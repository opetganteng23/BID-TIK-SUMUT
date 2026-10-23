import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Types } from "mongoose";
import { env } from "@/lib/env";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models";
import { ApiError } from "@/lib/http";
import { can, type Permission, type Role } from "@/lib/rbac";

export const SESSION_COOKIE = "bid_session";
const SESSION_TTL_S = 8 * 60 * 60;

const key = () => new TextEncoder().encode(env().AUTH_SECRET);

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
};

export async function signToken(payload: Record<string, unknown>, ttlSeconds: number, purpose: string) {
  return new SignJWT({ ...payload, purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key());
}

export async function verifyToken(token: string, purpose: string) {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.purpose === purpose ? payload : null;
  } catch {
    return null;
  }
}

export async function createSession(user: { _id: Types.ObjectId; sessionVersion: number }) {
  const token = await signToken({ sub: String(user._id), sv: user.sessionVersion }, SESSION_TTL_S, "session");
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Memuat pengguna dari sesi, memeriksa isActive dan sessionVersion. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyToken(token, "session");
  if (!payload || typeof payload.sub !== "string" || !Types.ObjectId.isValid(payload.sub)) return null;
  await connectDb();
  const user = await User.findById(payload.sub).lean();
  if (!user || !user.isActive || user.sessionVersion !== payload.sv) return null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role as Role,
    mustChangePassword: user.mustChangePassword,
  };
}

/** Gerbang otorisasi untuk setiap route handler admin. */
export async function requireUser(
  permission?: Permission,
  opts: { allowPasswordChange?: boolean } = {},
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError("UNAUTHENTICATED");
  if (user.mustChangePassword && !opts.allowPasswordChange) throw new ApiError("PASSWORD_CHANGE_REQUIRED");
  if (permission && !can(user.role, permission)) throw new ApiError("FORBIDDEN");
  return user;
}
