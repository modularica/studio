# fish-odalar

The room server for Fish (`/lab/fish/` → "Play with friends"), Tank Arenası (`/lab/tank/` → "Arkadaşlarla oyna") and Kar Savaşı (`/lab/kar-savasi/` → "Arkadaşlarla oyna"). The game pages are in `lab/fish/`, `lab/tank/` and `lab/kar-savasi/`. A Cloudflare Worker with four kinds of Durable Objects:

- `Lobi` (one object): the room list. Pages on the Rooms screen keep a websocket open and get the list pushed whenever a room changes.
- `Oda` (one object per room): the waiting room, a shared pond for a five-minute round, and the results. It runs the pond at 20 steps a second and sends each koi a snapshot 10 times a second.
- `TankOda` (one object per tank room, `src/tank-oda.js`): the waiting room (the host can fill empty places with bots), a three-minute round and the results. The tank rooms' list is a second `Lobi` object, named `tank`.
- `KarOda` (one object per Kar Savaşı room, `src/kar-oda.js`): the waiting room, a co-op game against the waves (it goes on until everyone is down at once; anyone can join in the middle) and the results. The list is a third `Lobi` object, named `kar`.

Tank Arenası's rules (map, movement, shots, bots) are in `lab/tank/oyun.js`, which both the page and `src/tank-oda.js` import, so they can't drift apart. Kar Savaşı works the same way with `lab/kar-savasi/oyun.js` (the forest from a seed, waves, the kids and their throws, hits, falls, getting up, snow piles, cocoa): the server runs the battle at 30 steps a second and sends a snapshot 15 times a second; each page walks its own player, keeps its own snowball pocket and says when it throws (`a`). The server runs the arena at 30 steps a second and sends everyone a snapshot 15 times a second; each page drives its own tank and reports where it is, and says when it fires (`a`). Shots, hits, points and bots are decided on the server.

Each page moves its own koi and reports where it is (15 times a second). The server checks that the move is possible, and decides everything else: wild fish, who eats whom, bites, deaths, sizes. Players prove who they are with their Supabase access token; the server asks Supabase whose token it is and whether the chosen player belongs to them.

## Run locally

```sh
npm install
npx wrangler dev --var AUTH_YOK:1
```

`AUTH_YOK:1` skips the Supabase check (only for local testing). In the browser, point Fish at the local server with `localStorage.setItem('fish.sunucu', 'ws://127.0.0.1:8787')` and reload; Tank Arenası with `localStorage.setItem('tank.sunucu', 'ws://127.0.0.1:8787')`; Kar Savaşı with `localStorage.setItem('karSavasi.sunucu', 'ws://127.0.0.1:8787')`. `--var TANK_TUR:30` makes tank rounds 30 seconds long.

## Deploy

Cloudflare Workers Builds deploys this folder on every push to `main` (root directory `fish/sunucu`, deploy command `npx wrangler deploy`). The Worker's name in the dashboard must be `fish-odalar`, the same as in `wrangler.toml`.

## Files

| File | |
|---|---|
| `src/index.js` | Routes: `/lobi`, `/oda/<8 letters>`, `/tank/lobi`, `/tank/oda/<8 letters>`, `/kar/lobi`, `/kar/oda/<8 letters>` |
| `src/lobi.js` | The room list |
| `src/oda.js` | One room: connections, the round, wild fish, eating and biting, snapshots |
| `src/kurallar.js` | Game rules shared with `lab/fish/index.html` (species sizes, growth, speeds) |
| `src/dogrula.js` | Checks the Supabase token and the player |
| `src/tank-oda.js` | One tank room: connections, bots setting, the round, snapshots |
| `../../lab/tank/oyun.js` | Tank rules, shared with the page |
| `src/kar-oda.js` | One Kar Savaşı room: connections, the co-op game, snapshots |
| `../../lab/kar-savasi/oyun.js` | Kar Savaşı rules, shared with the page |

## Messages

Page → server: `merhaba {token, profil, kur, ekran}`, `k {x, y, a, v, h}` (my koi), `basla` (host only), `ekran {e}`, and the text `ping`.

Server → page: `hos {ben}`, `oda {durum, kurucu, oyuncular}`, `basla {R, kalan}`, `dog {x, y, a, l, h, can}` (you are in the pond), `d` (snapshot: `p` koi, `f` wild fish, `e` events, `m` my stats), `isir`, `oldun`, `duz` (position correction), `son {sonuc}` (results), `hata {neden}`.

Tank rooms, page → server: `merhaba {token, profil, kur, surum}`, `k {x, y, vx, vy, g, tr, h}` (my tank), `a {x, y, a, s}` (I fired; `s` counts up), `basla` and `bot {n, z}` (host only), and `ping`.

Tank rooms, server → page: `hos {ben, surum}`, `oda {durum, kurucu, oyuncular, bot, zorluk, tanklar}`, `basla {tohum, n, kalan, tur, tanklar}` (the page builds the same map from `tohum` and `n`), `s` (snapshot: `p` tanks, `e` events: `m` shot, `v` hit, `k` shield, `x` shot stopped, `o` painted out, `d` back in, `c` left), `duz`, `son {sonuc}`, `hata {neden}`.

Kar Savaşı rooms, page → server: `merhaba {token, profil, kur, surum}`, `k {x, y, vx, vy, g, h}` (my player; `g` how far my screen reaches, `h` counts placements), `a {x, y, ux, uy, m, s}` (I threw; `m` how far, `s` counts up), `basla` (host only), and `ping`.

Kar Savaşı rooms, server → page: `hos {ben, surum}`, `oda {durum, kurucu, oyuncular, kadro, dalga}`, `basla {tohum, tur, kadro, ben, alinan, kakao, dalga, puan}` (the page builds the same forest from `tohum`; `alinan` are the snow piles taken right now), `s` (snapshot: `w` wave, break, score, kids left; `p` players; `d` kids; `e` events, the list above `Battle` in `oyun.js`), `duz`, `son {sonuc}`, `hata {neden}`.

## Free plan budget

A room only runs its loop during a round. Outgoing websocket messages are free; incoming ones count 20 to 1 as requests. Five minutes with 8 koi is about 36,000 incoming messages (≈1,800 requests) and well under the daily duration allowance. A three-minute tank round with 8 players is about 25,000 incoming messages (≈1,250 requests); bots cost nothing extra. A Kar Savaşı game has no time limit, but the waves keep getting harder: ten minutes with 4 players is about 36,000 incoming messages (≈1,800 requests).
