# lg-panel

Arbitrage en direct des *Loups-Garous de Thiercelieux* : un serveur fait autorité, trois écrans s'y connectent.

| Vue | Appareil | Rôle |
|---|---|---|
| `/mj` | téléphone du meneur | déroule la partie : rites de nuit, cartes, vote. Aucun bouton son ni lumière. |
| `/regie` | PC relié aux lumières | conduite de cues lancées avec **GO** (barre espace), son, lumière, écran public |
| `/public` | TV reliée à la sono de la salle | nuit, révélations du matin, débat, vote, victoire. Joue le son du spectacle (sortie réglable dans la régie) : appuyer une fois sur OK de la télécommande pour l'activer. Ne reçoit aucune information secrète. |

## Lancer

```bash
npm install
npm run dev     # serveur + interface, affiche le QR code à scanner avec le téléphone du MJ
npm start       # même chose en production (build puis serveur unique sur le port 3000)
npm test        # règles, projection publique, conduite, undo/redo, rejeu du journal
```

Le QR code contient un jeton d'accès (stocké dans `data/token.txt`). Sans lui, `/mj` et `/regie` refusent les connexions venant du réseau. Le PC qui fait tourner le serveur n'en a pas besoin.

Variables d'environnement : `PORT` (3000), `LIGHT_ENGINE_URL` (sans elle, les lumières sont simulées dans la console), `LG_DATA_DIR` (`data/`).

## Données

Tout est dans `data/` (ignoré par git) :
- `session.jsonl` : journal de chaque action, annulation et rétablissement. Il est rejoué au démarrage : un crash ou un redémarrage reprend la partie à l'identique, historique d'annulation compris.
- `show.json` : état de la régie (cues jouées, écran affiché).
- `presets.json` : compositions enregistrées depuis l'écran de préparation.
- `lnb.json` : `{ "apiKey": "lnb_…" }`, la clé du site du BDE. Le bouton **Inscrits** de l'écran de préparation remplit les sièges avec les inscrits de « Soirée Loup-Garou et Among Us » (prénom seul, initiale du nom en cas d'homonyme). `LNB_API_KEY` et `LNB_EVENT` remplacent la clé et le nom de l'événement.

## Personnaliser

- **Cartes** : déposer les scans dans `public/cards/<roleId>.jpg` (ex. `public/cards/voyante.jpg`). Les identifiants sont listés dans `shared/roles.ts`. Sans scan, une carte gravée de remplacement s'affiche.
- **Sons** : `public/audio/<nom>.mp3`, noms listés dans `src/lib/audio.ts`. Garder le volume harmonisé (-16 LUFS pour les effets, -23 LUFS pour les ambiances) : le moteur ne corrige pas le volume fichier par fichier.
- **light-engine** : les routes appelées sont isolées dans `server/light.ts` (`POST /api/scenes/:name`, `/api/target`, `/api/strobe`, `/api/blackout`, `GET /api/status`). Si l'API change, seul ce fichier est à modifier.

## Architecture

```
shared/   types, rôles, règles, reducer pur, conduite de cues, projection publique, protocole WebSocket
server/   Hono + ws : store (undo/redo + journal), hub (rôles, jeton, heartbeat, anti-doublon), show (régie), light
src/      React + Zustand : mj/ (Gravure Almanach), regie/ (Flat), public/, setup/, lib/ (connexion, audio, minuteur)
tests/    Vitest
```
