# lg-panel

Arbitrage en direct des *Loups-Garous de Thiercelieux* : un serveur fait autorité, trois écrans s'y connectent.

| Vue | Appareil | Rôle |
|---|---|---|
| `/mj` | téléphone du meneur | déroule la partie et le spectacle sans régie. La nuit, les rites lancent leur son et leur lumière à chaque étape validée, et la nuit tombe d'elle-même sur la salle au lancement de la partie et à **La nuit tombe**. Le jour se déroule pareil, une page par étape avec **Valider** : lever du jour, chaque mort de la nuit avec son rôle, Montreur d’Ours (chaque matin tant qu’il vit : l’ours grogne ou se tait), corbeau, tir du Chasseur, capitaine, débat, vote (on y accuse et compte les voix), élimination, second vote du Juge Bègue, victoire. L'élimination, le tir du Chasseur et le lever du jour passent à l'écran dès qu'ils sont validés. La flèche d'annulation en haut défait la dernière chose faite, étape ou action, dans l'ordre : revenir sur une étape remet son écran et sa lumière (sans rejouer le son). Annuler une action efface aussi sa scène : refaite, elle repasse à l'écran. |
| `/regie` | PC relié aux lumières | facultative pendant la partie : reprend la main à tout moment, **GO** (barre espace) et **Suivant** avancent dans la même conduite. Son, lumière, écran public. Avant la partie, le panneau **Préparation** affiche la mire sur la TV, teste le son et les lumières, et signale les fichiers manquants. Le jour, le minuteur du débat se pilote aussi d'ici. Raccourcis : `1`–`9` effets, `Échap` couper, `B` blackout, `N`/`J` ambiance nuit/jour |
| `/public` | TV reliée à la sono de la salle | nuit, révélations du matin, débat, vote, victoire. Joue le son du spectacle (sortie réglable dans la régie) : appuyer une fois sur OK de la télécommande pour l'activer. Ne reçoit aucune information secrète. |
| `/revue` | PC relié aux lumières | hors partie, fait défiler tous les évènements du jeu dans l'ordre et lance leur son, leur lumière et leur écran pour les vérifier. Raccourcis : `←`/`→` évènement précédent/suivant, `Espace` rejouer, `Échap` couper. Le son d'un évènement se coupe quand on passe au suivant, sauf de Cupidon aux Amoureux. Bloquée pendant une partie. |

## Lancer

```bash
npm install
npm run dev     # serveur + interface, affiche le QR code à scanner avec le téléphone du MJ
npm start       # même chose en production (build puis serveur unique sur le port 3000)
npm test        # règles, projection publique, conduite, undo/redo, rejeu du journal
```

Le QR code contient un jeton d'accès (stocké dans `data/token.txt`, supprimer le fichier pour en générer un nouveau). Sans lui, `/mj`, `/regie` et `/revue` refusent la connexion, y compris sur le PC qui fait tourner le serveur : ouvrir la régie avec le lien `?k=…` affiché au démarrage. Le jeton est ensuite mémorisé par le navigateur et retiré de la barre d'adresse. `/public` n'en a pas besoin.

Variables d'environnement : `PORT` (3000), `LG_DATA_DIR` (`data/`), et pour les lumières `STAGEHAND_URL` (`http://localhost:3001`, vide pour les simuler dans la console), `STAGEHAND_ROOM` (`wakanda`) et `STAGEHAND_TOKEN`, à mettre dans `.env` (voir `.env.example`).

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

1. Lancer stagehand sur le port 3001 (Node 24 ou plus, `PORT=3001` dans `apps/server/.env`) : `pnpm build && pnpm start`.
2. Copier `.env.example` vers `.env` et y mettre le jeton de stagehand.
3. Lancer lg-panel : il se connecte tout seul à la salle `wakanda`.

La salle doit être active et contenir les scènes `night`, `dawn`, `debate`, `vote`, `salvateur`, `seer`, `fox`, `wolves`, `loup-blanc`, `witch`, `flute`, `cupid`, `death`, `victory-village`, `victory-wolves`, `solo`, `full`, ainsi que l'effet `lightning` sans répétition (le stroboscope). Le panneau **Préparation** signale ce qui manque.

La lune et le soleil traversent le mur du fond de gauche à droite. La lune avance à chaque étape de nuit validée par le MJ, le soleil au lever du jour, à la révélation, au débat et au vote, avec un glissement d'environ 2 s (réglages dans `SKY_MOTION`, `shared/sky.ts`). L'arc se règle dans stagehand avec les cibles `moon-start`, `moon-zenith`, `moon-end` (les deux lyres) et `sun-start`, `sun-zenith`, `sun-end` (`m2`). lg-panel réécrit en continu les cibles `moon` et `sun` : ne pas les régler à la main. Une scène n'affiche l'astre que si elle contient ses effets (`moon-1` et `moon-2`, ou `sun`).

La lumière ne vise jamais un joueur : les morts déclenchent la scène `death` (le tir du Chasseur, le stroboscope). Si stagehand tombe, la partie continue, et le dernier look est renvoyé à son retour. Un effet lancé à la main depuis un pad de stagehand reste par-dessus les scènes jusqu'à son arrêt ou un blackout.

## Architecture

```
shared/   types, rôles, règles, reducer pur, conduite de cues, projection publique, protocole WebSocket
server/   Hono + ws : store (undo/redo + journal), hub (rôles, jeton, heartbeat, anti-doublon), show (régie), light
src/      React + Zustand : mj/ (Gravure Almanach), regie/ (Flat), public/, setup/, lib/ (connexion, audio, minuteur)
tests/    Vitest
```
