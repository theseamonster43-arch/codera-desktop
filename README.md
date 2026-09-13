# Codera for desktop

The Codera app for Windows and macOS: Tauri 2 around a Svelte 5 frontend, talking
to the same Firebase project (`codera-46b86`) as the website and the phone app.

## Run the frontend

```
npm install
npm run dev        # http://localhost:1420
npm run check      # type-check
```

In a browser the app works as-is; window controls, the tray, desktop
notifications and the pop-out mini player only switch on inside Tauri.

## Build the app

Rust builds are blocked on this PC by Windows Smart App Control, so installers
are built by GitHub Actions (`.github/workflows/desktop.yml`):

- push to `main` → download `codera-windows` / `codera-macos` from the run's Artifacts
- push a tag `v0.1.0` → the same files on a draft GitHub Release

On a machine that can run Rust: `npx tauri dev` or `npx tauri build`.

## Layout

- `src/lib` — Firebase, live session state, actions, router, dialogs, formatting
- `src/components` — title bar, sidebar, player, cards, dialogs, celebration
- `src/pages` — Home, Watch, Shorts, You, Plus, Compose, Mini (pop-out player), SignIn, PickName
- `src-tauri` — window, tray and plugin setup
