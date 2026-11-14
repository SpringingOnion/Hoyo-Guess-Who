# Hoyo Guess Who

Guess Who for two phones, with characters from **Genshin Impact**, **Honkai: Star Rail** and **Zenless Zone Zero**.
It's an installable web app (PWA): no Play Store, no APK, and it works offline once installed.

## How to play

1. Player 1 picks a game and board size and taps **Start new game**. A code like `G24-K7QX` appears in the top bar.
2. Player 2 enters that code under **Join a friend's game**, which gives both phones the same board.
3. Each phone secretly picks its own character (**My character** shows it, plus its element, path and so on so you can answer questions).
4. Take turns asking yes/no questions out loud. Tap cards to flip them down, or use **Ask** to pick a question and let the app flip the board for you.
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
```

When a new character is released, run `npm run roster`, commit the new files and redeploy.
Both players need the same version for room codes to produce matching boards. Installed copies update themselves the next time they're opened online.

### Data

- `scripts/build-roster.mjs` pulls character data and official icons from
  [Yatta](https://gi.yatta.moe) (Genshin and Star Rail) and the [Enka.Network](https://github.com/EnkaNetwork/API-docs) store (ZZZ),
  converts the icons to 192px WebP in `public/portraits/` and writes `src/data/roster.json`.
- `data/overrides.json` holds hand fixes merged on top of that data (for example, Star Rail genders, which no API provides).
  If a character has no value for an attribute, the **Ask** helper never flips them for that question.

### Hosting

Any static host works, since the build uses relative paths:

- **GitHub Pages:** push to a GitHub repo, then go to *Settings → Pages → Source: GitHub Actions*. `.github/workflows/deploy.yml` builds and deploys on every push to `main`.
- **Netlify Drop:** run `npm run build` and drag the `dist/` folder onto https://app.netlify.com/drop.

Fan-made and non-commercial. Character names and art © HoYoverse.
