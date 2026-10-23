import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { connectDb } from "@/lib/db";
import { About } from "@/lib/models";
import { AboutForm } from "@/components/admin/AboutForm";

export const metadata: Metadata = { title: "About" };

export default async function Page() {
  await requirePage("content.manage");
  await connectDb();
  const doc = await About.findOneAndUpdate({ key: "singleton" }, { $setOnInsert: { key: "singleton" } }, { upsert: true, new: true }).lean();
  return <AboutForm initial={JSON.parse(JSON.stringify(doc))} />;
}
