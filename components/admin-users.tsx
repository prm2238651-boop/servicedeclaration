"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Copy, KeyRound, RotateCcw, Search, Trash2, UserPlus, X } from "lucide-react";
import { DEFAULT_PERMISSIONS, type Permission } from "@/lib/permissions";
import { CreatableSelect } from "@/components/creatable-select";

type User = {
  initials: string;
  name: string;
  matricule: string;
  roleCode: string;
  role: string;
  service: string;
  status: "Actif" | "Suspendu";
  last: string;
  permissions?: string[];
};

type StoredUser = {
  name: string;
  matricule: string;
  role: string;
  service: string;
  status: "ACTIVE" | "SUSPENDED";
  permissions?: string[];
};

const initial: User[] = [{
  initials: "AP",
  name: "Administrateur principal",
  matricule: "PRM-8651",
  roleCode: "SUPER_ADMIN",
  role: "Administrateur principal",
  service: "Direction générale",
  status: "Actif",
  last: "Aujourd’hui",
}];

const rights: { code: Permission; label: string; help: string }[] = [
  { code: "DECLARE", label: "Créer des déclarations", help: "Enregistrer des objets volés/perdus ou retrouvés" },
  { code: "SEARCH", label: "Effectuer des recherches", help: "Contrôler un identifiant dans la base" },
  { code: "VIEW_STOLEN", label: "Voir les objets volés/perdus", help: "Consulter le registre correspondant" },
  { code: "VIEW_FOUND", label: "Voir les objets retrouvés", help: "Consulter les récupérations et restitutions" },
  { code: "UPDATE_STATUS", label: "Modifier les statuts", help: "Marquer retrouvé ou remis au propriétaire" },
  { code: "SUPERVISE", label: "Accéder à la supervision", help: "Voir les activités et classements" },
];

const roleCodes: Record<string, string> = {
  "Administrateur": "ADMIN",
  "Agent de commissariat": "COMMISSARIAT_AGENT",
  "Agent GSR": "GSR_AGENT",
  "Superviseur de commissariat": "COMMISSARIAT_SUPERVISOR",
};

const roleLabels: Record<string, string> = {
  ADMIN: "Administrateur",
  COMMISSARIAT_AGENT: "Agent de commissariat",
  GSR_AGENT: "Agent GSR",
  COMMISSARIAT_SUPERVISOR: "Superviseur de commissariat",
  SUPER_ADMIN: "Administrateur principal",
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(value => value[0]).join("").slice(0, 2).toUpperCase();
}

function toUser(user: StoredUser): User {
  return {
    initials: initials(user.name),
    name: user.name,
    matricule: user.matricule,
    roleCode: user.role,
    role: roleLabels[user.role] || user.role,
    service: user.service,
    status: user.status === "ACTIVE" ? "Actif" : "Suspendu",
    last: "Non renseigné",
    permissions: user.permissions,
  };
}

export function AdminUsers({ currentRole, currentMatricule }: { currentRole: string; currentMatricule: string }) {
  const [users, setUsers] = useState(initial);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("Agent de commissariat");
  const [selectedRights, setSelectedRights] = useState<Permission[]>(DEFAULT_PERMISSIONS.COMMISSARIAT_AGENT);
  const [notice, setNotice] = useState("");
  const [credentials, setCredentials] = useState<{ name: string; matricule: string; password: string } | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadUsers() {
      try {
        const response = await fetch("/api/admin/users", { cache: "no-store" });
        if (!response.ok) throw new Error("USERS_UNAVAILABLE");
        const data = await response.json() as { users: StoredUser[] };
        if (active) setUsers(data.users.map(toUser));
      } catch {
        const saved = localStorage.getItem("police-users-v2");
        if (active && saved) setUsers(JSON.parse(saved));
      }
    }
    localStorage.removeItem("police-demo-users");
    loadUsers();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(
    () => users.filter(user => Object.values(user).join(" ").toLowerCase().includes(query.toLowerCase())),
    [users, query],
  );

  function persist(next: User[]) {
    setUsers(next);
    localStorage.setItem("police-users-v2", JSON.stringify(next));
  }

  function roleChanged(role: string) {
    setSelectedRole(role);
    setSelectedRights(DEFAULT_PERMISSIONS[roleCodes[role]] || []);
  }

  function canManage(user: User) {
    if (user.matricule === currentMatricule || user.roleCode === "SUPER_ADMIN") return false;
    if (user.roleCode === "ADMIN") return currentRole === "SUPER_ADMIN";
    return true;
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(form) as Record<string, string>;
    const matricule = data.matricule.trim().toUpperCase();
    const password = `Police${Math.random().toString(36).slice(2, 7).toUpperCase()}!`;
    const name = `${data.prenom} ${data.nom}`;
    const role = roleCodes[data.role];
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ matricule, name, role, service: data.service, password, permissions: selectedRights }),
    });
    if (!response.ok) {
      setNotice(response.status === 409 ? "Ce matricule existe déjà." : response.status === 500 ? "Échec technique lors de l’enregistrement. Consultez les journaux du serveur." : "La création a échoué.");
      return;
    }
    persist([{
      initials: `${data.prenom[0]}${data.nom[0]}`.toUpperCase(),
      name,
      matricule,
      roleCode: role,
      role: data.role,
      service: data.service,
      status: "Actif",
      last: "Jamais",
      permissions: selectedRights,
    }, ...users]);
    setCreateOpen(false);
    setCredentials({ name, matricule, password });
  }

  async function accountAction(user: User, action: "suspend" | "activate" | "delete") {
    if (!canManage(user)) {
      setNotice("Ce compte est protégé par la hiérarchie administrative.");
      return;
    }
    if (action === "delete") {
      const response = await fetch(`/api/admin/users?matricule=${encodeURIComponent(user.matricule)}`, { method: "DELETE" });
      if (!response.ok) {
        setNotice(response.status === 403 ? "Vous n’êtes pas autorisé à supprimer ce compte." : "La suppression du compte a échoué.");
        return;
      }
      persist(users.filter(item => item.matricule !== user.matricule));
      setDeleteUser(null);
      setNotice(`Compte de ${user.name} supprimé.`);
      return;
    }
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "SET_STATUS", matricule: user.matricule, status: action === "suspend" ? "SUSPENDED" : "ACTIVE" }),
    });
    if (!response.ok) {
      setNotice("Le statut du compte n’a pas pu être modifié.");
      return;
    }
    persist(users.map(item => item.matricule === user.matricule ? { ...item, status: action === "suspend" ? "Suspendu" : "Actif" } : item));
    setNotice("Statut du compte mis à jour.");
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordUser) return;
    setPasswordError("");
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    if (data.password !== data.confirmPassword) {
      setPasswordError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "RESET_PASSWORD", matricule: passwordUser.matricule, password: data.password }),
    });
    if (!response.ok) {
      setPasswordError("Le mot de passe n’a pas pu être modifié.");
      return;
    }
    setPasswordUser(null);
    setNotice(`Mot de passe de ${passwordUser.name} modifié avec succès.`);
  }

  return <>
    {notice && <div className="toast"><CheckCircle2 size={18}/>{notice}<button onClick={() => setNotice("")}><X size={15}/></button></div>}
    <section className="card admin-table-card">
      <div className="admin-toolbar">
        <div><h2>Annuaire des comptes</h2><p>{filtered.length} utilisateur{filtered.length !== 1 ? "s" : ""}</p></div>
        <div className="admin-actions">
          <label className="admin-search"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nom, matricule, service…"/></label>
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}><UserPlus size={17}/>Créer un utilisateur</button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Utilisateur</th><th>Matricule</th><th>Profil</th><th>Service</th><th>Droits</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>{filtered.map(user => <tr key={user.matricule}>
            <td><div className="user-cell"><span className="avatar admin-avatar">{user.initials}</span><strong>{user.name}</strong></div></td>
            <td><code>{user.matricule}</code></td>
            <td>{user.role}</td>
            <td>{user.service}</td>
            <td><span className="rights-count">{user.roleCode === "SUPER_ADMIN" ? "Tous" : user.roleCode === "ADMIN" ? "Gestion utilisateurs" : `${user.permissions?.length ?? "Profil"} droits`}</span></td>
            <td><span className={`badge ${user.status === "Actif" ? "badge-green" : "badge-red"}`}>{user.status}</span></td>
            <td><div className="inline-actions">
              <button title={canManage(user) ? "Modifier le mot de passe" : "Compte protégé"} disabled={!canManage(user)} aria-label={`Modifier le mot de passe de ${user.name}`} onClick={() => { setPasswordError(""); setPasswordUser(user); }}><KeyRound size={16}/></button>
              {user.status === "Actif"
                ? <button title={canManage(user) ? "Suspendre" : "Compte protégé"} disabled={!canManage(user)} onClick={() => accountAction(user, "suspend")}><Ban size={16}/></button>
                : <button title={canManage(user) ? "Réactiver" : "Compte protégé"} disabled={!canManage(user)} onClick={() => accountAction(user, "activate")}><RotateCcw size={16}/></button>}
              <button title={canManage(user) ? "Supprimer" : "Compte protégé"} disabled={!canManage(user)} onClick={() => setDeleteUser(user)}><Trash2 size={16}/></button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    {createOpen && <div className="modal-backdrop"><form className="create-user-dialog" onSubmit={create}>
      <div className="dialog-head"><div><span className="eyebrow">Nouveau compte</span><h2>Créer un utilisateur et ses droits</h2></div><button type="button" className="icon-btn" onClick={() => setCreateOpen(false)}><X size={18}/></button></div>
      <div className="form-grid">
        <Field name="prenom" label="Prénom *"/><Field name="nom" label="Nom *"/><Field name="matricule" label="Numéro matricule *"/>
        <div className="field"><label>Type d’utilisateur *</label><select className="input" name="role" value={selectedRole} onChange={event => roleChanged(event.target.value)} required>{currentRole === "SUPER_ADMIN" && <option>Administrateur</option>}<option>Agent de commissariat</option><option>Agent GSR</option><option>Superviseur de commissariat</option></select></div>
        <div className="span-2"><CreatableSelect name="service" label="Service d’affectation *" required customPlaceholder="Écrivez le nom du service" options={["1er arrondissement — Bamako", "2e arrondissement — Bamako", "3e arrondissement — Bamako", "5e arrondissement — Bamako", "7e arrondissement — Bamako", "GSR Bamako"]}/></div>
      </div>
      {selectedRole === "Administrateur" ? <div className="permission-note"><strong>Administrateur secondaire</strong><span>Il pourra gérer les comptes ordinaires, mais ne pourra jamais modifier, suspendre ou supprimer l’Administrateur principal ni un autre administrateur.</span></div> : <fieldset className="permissions-fieldset"><legend>Pouvoirs accordés à l’utilisateur</legend><p>Cochez uniquement les actions que cet utilisateur est autorisé à effectuer.</p><div className="permissions-grid">{rights.map(right => <label className="permission-option" key={right.code}><input type="checkbox" checked={selectedRights.includes(right.code)} onChange={event => setSelectedRights(event.target.checked ? [...selectedRights, right.code] : selectedRights.filter(permission => permission !== right.code))}/><span><strong>{right.label}</strong><small>{right.help}</small></span></label>)}</div></fieldset>}
      <div className="dialog-actions"><button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Annuler</button><button className="btn btn-primary"><UserPlus size={17}/>Créer le compte</button></div>
    </form></div>}

    {credentials && <div className="modal-backdrop"><section className="confirm-dialog credentials-dialog"><CheckCircle2 size={35}/><h2>Compte créé</h2><p>Identifiants temporaires pour {credentials.name}.</p><Credential label="Matricule" value={credentials.matricule}/><Credential label="Mot de passe" value={credentials.password}/><button className="btn btn-primary btn-block" onClick={() => setCredentials(null)}>Terminer</button></section></div>}

    {passwordUser && <div className="modal-backdrop"><form className="recovery-dialog" onSubmit={resetPassword}>
      <div className="dialog-head"><div><span className="eyebrow">Sécurité du compte</span><h2>Modifier le mot de passe</h2></div><button type="button" className="icon-btn" onClick={() => setPasswordUser(null)} aria-label="Fermer"><X size={18}/></button></div>
      <div className="recovery-object"><KeyRound size={22}/><div><strong>{passwordUser.name}</strong><span>{passwordUser.matricule} · {passwordUser.service}</span></div></div>
      {passwordError && <div className="error" role="alert">{passwordError}</div>}
      <div className="field"><label htmlFor="newPassword">Nouveau mot de passe *</label><input className="input" id="newPassword" name="password" type="password" minLength={10} maxLength={128} autoComplete="new-password" required/></div>
      <div className="field"><label htmlFor="confirmPassword">Confirmer le mot de passe *</label><input className="input" id="confirmPassword" name="confirmPassword" type="password" minLength={10} maxLength={128} autoComplete="new-password" required/></div>
      <div className="permission-note"><strong>Réinitialisation administrateur</strong><span>Le nouveau mot de passe doit contenir au moins 10 caractères. Il sera enregistré sous forme chiffrée.</span></div>
      <div className="dialog-actions"><button type="button" className="btn btn-secondary" onClick={() => setPasswordUser(null)}>Annuler</button><button className="btn btn-primary"><KeyRound size={17}/>Enregistrer le mot de passe</button></div>
    </form></div>}

    {deleteUser && <div className="modal-backdrop"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <div className="confirm-icon danger"><Trash2 size={25}/></div><h2 id="delete-title">Supprimer ce compte ?</h2><p>Cette action retirera définitivement l’accès de cet utilisateur. Son matricule restera visible dans l’historique des dossiers déjà enregistrés.</p>
      <div className="confirm-user"><span className="avatar admin-avatar">{deleteUser.initials}</span><div><strong>{deleteUser.name}</strong><small>{deleteUser.matricule} · {deleteUser.role}</small></div></div>
      <div className="dialog-actions"><button className="btn btn-secondary" onClick={() => setDeleteUser(null)}>Annuler</button><button className="btn btn-danger" onClick={() => accountAction(deleteUser, "delete")}><Trash2 size={17}/>Supprimer</button></div>
    </section></div>}
  </>;
}

function Field({ name, label }: { name: string; label: string }) {
  return <div className="field"><label htmlFor={name}>{label}</label><input className="input" id={name} name={name} required/></div>;
}

function Credential({ label, value }: { label: string; value: string }) {
  return <div className="credential-row"><div><small>{label}</small><strong>{value}</strong></div><button className="icon-btn" onClick={() => navigator.clipboard.writeText(value)}><Copy size={16}/></button></div>;
}
