import { Pinecone } from "@pinecone-database/pinecone";

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "", // Add your Pinecone API key to environment variables
});

// Function to get or create a Pinecone index
async function getPineconeIndex(indexName: string, dimension: number = 768) {
  try {
    // Check if the index already exists
    const indexList = await pinecone.listIndexes();
    const indexExists = indexList.indexes?.some((index) => index.name === indexName);

    if (!indexExists) {
      // Create a new index if it doesn't exist
      await pinecone.createIndex({
        name: indexName,
        dimension: dimension, // Set dimension to 768 for Gemini embeddings
        metric: "cosine", // Use cosine similarity for embeddings
        spec: {
          serverless: {
            cloud: "aws", // or "gcp" depending on your Pinecone setup
            region: "us-west-2", // Adjust region as needed
          },
        },
      });

      // console.log(`Created new Pinecone index: ${indexName}`);
    } else {
      console.log(`Using existing Pinecone index: ${indexName}`);
    }

    // Return the index
    return pinecone.Index(indexName);
  } catch (error) {
    console.error("Error initializing Pinecone index:", error);
    throw error;
  }
}

// Function to get the Pinecone client
export function getPineconeClient() {
  return pinecone;
}

// Function to get the Pinecone index (for Gemini embeddings)
export async function getPineconeIndexForGemini() {
  const indexName = "chatdocs"; // Use a specific index for Gemini
  const dimension = 768; // Gemini embeddings have 768 dimensions
  return await getPineconeIndex(indexName, dimension);
}