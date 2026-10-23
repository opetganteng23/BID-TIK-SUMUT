import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { connectDb } from "@/lib/db";
import { SiteSettings } from "@/lib/models";
import { DEFAULT_MENU, DEFAULT_SECTIONS } from "@/lib/settings";
import { can } from "@/lib/rbac";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata: Metadata = { title: "Site Settings" };

export default async function Page() {
  const user = await requirePage("settings.layout");
  await connectDb();
  const doc = await SiteSettings.findOneAndUpdate(
    { key: "singleton" },
    { $setOnInsert: { key: "singleton", menu: DEFAULT_MENU, sections: DEFAULT_SECTIONS } },
    { upsert: true, new: true },
  ).lean();
  const settings = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
  // Konfigurasi email hanya untuk peran yang berhak.
  if (!can(user.role, "settings.identity")) delete settings.email;
  return <SettingsForm role={user.role} settings={settings} />;
}
