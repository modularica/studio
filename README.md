# studio

Uzay's page: the games Uzay and his dad make together.

| Path | Game |
|---|---|
| `/fish/` | Fish: a top-down koi pond game, alone or with friends in rooms (server in `fish/sunucu`) |
| `/yelken/` | Rüzgâr Kaptanı: a step-by-step sailing school |
| `/songbox/` | SONGbox: put characters on stage and build a song |
| `/sur-muhafizi/` | Sur Muhafızı: a 20-wave tower defense |
| `/sekme/` | Sekme: bounce the ball off walls to hit the target, 50 levels |

## Run locally

```sh
npx serve .
```

Deployed on Vercel: every push to `main` goes live, other branches get a preview URL. See `CLAUDE.md` for how to add a game.

Every page is behind a sign-in (Supabase Auth; anyone can sign up with just a username and password, and an account can hold several players). Play sessions and game saves live in Supabase; `/takip/` shows who played what. See the "Hesap sistemi" section in `CLAUDE.md`.
