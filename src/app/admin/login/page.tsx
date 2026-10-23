import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/AuthForms";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.mustChangePassword ? "/admin/change-password" : "/admin");
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
