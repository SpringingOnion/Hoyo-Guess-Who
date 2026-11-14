# Hoyo Guess Who

Guess Who for two phones, with characters from **Genshin Impact**, **Honkai: Star Rail** and **Zenless Zone Zero**.
It's an installable web app (PWA): no Play Store, no APK, and it works offline once installed.

## How to play

1. Player 1 picks a game, a board size and optionally **filters** (rarity, element, weapon/path/specialty, region, gender), then taps **Start new game**. A code like `G24-K7QXA` appears in the top bar.
2. Player 2 enters that code under **Join a friend's game**, which gives both phones the same board. The filters are part of the code.
3. Each phone secretly picks its own character. Tap **My character** to see it.
4. Take turns asking yes/no questions out loud and tap cards to flip them down. **Undo** reverses a mistake.
5. **Guess** shows your guess full-screen for the other player to confirm.

## Install on Android

1. Open the hosted URL in Chrome.
2. Tap **⋮ → Add to Home screen → Install**.
3. Open it once while online. After that it runs fully offline, with every portrait cached.

## Development

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN IP for phone testing)
npm run build      # production build in dist/
npm run roster     # refresh characters + portraits from the data sources
npm run update     # roster + build
```

## Getting new characters

**Automatic (GitHub Pages):** `.github/workflows/update-characters.yml` checks the data sources every Wednesday and Thursday.
If there are new characters it commits them and redeploys. You can also run it any time from the repo's
*Actions → Update characters → Run workflow*. The run summary lists who was added.

**By hand:** run `npm run update` (fetches characters and builds), then commit and push, or re-upload `dist/`.
The script prints new and removed characters, and flags new ones missing a gender so you can add them to `data/overrides.json`.

**On the phones:** installed copies pick up a new version when opened online, or tap **Check for updates** at the bottom of the home screen.
Room codes include a one-letter fingerprint of the character list. If two phones have different lists, the joining phone shows a warning instead of quietly building a different board.

### Data

- `scripts/build-roster.mjs` pulls character data and official icons from
  [Yatta](https://gi.yatta.moe) (Genshin and Star Rail) and the [Enka.Network](https://github.com/EnkaNetwork/API-docs) store (ZZZ),
  converts the icons to 192px WebP in `public/portraits/` and writes `src/data/roster.json`.
- `data/overrides.json` holds hand fixes merged on top of that data (for example, renaming a character).

### Hosting

Any static host works, since the build uses relative paths:

- **GitHub Pages:** push to a GitHub repo, then go to *Settings → Pages → Source: GitHub Actions*. `.github/workflows/deploy.yml` builds and deploys on every push to `main`.
- **Netlify Drop:** run `npm run build` and drag the `dist/` folder onto https://app.netlify.com/drop.

Fan-made and non-commercial. Character names and art © HoYoverse.
