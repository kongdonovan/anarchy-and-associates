import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();
const uri = process.env.MONGO_URI!;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!global._mongoClient) {
  client = new MongoClient(uri, options);
  global._mongoClient = client;
  global._mongoClientPromise = client.connect();
}

clientPromise = global._mongoClientPromise!;

export default clientPromise;

// Utility: Centralized config loader for environment variables
export function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
}
