/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types, type Model } from "mongoose";
import { z, type ZodType } from "zod";
import { ApiError, assertSameOrigin, clientIp, ok, parseQuery, readJson, route, type Ctx } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth/session";
import type { Permission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { revalidate } from "@/lib/settings";
import { isReservedSlug, slugify } from "@/lib/slug";
import { buildSort, pickFilters, tableQuery } from "@/lib/listing";

export function objectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id) || String(new Types.ObjectId(id)) !== id) {
    throw new ApiError("NOT_FOUND");
  }
  return new Types.ObjectId(id);
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Options = {
  model: Model<any>;
  entity: string;
  readPermission: Permission;
  writePermission: Permission;
  /** Skema isi (create dan update memakai skema yang sama, update bersifat parsial). */
  schema: z.ZodObject<any>;
  searchField?: string;
  sort?: Record<string, 1 | -1>;
  /** Kolom yang boleh dipakai untuk pengurutan dari klien. */
  sortable?: readonly string[];
  /** Kolom yang boleh difilter (kesetaraan) dari klien. */
  filterable?: readonly string[];
  tags?: string[];
  /** Kolom sumber slug, mis. "title" atau "name". Bila ada, slug dibuat dan dijaga unik. */
  slugFrom?: string;
  reserveSlugs?: boolean;
  populate?: string;
  prepare?: (data: Record<string, any>, user: SessionUser) => Record<string, any>;
  /** Cek tambahan sebelum hapus, mis. kategori yang masih dipakai. */
  beforeDelete?: (id: Types.ObjectId) => Promise<void>;
};

const listQuery = tableQuery;

export function crud(o: Options) {
  const partial = o.schema.partial().strict();
  const full = o.schema.strict();

  async function uniqueSlug(base: string, ignoreId?: Types.ObjectId) {
    const slug = slugify(base);
    if (!slug) throw new ApiError("VALIDATION_ERROR", undefined, { slug: "Slug tidak valid." });
    if (o.reserveSlugs && isReservedSlug(slug)) {
      throw new ApiError("CONFLICT", "Slug dipesan oleh sistem.", { slug: "Slug dipesan oleh sistem." });
    }
    const filter: Record<string, unknown> = { slug };
    if (ignoreId) filter._id = { $ne: ignoreId };
    if (await o.model.exists(filter)) {
      throw new ApiError("CONFLICT", "Slug sudah dipakai.", { slug: "Slug sudah dipakai." });
    }
    return slug;
  }

  function done(user: SessionUser) {
    if (o.tags?.length) revalidate(...o.tags);
    return user;
  }

  const collection = {
    GET: route(async ({ req, requestId }) => {
      await requireUser(o.readPermission);
      const { page, limit, q, sort, dir } = parseQuery(req, listQuery);
      await connectDb();
      const filter: Record<string, unknown> = { ...pickFilters(req, o.filterable ?? []) };
      if (q && o.searchField) filter[o.searchField] = { $regex: escapeRegex(q), $options: "i" };
      const [items, total] = await Promise.all([
        o.model
          .find(filter)
          .sort(buildSort(sort, dir, o.sortable ?? [], o.sort ?? { createdAt: -1 }))
          .skip((page - 1) * limit)
          .limit(limit)
          .populate(o.populate ?? "")
          .lean(),
        o.model.countDocuments(filter),
      ]);
      return ok({ items, total, page, limit }, requestId);
    }),

    POST: route(async ({ req, requestId }) => {
      assertSameOrigin(req);
      const user = await requireUser(o.writePermission);
      let data: Record<string, any> = await readJson(req, full, 2_000_000);
      await connectDb();
      if (o.slugFrom) data.slug = await uniqueSlug((data.slug as string) || data[o.slugFrom]);
      if (o.prepare) data = o.prepare(data, user);
      const doc = await o.model.create(data);
      await audit({
        actorId: user.id,
        action: `${o.entity}.create`,
        entity: o.entity,
        entityId: String(doc._id),
        summary: String(data.title ?? data.name ?? ""),
        ip: clientIp(req),
        requestId,
      });
      done(user);
      return ok(doc.toObject(), requestId, 201);
    }),

    /** PATCH /reorder: { ids: [...] } mengatur ulang field `order`. */
    PATCH: route(async ({ req, requestId }) => {
      assertSameOrigin(req);
      const user = await requireUser(o.writePermission);
      const { ids } = await readJson(req, z.object({ ids: z.array(z.string()).max(500) }).strict());
      await connectDb();
      await o.model.bulkWrite(
        ids.map((id, i) => ({ updateOne: { filter: { _id: objectId(id) }, update: { $set: { order: i } } } })),
      );
      await audit({ actorId: user.id, action: `${o.entity}.reorder`, entity: o.entity, ip: clientIp(req), requestId });
      done(user);
      return ok({}, requestId);
    }),
  };

  const item = {
    GET: route(async ({ ctx, requestId }) => {
      await requireUser(o.readPermission);
      const id = objectId((await ctx.params).id);
      await connectDb();
      const doc = await o.model.findById(id).lean();
      if (!doc) throw new ApiError("NOT_FOUND");
      return ok(doc, requestId);
    }),

    PUT: route(async ({ req, ctx, requestId }) => {
      assertSameOrigin(req);
      const user = await requireUser(o.writePermission);
      const id = objectId((await ctx.params).id);
      let data: Record<string, any> = await readJson(req, partial, 2_000_000);
      await connectDb();
      if (o.slugFrom && (data.slug || data[o.slugFrom])) {
        const existing = await o.model.findById(id).lean();
        if (!existing) throw new ApiError("NOT_FOUND");
        if (data.slug) data.slug = await uniqueSlug(data.slug, id);
      }
      if (o.prepare) data = o.prepare(data, user);
      const doc = await o.model.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean();
      if (!doc) throw new ApiError("NOT_FOUND");
      await audit({
        actorId: user.id,
        action: `${o.entity}.update`,
        entity: o.entity,
        entityId: String(id),
        summary: Object.keys(data).join(","),
        ip: clientIp(req),
        requestId,
      });
      done(user);
      return ok(doc, requestId);
    }),

    DELETE: route(async ({ req, ctx, requestId }) => {
      assertSameOrigin(req);
      const user = await requireUser(o.writePermission);
      const id = objectId((await ctx.params).id);
      await connectDb();
      if (o.beforeDelete) await o.beforeDelete(id);
      const doc = await o.model.findByIdAndDelete(id).lean();
      if (!doc) throw new ApiError("NOT_FOUND");
      await audit({ actorId: user.id, action: `${o.entity}.delete`, entity: o.entity, entityId: String(id), ip: clientIp(req), requestId });
      done(user);
      return ok({}, requestId);
    }),
  };

  return { collection, item };
}

export type { Ctx, ZodType };
