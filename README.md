# lg-panel

Arbitrage en direct des *Loups-Garous de Thiercelieux* : un serveur fait autorité, trois écrans s'y connectent.

| Vue | Appareil | Rôle |
|---|---|---|
| `/mj` | téléphone du meneur | déroule la partie : rites de nuit, cartes, vote. Le matin, un bouton **Suivant** enchaîne lui-même les scènes d'ouverture du jour (lever du jour, révélation, ours, corbeau, tir du Chasseur, débat) au rythme de sa narration ; la suite reste à la régie. |
| `/regie` | PC relié aux lumières | conduite de cues lancées avec **GO** (barre espace), son, lumière, écran public. Avant la partie, le panneau **Préparation** affiche la mire sur la TV, teste le son et les lumières, et signale les fichiers manquants. Le jour, le minuteur du débat se pilote aussi d'ici. Raccourcis : `1`–`9` effets, `Échap` couper, `B` blackout, `N`/`J` ambiance nuit/jour |
| `/public` | TV reliée à la sono de la salle | nuit, révélations du matin, débat, vote, victoire. Joue le son du spectacle (sortie réglable dans la régie) : appuyer une fois sur OK de la télécommande pour l'activer. Ne reçoit aucune information secrète. |

## Lancer

```bash
npm install
npm run dev     # serveur + interface, affiche le QR code à scanner avec le téléphone du MJ
npm start       # même chose en production (build puis serveur unique sur le port 3000)
npm test        # règles, projection publique, conduite, undo/redo, rejeu du journal
```

Le QR code contient un jeton d'accès (stocké dans `data/token.txt`). Sans lui, `/mj` et `/regie` refusent les connexions venant du réseau. Le PC qui fait tourner le serveur n'en a pas besoin.

Variables d'environnement : `PORT` (3000), `LG_DATA_DIR` (`data/`), et pour les lumières `STAGEHAND_URL`, `STAGEHAND_TOKEN`, `STAGEHAND_ROOM` (si l'une manque, les lumières sont simulées dans la console).

## Données

Tout est dans `data/` (ignoré par git) :
- `session.jsonl` : journal de chaque action, annulation et rétablissement de la partie en cours. Il est rejoué au démarrage : un crash ou un redémarrage reprend la partie à l'identique, historique d'annulation compris.
- `games/` : le journal de chaque partie précédente, archivé quand la suivante est ouverte.
- `show.json` : état de la régie (cues jouées, écran affiché, écran Village autorisé ou non).
- `presets.json` : compositions enregistrées depuis l'écran de préparation.
- `lnb.json` : `{ "apiKey": "lnb_…" }`, la clé du site du BDE. Le bouton **Inscrits** de l'écran de préparation remplit les sièges avec les inscrits de « Soirée Loup-Garou et Among Us » (prénom seul, initiale du nom en cas d'homonyme). `LNB_API_KEY` et `LNB_EVENT` remplacent la clé et le nom de l'événement.

## Personnaliser

- **Cartes** : déposer les scans dans `public/cards/<roleId>.png` ou `.webp` (ex. `public/cards/voyante.png`). Les identifiants sont listés dans `shared/roles.ts`. Sans scan, une carte gravée de remplacement s'affiche.
- **Sons** : `public/audio/<nom>.mp3`, noms listés dans `src/lib/audio.ts`. Garder le volume harmonisé (-16 LUFS pour les effets, -23 LUFS pour les ambiances) : le moteur ne corrige pas le volume fichier par fichier.
- **Lumières** : voir ci-dessous.

## Lumières

Les lumières sont pilotées par [stagehand](../stagehand), un serveur séparé qui parle au DMX. Ses routes sont isolées dans `server/light.ts`.

1. Lancer stagehand sur un autre port (`PORT=3001` et `STAGEHAND_TOKEN` dans `apps/server/.env`, Node 24 ou plus) : `pnpm build && pnpm start`.
2. Y créer et activer la salle, puis créer :
   - les scènes aux ID exacts `night`, `day`, `salvateur`, `voyante`, `loups`, `loup-blanc`, `sorciere`, `flute`, `death`, `victory`, `full` ;
   - l'effet `strobe`, de type `lightning`, sans répétition.
3. Lancer lg-panel :

```bash
STAGEHAND_URL=http://localhost:3001 STAGEHAND_TOKEN=… STAGEHAND_ROOM=<id de la salle> npm start
```

Le panneau **Préparation** signale ce qui manque dans stagehand. La lumière ne vise jamais un joueur : les morts déclenchent la scène `death` (le tir du Chasseur, le stroboscope). Si stagehand tombe, la partie continue, et le dernier look est renvoyé à son retour.

## Architecture

```
shared/   types, rôles, règles, reducer pur, conduite de cues, projection publique, protocole WebSocket
server/   Hono + ws : store (undo/redo + journal), hub (rôles, jeton, heartbeat, anti-doublon), show (régie), light
src/      React + Zustand : mj/ (Gravure Almanach), regie/ (Flat), public/, setup/, lib/ (connexion, audio, minuteur)
tests/    Vitest
```
