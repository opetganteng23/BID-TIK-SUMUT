export type ComplaintStatus =
  | "submitted"
  | "in_progress"
  | "waiting_reporter"
  | "awaiting_reporter_confirmation"
  | "closed";

export type ComplaintActor = "reporter" | "admin" | "system";

export const STATUS_LABEL: Record<ComplaintStatus, string> = {
  submitted: "Belum Diambil",
  in_progress: "Sedang Diproses",
  waiting_reporter: "Menunggu Informasi Pelapor",
  awaiting_reporter_confirmation: "Menunggu Konfirmasi Pelapor",
  closed: "Ditutup",
};

export const CONFIRMATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type Edge = { from: ComplaintStatus; to: ComplaintStatus; actors: ComplaintActor[] };

// Transisi minimum yang disetujui (MTS Section 29.5). Selain ini ditolak.
const EDGES: Edge[] = [
  { from: "submitted", to: "in_progress", actors: ["admin"] },
  { from: "in_progress", to: "waiting_reporter", actors: ["admin"] },
  { from: "waiting_reporter", to: "in_progress", actors: ["reporter"] },
  { from: "in_progress", to: "awaiting_reporter_confirmation", actors: ["admin"] },
  { from: "awaiting_reporter_confirmation", to: "closed", actors: ["reporter", "system"] },
  { from: "awaiting_reporter_confirmation", to: "in_progress", actors: ["reporter"] },
];

export function canTransition(from: ComplaintStatus, to: ComplaintStatus, actor: ComplaintActor): boolean {
  return EDGES.some((e) => e.from === from && e.to === to && e.actors.includes(actor));
}

export function allowedAdminTargets(from: ComplaintStatus): ComplaintStatus[] {
  return EDGES.filter((e) => e.from === from && e.actors.includes("admin")).map((e) => e.to);
}

export function confirmationDeadline(start: Date): Date {
  return new Date(start.getTime() + CONFIRMATION_WINDOW_MS);
}
