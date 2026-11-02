import { redirect } from "next/navigation";
import { Eye } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { readSession } from "@/lib/auth";
import { hasPermission, landingPageForSession } from "@/lib/permissions";
export default async function SupervisionPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "SUPERVISE")) redirect(landingPageForSession(session));

  return (
    <AppShell active="/supervision">
      <div className="page-head">
        <div>
          <span className="eyebrow">Vue administrateur</span>
          <h1>Tableau de supervision</h1>
          <p>Les indicateurs s’afficheront lorsque les données opérationnelles seront connectées.</p>
        </div>
        <span className="badge badge-green"><Eye size={13} />Lecture seule</span>
      </div>
      <section className="card">
        <div className="empty-state">
          <p>Aucune donnée de supervision n’est disponible pour le moment.</p>
        </div>
      </section>
    </AppShell>
  );
}
