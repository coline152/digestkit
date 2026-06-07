# DECISIONS.LOG — DigestKit

Ce fichier trace les décisions techniques importantes du projet.
## 2024-03-20
- Douleur stockée en int (0,3,6,9)
- Douleur inhabituelle stockée en tag dans notes
- mood_level obligatoire (fallback 5 si non rempli)


---

# 2025-03 — Migration vers meta (jsonb)

## Problème initial
Les données techniques (tags mood, pain_unusual…) étaient stockées dans `notes`
avec un format texte du type :

[mood_tags:id1|id2]
[mood_note:texte]
[pain_unusual]

Cela nécessitait du parsing regex fragile et peu scalable.

## Décision

Ajout d’une colonne :

meta jsonb not null default '{}'::jsonb

dans la table daily_entries.

Toutes les données techniques sont désormais stockées dans meta.

## Structure actuelle

meta:
{
  pain_unusual: boolean,
  mood_tags: string[],
  mood_note: string,
  symptom_tags: string[],
  symptom_note: string
}

## Raison

- Structure propre
- Pas de parsing regex
- Extensible
- Lisible
- Cohérent avec Supabase

---

# 2025-03 — Fusion obligatoire de meta

Chaque module (pain, mood, symptoms) doit :

1. Lire meta existant
2. Fusionner ses propres champs
3. Upsert avec meta fusionné

Exemple :

const nextMeta = {
  ...existingMeta,
  symptom_tags: selectedTags,
  symptom_note: note
}

But : éviter qu’un module écrase les données d’un autre.

---

# 2025-03 — Correction définitive timezone

Suppression totale de toISOString().

Toutes les dates utilisent :

getFullYear()
getMonth()
getDate()

via helper toISODate().

But : éviter décalage jour -1 / +1.

---

# 2025-03 — Affichage enrichi page accueil

La page /app affiche désormais :

Douleurs :
- intensité texte
- étoile si pain_unusual
- rond rouge proportionnel
- étoile superposée au rond rouge

Moral :
- intensité texte
- tags affichés
- rond jaune proportionnel

Symptômes :
- liste des symptômes sélectionnés

---

# Convention

- Toutes les requêtes filtrées par user_id
- RLS activé sur toutes les tables
- meta toujours fusionné
- notes = texte libre uniquement

# DIGESTKIT – DECISIONS LOG

---

## 1. Migration vers JSONB meta

Raison :
éviter explosion de tables relationnelles.

Impact :
architecture flexible et évolutive.

---

## 2. 1 ligne = 1 jour

Clé composite :
(user_id, entry_date)

Simplifie logique application.

---

## 3. Pain zones numérotées

Décision UX :
numéro visible dès sélection.

Améliore lisibilité.

---

## 4. Étoile douleur inhabituelle

Stockée dans meta.pain_unusual.
Affichée sur rond rouge.

---

## 5. Sections dynamiques persistantes

Table custom_sections.
Notes quotidiennes stockées dans meta.

---

## 6. Timezone fix

Abandon complet de toISOString().
Utilisation date locale uniquement.

---

## 7. Suppression section

Suppression persistante.
Nettoyage meta du jour courant.

---

## 8. Nettoyage base

Suppression notes textuelles legacy.
Architecture 100% meta.

---

## 9. Simplicité priorisée

Pas de micro-tables inutiles.
Pas de jointures complexes.

---

Architecture actuelle validée.