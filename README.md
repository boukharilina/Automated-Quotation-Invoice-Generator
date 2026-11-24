# EDUTEST – Devis & Factures

Application web de génération et de suivi des devis, factures et paiements (TVA 19 %, TND), en français.
Stack : Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL · PDFKit · ExcelJS.

## Démarrage

```bash
npm install
cp .env.example .env.local      # puis ajuster AUTH_SECRET (et DATABASE_URL en production)
npm run dev                     # http://localhost:3000
```

- **Sans `DATABASE_URL`** : une base PostgreSQL embarquée (PGlite, dossier `data/`) est utilisée – pratique pour tester, **pas pour la production**.
- **Avec PostgreSQL** : `docker compose up -d` puis définir `DATABASE_URL=postgresql://edutest:edutest@localhost:5432/edutest`. Le schéma est créé automatiquement au premier lancement.
- Production : `npm run build && npm start`, avec `AUTH_SECRET` (obligatoire) et `DATABASE_URL`.

Premier compte administrateur (créé uniquement si la table `users` est vide) : `ADMIN_EMAIL` / `ADMIN_PASSWORD`
(défaut `admin@edutest.tn` / `Edutest2026!` – **à changer immédiatement** dans *Paramètres → Utilisateurs*).

> Windows : si le chemin du projet contient `&` ou des espaces, `npm run …`/`npx` peuvent échouer ; lancez `node node_modules/next/dist/bin/next dev` ou déplacez le dossier.

## À configurer avant usage (Paramètres, administrateur)
Adresse, téléphone, matricule fiscal, banque, **RIB**, logo (PNG/JPEG), conditions de paiement, prix des services.
Le service « Frais de dossier administratif / candidature » est créé à **0,000 TND** : renseignez son montant.

## Rôles
| Rôle | Accès |
|---|---|
| Administrateur | Tout, y compris paramètres, services, utilisateurs, journal d'audit |
| Comptabilité | Clients, devis, factures, paiements, remises/frais, tableau de bord, exports |
| Équipe commerciale | Clients et devis (sans remises), archives de ses documents |

## Règles métier
- Montants calculés côté serveur en millimes (entiers) : 3 500 HT → 665 TVA → 4 165 TTC. La TVA s'applique après remise et frais additionnels.
- Numérotation séquentielle atomique par année (`DEV-2026-0001`, `FAC-2026-0001`, `REC-2026-0001`, clients `CLI-0001`) + contrainte d'unicité en base.
- Devis : brouillon → envoyé → accepté/refusé ; expiration automatique à la date de validité ; un devis accepté se convertit en un clic en facture liée (clients, lignes, prix, TVA conservés).
- Factures : seuls les brouillons sont modifiables ; paiements partiels/totaux avec verrouillage de ligne, solde et statut recalculés automatiquement ; retard automatique après l'échéance ; une facture avec paiements ne peut pas être annulée.
- Chaque opération financière est inscrite dans `audit_log` (consultable dans *Journal d'audit*).
- Archives : documents classés par année puis par client ; PDF générés dynamiquement.

## Tests
`npm test` (calculs de TVA, formats TND, montants en lettres) · `npm run typecheck`.

## Déploiement sur Vercel
1. Créez une base PostgreSQL hébergée (Neon, Supabase ou Vercel Postgres) et copiez l'URL « pooled ».
2. Poussez le projet sur GitHub et importez-le dans Vercel.
3. Variables d'environnement : `DATABASE_URL`, `AUTH_SECRET` (longue chaîne aléatoire), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
4. Déployez. Le schéma et le compte administrateur sont créés à la première requête ; changez ensuite le mot de passe.
La base embarquée (PGlite) ne fonctionne pas sur Vercel (disque éphémère) : `DATABASE_URL` est obligatoire.
