export type Role = "super_admin" | "admin" | "editor";

export type Permission =
  | "users.manage"
  | "settings.identity"
  | "settings.layout"
  | "content.manage"
  | "news.write"
  | "news.manage_others"
  | "news.raw"
  | "media.upload"
  | "media.delete"
  | "audit.read"
  | "messages.manage"
  | "complaints.view"
  | "complaints.handle"
  | "complaints.export"
  | "complaints.export_sensitive"
  | "complaints.categories.manage";

const ALL: Permission[] = [
  "users.manage",
  "settings.identity",
  "settings.layout",
  "content.manage",
  "news.write",
  "news.manage_others",
  "news.raw",
  "media.upload",
  "media.delete",
  "audit.read",
  "messages.manage",
  "complaints.view",
  "complaints.handle",
  "complaints.export",
  "complaints.export_sensitive",
  "complaints.categories.manage",
];

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  super_admin: new Set(ALL),
  admin: new Set<Permission>([
    "settings.layout",
    "content.manage",
    "news.write",
    "news.manage_others",
    "media.upload",
    "media.delete",
    "audit.read",
    "messages.manage",
    "complaints.view",
    "complaints.handle",
    "complaints.export",
    "complaints.categories.manage",
  ]),
  editor: new Set<Permission>(["news.write", "media.upload", "complaints.view", "complaints.handle"]),
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.has(permission) ?? false;
}

export const ROLES: Role[] = ["super_admin", "admin", "editor"];
