export type Role = "owner" | "editor" | "viewer";

export function canRead(role: Role | null) {
  return role !== null;
}
export function canEdit(role: Role | null) {
  return role === "owner" || role === "editor";
}
export function canManage(role: Role | null) {
  return role === "owner";
}

/** Pure rule: owner wins, otherwise the share role, otherwise no access. */
export function resolveRole(
  ownerId: string,
  userId: string,
  shareRole: "editor" | "viewer" | null | undefined,
): Role | null {
  if (ownerId === userId) return "owner";
  return shareRole ?? null;
}
