import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "@/components/admin/AuthForms";

export const metadata: Metadata = { title: "Atur password baru", referrer: "no-referrer" };

export default function Page() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
