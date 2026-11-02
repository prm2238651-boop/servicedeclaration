import Link from "next/link";
import { Bell, ChartNoAxesCombined, CircleGauge, ClipboardPlus, FileSearch, LayoutDashboard, LogOut, Search, Settings, ShieldCheck, Users } from "lucide-react";
import { readSession } from "@/lib/auth";
import { canViewStatistics, hasPermission, landingPageForSession } from "@/lib/permissions";

export async function AppShell({ children, active }: { children: React.ReactNode; active: string }) {
  const session = await readSession();
  const isAdmin = session?.role === "SUPER_ADMIN" || session?.role === "ADMIN";
  const isPrincipalAdmin = session?.role === "SUPER_ADMIN";
  const canDeclare = hasPermission(session, "DECLARE");
  const canSearch = hasPermission(session, "SEARCH");
  const canViewStolen = hasPermission(session, "VIEW_STOLEN");
  const canViewFound = hasPermission(session, "VIEW_FOUND");
  const canSupervise = hasPermission(session, "SUPERVISE");
  const canSeeStatistics = canViewStatistics(session);
  const home = landingPageForSession(session);
  const showMobileHome = Boolean(isAdmin || canDeclare || canSupervise);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><span className="crest"><ShieldCheck size={25}/></span><span>POLICE NATIONALE<br/><small>DECLARATION/MALI</small></span></div>
      <nav className="nav">
        <div className="nav-section">Opérations</div>
        {canSupervise && <Link href="/supervision" className={active === "/supervision" ? "active" : ""}><LayoutDashboard size={18}/>Supervision</Link>}
        {canDeclare && <Link href="/dashboard" className={active === "/dashboard" ? "active" : ""}><CircleGauge size={18}/>Tableau de bord</Link>}
        {canSearch && <Link href="/verification" className={active === "/verification" ? "active" : ""}><Search size={18}/>Vérification rapide</Link>}
        {canDeclare && <Link href="/declarations/nouvelle" className={active === "/declarations/nouvelle" ? "active" : ""}><ClipboardPlus size={18}/>Nouvelle déclaration</Link>}
        {canViewStolen && <Link href="/objets/voles" className={active === "/objets/voles" ? "active" : ""}><FileSearch size={18}/>Objets volés/perdus</Link>}
        {canViewFound && <Link href="/objets/retrouves" className={active === "/objets/retrouves" ? "active" : ""}><ShieldCheck size={18}/>Objets retrouvés</Link>}
        {canSeeStatistics && <Link href="/statistiques" className={active === "/statistiques" ? "active" : ""}><ChartNoAxesCombined size={18}/>Statistiques</Link>}
        {isAdmin && <>
          <div className="nav-section">Administration</div>
          <Link href="/admin" className={active === "/admin" ? "active" : ""}><Users size={18}/>Utilisateurs</Link>
          {isPrincipalAdmin && <Link href="/admin/objets" className={active === "/admin/objets" ? "active" : ""}><FileSearch size={18}/>Tous les objets</Link>}
          {isPrincipalAdmin && <Link href="#"><Settings size={18}/>Paramètres</Link>}
        </>}
      </nav>
      <div className="sidebar-footer">
        <div className="agent"><span className="avatar">{session?.name.split(" ").map(value => value[0]).join("").slice(0, 2) || "AG"}</span><div><strong>{session?.name || "Agent"}</strong><small>{session?.matricule}</small></div></div>
        <form action="/api/auth/logout" method="post"><button className="btn sidebar-logout"><LogOut size={16}/>Déconnexion</button></form>
      </div>
    </aside>
    <main className="main">
      <header className="topbar"><span className="mobile-title">DECLARATION/MALI</span><div className="top-actions"><button className="icon-btn"><Bell size={19}/></button><span className="badge badge-green system-status">Système opérationnel</span><form action="/api/auth/logout" method="post"><button className="btn topbar-logout"><LogOut size={17}/><span>Déconnexion</span></button></form></div></header>
      <div className="content">{children}</div>
    </main>
    <nav className="mobile-nav">
      {showMobileHome && <Link href={home}><CircleGauge size={20}/>Accueil</Link>}
      {canSearch && <Link href="/verification"><Search size={20}/>Vérifier</Link>}
      {canDeclare && <Link href="/declarations/nouvelle"><ClipboardPlus size={20}/>Déclarer</Link>}
      {canSeeStatistics && <Link href="/statistiques"><ChartNoAxesCombined size={20}/>Stats</Link>}
    </nav>
  </div>;
}
