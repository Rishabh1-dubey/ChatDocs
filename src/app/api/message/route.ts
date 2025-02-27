import { db } from "@/db";
import { getPineconeIndexForGemini } from "@/lib/pinecone";
import { SendMessageValidator } from "@/lib/SendMessageValidator";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
  // Endpoint for asking a question to a PDF file
  const body = await req.json();

  // Step 1: Authenticate the user
  const { getUser } = getKindeServerSession();
  const user = await getUser();
  const { id: userId } = user;

  if (!userId) return new Response("Unauthorized", { status: 401 });

  // Step 2: Validate the request body
  const { fileId, message } = SendMessageValidator.parse(body);

  // Step 3: Fetch the file from the database
  const file = await db.file.findFirst({
    where: {
      id: fileId,
      userId,
    },
  });

  if (!file) return new Response("Not Found", { status: 404 });

  // Step 4: Save the user's message to the database
  await db.message.create({
    data: {
      text: message,
      isUserMessage: true,
      userId,
      fileId,
    },
  });

  // Step 5: Initialize the Gemini Model
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "embedding-001" });

  try {
    // Step 6: Vectorize the message
    const embeddingResponse = await model.embedContent(message);
    const embeddingVector = embeddingResponse.embedding.values;

    // Step 7: Upsert the vectorized message into Pinecone
    const pineconeIndex = await getPineconeIndexForGemini();
    await pineconeIndex.upsert([
      {
        id: `message_${Date.now()}`, // Unique ID for the message
        values: embeddingVector, // Embedding vector
        metadata: {
          fileId: fileId, // Associate with the file
          userId: userId, // Associate with the user
          text: message, // Optional: Store the original message text
        },
      },
    ]);


    // Step 8: Query Pinecone for similar vectors (context)
    const queryResponse = await pineconeIndex.query({
      topK: 4, // Number of similar vectors to retrieve
      vector: embeddingVector, // Query vector (the vectorized message)
      filter: { fileId: file.id }, // Filter by fileId
    });

    // Extract the context from Pinecone results
    const context = queryResponse.matches
      .map((match) => match.metadata?.text)
      .join("\n\n");
    // Step 9: Fetch previous messages for context
    const prevMessages = await db.message.findMany({
      where: {
        fileId,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 6, // Fetch the last 6 messages
    });

    // Format previous messages for Gemini
    const formattedPrevMessages = prevMessages.map((msg) => ({
      role: msg.isUserMessage ? "user" : "assistant",
      content: msg.text,
    }));

    // console.log("Previous Messages:", formattedPrevMessages);

    // Step 10: Initialize Gemini for chat
    const chatModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Step 11: Generate a response using Gemini
   const chat = chatModel.startChat({
  history: [
    ...formattedPrevMessages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    })),
    { role: "user", parts: [{ text: message }] }, // Ensure new message is included
  ],
});

    const prompt = `
      Use the following pieces of context (or previous conversation if needed) to answer the user's question in markdown format.\nIf
      If you don't know the answer, just say that you don't know, don't try to make up an answer.

      PREVIOUS CONVERSATION:
      ${formattedPrevMessages
        .map((message) => {
          if (message.role === "user") return `User: ${message.content}\n`;
          return `Assistant: ${message.content}\n`;
        })
        .join("")}

      CONTEXT:
      ${context}

      USER INPUT: ${message}
    `;

    const response = await chat.sendMessage(prompt);

    // Step 12: Extract the generated text
    const completion = await response.response.text(); // Ensure `completion` is a string
    // console.log("Generated Response:", completion);

    // Step 13: Save the assistant's response to the database
    await db.message.create({
      data: {
        text: completion, // Save the assistant's response
        isUserMessage: false, // Mark as assistant's message
        userId,
        fileId,
      },
    });

    // Step 14: Return the response
    return new Response(completion, { status: 200 });
  } catch (error) {
    console.error("Error processing message:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};