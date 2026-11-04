# ArchiMétro

Plan de métro 3D pour cartographier l'architecture d'une organisation (point de vue Organisation, ArchiMate).
Le produit est livré **vierge** : tout se construit depuis l'éditeur intégré.

## Démarrer

```bash
npm install
npm run dev          # http://localhost:3000
```

Sans configuration, les cartes sont gardées dans le `localStorage` du navigateur (pratique pour tester).

## Pages

| Route | Rôle |
| --- | --- |
| `/` | Accueil : nombre de cartes disponibles, « Ajouter une carte », « Ouvrir », « Éditer », « Supprimer ». Léger : n'embarque pas la scène 3D. |
| `/cartes/nouvelle` | Création d'une carte (titre, sous-titre), puis ouverture de l'éditeur. |
| `/cartes/[id]` | Lecture : le plan 3D, sans outils d'édition. |
| `/cartes/[id]/edit` | Édition : le plan 3D avec les « + » (créer l'arbre : lignes, embranchements, cartes) et le panneau latéral d'édition d'une carte. |

Pas de mot de passe pour l'instant (voir « Sécurité »). Le mode lecture ou édition est défini par la route, pas par l'URL (`?edit=1` n'existe plus).

## Brancher Supabase

1. Créer un projet Supabase, exécuter `supabase/schema.sql` dans l'éditeur SQL (il crée aussi le bucket `cards`).
2. Copier `.env.example` en `.env.local` et renseigner `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Relancer. Les cartes, lignes, stations, opérations, relations et photos sont alors enregistrées dans Supabase.

## Utiliser l'éditeur

- **« + Créer la première ligne »** sur une carte vierge (page `/cartes/[id]/edit`) : nom, couleur, première carte.
- **« + » au bout d'une ligne** : prolonger (direction à 45°, longueur) et poser une carte au bout. C'est ainsi qu'on fabrique le zigzag.
- **« + » entre deux cartes** : insérer une carte au milieu.
- **Clic sur une carte** : panneau d'édition (titre, photo, description, type, opérations, source, lien).
  - **Embranchement** : nouvelle ligne (autre couleur) qui part de cette station.
  - **Relier à…** : relation vers une autre station (type pris dans la liste fermée des connecteurs).
- **Légende, ✎ à côté d'une ligne** : renommer, changer la couleur, supprimer.

## Où modifier quoi

| Fichier | Rôle |
| --- | --- |
| `data/qualifiers.ts` | Types de stations (acteur, rôle, processus…) et leur symbole |
| `data/connectors.ts` | Types de relations et style de trait |
| `app/globals.css` | Thème : couleurs et polices (variables en haut du fichier) |
| `supabase/schema.sql` | Schéma de la base |
| `lib/geometry.ts`, `lib/layout.ts` | Tracé des lignes (segments à 45°, coins arrondis) |
| `lib/camera.ts`, `components/MetroMap.tsx` | Scène 3D, caméra, zoom |

## Navigation

Molette / pincer : zoom · Glisser : déplacer · Clic droit + glisser : tourner et incliner · Clic : ouvrir une carte ·
← → : même ligne · ↑ ↓ : station suivante · V : vue d'ensemble · T : mode épuré · B / N : fond clair / sombre · Échap : fermer.

## Sécurité (à régler avant la mise en ligne publique)

L'éditeur n'a **pas de mot de passe** et `supabase/schema.sql` ouvre l'écriture à tout le monde (policies « ecriture ouverte »).
Quiconque connaît l'URL et la clé anon du projet peut modifier la carte. Avant d'exposer le site :
supprimer ces policies et les remplacer par une écriture réservée aux utilisateurs authentifiés (Supabase Auth).
