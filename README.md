# 🎵 Spotify Widget Local

A no-bullshit, fully local **"Now Playing"** widget for OBS Studio.  
No cloud hosting, no electron app, no browser extensions, no third-party services skimming your data.  
Just your Spotify, your OBS, and a tiny local server. That's it.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue)
![Zero Frameworks](https://img.shields.io/badge/Frameworks-Zero-ff4444)

---

## What It Does

Displays the song you're currently playing on Spotify as a clean overlay inside OBS — album art, track title, artist, live progress bar, next track preview, and a scannable Spotify Code. Updates every 3 seconds. Hides itself when nothing is playing.

## Features

- **Guided setup** — the settings page walks you through connecting Spotify step by step, with copy buttons and plain-language error messages
- **Album art** — full-res cover pulled straight from the Spotify API
- **Track title with auto-scroll** — long titles get a smooth marquee animation instead of ugly truncation
- **Artist name** — all featured artists, comma-separated
- **Smooth progress bar** — interpolates between polls for a buttery-smooth real-time feel
- **Next track preview** — shows what's coming up next in your queue
- **Album name** — optional display of the current album (toggle in settings)
- **Podcast & episode support** — detects episodes automatically, shows the podcast/show name in green
- **Color-adaptive background** — widget background tints to match the album art (disable with `?adaptive=false`)
- **Custom text color** — override text color manually or let auto-contrast pick black/white based on background
- **Widget transparency** — adjustable opacity so the widget blends into your scene
- **Spotify Code** — scannable barcode so viewers can instantly grab the song
- **Auto-hide** — widget slides out when playback is paused or stopped
- **Transparent background** — composites cleanly over any OBS scene
- **Auto-refresh tokens** — handles OAuth token renewal silently, no re-auth needed
- **System tray** — the `.exe` build runs in the tray with settings access and a quit option
- **Start with Windows** — one-click toggle to auto-launch on login (settings page or tray menu)
- **Response caching** — multiple browser sources share a single API call (no rate-limit worries)

## What It Doesn't Do

- Phone home to anyone
- Require Docker, databases, accounts, subscriptions, or "pro tiers"
- Install 600 MB of Electron to show one widget
- Break when Spotify changes their website layout (it uses the official API)

---

## Getting Started (Windows, nothing to install)

### What you need

- **Windows 10 or 11** (on macOS/Linux, [run it from source](#run-from-source))
- **OBS Studio**
- **Spotify Premium** — Spotify requires a small (free) developer app to read what's playing, and [since February 2026](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) the account that owns that app must have Premium.

### 1. Download

1. **[⬇ Download the latest release](https://github.com/BertHcoder/LocalSpotifyWidget/releases/latest)** — grab the `SpotifyWidget-…-win-x64.zip` file.
2. Extract it to a folder you'll keep, e.g. `Documents\SpotifyWidget`.  
   Your settings and Spotify login are saved in that folder, so don't run the widget from inside the zip.

### 2. Start it

Double-click **`SpotifyWidget.exe`**.

> Windows may show **"Windows protected your PC"** because the app isn't code-signed. Click **More info → Run anyway**.  
> The release is built by [GitHub Actions](.github/workflows/release.yml) straight from this repo's source, or you can [build it yourself](#run-from-source).

The settings page opens in your browser and a green dot appears in the system tray, near the clock.

### 3. Connect Spotify (one time, about 2 minutes)

The settings page walks you through this, with copy buttons. For reference:

1. Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and log in with your Spotify account.
2. Click **Create app**. Any name and description will do (e.g. "My OBS Widget").
3. Under **Redirect URI**, add exactly `http://127.0.0.1:4202/callback` and click **Add**.
4. Under "Which API/SDKs are you planning to use?", tick **Web API**. Accept the terms and **Save**.
5. Copy the **Client ID** from your new app's page (you don't need the Client secret).
6. Paste it into the settings page and click **Save & Log In with Spotify**, then **Agree** on Spotify's page.

You land back on the settings page with a green "Connected" status. Your login is remembered and refreshed automatically.

### 4. Add it to OBS

1. In OBS, click **+** under **Sources** → **Browser** → **OK**.
2. Set the URL to `http://127.0.0.1:4202/overlay.html` (the settings page has a copy button).
3. Set width to **400** and height to **120**, click **OK**, and drag it where you want it.

Play a song in Spotify and it shows up. That's it.

> **Tip:** If you change settings and they don't appear in OBS, right-click the browser source and click **"Refresh cache of current page"**.

### Everyday use

- **Settings:** double-click the green tray icon. Starting `SpotifyWidget.exe` again while it's already running also just opens the settings.
- **Start with Windows:** right-click the tray icon, or use the toggle on the settings page.
- **Quit:** right-click the tray icon → **Quit**.
- **Update:** quit the widget, then extract the new release over the old folder. Your settings and login are kept.
- **Moving the folder:** turn off "Start with Windows" first, move the folder, then turn it back on.

---

## Run from Source

For macOS, Linux, or if you'd rather not run a downloaded `.exe`. Needs **Node.js 18+** ([download](https://nodejs.org)).

```bash
git clone https://github.com/BertHcoder/LocalSpotifyWidget.git
cd LocalSpotifyWidget
npm install
npm start
```

The settings page opens in your browser; follow the same steps as above. Keep the terminal open while streaming.  
The tray icon and "Start with Windows" are only available in the `.exe`. To build it yourself on Windows: `npm run build` (output in `dist/`).

---

## Customizing the Widget

Most options (theme, colors, transparency, which elements to show) are on the settings page and apply live in OBS. The URL options below are handy if you want different looks in different scenes.

### Themes

Append `?theme=` to the browser source URL to switch layouts:

| Theme | URL | Description |
|-------|-----|-------------|
| **Default** | `.../overlay.html` | Full card — album art, progress bar, next track, Spotify Code |
| **Compact** | `.../overlay.html?theme=compact` | Thin bar — smaller art, no next track or code (320 × ~60) |
| **Minimal** | `.../overlay.html?theme=minimal` | Text only — no art, just title, artist, and a slim progress bar |

### Adaptive Background

The widget automatically tints its background to match the album art's dominant color.  
This is **on by default**. To disable it, add `?adaptive=false`:

```
http://127.0.0.1:4202/overlay.html?adaptive=false
```

To use a **fixed color** instead, pass a name or hex code with `?color=`:

```
http://127.0.0.1:4202/overlay.html?color=orange
http://127.0.0.1:4202/overlay.html?color=darkred
http://127.0.0.1:4202/overlay.html?color=1a1a2e
```

Supported color names: `red`, `darkred`, `crimson`, `orange`, `lightorange`, `darkorange`, `yellow`, `green`, `darkgreen`, `lightgreen`, `teal`, `cyan`, `blue`, `darkblue`, `lightblue`, `navy`, `purple`, `darkpurple`, `violet`, `indigo`, `lavender`, `pink`, `hotpink`, `brown`, `darkbrown`, `spotify`, `midnight`, and more. Any 6-digit hex code also works.

When `color` is set, adaptive tinting is automatically disabled. Combine with themes: `?theme=compact&color=ff6600`.

### Text Color

By default the widget auto-selects white text on dark backgrounds and black text on light backgrounds.  
To override, open the settings page and set a custom text color (name or hex).

### Widget Transparency

Enable the "Widget Transparency" toggle on the settings page to reveal an opacity slider.  
Lower values make the widget semi-transparent so your scene shows through.

---

## Troubleshooting

**Spotify says "INVALID_CLIENT: Invalid redirect URI"**  
The Redirect URI in your Spotify app must be exactly `http://127.0.0.1:4202/callback`: `127.0.0.1` (not `localhost`), `http` (not `https`), no trailing slash. Fix it in the dashboard (your app → Settings → Edit), save, and log in again.

**Spotify says "INVALID_CLIENT: Invalid client", or the settings page says "Failed to get client"**  
The Client ID is wrong. Copy it again from your app's page in the dashboard. If you're connected, click **Log out** first to get the Client ID field back.

**The settings page says "Spotify refused access (403)"**  
The account that owns your developer app needs an active Premium subscription. If you log in with a different account than the owner, add it under **User Management** in the dashboard (new apps allow up to 5 users).

**Connected, but the widget stays empty**  
The widget only shows while something is actually playing and hides when you pause. Start a song: the preview on the settings page should show it within a few seconds. If the preview works but OBS doesn't, check the browser source URL and use **"Refresh cache of current page"**.

**I can't find the widget after starting it**  
It runs in the system tray (the green dot near the clock; click **^** to see hidden icons). Double-click it, or start `SpotifyWidget.exe` again, to open the settings.

**"Port 4202 is already in use by another program"**  
Another program uses the widget's port. Create a file named `.env` next to `SpotifyWidget.exe` (or in the project folder when running from source) containing `PORT=4203`. In Notepad, pick **Save as type: All files** so it isn't saved as `.env.txt`. Then change the Redirect URI in your Spotify app to `http://127.0.0.1:4203/callback` and use port 4203 in the OBS URL too.

**The settings page asks me to log in again**  
Spotify no longer accepts the saved login, for example because you removed the app's access in your Spotify account or changed the Client ID. Click **Save & Log In with Spotify** to reconnect.

---

## How It Works

```
┌──────────────┐  polls /now-playing  ┌────────────────┐  Spotify Web API
│  OBS Browser │ ◄─────────────────── │   Express       │ ──────────────►
│    Source     │       JSON          │   server.js     │  /v1/me/player
└──────────────┘                     └────────────────┘  /v1/me/player/queue
```

| File | Purpose |
|------|---------|
| `server.js` | Express server — handles Spotify OAuth (PKCE), proxies the API, serves the overlay and settings |
| `overlay.html` | The page OBS loads as a browser source |
| `settings.html` | In-browser settings page: guided Spotify setup, theme, colors, toggles, system controls. Opens on first run |
| `settings.json` | Persisted user preferences (auto-generated) |
| `style.css` | All styling — dark theme, Spotify green accent, smooth animations |
| `widget.js` | Client-side polling logic, marquee, progress interpolation |
| `colors.js` | Named color map shared between widget and settings |
| `tray.js` | Windows system tray icon (context menu, start-with-Windows toggle) |
| `build.js` | Bundles the project into a standalone `.exe` for releases |

The overlay polls the local server every **3 seconds**. The server calls the Spotify API (with a 2.5 s response cache), returns a slim JSON payload, and the widget updates in place. Between polls, the progress bar and timestamp interpolate client-side for smooth real-time display. Tokens refresh automatically before they expire.

---

## Advanced Tweaks

**Change poll speed** — edit `POLL_INTERVAL` in `widget.js` (default: 3000 ms).  
**Change port** — set `PORT=5000` in a `.env` file next to the `.exe` (or in the project root), and update the Redirect URI in your Spotify app to match.  
**Change styling** — edit `style.css` directly. The widget is 380px wide by default with a semi-transparent dark background and rounded corners.

---

## Tech Stack

- **Node.js** + **Express 5** — local server (~500 lines)
- **Spotify Web API** — official REST API with OAuth 2.0 PKCE
- **Vanilla HTML/CSS/JS** — no React, no Vue, no build step, no bundler
- **2 dependencies** — `express` and `open` (for the initial auth browser tab)
- **System tray** — native Windows tray via PowerShell/.NET (zero extra deps)

---

## Upcoming: No More Developer App Needed

I'm currently applying for a Spotify app approval. Once approved, the widget will ship with a built-in Client ID — meaning **you won't need to create your own Spotify Developer App anymore**. Setup will be as simple as: install, log in, done.

Until that's approved, you still need to create a free Spotify Developer App (takes 30 seconds, instructions above).

**Testers appreciated!** If you'd like to help test the widget before the app is fully approved, I'd love the help — just open an issue or reach out.

---

## Support

If this saved you time or you just like it, consider buying me a coffee:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/dirtymasterchief)

---

## License

ISC
