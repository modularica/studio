# studio

Uzi Games (uzigames.com): the games Uzay and his dad make together.

- `/` is the public studio page (coming soon).
- `/lab/` is the Lab: Uzay's page with every game in testing, behind a sign-in, for invited players.

| Path | Game |
|---|---|
| `/lab/fish/` | Fish: a top-down koi pond game, alone or with friends in rooms (server in `fish/sunucu`) |
| `/lab/yelken/` | Rüzgâr Kaptanı: a step-by-step sailing school |
| `/lab/songbox/` | SONGbox: put characters on stage and build a song |
| `/lab/sur-muhafizi/` | Sur Muhafızı: a 20-wave tower defense |
| `/lab/sekme/` | Sekme: bounce the ball off walls to hit the target, 50 levels |
| `/lab/kar-savasi/` | Kar Savaşı: an open-world snowball fight against waves of kids |
| `/lab/kanyon/` | Kanyon: fly a jet over a canyon river, refuel, blow up the bridges |
| `/lab/tank/` | Tank Arenası: 2–8 tanks, every hit is a point; against bots or with friends in rooms (server in `fish/sunucu`) |

## Run locally

```sh
npx serve .
```

Deployed on Vercel: every push to `main` goes live, other branches get a preview URL. See `CLAUDE.md` for how to add a game.

Every page is behind a sign-in (Supabase Auth; anyone can sign up with just a username and password, and an account can hold several players). Play sessions, game saves and "Nasıldı?" feedback live in Supabase; `/lab/takip/` shows who played what and `/lab/yorumlar/` shows the feedback (all of it for admins). See the "Hesap sistemi" section in `CLAUDE.md`.
