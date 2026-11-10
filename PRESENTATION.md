# DECLARATION/MALI — Plateforme de déclaration d'objets

## 1. Contexte et besoin

Au Mali, les déclarations d'objets volés ou retrouvés sont souvent gérées de manière manuelle, dispersée et peu traçable. Les victimes peinent à prouver la propriété de leurs biens, les forces de sécurité manquent d'un outil centralisé pour vérifier rapidement un objet (IMEI, plaque, numéro de série) et les statistiques sont difficiles à produire.

**Besoin résolu :**
- Centraliser l'enregistrement des déclarations d'objets volés/retrouvés.
- Permettre la vérification instantanée d'un objet par tout agent habilité.
- Garantir la traçabilité (qui a déclaré, quand, par quel service).
- Produire des statistiques opérationnelles fiables.
- Restituer les objets retrouvés à leurs propriétaires de façon documentée.

## 2. Objectifs

1. **Enregistrement structuré** : formulaire de déclaration avec identité du déclarant, description de l'objet, identifiants (IMEI, plaque, série), lieu, date, PV.
2. **Vérification universelle** : saisie d'un IMEI/plaque → résultat rouge « OBJET SIGNALÉ VOLÉ » ou formulation neutre.
3. **Traçabilité complète** : historique par dossier, audit des actions, rôles et permissions.
4. **Tableau de bord opérationnel** : statistiques par période, service, catégorie.
5. **Sécurité et confidentialité** : sessions HTTP-only signées, RBAC, chiffrement des champs sensibles, audit append-only à ajouter.
6. **Accessibilité mobile** : interface responsive, manifeste PWA, utilisation terrain.

## 3. Fonctionnalités principales

- Connexion par matricule + mot de passe (session signée JWT, 30 min).
- Protection des pages internes par rôle.
- Tableau de bord responsive.
- Vérification rapide IMEI/plaque avec normalisation.
- Formulaire structuré de nouvelle déclaration.
- Schéma Prisma complet : utilisateurs, rôles, services, objets, identifiants, récupération, restitution, audit, recherches, notifications.
- Aucun compte ni dossier d’exemple n’est conservé ; les comptes sont persistés dans PostgreSQL et le premier `SUPER_ADMIN` est créé par une commande interactive.
- Manifeste PWA et interface mobile.

## 4. Architecture

- **Frontend/Backend** : Next.js (App Router) + React 19.
- **Base de données** : comptes, déclarations et données 2FA persistés dans PostgreSQL via Prisma.
- **Authentification** : JWT signé (jose), cookies `__Host-` HTTP-only, SameSite strict.
- **Sécurité** : CSP avec nonce, X-Frame-Options, Referrer-Policy, rate limiting, validation Zod, same-origin.
- **Déploiement** : Docker Compose (PostgreSQL), reverse proxy HTTPS.

## 5. Sécurité mise en œuvre

- Secret AUTH_SECRET fort (≥ 32 caractères aléatoires).
- TOTP obligatoire pour tous les utilisateurs dès la première connexion, puis après 12 heures sans connexion, avec codes de récupération à usage unique.
- `ALLOW_INSECURE_LOCALHOST=false` en production.
- Rate limiting par IP (global) et par compte (login).
- Validation stricte des entrées (Zod).
- Protection CSRF (same-origin).
- Sessions révocables, expiration 30 min.
- En-têtes de sécurité (CSP, X-Frame-Options, nosniff, Referrer-Policy).
- Champs personnels des déclarations chiffrés par l’application ; externalisation des clés vers KMS/HSM à prévoir.

## 6. Public cible

- Police nationale du Mali (agents, commissariats, services spécialisés).
- Citoyens victimes de vol (déclaration).
- Autorités judiciaires (consultation).

## 7. Valeur apportée

- Réduction du temps de vérification d'un objet de plusieurs heures à quelques secondes.
- Diminution des fraudes et des déclarations frauduleuses.
- Amélioration de la coordination entre services.
- Production de statistiques fiables pour la décision.

## 8. Feuille de route

1. Ajouter des transactions et un audit append-only aux opérations métier.
2. RBAC fin côté serveur et cloisonnement par service.
3. Ajouter une chronologie des dossiers et la traçabilité détaillée des actions.
4. Finaliser gestion administrative des comptes et verrouillage.
5. Chiffrement, sauvegardes, observabilité.
6. Audits de sécurité, charge, accessibilité, conformité.

---

*Document généré pour la présentation de la plateforme DECLARATION/MALI.*