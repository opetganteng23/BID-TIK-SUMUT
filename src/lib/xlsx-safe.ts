/** Mencegah formula injection: sel teks berawalan = + - @ tab atau CR diberi awalan apostrof. */
export function safeCell(value: unknown): string | number | Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === "number") return value;
  const s = String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function safeFileName(base: string): string {
  return base.replace(/[^\w.-]+/g, "_").slice(0, 80);
}
