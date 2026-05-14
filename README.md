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

- **Zero configuration** — no Spotify developer account needed, just log in with your Spotify account
- **Album art** — full-res cover pulled straight from the Spotify API
- **Track title with auto-scroll** — long titles get a smooth marquee animation instead of ugly truncation
- **Artist name** — all featured artists, comma-separated
- **Live progress bar** — real-time playback position with elapsed/total timestamps
- **Next track preview** — shows what's coming up next in your queue
- **Podcast & episode support** — detects episodes automatically, shows the podcast/show name in green
- **Color-adaptive background** — widget background tints to match the album art (disable with `?adaptive=false`)
- **Spotify Code** — scannable barcode so viewers can instantly grab the song
- **Auto-hide** — widget slides out when playback is paused or stopped
- **Transparent background** — composites cleanly over any OBS scene
- **Auto-refresh tokens** — handles OAuth token renewal silently, no re-auth needed

## What It Doesn't Do

- Phone home to anyone
- Require a Spotify developer account, API keys, or any configuration
- Require Docker, databases, accounts, subscriptions, or "pro tiers"
- Install 600 MB of Electron to show one widget
- Break when Spotify changes their website layout (it uses the official API)

---

## Download

**[⬇ Download the latest release](https://github.com/BertHcoder/LocalSpotifyWidget/releases/latest)**

Or clone the repo:

```bash
git clone https://github.com/BertHcoder/LocalSpotifyWidget.git
```

---

## Quick Start

### Prerequisites

- **Node.js** 18+ — [download here](https://nodejs.org)
- A **Spotify account** (free or Premium)

That's it. No developer account, no API keys, no config files.

### 1. Install & Run

```bash
cd LocalSpotifyWidget
npm install
npm start
```

Your browser opens automatically — log in with your Spotify account and click **Agree**.  
Close the tab when it says "Authenticated!" — you're done.

### 2. Add to OBS

1. In OBS, add a **Browser Source**.
2. Set the URL to `http://127.0.0.1:4202/overlay.html`.
3. Set width to **400** and height to **120** (adjust to taste).
4. Uncheck **"Shutdown source when not visible"** so the widget keeps polling.
5. Position it wherever you want on your scene.

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
| `server.js` | Lightweight Express server — handles Spotify OAuth (PKCE), proxies the API, serves the overlay |
| `overlay.html` | The page OBS loads as a browser source |
| `style.css` | All styling — dark theme, Spotify green accent, smooth animations |
| `widget.js` | Client-side polling logic, marquee, progress bar updates |

The overlay polls the local server every **3 seconds**. The server calls the Spotify API, returns a slim JSON payload, and the widget updates in place. Tokens refresh automatically before they expire.

---

## Customization

**Change poll speed** — edit `POLL_INTERVAL` in `widget.js` (default: 3000 ms).  
**Change port** — set `PORT=5000` in a `.env` file in the project root.  
**Change styling** — edit `style.css` directly. The widget is 380px wide by default with a semi-transparent dark background and rounded corners.

---

## Tech Stack

- **Node.js** + **Express 5** — local server (~170 lines)
- **Spotify Web API** — official REST API with OAuth 2.0 PKCE
- **Vanilla HTML/CSS/JS** — no React, no Vue, no build step, no bundler
- **2 dependencies** — `express` and `open` (for the initial auth browser tab)

---

## Support

If this saved you time or you just like it, consider buying me a coffee:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/dirtymasterchief)

---

## License

ISC
