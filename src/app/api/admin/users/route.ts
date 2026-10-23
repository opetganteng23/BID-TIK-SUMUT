import { z } from "zod";
import { ApiError, assertSameOrigin, clientIp, ok, parseQuery, readJson, route } from "@/lib/http";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models";
import { requireUser } from "@/lib/auth/session";
import { hashPassword, passwordSchema } from "@/lib/auth/password";
import { audit } from "@/lib/audit";

const PUBLIC_FIELDS = { passwordHash: 0, failedLogins: 0 };

const query = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = route(async ({ req, requestId }) => {
  await requireUser("users.manage");
  const { page, limit } = parseQuery(req, query);
  await connectDb();
  const [items, total] = await Promise.all([
    User.find({}, PUBLIC_FIELDS).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(),
  ]);
  return ok({ items, total, page, limit }, requestId);
});

const create = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    role: z.enum(["super_admin", "admin", "editor"]),
    password: passwordSchema,
  })
  .strict();

export const POST = route(async ({ req, requestId }) => {
  assertSameOrigin(req);
  const actor = await requireUser("users.manage");
  const input = await readJson(req, create, 10_000);
  await connectDb();
  const email = input.email.toLowerCase();
  if (await User.exists({ email })) throw new ApiError("CONFLICT", "Email sudah terdaftar.", { email: "Email sudah terdaftar." });
  const user = await User.create({
    name: input.name,
    email,
    role: input.role,
    passwordHash: await hashPassword(input.password),
    mustChangePassword: true,
  });
  await audit({
    actorId: actor.id,
    action: "user.create",
    entity: "user",
    entityId: String(user._id),
    summary: `${email} (${input.role})`,
    ip: clientIp(req),
    requestId,
  });
  return ok({ id: String(user._id), email, role: user.role }, requestId, 201);
});
