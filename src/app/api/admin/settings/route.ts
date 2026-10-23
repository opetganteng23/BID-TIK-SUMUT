import { z } from "zod";
import { ApiError, assertSameOrigin, clientIp, ok, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { SiteSettings } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { revalidate, DEFAULT_MENU, DEFAULT_SECTIONS } from "@/lib/settings";
import { linkUrl, optionalHttpsUrl, httpsUrl } from "@/lib/schemas";

const menuLeaf = z.object({ label: z.string().min(1).max(60), href: linkUrl, openInNewTab: z.boolean(), enabled: z.boolean() }).strict();

const schema = z
  .object({
    // identitas (super admin)
    siteName: z.string().min(1).max(120),
    tagline: z.string().max(200),
    orgName: z.string().max(200),
    logoLight: optionalHttpsUrl,
    logoDark: optionalHttpsUrl,
    favicon: optionalHttpsUrl,
    maintenanceMode: z.boolean(),
    maintenanceMessage: z.string().max(500),
    // email (super admin). Kredensial SMTP hanya di env.
    email: z
      .object({
        contactRecipients: z.array(z.string().email()).max(10),
        emailSubjectPrefix: z.string().max(40),
        otpEnabled: z.boolean(),
      })
      .strict(),
    // layout (admin dan super admin)
    menu: z.array(menuLeaf.extend({ children: z.array(menuLeaf).max(12) })).max(12),
    sections: z
      .array(
        z
          .object({
            key: z.enum(["hero", "about", "news", "features"]),
            enabled: z.boolean(),
            order: z.number().int().min(0).max(20),
            title: z.string().max(120),
            subtitle: z.string().max(300),
          })
          .strict(),
      )
      .max(4),
    newsHomeCount: z.number().int().min(1).max(24),
    newsHomeCategory: z.string().max(100).optional(),
    marquees: z
      .array(
        z
          .object({
            id: z.string().min(1).max(40),
            after: z.enum(["hero", "about", "news", "features"]),
            enabled: z.boolean(),
            speed: z.number().min(10).max(200),
            direction: z.enum(["left", "right"]),
            height: z.number().int().min(32).max(160),
            items: z
              .array(
                z
                  .object({
                    type: z.enum(["text", "logo"]),
                    text: z.string().max(120).optional(),
                    logo: optionalHttpsUrl,
                    alt: z.string().max(120).optional(),
                    href: z.union([linkUrl, z.literal("")]).optional(),
                  })
                  .strict(),
              )
              .max(40),
          })
          .strict(),
      )
      .max(6),
    footer: z
      .object({
        about: z.string().max(600),
        address: z.string().max(300),
        phones: z.array(z.string().max(30)).max(6),
        emails: z.array(z.string().email()).max(6),
        hours: z.string().max(200),
        mapEmbedUrl: z.union([httpsUrl, z.literal("")]).optional(),
        quickLinks: z.array(z.object({ label: z.string().max(60), href: linkUrl }).strict()).max(12),
        socials: z.array(z.object({ label: z.string().max(40), href: linkUrl }).strict()).max(8),
        copyright: z.string().max(200),
      })
      .strict(),
    seo: z
      .object({
        defaultTitle: z.string().max(120),
        titleTemplate: z.string().max(120).includes("%s", { message: "Templat harus memuat %s." }),
        defaultDescription: z.string().max(300),
        ogImage: optionalHttpsUrl,
        robotsIndex: z.boolean(),
      })
      .strict(),
    accessibility: z
      .object({
        defaultTheme: z.enum(["light", "dark", "system"]),
        defaultFontScale: z.number().min(0.875).max(1.5),
        ttsEnabled: z.boolean(),
        ttsDefaultLang: z.string().max(10),
      })
      .strict(),
  })
  .partial()
  .strict();

const REQUIRED: Record<string, Permission> = {
  siteName: "settings.identity",
  tagline: "settings.identity",
  orgName: "settings.identity",
  logoLight: "settings.identity",
  logoDark: "settings.identity",
  favicon: "settings.identity",
  maintenanceMode: "settings.identity",
  maintenanceMessage: "settings.identity",
  email: "settings.identity",
  menu: "settings.layout",
  sections: "settings.layout",
  newsHomeCount: "settings.layout",
  newsHomeCategory: "settings.layout",
  marquees: "settings.layout",
  footer: "settings.layout",
  seo: "settings.layout",
  accessibility: "settings.layout",
};

async function load() {
  await connectDb();
  return SiteSettings.findOneAndUpdate(
    { key: "singleton" },
    { $setOnInsert: { key: "singleton", menu: DEFAULT_MENU, sections: DEFAULT_SECTIONS } },
    { upsert: true, new: true },
  ).lean();
}

export const GET = route(async ({ requestId }) => {
  const user = await requireUser("settings.layout");
  const doc = await load();
  // Pengguna tanpa hak identitas tidak menerima konfigurasi email.
  if (!can(user.role, "settings.identity") && doc) delete (doc as { email?: unknown }).email;
  return ok(doc, requestId);
});

export const PUT = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const user = await requireUser("settings.layout");
  const data = await readJson(req, schema, 500_000);
  for (const key of Object.keys(data)) {
    if (!can(user.role, REQUIRED[key])) throw new ApiError("FORBIDDEN", `Anda tidak boleh mengubah "${key}".`);
  }
  await load();
  const doc = await SiteSettings.findOneAndUpdate({ key: "singleton" }, { $set: data }, { new: true, runValidators: true }).lean();
  await audit({
    actorId: user.id,
    action: "settings.update",
    entity: "settings",
    summary: Object.keys(data).join(","),
    ip: clientIp(req),
    requestId,
  });
  revalidate("settings");
  return ok(doc, requestId);
});
