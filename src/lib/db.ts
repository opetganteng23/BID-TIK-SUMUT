import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "@/lib/env";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const g = globalThis as unknown as { __mongoose?: Cache };
const cache: Cache = (g.__mongoose ??= { conn: null, promise: null });

const connect = () => {
  const { MONGODB_URI, MONGODB_DB } = env();
  return mongoose.connect(MONGODB_URI, {
    dbName: MONGODB_DB,
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    bufferCommands: false,
  });
};

/** Gagal mencari DNS SRV (alamat mongodb+srv://), mis. resolver jaringan lokal tidak menjawab SRV. */
const isSrvDnsError = (err: unknown) => {
  const e = err as { syscall?: string; code?: string };
  return e?.syscall === "querySrv" || (e?.code === "ECONNREFUSED" && String(err).includes("_mongodb._tcp"));
};

export async function connectDb() {
  if (cache.conn) return cache.conn;
  cache.promise ??= connect().catch((err) => {
    if (!isSrvDnsError(err)) throw err;
    // Fallback sekali: pakai DNS publik lalu coba lagi. Tidak pernah terpicu bila DNS normal (mis. di Vercel).
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    return connect();
  });
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
