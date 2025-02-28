import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { getPineconeIndexForGemini } from "@/lib/pinecone";

const f = createUploadthing();

export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: "4MB" } })
    .middleware(async ({ req }) => {
      const { getUser } = getKindeServerSession();
      const user = await getUser();

      if (!user || !user.id) throw new Error("Unauthorized");

      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const createdFile = await db.file.create({
        data: {
          key: file.key,
          name: file.name,
          userId: metadata.userId,
          url: file.ufsUrl,
          uploadStatus: "PROCESSING",
        },
      });

      try {
        // console.log("checking my file id id corrent or ", file.ufsUrl);
        const response = await fetch(file.ufsUrl);
        const blob = await response.blob();

        const loader = new PDFLoader(blob);
        const pageLevelDocs = await loader.load();
        // const pagesAmt = pageLevelDocs.length;

        //vectorize and index entire document
        // const pineconeIndex = await getPineconeIndexForGemini();
        // console.log("Pinecone index initialized:", pineconeIndex);

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: "embedding-001" });

try {
  const embeddingData = await Promise.all(
    pageLevelDocs.map(async (doc, index) => ({
      id: `${createdFile.id}_${index}`,
      values: (await model.embedContent(doc.pageContent)).embedding.values,
      metadata: { page: index, fileId: createdFile.id }
    }))
  );

  // console.log("Embedding Data:", embeddingData);

  const pineconeIndex = await getPineconeIndexForGemini();
  // console.log("Pinecone Index:", pineconeIndex);

  // Set namespace (if needed)
  //@ts-ignore
  pineconeIndex.namespace = createdFile.id;

  // Upsert vectors directly (Pinecone v1)
  await pineconeIndex.upsert(
    embeddingData.map((vector) => ({
      id: vector.id,
      values: vector.values,
      metadata: vector.metadata
    }))
  );

  console.log("Upsert successful");
} catch (error) {
  console.error("Error during upsert:", error);
  throw error;
}




        // ✅ Convert PDF text into embeddings
        // const embeddingData = await Promise.all(
        //   pageLevelDocs.map(async (doc, index) => ({
        //     id: `${createdFile.id}_${index}`, // Unique ID per page
        //     values: (
        //       await model.embedContent(doc.pageContent)
        //     ).embedding.values, // ✅ Gemini Embedding API
        //     metadata: { page: index, fileId: createdFile.id },
        //   }))
        // );

        // console.log(
        //   "Display the embedding data ",
        //   embeddingData
        // );
        // console.log(
        //   "Display my open ai key wheater it is right or not",
        //   typeof embeddingData
        // );
        

        // //check the error data 24 feb
        // await pineconeIndex.upsert({
          //@ts-ignore
        //   namespace:createdFile.id, // ✅ Correct way to specify namespace
        //   vectors: embeddingData.map((vector) => ({
        //     id: vector.id, // Ensure each vector has a unique ID
        //     values: vector.values, // Correctly reference `values`
        //     metadata: vector.metadata, // Include metadata
        //   })),
        // });

        // console.log(
        //   "Just checking the pincecone  index is imported or not",
        //   pineconeIndex
        // );
        await db.file.update({
          data: {
            uploadStatus: "SUCCESS",
          },
          where: {
            id: createdFile.id,
          },
        });
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
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

// `https://uploadthing-prod.s3.us-west-2.amazonaws.com/${file.key}`
