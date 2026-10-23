import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const btnBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variants = {
  primary: "bg-primary text-primary-fg hover:opacity-90",
  secondary: "border-2 border-border bg-surface text-fg hover:bg-surface-2",
  ghost: "text-fg underline underline-offset-4 hover:opacity-70",
  danger: "border-2 border-dashed border-fg bg-surface text-fg hover:bg-surface-2",
} as const;

type Variant = keyof typeof variants;

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button className={cx(btnBase, variants[variant], className)} disabled={rest.disabled || loading} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "primary", className, children, ...rest }: { href: string; variant?: Variant; className?: string; children: ReactNode } & Omit<React.ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={cx(btnBase, variants[variant], className)} {...rest}>
      {children}
    </Link>
  );
}

const field = "w-full rounded-xl border-2 border-border bg-surface px-3 py-2.5 text-base text-fg placeholder:text-muted";

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-err`} className="flex items-start gap-1.5 text-sm font-medium">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

const describe = (id: string, error?: string, hint?: string) =>
  error ? `${id}-err` : hint ? `${id}-hint` : undefined;

export function TextInput({ id, label, error, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string; hint?: string }) {
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <input id={id} name={id} className={cx(field, error && "border-dashed border-fg")} aria-invalid={!!error} aria-describedby={describe(id, error, hint)} {...rest} />
    </Field>
  );
}

export function TextArea({ id, label, error, hint, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; label: string; error?: string; hint?: string }) {
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <textarea id={id} name={id} rows={4} className={cx(field, error && "border-dashed border-fg")} aria-invalid={!!error} aria-describedby={describe(id, error, hint)} {...rest} />
    </Field>
  );
}

export function SelectInput({
  id,
  label,
  error,
  hint,
  options,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { id: string; label: string; error?: string; hint?: string; options: { value: string; label: string }[] }) {
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <select id={id} name={id} className={cx(field, error && "border-dashed border-fg")} aria-invalid={!!error} aria-describedby={describe(id, error, hint)} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Checkbox({ id, label, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { id: string; label: ReactNode }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
      <input id={id} name={id} type="checkbox" className="size-5 accent-[var(--primary)]" {...rest} />
      <span>{label}</span>
    </label>
  );
}

/** Pesan status. Dibedakan lewat ikon, teks, dan pola garis, bukan warna. */
export function Notice({ kind = "info", children }: { kind?: "info" | "error" | "success"; children: ReactNode }) {
  const Icon = kind === "error" ? AlertCircle : kind === "success" ? CheckCircle2 : Info;
  const label = kind === "error" ? "Kesalahan" : kind === "success" ? "Berhasil" : "Informasi";
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cx(
        "flex items-start gap-3 rounded-xl border-2 p-4 text-sm",
        kind === "error" ? "border-dashed border-fg bg-surface-2" : kind === "success" ? "border-solid border-fg bg-surface" : "border-border bg-surface-2",
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <span className="sr-only">{label}: </span>
        {children}
      </div>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-card border border-border bg-surface p-5 shadow-[var(--shadow)]", className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-xl bg-surface-2", className)} />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border-2 border-dashed border-border p-10 text-center">
      <p className="text-lg font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("mx-auto w-full max-w-[1200px] px-4 md:px-6", className)}>{children}</div>;
}
