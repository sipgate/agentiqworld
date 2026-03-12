# Agentiq World — sipgate AI Flow Workshop

Workshop-Tool for the sipgate session **"Turning Chatbots into Phonebots (Without Breaking Everything)"** at Agentiq World Berlin 2026.

## What is this?

A web-based agent configurator that lets you build and deploy a voice AI agent powered by sipgate AI Flow. Configure your LLM, system prompt, TTS voice, and barge-in behavior — then connect it to a real phone number via WebSocket.

## Live

**Production:** https://agentiqworld-production.up.railway.app

- `/` — Landing page
- `/app` — Agent configurator (webapp)
- `/admin` — Admin dashboard

## Local Development

```bash
cp .env.example .env
docker compose up --build -d
```

- **Homepage:** http://localhost:3000
- **Webapp:** http://localhost:3001
- **Admin:** http://localhost:3002
- **PocketBase:** http://localhost:8090/_/

Changes to `homepage/`, `webapp/`, `admin/` hot-reload. Server code (`server/*.js`) auto-restarts via `--watch`.

## Architecture

Single Docker container running:
- **Node.js Express** — serves all apps, handles WebSocket for sipgate flow, proxies PocketBase
- **PocketBase** — auth, database, file storage

Production uses single-port path-based routing. Development uses separate ports.

## Stack

- **Frontend:** Static HTML/CSS/JS
- **Backend:** Node.js Express + PocketBase
- **LLM:** Anthropic Claude / Google Gemini (configurable)
- **Voice:** sipgate AI Flow (WebSocket)
- **TTS:** Azure / ElevenLabs (configurable)
- **Deployment:** Docker on Railway
