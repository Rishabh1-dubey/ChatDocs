import { db } from "@/db";
import { getPineconeIndexForGemini } from "@/lib/pinecone";
import { SendMessageValidator } from "@/lib/SendMessageValidator";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
  const body = await req.json();

  const { getUser } = getKindeServerSession();
  const user = await getUser();
  const { id: userId } = user;

  if (!userId) return new Response("Unauthorized", { status: 401 });

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

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "embedding-001" });

  try {
    const embeddingResponse = await model.embedContent(message);
    const embeddingVector = embeddingResponse.embedding.values;

    const pineconeIndex = await getPineconeIndexForGemini();
    
    const queryResponse = await pineconeIndex.query({
      topK: 5,
      vector: embeddingVector,
      filter: { fileId: { '$eq': file.id } },
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

    const chatModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // **THE FINAL, STRICTEST PROMPT FOR GENUINE AND RELEVANT ANSWERS**
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

    const result = await chatModel.generateContent(prompt);
    const completion = result.response.text();

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