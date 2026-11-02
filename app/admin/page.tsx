import { redirect } from "next/navigation";
import { ShieldCheck, UserCheck, Users, UserX } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AdminUsers } from "@/components/admin-users";
import { readSession } from "@/lib/auth";
import { landingPageForSession } from "@/lib/permissions";
import { listStoredUsers } from "@/lib/user-store";
import Link from "next/link";

export default async function AdminPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.role)) redirect(landingPageForSession(session));
  const users = await listStoredUsers();
  const activeUsers = users.filter(user => user.status === "ACTIVE").length;
  const administrators = users.filter(user => ["ADMIN", "SUPER_ADMIN"].includes(user.role)).length;
  const suspendedUsers = users.filter(user => user.status === "SUSPENDED").length;

  return <AppShell active="/admin">
    <div className="page-head"><div><span className="eyebrow">Administration nationale</span><h1>Gestion des utilisateurs</h1><p>Comptes, rôles et accès aux services de police.</p></div>{session.role === "SUPER_ADMIN" && <Link className="btn btn-secondary" href="/admin/objets">Voir et modifier tous les objets</Link>}</div>
    <section className="stats admin-stats">
      <div className="stat"><div className="stat-top"><span>Utilisateurs</span><Users size={18}/></div><strong>{users.length}</strong><div className="trend">Tous les services</div></div>
      <div className="stat"><div className="stat-top"><span>Comptes actifs</span><UserCheck size={18}/></div><strong>{activeUsers}</strong><div className="trend">{users.length ? Math.round(activeUsers / users.length * 100) : 0} % du total</div></div>
      <div className="stat"><div className="stat-top"><span>Administrateurs</span><ShieldCheck size={18}/></div><strong>{administrators}</strong><div className="trend">Accès renforcé</div></div>
      <div className="stat"><div className="stat-top"><span>Suspendus</span><UserX size={18}/></div><strong>{suspendedUsers}</strong><div className="trend admin-warning">À contrôler</div></div>
    </section>
    <AdminUsers currentRole={session.role} currentMatricule={session.matricule}/>
  </AppShell>;
}
