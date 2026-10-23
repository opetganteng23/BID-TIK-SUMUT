"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ApiClientError, api } from "@/components/api";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/site/Brand";
import { Button, Notice, TextInput } from "@/components/ui";

function useSubmit<T>(fn: (fd: FormData) => Promise<T>, onOk: (r: T) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; fields?: Record<string, string> } | null>(null);
  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onOk(await fn(new FormData(e.currentTarget)));
    } catch (err) {
      const c = err instanceof ApiClientError ? err : null;
      setError({ message: c?.message ?? "Terjadi kesalahan.", fields: c?.fields });
      requestAnimationFrame(() => document.getElementById("auth-error")?.focus());
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, handle, setError };
}

function Shell({ title, children, back = { href: "/", label: "Kembali ke beranda" } }: { title: string; children: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-6 px-4 py-10">
      <Brand name="BID TIK Polda Sumatera Utara" />
      <div className="w-full max-w-md rounded-[20px] border border-border bg-surface p-6 shadow-[var(--shadow)] md:p-8">
        <h1 className="mb-6 text-3xl">{title}</h1>
        {children}
      </div>
      <Link href={back.href} className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-border px-5 text-sm font-medium hover:bg-surface-2">
        <ArrowLeft className="size-4" aria-hidden /> {back.label}
      </Link>
    </div>
  );
}

const ErrorBox = ({ error }: { error: { message: string } | null }) =>
  error ? (
    <div id="auth-error" tabIndex={-1} className="outline-none">
      <Notice kind="error">{error.message}</Notice>
    </div>
  ) : null;

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [challenge, setChallenge] = useState<string | null>(null);

  const go = (mustChange: boolean) => {
    const target = mustChange ? "/admin/change-password" : next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
    router.replace(target);
    router.refresh();
  };

  const login = useSubmit(
    (fd) => api<{ otpRequired: boolean; challenge?: string; mustChangePassword?: boolean }>("/api/auth/login", { body: { email: fd.get("email"), password: fd.get("password") } }),
    (r) => (r.otpRequired && r.challenge ? setChallenge(r.challenge) : go(!!r.mustChangePassword)),
  );
  const otp = useSubmit(
    (fd) => api<{ mustChangePassword: boolean }>("/api/auth/otp/verify", { body: { challenge, code: fd.get("code") } }),
    (r) => go(r.mustChangePassword),
  );

  if (challenge) {
    return (
      <Shell title="Verifikasi kode">
        <form onSubmit={otp.handle} className="space-y-4" noValidate>
          <p className="text-sm text-muted">Kami mengirim kode 6 digit ke email Anda. Kode berlaku 5 menit.</p>
          <ErrorBox error={otp.error} />
          <TextInput id="code" label="Kode verifikasi" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
          <Button type="submit" loading={otp.busy} className="w-full">Verifikasi</Button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell title="Masuk admin">
      <form onSubmit={login.handle} className="space-y-4" noValidate>
        <ErrorBox error={login.error} />
        <TextInput id="email" label="Email" type="email" autoComplete="username" required />
        <TextInput id="password" label="Password" type="password" autoComplete="current-password" required />
        <Button type="submit" loading={login.busy} className="w-full">Masuk</Button>
        <p className="text-center text-sm"><Link href="/admin/forgot-password" className="underline underline-offset-4">Lupa password?</Link></p>
      </form>
    </Shell>
  );
}

export function ForgotForm() {
  const [done, setDone] = useState(false);
  const f = useSubmit((fd) => api("/api/auth/forgot", { body: { email: fd.get("email") } }), () => setDone(true));
  return (
    <Shell title="Lupa password">
      {done ? (
        <Notice kind="success">Jika email terdaftar, tautan reset telah dikirim. Tautan berlaku 30 menit.</Notice>
      ) : (
        <form onSubmit={f.handle} className="space-y-4" noValidate>
          <ErrorBox error={f.error} />
          <TextInput id="email" label="Email" type="email" autoComplete="email" required />
          <Button type="submit" loading={f.busy} className="w-full">Kirim tautan reset</Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm"><Link href="/admin/login" className="underline underline-offset-4">Kembali ke halaman masuk</Link></p>
    </Shell>
  );
}

export function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const f = useSubmit(
    (fd) => {
      if (fd.get("newPassword") !== fd.get("confirm")) throw new ApiClientError("Konfirmasi password tidak sama.", "VALIDATION_ERROR", 400);
      return api("/api/auth/reset", { body: { token, newPassword: fd.get("newPassword") } });
    },
    () => router.replace("/admin/login?reset=1"),
  );
  return (
    <Shell title="Atur password baru">
      <form onSubmit={f.handle} className="space-y-4" noValidate>
        <ErrorBox error={f.error} />
        <TextInput id="newPassword" label="Password baru" type="password" autoComplete="new-password" hint="Minimal 12 karakter." required />
        <TextInput id="confirm" label="Ulangi password baru" type="password" autoComplete="new-password" required />
        <Button type="submit" loading={f.busy} className="w-full">Simpan password</Button>
      </form>
    </Shell>
  );
}

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const f = useSubmit(
    (fd) => {
      if (fd.get("newPassword") !== fd.get("confirm")) throw new ApiClientError("Konfirmasi password tidak sama.", "VALIDATION_ERROR", 400);
      return api("/api/auth/change-password", { body: { currentPassword: fd.get("currentPassword"), newPassword: fd.get("newPassword") } });
    },
    () => {
      router.replace("/admin");
      router.refresh();
    },
  );
  return (
    <Shell title="Ganti password" back={forced ? { href: "/", label: "Kembali ke beranda" } : { href: "/admin", label: "Kembali ke dashboard" }}>
      {forced && <div className="mb-4"><Notice kind="info">Demi keamanan, Anda wajib mengganti password sebelum memakai panel admin.</Notice></div>}
      <form onSubmit={f.handle} className="space-y-4" noValidate>
        <ErrorBox error={f.error} />
        <TextInput id="currentPassword" label="Password saat ini" type="password" autoComplete="current-password" required error={f.error?.fields?.currentPassword} />
        <TextInput id="newPassword" label="Password baru" type="password" autoComplete="new-password" hint="Minimal 12 karakter." required error={f.error?.fields?.newPassword} />
        <TextInput id="confirm" label="Ulangi password baru" type="password" autoComplete="new-password" required />
        <Button type="submit" loading={f.busy} className="w-full">Simpan password</Button>
      </form>
    </Shell>
  );
}
