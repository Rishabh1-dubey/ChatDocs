import { db } from "@/db";
import { getPineconeIndexForGemini } from "@/lib/pinecone";
import { SendMessageValidator } from "@/lib/SendMessageValidator";
import { GoogleGenAI } from "@google/genai";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
  const body = await req.json();

  const { getUser } = getKindeServerSession();
  const user = await getUser();
  if (!user || !user.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = user.id;

  const { fileId, message } = SendMessageValidator.parse(body);

  const file = await db.file.findFirst({
    where: {
      id: fileId,
      userId,
    },
  });

  if (!file) return new Response("Not Found", { status: 404 });

  await db.message.create({
    data: {
      text: message,
      isUserMessage: true,
      userId,
      fileId,
    },
  });

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  // try {
  //   const modelsResponse = await genAI.models.list();
  //   console.log("---- AVAILABLE MODELS LIST START ----");
  //   console.log(modelsResponse);
  //   console.log("---- AVAILABLE MODELS LIST END ----");
  // } catch (error) {
  //   console.log("List Models Error:", error);
  // }
  try {
    // FREE Embedding Model
    const embeddingResponse = await genAI.models.embedContent({
      model: "models/text-embedding-004", // FREE
      contents: [
        {
          parts: [{ text: message }],
        },
      ],
    });

    const embeddingVector = embeddingResponse.embeddings?.[0]?.values;

    if (!embeddingVector) {
      throw new Error("Failed to generate embedding for message");
    }

    const pineconeIndex = await getPineconeIndexForGemini();

    const queryResponse = await pineconeIndex.query({
      topK: 5,
      vector: embeddingVector,
      filter: { fileId: { $eq: file.id } },
      includeMetadata: true,
    });

    const context = queryResponse.matches
      .map((match) => match.metadata?.text)
      .join("\n\n");

    const prevMessages = await db.message.findMany({
      where: { fileId },
      orderBy: { createdAt: "asc" },
      take: 6,
    });

    const formattedPrevMessages = prevMessages.map((msg) => ({
      role: msg.isUserMessage ? "user" : "assistant",
      content: msg.text,
    }));

    const prompt = `
      You are a highly intelligent assistant whose purpose is to answer questions based *only* on the provided document context.

      **Your instructions are absolute:**
      1.  Analyze the "CONTEXT FROM PDF" below.
      2.  Your answer must be directly and genuinely derived from this context.
      3.  Do not add, infer, or fabricate any information that is not explicitly stated in the context.
      4.  If the context does not contain the answer to the question, you must respond with the exact phrase: "I could not find an answer to that in this document."
      5.  Do not use any of your outside knowledge. Your world is only this document.

      PREVIOUS CONVERSATION:
      ${formattedPrevMessages
        .map((message) => {
          if (message.role === "user") return `User: ${message.content}\n`;
          return `Assistant: ${message.content}\n`;
        })
        .join("")}

      CONTEXT FROM PDF:
      ${context}

      USER QUESTION: ${message}
    `;

    // Use FREE Gemini Flash model
    const result = await genAI.models.generateContent({
      model: "models/gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    const completion = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!completion) {
      throw new Error("No response content generated");
    }

    await db.message.create({
      data: {
        text: completion,
        isUserMessage: false,
        userId,
        fileId,
      },
    });

    return new Response(completion, { status: 200 });
  } catch (error) {
    console.error("Error processing message:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
