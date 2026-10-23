import mongoose from "mongoose";
import { env } from "@/lib/env";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const g = globalThis as unknown as { __mongoose?: Cache };
const cache: Cache = (g.__mongoose ??= { conn: null, promise: null });

export async function connectDb() {
  if (cache.conn) return cache.conn;
  const { MONGODB_URI, MONGODB_DB } = env();
  cache.promise ??= mongoose.connect(MONGODB_URI, {
    dbName: MONGODB_DB,
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    bufferCommands: false,
  });
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
