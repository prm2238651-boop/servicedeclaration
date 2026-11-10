# Police Mali — DECLARATION/MALI

Première version fonctionnelle d’une plateforme destinée à l’enregistrement, la vérification et au suivi d’objets déclarés volés. Cette version livre l’architecture monolithique modulaire, l’authentification, un tableau de bord responsive, la vérification universelle, un formulaire de déclaration et le schéma PostgreSQL/Prisma. Aucun compte ni dossier d’exemple n’est conservé dans le dépôt ; le premier administrateur est créé explicitement dans la base.

> Important : il s’agit d’un socle de développement et de démonstration, pas d’un système homologué pour traiter des données policières réelles. Un audit juridique, sécurité, infrastructure et protection des données est indispensable avant tout déploiement opérationnel.

## Fonctions disponibles

- connexion par matricule avec session HTTP-only signée ;
- modification sécurisée de son profil administrateur, de son matricule et de son mot de passe ;
- modification des profils, rôles, droits et mots de passe des comptes autorisés selon la hiérarchie administrative ;
- protection des pages internes ;
- tableau de bord opérationnel responsive ;
- vérification rapide IMEI/plaque avec normalisation ;
- résultat rouge « OBJET SIGNALÉ VOLÉ » ou formulation neutre en absence de résultat ;
- formulaire structuré de nouvelle déclaration ;
- schéma Prisma complet : utilisateurs, rôles, services, objets, identifiants, récupération, restitution, audit, recherches et notifications ;
- comptes créés explicitement dans PostgreSQL, sans compte par défaut ni mot de passe livré ;
- manifeste PWA de base et interface mobile ;
- proposition d’installation dans les navigateurs compatibles, avec instructions iPhone/iPad ;
- test automatisé de normalisation.

## Prérequis

- Node.js 20 ou supérieur ;
- npm 10 ou supérieur ;
- Docker Desktop, ou PostgreSQL 16 installé localement.

## Démarrage rapide

```bash
copy .env.example .env
npm install
npm run db:generate
docker compose up -d postgres
npm run db:migrate:deploy
npm run db:create-admin
npm run dev
```

Le compte initial est créé uniquement dans PostgreSQL ; aucun mot de passe n’est livré avec le dépôt.

Pour importer des déclarations existantes depuis un fichier JSON :

```bash
npm run db:import-reports -- data/demo-reports.json
```

L’import ignore les dossiers déjà présents, chiffre les données sensibles et refuse les collisions d’identifiant. Conserver une copie sécurisée du fichier source jusqu’à vérification de l’import.

Ouvrir `http://localhost:3000`.

Aucun compte de démonstration n’est fourni dans le dépôt. Le stockage JSON des comptes n’est lu que lorsque `DEMO_MODE=true` ; ne jamais activer ce mode en production.

## Installation sur un appareil

En ligne, ouvrir le site en HTTPS et attendre que le navigateur ait chargé la page et activé son service worker. La proposition affiche un bouton **Installer** pendant 30 secondes : il ouvre la confirmation native quand le navigateur émet l’événement d’installation ; sinon, un clic affiche les étapes d’ajout manuel. Sur iPhone/iPad, ouvrir le site avec Safari puis choisir **Partager → Sur l’écran d’accueil**. Firefox ordinateur ne prend pas en charge l’installation des PWA ; utiliser Chrome ou Edge. Le service worker transmet les requêtes au réseau et ne met aucune donnée en cache : l’application n’est pas utilisable hors ligne.

## PostgreSQL et Prisma

1. Démarrer PostgreSQL : `docker compose up -d postgres`.
2. Configurer `DATABASE_URL` (URL poolée pour l’application) et `DIRECT_URL` (URL directe sans `-pooler`, utilisée par Prisma Migrate) dans `.env` ou dans l’environnement de déploiement.
3. Générer le client : `npm run db:generate`.
4. Appliquer les migrations : `npm run db:migrate:deploy`.
5. Créer le premier compte `SUPER_ADMIN` dans un terminal interactif : `npm run db:create-admin`.

Les comptes, déclarations, graines TOTP chiffrées et codes de récupération hachés sont stockés dans PostgreSQL quand `DEMO_MODE` n’est pas exactement égal à `true`. Les champs personnels des déclarations (nom, prénom, téléphone, pièce, identifiant de l’objet et notes) sont chiffrés avec AES-256-GCM ; l’application recherche les identifiants par empreinte HMAC. `npm run db:create-admin` demande les informations du premier administrateur sans afficher le mot de passe ; comme tous les utilisateurs, il active TOTP à sa première connexion. Les fichiers JSON ne servent qu’au mode démo. Les autres tables du schéma Prisma (rôles métier normalisés, pièces jointes, sessions/audit dédiés et services) ne sont pas toutes utilisées par les routes actuelles.

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
tentatives de connexion. Le limiteur est en mémoire et s’appuie sur l’adresse cliente
transmise par un proxy de confiance : celui-ci doit retirer tout en-tête
`x-trusted-proxy-secret` reçu du client, définir cet en-tête avec `TRUSTED_PROXY_SECRET`
et transmettre l’adresse réelle en premier dans `X-Forwarded-For`. Sans secret valide,
les en-têtes d’adresse sont ignorés et les requêtes partagent le bucket `direct` ;
ne pas exposer ainsi l’application en production. Avant tout déploiement multi-instance,
remplacer également le stockage en mémoire par Redis ou un mécanisme distribué.

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

Le dépôt ne fournit aucun compte `SUPER_ADMIN`. Avec `DEMO_MODE` désactivé, les comptes sont chargés depuis PostgreSQL. Pour initialiser la base vide, exécuter `npm run db:migrate:deploy`, puis créer le premier compte avec `npm run db:create-admin`.

Un administrateur peut modifier son propre nom, matricule, service et mot de passe après vérification du mot de passe actuel. Le `SUPER_ADMIN` peut gérer les profils des autres comptes ; les administrateurs secondaires ne peuvent gérer que les comptes non administrateurs. Le rôle `SUPER_ADMIN` et son compte restent protégés.

## Déploiement et sécurité

La double authentification TOTP est exigée de tous les utilisateurs : lors de leur première connexion, ils enregistrent une application TOTP et confirment un code avant d’ouvrir leur session. Ensuite, le code TOTP ou un code de récupération est redemandé après 12 heures sans connexion réussie. Dix codes de récupération à usage unique sont alors affichés une seule fois. Les graines TOTP et les champs personnels des déclarations sont chiffrés avec des clés dérivées de `AUTH_SECRET` ; garder ce secret stable et sauvegardé, car son remplacement empêche de déchiffrer ces données.

Avant mise en production complète : intégrer Argon2id, ajouter une limitation distribuée des tentatives, la révocation centralisée des sessions, externaliser les clés de chiffrement vers un KMS/HSM, ajouter le stockage S3 privé, l’antivirus des fichiers, les sauvegardes chiffrées testées, un journal d’audit append-only, la supervision, un reverse proxy HTTPS et une revue complète des autorisations côté serveur.

La plateforme ne doit jamais présenter une correspondance comme preuve judiciaire définitive. Les décisions restent du ressort des agents et autorités compétentes.

## Variables d’environnement

- `DATABASE_URL` : connexion PostgreSQL ;
- `AUTH_SECRET` : secret aléatoire de 32 octets (64 caractères hexadécimaux), différent pour chaque environnement ;
- `TRUSTED_PROXY_SECRET` : secret partagé avec le reverse proxy autorisé à fournir l'adresse cliente ;
- `DEMO_MODE` : doit rester différent de `true` en production ; `true` active le stockage JSON de démonstration ;
- `ALLOW_INSECURE_LOCALHOST` : laisser à `false` ; ne l’activer que pour un besoin local explicitement maîtrisé ;
- `APP_NAME` : nom personnalisable.

### Configuration Netlify

Dans les variables d’environnement du site Netlify, définir `AUTH_SECRET` avec une valeur générée par exemple avec `openssl rand -hex 32`, puis relancer le déploiement. Utiliser un secret différent par environnement, ne pas utiliser la valeur d’exemple de `.env.example` et ne jamais publier ce secret sur GitHub.

En production, définir aussi `DATABASE_URL` vers la base PostgreSQL de production et `DEMO_MODE=false`. Appliquer les migrations avec `npm run db:migrate:deploy` avant d’envoyer le trafic vers la nouvelle version. Importer toute ancienne déclaration avec `npm run db:import-reports -- chemin/vers/demo-reports.json` depuis un environnement sécurisé ayant accès à la base. Créer le premier administrateur une seule fois depuis un terminal sécurisé avec la même URL de base : `npm run db:create-admin`. Ne pas placer le mot de passe administrateur dans les variables de déploiement.

En mode démo, les comptes JSON sont chargés depuis `POLICE_DATA_DIR` si cette variable est définie, sinon depuis `%LOCALAPPDATA%\PoliceMali\demo-users.json` sous Windows ou `data/demo-users.json` ailleurs. Ce stockage est réservé au développement et n’est pas persistant en production. Supprimer tout ancien `demo-users.json` des environnements déployés et conserver `DEMO_MODE` désactivé.

## Feuille de route prioritaire

1. Ajouter des transactions et un audit append-only aux opérations métier.
2. Implémenter RBAC fin côté serveur et cloisonnement par service.
3. Finaliser déclaration, récupération, restitution et chronologie.
4. Finaliser la gestion administrative des comptes et le verrouillage.
5. Sécuriser documents, chiffrement, sauvegardes et observabilité.
6. Réaliser audits de sécurité, charge, accessibilité et conformité au cadre malien applicable.
