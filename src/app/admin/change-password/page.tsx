import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/admin/AuthForms";
import { requirePage } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "Ganti password" };

export default async function Page() {
  const user = await requirePage(undefined, { allowPasswordChange: true });
  return <ChangePasswordForm forced={user.mustChangePassword} />;
}
