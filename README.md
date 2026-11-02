# Police Mali — DECLARATION/MALI

Première version fonctionnelle d’une plateforme destinée à l’enregistrement, la vérification et au suivi d’objets déclarés volés. Cette version livre l’architecture monolithique modulaire, l’authentification, un tableau de bord responsive, la vérification universelle, un formulaire de déclaration et le schéma PostgreSQL/Prisma. Seul le compte administrateur principal est conservé ; les comptes et dossiers d’exemple ont été retirés.

> Important : il s’agit d’un socle de développement et de démonstration, pas d’un système homologué pour traiter des données policières réelles. Un audit juridique, sécurité, infrastructure et protection des données est indispensable avant tout déploiement opérationnel.

## Fonctions disponibles

- connexion par matricule avec session HTTP-only signée ;
- protection des pages internes ;
- tableau de bord opérationnel responsive ;
- vérification rapide IMEI/plaque avec normalisation ;
- résultat rouge « OBJET SIGNALÉ VOLÉ » ou formulation neutre en absence de résultat ;
- formulaire structuré de nouvelle déclaration ;
- schéma Prisma complet : utilisateurs, rôles, services, objets, identifiants, récupération, restitution, audit, recherches et notifications ;
- compte administrateur principal conservé sans comptes ni dossiers d’exemple ;
- manifeste PWA de base et interface mobile ;
- test automatisé de normalisation.

## Prérequis

- Node.js 20 ou supérieur ;
- npm 10 ou supérieur ;
- Docker Desktop, ou PostgreSQL 16 installé localement.

## Démarrage rapide

```bash
copy .env.example .env
npm install
npm run dev
```

Ouvrir `http://localhost:3000`.

Le compte `SUPER_ADMIN` existant est conservé dans `data/demo-users.json`. Son mot de passe n’est pas stocké en clair dans le dépôt.

## PostgreSQL et Prisma

1. Démarrer PostgreSQL : `docker compose up -d postgres`
2. Vérifier `DATABASE_URL` dans `.env`.
3. Générer le client : `npm run db:generate`
4. Créer la migration : `npm run db:migrate -- --name initial_schema`

Le schéma est dans `prisma/schema.prisma`. Les routes métier et l’authentification ne sont pas encore raccordées à Prisma ; l’application utilise actuellement des fichiers JSON. Les champs personnels portent explicitement le suffixe `Encrypted` : le chiffrement applicatif doit être branché à un KMS/HSM avant production.

## Vérifications

```bash
npm run typecheck
npm run test
npm run build
```

Tests de sécurité k6 (application lancée sur `http://127.0.0.1:3000`) :

```bash
npm run test:k6:security
npm run test:k6:rate-limit
```

Ces scénarios vérifient le refus des accès anonymes, le rejet d'une session falsifiée,
le blocage des mutations inter-origines, les en-têtes de sécurité et la limitation des
tentatives de connexion. La limitation actuelle est en mémoire et doit être remplacée
par Redis ou un mécanisme distribué avant tout déploiement sur plusieurs instances.

## Architecture

```text
app/                 Pages et routes API Next.js
components/          Composants d’interface partagés
lib/                 Session, normalisation et stockage
prisma/              Schéma PostgreSQL
public/              Manifeste PWA
tests/               Tests automatisés
```

## Compte administrateur

Le compte `SUPER_ADMIN` existant est le seul compte fourni dans les données locales. Avant tout usage réel, remplacer ce stockage JSON par un système persistant et mettre en place une procédure sécurisée de gestion du mot de passe administrateur.

## Déploiement et sécurité

Avant mise en production : remplacer le stockage JSON par des dépôts Prisma persistants, intégrer Argon2id et la 2FA, ajouter une limitation distribuée des tentatives, la révocation centralisée des sessions, le chiffrement applicatif avec clés externes, le stockage S3 privé, l’antivirus des fichiers, les sauvegardes chiffrées testées, un journal d’audit append-only, la supervision, un reverse proxy HTTPS et une revue complète des autorisations côté serveur.

La plateforme ne doit jamais présenter une correspondance comme preuve judiciaire définitive. Les décisions restent du ressort des agents et autorités compétentes.

## Variables d’environnement

- `DATABASE_URL` : connexion PostgreSQL ;
- `AUTH_SECRET` : secret aléatoire d’au moins 32 caractères ;
- `TRUSTED_PROXY_SECRET` : secret partagé avec le reverse proxy autorisé à fournir l'adresse cliente ;
- `APP_NAME` : nom personnalisable.

## Feuille de route prioritaire

1. Brancher les routes métier sur Prisma avec transactions et audit append-only.
2. Implémenter RBAC fin côté serveur et cloisonnement par service.
3. Finaliser déclaration, récupération, restitution et chronologie.
4. Ajouter 2FA, gestion administrative des comptes et verrouillage.
5. Sécuriser documents, chiffrement, sauvegardes et observabilité.
6. Réaliser audits de sécurité, charge, accessibilité et conformité au cadre malien applicable.
