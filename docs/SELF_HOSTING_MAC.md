# Running openGym on a Mac, reached from your phone over Tailscale

For one person running the instance on their own Mac, with no domain to buy. [Tailscale](https://tailscale.com)
gives the Mac a real HTTPS name (`<mac>.<tailnet>.ts.net`, with a valid certificate), which is
what passkeys and an installable home-screen app both need. It is free for personal use.

## 1. Tailscale

1. Install Tailscale on the Mac and on the iPhone, sign both into the same account.
2. In the admin console (login.tailscale.com → **DNS**), turn on **MagicDNS** and **HTTPS
   Certificates**.
3. Note the Mac's name there, e.g. `macbook.tail1234.ts.net`.

## 2. `.env`

```bash
cp .env.example .env
```

Then set:

```ini
RP_ID=macbook.tail1234.ts.net
ORIGIN=https://macbook.tail1234.ts.net
WEB_PORT=8080
# One person: no guests, sign-in by passkey (add PASSWORD_LOGIN=1 for a password too)
ALLOW_GUEST=0
# The Coach on a ChatGPT subscription runs the Codex CLI, which lives in the bigger image
API_TARGET=coach
# Only if the provider is reachable from this Mac through a local proxy only:
# COACH_PROXY=http://host.docker.internal:1087
```

## 3. Start it

```bash
docker compose up -d --build      # --build: your fork's code, not the published images
```

Then publish it to your tailnet:

```bash
tailscale serve --bg 8080         # https://macbook.tail1234.ts.net → localhost:8080
```

(With the App Store build of Tailscale the CLI is
`/Applications/Tailscale.app/Contents/MacOS/Tailscale`.)

**Phone without the Tailscale VPN.** iOS runs one VPN at a time. If the phone needs another VPN
for other reasons, use `tailscale funnel --bg 8080` instead of `serve`: the same address,
reachable from the internet without Tailscale on the phone. It is then public, so keep
`ALLOW_GUEST=0` and set `INVITE_ONLY=1` after creating your profile.

## 4. On the iPhone

Open `https://macbook.tail1234.ts.net` in Safari → **Create profile** (Face ID) → Share →
**Add to Home Screen**. Notifications work from the home-screen app once allowed in Settings.

## 5. The Coach on a ChatGPT subscription

In the app: **Settings → Admin dashboard → AI Coach** → provider **Codex (OpenAI)**. Then sign
the CLI in once, on the Mac:

```bash
docker compose exec -u coach -e CODEX_HOME=/coach-auth api codex login --device-auth
```

Open the link it prints, enter the code, then press **Check sign-in** on the card and **Test the
Coach**. The sign-in is kept in `./coach-auth` (not in `./data`, so it is not in your backups).
If the `exec` complains about permissions on that folder, run it once as root and hand the
folder back: `docker compose exec api chown -R coach:coach /coach-auth`.

## 6. When the Mac sleeps

The app keeps working on the phone without the Mac — it is offline-first, and the session you
log at the gym syncs when the Mac is reachable again. The Coach and the AI food lookup need the
Mac awake. On a charger, **System Settings → Battery → Options → Prevent automatic sleeping on
power adapter when the display is off**, and let Docker Desktop start at login.

## Backups

`./data` is everything: `tar czf opengym-$(date +%F).tgz data/`.
