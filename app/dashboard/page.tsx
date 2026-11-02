import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowRight, ClipboardPlus, Search, ShieldAlert } from "lucide-react";
import { readSession } from "@/lib/auth";
import { hasPermission, landingPageForSession } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session=await readSession();
  if(!session) redirect("/login");
  if(!hasPermission(session,"DECLARE")) redirect(landingPageForSession(session));
  const canSearch=hasPermission(session,"SEARCH"),canViewOperations=hasPermission(session,"VIEW_STOLEN")||hasPermission(session,"VIEW_FOUND");
  const formattedDate=new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Africa/Bamako"}).format(new Date());
  const displayDate=formattedDate.charAt(0).toUpperCase()+formattedDate.slice(1);
  const lastName=session.name.trim().split(/\s+/).at(-1) || session.name;
  const title=session.role==="SUPER_ADMIN"?"administratrice":"agent";
  return <AppShell active="/dashboard">
    <div className="page-head"><div><span className="eyebrow">{displayDate}</span><h1>Bonjour, {title} {lastName}</h1><p>Vue opérationnelle du service — {session.service}</p></div>{canSearch&&<Link className="btn btn-secondary" href="/verification"><Search size={18}/>Recherche universelle</Link>}</div>
    <section className="action-grid">
      {canSearch&&<article className="hero-action"><ShieldAlert size={27}/><h2>Vérifier un objet</h2><p>Saisissez un IMEI, VIN, numéro de série, plaque ou autre identifiant pendant un contrôle.</p><Link className="btn" style={{background:"white",color:"#0b3b69"}} href="/verification">Commencer la vérification <ArrowRight size={17}/></Link></article>}
      <article className="hero-action secondary"><ClipboardPlus size={27}/><h2>Nouvelle déclaration</h2><p>Enregistrer un objet signalé volé et les informations du propriétaire.</p><Link className="btn btn-primary" href="/declarations/nouvelle">Créer un dossier <ArrowRight size={17}/></Link></article>
    </section>
    {canViewOperations&&<section className="card">
      <div className="card-head"><h3>Données opérationnelles</h3></div>
      <div className="empty-state"><p>Les dossiers, statistiques et activités apparaîtront ici lorsqu’ils seront enregistrés.</p></div>
    </section>}
  </AppShell>;
}
