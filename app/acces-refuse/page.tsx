import { ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { readSession } from "@/lib/auth";
import { effectivePermissions, landingPageForSession } from "@/lib/permissions";

export default async function AccessDeniedPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (effectivePermissions(session).length > 0 || session.role === "SUPER_ADMIN") redirect(landingPageForSession(session));
  return <AppShell active="/acces-refuse"><section className="card empty-objects"><span><ShieldAlert size={28}/></span><h1>Aucun accès attribué</h1><p>Votre compte est actif, mais aucune fonction ne lui a encore été accordée. Contactez le super administrateur.</p></section></AppShell>;
}
