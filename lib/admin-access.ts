export type AdminActor = { matricule: string; role: string };
export type ManagedAccount = { matricule: string; role: string };

export function isAdministrator(role: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function canCreateRole(actor: AdminActor, role: string) {
  if (!isAdministrator(actor.role)) return false;
  if (role === "SUPER_ADMIN") return false;
  if (role === "ADMIN") return actor.role === "SUPER_ADMIN";
  return true;
}

export function canManageAccount(actor: AdminActor, target: ManagedAccount) {
  if (!isAdministrator(actor.role)) return false;
  if (actor.matricule === target.matricule) return false;
  if (target.role === "SUPER_ADMIN") return false;
  if (target.role === "ADMIN") return actor.role === "SUPER_ADMIN";
  return true;
}
