This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

28-02-2026

# DigestKit

Application de suivi santé digestive.
Mobile-first.
Basée sur Supabase + Next.js.



---

# Stack

- Next.js App Router
- Supabase Auth
- PostgreSQL
- JSONB (meta)
- TailwindCSS
- TypeScript

---

# Architecture

La table centrale est :

daily_entries

Chaque module (pain, mood, symptoms) écrit dans :

meta (jsonb)

Important :
Toujours fusionner meta.
Ne jamais l’écraser entièrement.


meta

Cela permet :

- d’éviter la multiplication de tables
- de garder une architecture simple
- d’ajouter facilement de nouveaux modules

---

# Structure du champ meta

Exemple :

json
{
  "pain_unusual": true,
  "pain_spots": [
    { "zone": "head", "text": "migraine pulsatile" },
    { "zone": "abdomen", "text": "douleur après repas" }
  ],
  "mood_tags": ["uuid1", "uuid2"],
  "mood_note": "journée stressante",
  "symptom_tags": ["uuid3"],
  "symptom_note": "nausée légère",
  "custom_sections_notes": {
    "section_uuid": "note du jour"
  }
}

---

# Modules actuels

Douleurs :

intensité de la douleur
douleur inhabituelle (étoile)
sélection de zones corporelles
description par zone
numérotation automatique des zones

Moral :

intensité du moral
tags personnalisables
note libre

Symptômes :
tages personnalisables
note libre

sections personnalisées :

L’utilisateur peut créer ses propres sections.

Exemples :
alimentation
médicaments
sommeil
activité physique

Les sections :
sont persistantes
apparaissent chaque jour
contiennent une note quotidienne

# Structure des routes

/app : écran d'accueil
/app/pain : module douleurs
/app/mood : module moral
/app/symptoms : module symptômes
/app/new : création d'une section personnalisée
/app/sections/[id] : page d'une section personnalisée

---

# RLS

Toutes les tables ont Row Level Security activé.
Toutes les requêtes filtrent par user_id.
//Cela évite les décalages liés aux timezones

---

# Lancer en local

Installer les dépendances:
npm install

lancer le serveur:
npm run dev

ouvrir ensuite:
http://localhost:3000

---

# Philosophie

Code simple.
Structure claire.
Évolutif.
Pas de parsing fragile.
Flexibilité grâce à JSONB.
Eviter la sur-ingénierie.
Pas de hacks.

---

# Gestion des dates

Ne jamais utiliser toISOString().

Toujours utiliser :
function toISODate(d: Date)
//Cela évite les décalages liés aux timezones

basé sur :
getFullYear()
getMonth()
getDate()

---

# Etat actuel du projet

fonctionnel:
- authentification Supabase
- saisies douleurs
- zones douloureuses annotées
- douleur inhabituelle
- suivi
- saisie moral
- saisie symptômes
