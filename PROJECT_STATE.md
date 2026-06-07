# DIGESTKIT – PROJECT STATE (v3 META ARCHITECTURE)

## Contexte Produit

- Nom : DigestKit
- Pays cible : France
- Web app mobile-first
- Produit gratuit
- Authentification : Supabase email + confirmation
- RGPD : consentement versionné stocké en base
- Données personnelles isolées par RLS

---

# Architecture Technique

## Stack

- Next.js (App Router)
- Supabase (Auth + Postgres)
- PostgreSQL
- JSONB (`meta`) pour stockage flexible
- TailwindCSS
- Session gérée côté client
- RLS activé sur toutes les tables

---
---

# Database

## daily_entries

Primary key :
(user_id, entry_date)

Colonnes :

- pain_level (int nullable)
- mood_level (int nullable)
- meta (jsonb)
- created_at
- updated_at

---

## mood_states

États persistants du moral personnalisables.

---

## symptom_states

États persistants du moral personnalisables.

## custom_sections

Sections dynamiques créées par l'utilisateur.
Persistantes pour tous les jours.

---

## user_consents

Stockage consentement RGPD.

---

### Structure du champ meta

```json
{
  "pain_unusual": true,
  "pain_spots": [
    { "zone": "tete", "text": "migraine pulsatile" }
  ],
  "mood_tags": ["uuid1", "uuid2"],
  "mood_note": "journée difficile",
  "symptom_tags": ["uuid3"],
  "symptom_note": "nausée légère",
  "custom_sections_notes": {
    "section_uuid": "note du jour"
  }
}

# Fonctionnalités stables

Auth ✔
Consent ✔
Pain ✔
Mood ✔
Symptoms ✔
Fusion meta ✔
Timezone corrigée ✔
Étoile inhabituelle ✔
Affichage semaine ✔

---

# UX actuelle

Accueil :
- Sélecteur semaine
- Ronds rouge (douleur)
- Ronds jaune (moral)
- Étoile sur rond rouge si inhabituelle

Cartes :
- Douleurs (intensité + inhabituelle + localisation et description des douleurs)
- Moral (intensité + tags)
- Symptômes (tags sélectionnés)
- Médications (placeholder)
- carte vierge (description libre)

---

# Architecture propre

- Plus aucun parsing regex
- Plus aucun toISOString
- Fusion meta obligatoire
- Notes = texte libre uniquement