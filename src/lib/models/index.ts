import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

function define<T extends Schema>(name: string, schema: T): Model<InferSchemaType<T>> {
  return (models[name] as Model<InferSchemaType<T>>) || model<InferSchemaType<T>>(name, schema);
}

const opts = { timestamps: true } as const;
const seo = new Schema({ title: String, description: String, ogImage: String }, { _id: false });

export const User = define(
  "User",
  new Schema(
    {
      name: { type: String, required: true, maxlength: 120 },
      email: { type: String, required: true, unique: true, lowercase: true, trim: true },
      passwordHash: { type: String, required: true },
      role: { type: String, enum: ["super_admin", "admin", "editor"], required: true },
      isActive: { type: Boolean, default: true },
      sessionVersion: { type: Number, default: 0 },
      mustChangePassword: { type: Boolean, default: false },
      failedLogins: { type: Number, default: 0 },
      lockedUntil: Date,
      lastLoginAt: Date,
    },
    opts,
  ),
);

const menuItem = new Schema(
  {
    label: String,
    href: String,
    openInNewTab: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    children: [
      new Schema(
        { label: String, href: String, openInNewTab: { type: Boolean, default: false }, enabled: { type: Boolean, default: true } },
        { _id: false },
      ),
    ],
  },
  { _id: false },
);

export const SiteSettings = define(
  "SiteSettings",
  new Schema(
    {
      key: { type: String, default: "singleton", unique: true },
      siteName: { type: String, default: "BID TIK Polda Sumatera Utara" },
      tagline: { type: String, default: "" },
      orgName: { type: String, default: "" },
      logoLight: String,
      logoDark: String,
      favicon: String,
      menu: { type: [menuItem], default: [] },
      sections: {
        type: [
          new Schema(
            { key: { type: String, enum: ["hero", "about", "news", "features"] }, enabled: Boolean, order: Number, title: String, subtitle: String },
            { _id: false },
          ),
        ],
        default: [],
      },
      newsHomeCount: { type: Number, default: 6 },
      newsHomeCategory: String,
      marquees: {
        type: [
          new Schema(
            {
              id: String,
              after: String,
              enabled: { type: Boolean, default: true },
              speed: { type: Number, default: 40 },
              direction: { type: String, enum: ["left", "right"], default: "left" },
              height: { type: Number, default: 56 },
              items: [
                new Schema(
                  { type: { type: String, enum: ["text", "logo"] }, text: String, logo: String, alt: String, href: String },
                  { _id: false },
                ),
              ],
            },
            { _id: false },
          ),
        ],
        default: [],
      },
      footer: {
        about: String,
        address: String,
        phones: [String],
        emails: [String],
        hours: String,
        mapEmbedUrl: String,
        quickLinks: [new Schema({ label: String, href: String }, { _id: false })],
        socials: [new Schema({ label: String, href: String }, { _id: false })],
        copyright: String,
      },
      seo: {
        defaultTitle: String,
        titleTemplate: { type: String, default: "%s | BID TIK Polda Sumut" },
        defaultDescription: String,
        ogImage: String,
        robotsIndex: { type: Boolean, default: false },
      },
      email: {
        contactRecipients: [String],
        emailSubjectPrefix: { type: String, default: "[BID TIK]" },
        otpEnabled: { type: Boolean, default: false },
      },
      accessibility: {
        defaultTheme: { type: String, enum: ["light", "dark", "system"], default: "system" },
        defaultFontScale: { type: Number, default: 1 },
        ttsEnabled: { type: Boolean, default: true },
        ttsDefaultLang: { type: String, default: "id-ID" },
      },
      maintenanceMode: { type: Boolean, default: false },
      maintenanceMessage: String,
    },
    opts,
  ),
);

export const HeroSlide = define(
  "HeroSlide",
  new Schema(
    {
      order: { type: Number, default: 0, index: true },
      enabled: { type: Boolean, default: true },
      mediaType: { type: String, enum: ["image", "video", "embed"], default: "image" },
      image: String,
      videoUrl: String,
      embedUrl: String,
      poster: String,
      title: { type: String, required: true },
      subtitle: String,
      description: String,
      alt: String,
      ctas: [new Schema({ label: String, href: String, style: { type: String, enum: ["primary", "secondary"], default: "primary" } }, { _id: false })],
    },
    opts,
  ),
);

export const About = define(
  "About",
  new Schema(
    {
      key: { type: String, default: "singleton", unique: true },
      title: { type: String, default: "Tentang Kami" },
      body: { type: String, default: "" },
      bodyJson: Schema.Types.Mixed,
      image: String,
      imageAlt: String,
      stats: [new Schema({ value: String, label: String }, { _id: false })],
    },
    opts,
  ),
);

export const NewsCategory = define(
  "NewsCategory",
  new Schema({ name: { type: String, required: true }, slug: { type: String, required: true, unique: true } }, opts),
);

const mediaItem = new Schema(
  { type: { type: String, enum: ["image", "video", "embed"] }, url: String, alt: String, caption: String },
  { _id: false },
);

export const News = define(
  "News",
  new Schema(
    {
      title: { type: String, required: true, maxlength: 200 },
      slug: { type: String, required: true, unique: true },
      excerpt: { type: String, maxlength: 400 },
      coverImage: String,
      coverAlt: String,
      media: [mediaItem],
      contentMode: { type: String, enum: ["richtext", "html", "html_raw"], default: "richtext" },
      contentJson: Schema.Types.Mixed,
      contentHtml: String,
      rawHtml: String,
      category: { type: Schema.Types.ObjectId, ref: "NewsCategory" },
      tags: [String],
      status: { type: String, enum: ["draft", "review", "scheduled", "published", "archived"], default: "draft" },
      publishedAt: Date,
      authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      authorNameSnapshot: String,
      reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
      reviewedAt: Date,
      publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
      publishedAtActual: Date,
      seo,
      viewCount: { type: Number, default: 0 },
    },
    opts,
  ).index({ status: 1, publishedAt: -1 }).index({ title: "text", excerpt: "text" }),
);

export const FeatureCategory = define(
  "FeatureCategory",
  new Schema(
    { name: { type: String, required: true }, slug: { type: String, required: true, unique: true }, order: { type: Number, default: 0 } },
    opts,
  ),
);

export const Feature = define(
  "Feature",
  new Schema(
    {
      title: { type: String, required: true },
      slug: { type: String, required: true, unique: true },
      summary: String,
      icon: { type: String, default: "Sparkles" },
      category: { type: Schema.Types.ObjectId, ref: "FeatureCategory" },
      order: { type: Number, default: 0 },
      enabled: { type: Boolean, default: true },
      heroImage: String,
      heroAlt: String,
      contentMode: { type: String, enum: ["richtext", "html"], default: "richtext" },
      contentJson: Schema.Types.Mixed,
      contentHtml: String,
      gallery: [new Schema({ url: String, alt: String }, { _id: false })],
      highlights: [String],
      cta: new Schema({ label: String, href: String }, { _id: false }),
      seo,
    },
    opts,
  ),
);

export const Page = define(
  "Page",
  new Schema(
    {
      title: { type: String, required: true },
      slug: { type: String, required: true, unique: true },
      contentMode: { type: String, enum: ["richtext", "html"], default: "richtext" },
      contentJson: Schema.Types.Mixed,
      contentHtml: String,
      enabled: { type: Boolean, default: true },
      seo,
    },
    opts,
  ),
);

export const Media = define(
  "Media",
  new Schema(
    {
      url: { type: String, required: true },
      pathname: { type: String, required: true },
      type: { type: String, enum: ["image", "video", "file"], required: true },
      mime: String,
      size: Number,
      width: Number,
      height: Number,
      alt: { type: String, default: "" },
      /** Isi gambar dalam base64 (tanpa prefix data:). Tidak ikut query daftar. */
      data: { type: String, select: false },
      uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    opts,
  ),
);

export const ContactMessage = define(
  "ContactMessage",
  new Schema(
    {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: String,
      subject: { type: String, required: true },
      message: { type: String, required: true },
      ip: String,
      userAgent: String,
      status: { type: String, enum: ["new", "read", "replied"], default: "new" },
    },
    opts,
  ),
);

export const PasswordReset = define(
  "PasswordReset",
  new Schema({
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    usedAt: Date,
  }),
);

export const LoginOtp = define(
  "LoginOtp",
  new Schema({
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    attempts: { type: Number, default: 0 },
  }),
);

export const RateLimit = define(
  "RateLimit",
  new Schema({
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  }),
);

export const AuditLog = define(
  "AuditLog",
  new Schema({
    actorId: { type: Schema.Types.ObjectId, index: true },
    actorLabel: String,
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: String,
    summary: String,
    ip: String,
    requestId: String,
    at: { type: Date, default: Date.now, index: true },
  }),
);

// ---- Pengaduan Online (MTS Section 29) ----

export const ComplaintCategory = define(
  "ComplaintCategory",
  new Schema(
    {
      name: { type: String, required: true },
      slug: { type: String, required: true, unique: true },
      active: { type: Boolean, default: true },
      order: { type: Number, default: 0 },
    },
    opts,
  ),
);

const attachmentMeta = new Schema(
  {
    attachmentId: { type: Schema.Types.ObjectId, required: true },
    name: String,
    mime: String,
    size: Number,
    scanStatus: { type: String, enum: ["pending_scan", "clean", "infected"], default: "pending_scan" },
  },
  { _id: false },
);

export const Complaint = define(
  "Complaint",
  new Schema(
    {
      ticketNumber: { type: String, required: true, unique: true },
      accessCodeHash: { type: String, required: true },
      reporter: {
        name: { type: String, required: true },
        address: { type: String, required: true },
        phone: { type: String, required: true },
      },
      categoryId: { type: Schema.Types.ObjectId, ref: "ComplaintCategory", required: true },
      subject: { type: String, required: true, maxlength: 200 },
      description: { type: String, required: true, maxlength: 5000 },
      status: {
        type: String,
        enum: ["submitted", "in_progress", "waiting_reporter", "awaiting_reporter_confirmation", "closed"],
        default: "submitted",
      },
      claimedBy: { type: Schema.Types.ObjectId, ref: "User" },
      claimedAt: Date,
      lastMessageAt: Date,
      awaitingConfirmationAt: Date,
      confirmationDeadlineAt: Date,
      resolvedAt: Date,
      closedAt: Date,
      closureReason: { type: String, enum: ["reporter_confirmed", "auto_closed_no_reporter_response"] },
      attachments: [attachmentMeta],
      referenceTicket: String,
    },
    opts,
  )
    .index({ status: 1, createdAt: -1 })
    .index({ claimedBy: 1, status: 1 })
    .index({ confirmationDeadlineAt: 1 }),
);

export const ComplaintMessage = define(
  "ComplaintMessage",
  new Schema(
    {
      complaintId: { type: Schema.Types.ObjectId, required: true },
      senderType: { type: String, enum: ["reporter", "admin"], required: true },
      senderUserId: { type: Schema.Types.ObjectId, ref: "User" },
      senderLabel: String,
      body: { type: String, required: true, maxlength: 3000 },
      attachments: [attachmentMeta],
    },
    { timestamps: { createdAt: true, updatedAt: false } },
  ).index({ complaintId: 1, createdAt: 1 }),
);

export const ComplaintStatusHistory = define(
  "ComplaintStatusHistory",
  new Schema(
    {
      complaintId: { type: Schema.Types.ObjectId, required: true },
      fromStatus: String,
      toStatus: { type: String, required: true },
      actorType: { type: String, enum: ["reporter", "admin", "system"], required: true },
      actorUserId: { type: Schema.Types.ObjectId, ref: "User" },
      note: String,
    },
    { timestamps: { createdAt: true, updatedAt: false } },
  ).index({ complaintId: 1, createdAt: 1 }),
);

/** Penyimpanan privat lampiran: byte disimpan di MongoDB dan hanya dilayani lewat proxy terotorisasi. */
export const ComplaintAttachment = define(
  "ComplaintAttachment",
  new Schema(
    {
      complaintId: { type: Schema.Types.ObjectId, required: true, index: true },
      name: String,
      mime: String,
      size: Number,
      data: { type: Buffer, required: true },
      scanStatus: { type: String, enum: ["pending_scan", "clean", "infected"], default: "pending_scan" },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
  ),
);

export const ReporterSession = define(
  "ReporterSession",
  new Schema({
    complaintId: { type: Schema.Types.ObjectId, required: true, index: true },
    lastActivityAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    revoked: { type: Boolean, default: false },
  }),
);
