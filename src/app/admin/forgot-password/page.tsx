import type { Metadata } from "next";
import { ForgotForm } from "@/components/admin/AuthForms";

export const metadata: Metadata = { title: "Lupa password" };

export default function Page() {
  return <ForgotForm />;
}
