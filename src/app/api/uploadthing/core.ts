import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
// 1. Correct Import
import { GoogleGenAI } from "@google/genai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { getPineconeIndexForGemini } from "@/lib/pinecone";
import { getUserSubscriptionPlan } from "@/lib/razorpay";
import { PLANS } from "@/config/razorpay";

const f = createUploadthing();

const middleware = async () => {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  if (!user || !user.id) throw new Error("Unauthorized");

  const subscriptionPlan = await getUserSubscriptionPlan();

  return { subscriptionPlan, userId: user.id };
};

const onUploadComplete = async ({
  metadata,
  file,
}: {
  metadata: Awaited<ReturnType<typeof middleware>>;
  file: {
    key: string;
    name: string;
    url: string;
  };
}) => {
  console.log("[UPLOAD] - onUploadComplete started for file:", file.name);
  const isFileExist = await db.file.findFirst({
    where: {
      key: file.key,
    },
  });
  if (isFileExist) {
    console.log("[UPLOAD] - File already exists. Aborting.");
    return;
  }

  const createdFile = await db.file.create({
    data: {
      key: file.key,
      name: file.name,
      userId: metadata.userId,
      url: file.url,
      uploadStatus: "PROCESSING",
    },
  });
  console.log(
    `[UPLOAD] - Created file record in DB with ID: ${createdFile.id}`
  );

  try {
    console.log("Fetching file from url:", file.url);
    const response = await fetch(file.url);
    const blob = await response.blob();

    const loader = new PDFLoader(blob);
    const pageLevelDocs = await loader.load();

    const pagesAmt = pageLevelDocs.length;
    console.log(`[UPLOAD] - PDF loaded successfully. Found ${pagesAmt} pages.`);

    const { subscriptionPlan } = metadata;
    const { isSubscribed } = subscriptionPlan;

    const isProExceeded =
      pagesAmt > PLANS.find((plan) => plan.name === "Pro")!.pagesPerPdf;
    const isFreeExceeded =
      pagesAmt > PLANS.find((plan) => plan.name === "Free")!.pagesPerPdf;

    if ((isSubscribed && isProExceeded) || (!isSubscribed && isFreeExceeded)) {
      console.log("[UPLOAD] - Page limit exceeded. Marking file as FAILED.");
      await db.file.update({
        data: {
          uploadStatus: "FAILED",
        },
        where: {
          id: createdFile.id,
        },
      });
      return;
    }

    console.log("[UPLOAD] - Starting embedding process...");

    // 2. Initialize New SDK
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    try {
      const embeddingData = await Promise.all(
        pageLevelDocs.map(async (doc, index) => {
          // 3. FIX: Use 'contents' (plural) and correct structure
          const result = await genAI.models.embedContent({
            model: "text-embedding-004",
            contents: [
              {
                parts: [{ text: doc.pageContent }],
              },
            ],
          });

          // 4. FIX: Handle 'possibly undefined' error
          const values = result.embeddings?.[0]?.values;

          if (!values) {
            throw new Error(`Failed to generate embedding for page ${index}`);
          }

          return {
            id: `${createdFile.id}_${index}`,
            values: values,
            metadata: {
              page: index,
              fileId: createdFile.id,
              userId: metadata.userId,
              text: doc.pageContent,
            },
          };
        })
      );

      console.log(
        `[UPLOAD] - Successfully created ${embeddingData.length} embeddings.`
      );

      console.log("[UPLOAD] - Connecting to Pinecone and upserting vectors...");
      const pineconeIndex = await getPineconeIndexForGemini();

      // 5. FIX: Simplified Upsert (Removed double upsert & fixed types)
      // We map specifically to ensure Typescript knows this matches the Pinecone Record type
      await pineconeIndex.upsert(
        embeddingData.map((vector) => ({
          id: vector.id,
          values: vector.values,
          metadata: {
            ...vector.metadata,
            page: vector.metadata.page, // Explicitly passing number
            text: vector.metadata.text, // Explicitly passing string
          },
        }))
      );

      console.log("[UPLOAD] - Upsert successful");
    } catch (error) {
      console.error("Error during upsert:", error);
      throw error;
    }

    await db.file.update({
      data: {
        uploadStatus: "SUCCESS",
      },
      where: {
        id: createdFile.id,
      },
    });
    console.log("[UPLOAD] - Marked file as SUCCESS in DB.");
  } catch (error) {
    console.log(error);
    await db.file.update({
      data: {
        uploadStatus: "FAILED",
      },
      where: {
        id: createdFile.id,
      },
    });
  }
};

export const ourFileRouter = {
  freePlanUploader: f({ pdf: { maxFileSize: "8MB" } })
    .middleware(middleware)
    .onUploadComplete(onUploadComplete),
  proPlanUploader: f({ pdf: { maxFileSize: "16MB" } })
    .middleware(middleware)
    .onUploadComplete(onUploadComplete),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
