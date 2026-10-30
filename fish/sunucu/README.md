# fish-odalar

The room server for Fish (`/lab/fish/` → "Play with friends") and Tank Arenası (`/lab/tank/` → "Arkadaşlarla oyna"). The game pages are in `lab/fish/` and `lab/tank/`. A Cloudflare Worker with three kinds of Durable Objects:

- `Lobi` (one object): the room list. Pages on the Rooms screen keep a websocket open and get the list pushed whenever a room changes.
- `Oda` (one object per room): the waiting room, a shared pond for a five-minute round, and the results. It runs the pond at 20 steps a second and sends each koi a snapshot 10 times a second.
- `TankOda` (one object per tank room, `src/tank-oda.js`): the waiting room (the host can fill empty places with bots), a three-minute round and the results. The tank rooms' list is a second `Lobi` object, named `tank`.

Tank Arenası's rules (map, movement, shots, bots) are in `lab/tank/oyun.js`, which both the page and `src/tank-oda.js` import, so they can't drift apart. The server runs the arena at 30 steps a second and sends everyone a snapshot 15 times a second; each page drives its own tank and reports where it is, and says when it fires (`a`). Shots, hits, points and bots are decided on the server.

Each page moves its own koi and reports where it is (15 times a second). The server checks that the move is possible, and decides everything else: wild fish, who eats whom, bites, deaths, sizes. Players prove who they are with their Supabase access token; the server asks Supabase whose token it is and whether the chosen player belongs to them.

## Run locally

```sh
npm install
npx wrangler dev --var AUTH_YOK:1
```

`AUTH_YOK:1` skips the Supabase check (only for local testing). In the browser, point Fish at the local server with `localStorage.setItem('fish.sunucu', 'ws://127.0.0.1:8787')` and reload; Tank Arenası with `localStorage.setItem('tank.sunucu', 'ws://127.0.0.1:8787')`. `--var TANK_TUR:30` makes tank rounds 30 seconds long.

## Deploy

Cloudflare Workers Builds deploys this folder on every push to `main` (root directory `fish/sunucu`, deploy command `npx wrangler deploy`). The Worker's name in the dashboard must be `fish-odalar`, the same as in `wrangler.toml`.

## Files

| File | |
|---|---|
| `src/index.js` | Routes: `/lobi`, `/oda/<8 letters>`, `/tank/lobi`, `/tank/oda/<8 letters>` |
| `src/lobi.js` | The room list |
| `src/oda.js` | One room: connections, the round, wild fish, eating and biting, snapshots |
| `src/kurallar.js` | Game rules shared with `lab/fish/index.html` (species sizes, growth, speeds) |
| `src/dogrula.js` | Checks the Supabase token and the player |
| `src/tank-oda.js` | One tank room: connections, bots setting, the round, snapshots |
| `../../lab/tank/oyun.js` | Tank rules, shared with the page |

## Messages

Page → server: `merhaba {token, profil, kur, ekran}`, `k {x, y, a, v, h}` (my koi), `basla` (host only), `ekran {e}`, and the text `ping`.

Server → page: `hos {ben}`, `oda {durum, kurucu, oyuncular}`, `basla {R, kalan}`, `dog {x, y, a, l, h, can}` (you are in the pond), `d` (snapshot: `p` koi, `f` wild fish, `e` events, `m` my stats), `isir`, `oldun`, `duz` (position correction), `son {sonuc}` (results), `hata {neden}`.

Tank rooms, page → server: `merhaba {token, profil, kur, surum}`, `k {x, y, vx, vy, g, tr, h}` (my tank), `a {x, y, a, s}` (I fired; `s` counts up), `basla` and `bot {n, z}` (host only), and `ping`.

Tank rooms, server → page: `hos {ben, surum}`, `oda {durum, kurucu, oyuncular, bot, zorluk, tanklar}`, `basla {tohum, n, kalan, tur, tanklar}` (the page builds the same map from `tohum` and `n`), `s` (snapshot: `p` tanks, `e` events: `m` shot, `v` hit, `k` shield, `x` shot stopped, `o` painted out, `d` back in, `c` left), `duz`, `son {sonuc}`, `hata {neden}`.

## Free plan budget

A room only runs its loop during a round. Outgoing websocket messages are free; incoming ones count 20 to 1 as requests. Five minutes with 8 koi is about 36,000 incoming messages (≈1,800 requests) and well under the daily duration allowance. A three-minute tank round with 8 players is about 25,000 incoming messages (≈1,250 requests); bots cost nothing extra.
