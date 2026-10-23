import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guard";
import { can } from "@/lib/rbac";
import { MediaLibrary } from "@/components/admin/MediaPicker";

export const metadata: Metadata = { title: "Media" };

export default async function Page() {
  const user = await requirePage("media.upload");
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Media</h1>
      <MediaLibrary manage={can(user.role, "media.delete")} />
    </div>
  );
}
