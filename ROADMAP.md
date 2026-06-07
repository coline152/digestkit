# DigestKit Roadmap

# ROADMAP — DigestKit

## Phase actuelle — MVP solide

✔ Pain
✔ Mood
✔ Symptoms
✔ Accueil enrichi
✔ Fusion meta stable

---

### Architecture
- Migration complète vers JSONB `meta`
- Suppression du stockage texte legacy
- Nettoyage des dépendances inutiles

### Fonctionnalités
- Douleurs avec intensité
- Douleur inhabituelle (étoile)
- Zones corporelles annotées
- Numérotation automatique des zones
- Suppression de zone

- Moral avec états persistants
- Note texte morale
- Symptômes persistants
- Sections dynamiques personnalisables
- Suppression de section

### UX
- Semaine alignée sur date sélectionnée
- Correction bug timezone
- Pastilles visuelles dynamiques

## PROCHAINES PRIORITES UX
## 2.1 Fluidité & Feedback

- Indicateur visuel de sauvegarde réussie
- Animation micro-interaction sélection zone
- Transition douce entre dates
- Désactivation intelligente boutons pendant save

## 2.2 Ergonomie

- Réorganisation visuelle cartes accueil
- Uniformisation tailles pastilles
- Optimisation contraste couleurs
- Amélioration affichage mobile petits écrans

## 2.3 Sections dynamiques

- Réordonner les sections (drag & drop)
- Changer le nom d’une section
- Icône personnalisée par section

## Phase 2 — Analyse

- Graphique évolution douleur
- Graphique évolution moral
- Corrélation symptômes ↔ douleur
- Vue mensuelle

## analyse avancée

# avancé1: Graphiques utilisateur

- Graphique douleur 7 / 30 jours
- Graphique moral 7 / 30 jours
- Heatmap mensuelle
- Historique zones les plus touchées

# avancé2: Corrélations

- Corrélation douleur ↔ moral
- Corrélation symptômes ↔ douleur
- Détection pics récurrents

# avancé3: Synthèse automatique

- Résumé hebdomadaire automatique
- Résumé mensuel automatique
- Export PDF simplifié

---

## Phase 3 — Médications

- Table medication_states
- Tracking prise
- Historique
- Indicateur visuel accueil

---

## Phase 4 — Export

- Export PDF structuré mensuel
- export CSV
- Export RGPD complet
- Partage sécurisé médecin

---

# 🛠 PHASE 5 – TECHNIQUE & PERFORMANCE

## 5.1 Backend

- Index JSONB optimisés
- Nettoyage meta obsolète
- Scripts de migration future-proof
- Monitoring erreurs Supabase

## 5.2 Frontend

- Refactor composants partagés
- Extraction helpers date globaux
- Typage TypeScript strict
- Tests unitaires critiques

## 5.3 — Sécurité

- Suppression compte
- Anonymisation
- Logs accès
- Vérification policies RLS
- Tests accès multi-user
- Protection requêtes sensibles

---

## Phase 6 — Optimisation

- Index sur entry_date
- Normalisation relationnelle future
- Performance mobile


# 🔮 LONG TERME, app avancée


- Application mobile native
- Synchronisation offline-first
- API publique sécurisée


---
# 🧭 PRIORITÉ ACTUELLE

1. Stabilisation UX
2. Visualisation graphique
3. Export PDF
4. Performance & clean architecture

