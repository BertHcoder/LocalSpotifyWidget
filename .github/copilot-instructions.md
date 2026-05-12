# Copilot Instructions — Spotify Widget Local

## Project Overview
A minimal, fully local Spotify "Now Playing" widget for vanilla OBS Studio.
OBS loads a local browser source that shows the currently playing track (title, artist, album art).

## Tech Stack
- **Node.js** — lightweight local server
- **Spotify Web API** — polling `/v1/me/player/currently-playing`
- **Vanilla HTML/CSS/JS** — OBS browser source overlay (no frameworks)

## Key Principles
- **Local only** — everything runs on the user's machine; no cloud hosting, no external services beyond the Spotify API.
- **Keep it simple** — no build tools, no bundlers, no frameworks. Plain files served by a small Express server.
- **Minimal dependencies** — only what's truly needed (express, open for auth flow).
- **Single concern** — this project does one thing: show what's playing on Spotify inside OBS.

## Conventions
- Use `const`/`let`, never `var`.
- Use ES module syntax where possible (`import`/`export`).
- Config (client ID, client secret, ports) lives in a `.env` file that is `.gitignore`d.
- Keep all source files in the project root — no nested `src/` folder needed for a project this small.
