import nodemailer from "nodemailer";
import { env } from "@/lib/env";

let transport: ReturnType<typeof nodemailer.createTransport> | undefined;

function getTransport() {
  const e = env();
  if (!e.MAIL_USER || !e.MAIL_APP_PASSWORD) throw new Error("SMTP belum dikonfigurasi");
  transport ??= nodemailer.createTransport({
    host: e.MAIL_HOST,
    port: e.MAIL_PORT,
    secure: e.MAIL_PORT === 465,
    auth: { user: e.MAIL_USER, pass: e.MAIL_APP_PASSWORD },
  });
  return transport;
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Templat monokrom dengan versi teks polos. Semua teks pengguna wajib di-escape sebelum masuk. */
export function renderEmail(opts: { title: string; paragraphs: string[]; action?: { label: string; url: string } }) {
  const html = `<!doctype html><html lang="id"><body style="margin:0;background:#f7f7f8;font-family:Arial,Helvetica,sans-serif;color:#0a0a0b">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e4e4e7;border-radius:12px"><tr><td style="padding:32px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(opts.title)}</h1>
${opts.paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 12px">${escapeHtml(p)}</p>`).join("")}
${opts.action ? `<p style="margin:24px 0"><a href="${escapeHtml(opts.action.url)}" style="background:#111113;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px">${escapeHtml(opts.action.label)}</a></p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
  const text = [opts.title, "", ...opts.paragraphs, ...(opts.action ? ["", `${opts.action.label}: ${opts.action.url}`] : [])].join("\n");
  return { html, text };
}

export type MailInput = { to: string | string[]; subject: string; html: string; text: string; replyTo?: string };

/** Wajib di-await sebelum respons dikirim (serverless). Melempar error bila gagal; pemanggil yang memutuskan penanganan. */
export async function sendMail(input: MailInput) {
  const e = env();
  await getTransport().sendMail({
    from: `"${e.MAIL_FROM_NAME}" <${e.MAIL_USER}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });
}
