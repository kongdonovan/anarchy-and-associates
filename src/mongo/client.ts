import clientPromise from "./mongo.js";
import { getEnvVar } from "./mongo.js";

const uri = getEnvVar("MONGO_URI");

export async function getDb(dbName = "myapp") {
  const client = await clientPromise;
  return client.db(dbName);
}
