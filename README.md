# Manufacturing Cost Impact Analyzer

A mobile-first PWA for identifying, calculating, and validating cost savings
from manufacturing process improvements using absorption-based cost
accounting.

All data (data model values, calculations, saved assessments) is stored
**locally in your browser** via `localStorage`. Nothing is sent to a server.
There is no backend in this version.

## Project structure

```
.
├── index.html            entry HTML (loads fonts, mounts the app)
├── vite.config.js         Vite + PWA plugin config (manifest, service worker)
├── package.json
├── public/
│   ├── icon-192.png       app icon (home screen / install prompt)
│   └── icon-512.png       app icon (splash / store listing size)
└── src/
    ├── main.jsx           React root
    ├── App.jsx            the entire app (all 6 tabs, calc engine, matrix config)
    └── index.css          minimal global reset
```

## 1. Run it locally first (optional but recommended)

```bash
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`).

## 2. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Manufacturing Cost Impact Analyzer"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(Create the empty repo on GitHub first if you haven't already — no README/license,
so it doesn't conflict with this push.)

## 3. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. Import the repo you just pushed.
3. Framework preset: Vercel should auto-detect **Vite** — leave build command
   as `npm run build` and output directory as `dist`.
4. Click **Deploy**. You'll get a live URL like
   `https://your-project.vercel.app`.

Every time you `git push` to `main` after this, Vercel redeploys automatically.

## 4. Install it on your phone

Open your Vercel URL on your phone's browser, then:

- **iPhone (Safari):** tap the Share icon → **Add to Home Screen**.
- **Android (Chrome):** tap the ⋮ menu → **Add to Home screen** / **Install app**.

It'll behave like a native app icon and open full-screen, no browser chrome.

## Notes / known limitations (v1)

- **No cross-device sync.** Data lives in that one browser on that one device.
  Clearing site data/cache will erase it.
- **CSV export** downloads a file via the browser's native download — this
  works well on desktop and Android Chrome; on iOS Safari it may open in a
  new tab instead of downloading directly, depending on iOS version.
- **Reset All Data** button lives in the Saved Assessments tab if you need to
  wipe everything and start fresh.
- If you want this to eventually sync across your phone, laptop, and
  coworkers, the natural next step is adding a real backend (e.g. Supabase,
  Firebase, or a small API) in place of `localStorage` — happy to help with
  that when you're ready.
