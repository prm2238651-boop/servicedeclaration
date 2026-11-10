import { redirect } from "next/navigation";
import { CheckCircle2, FileText, RotateCcw, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { readSession } from "@/lib/auth";
import { canViewStatistics, landingPageForSession } from "@/lib/permissions";
import { getReportStatistics } from "@/lib/report-store";

export default async function StatisticsPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!canViewStatistics(session)) redirect(landingPageForSession(session));
  const isAdmin = session.role === "SUPER_ADMIN";
  const statistics = await getReportStatistics(isAdmin ? undefined : session.matricule);

  return <AppShell active="/statistiques">
    <div className="page-head"><div><span className="eyebrow">{isAdmin ? "Vue nationale" : "Activité personnelle"}</span><h1>{isAdmin ? "Statistiques globales" : "Mes statistiques"}</h1><p>{isAdmin ? "Ensemble des commissariats et détail par service." : `Uniquement les activités enregistrées avec le matricule ${session.matricule}.`}</p></div><span className="badge badge-blue">{isAdmin ? "Accès administrateur" : "Données personnelles"}</span></div>
    <section className="stats">
      <Stat title="Déclarations" value={statistics.total} icon={<FileText size={18}/>}/>
      <Stat title="Volés/perdus actifs" value={statistics.stolen} icon={<ShieldAlert size={18}/>}/>
      <Stat title="Objets retrouvés" value={statistics.found} icon={<CheckCircle2 size={18}/>}/>
      <Stat title="Remis aux propriétaires" value={statistics.returned} icon={<RotateCcw size={18}/>}/>
    </section>
    <section className="dashboard-grid">
      <div className="card"><div className="card-head"><h3>Répartition des activités</h3></div><div className="card-body"><div className="stats-bars">
        <Bar label="Volés/perdus" value={statistics.stolen} total={statistics.total} kind="red"/>
        <Bar label="Retrouvés" value={statistics.found} total={statistics.total} kind="green"/>
        <Bar label="Restitués" value={statistics.returned} total={statistics.total} kind="blue"/>
      </div></div></div>
      <div className="card"><div className="card-head"><h3>Taux de récupération</h3></div><div className="card-body rate-panel"><strong>{statistics.total ? Math.round(((statistics.found + statistics.returned) / statistics.total) * 100) : 0}%</strong><p>des objets déclarés ont été retrouvés ou restitués.</p></div></div>
    </section>
    {isAdmin && <section className="card station-stats"><div className="card-head"><h3>Statistiques par commissariat</h3></div><div className="table-wrap"><table><thead><tr><th>Commissariat</th><th>Total</th><th>Volés/perdus</th><th>Retrouvés</th><th>Restitués</th><th>Taux</th></tr></thead><tbody>{statistics.stations.map(station=><tr key={station.service}><td><strong>{station.service}</strong></td><td>{station.total}</td><td>{station.stolen}</td><td>{station.found}</td><td>{station.returned}</td><td><span className="badge badge-blue">{station.rate}%</span></td></tr>)}</tbody></table></div></section>}
  </AppShell>;
}

function Stat({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return <div className="stat"><div className="stat-top"><span>{title}</span>{icon}</div><strong>{value}</strong></div>;
}

function Bar({ label, value, total, kind }: { label: string; value: number; total: number; kind: string }) {
  return <div className="stats-bar"><div><span>{label}</span><strong>{value}</strong></div><div><span className={kind} style={{ width: `${total ? Math.round(value / total * 100) : 0}%` }}/></div></div>;
}
