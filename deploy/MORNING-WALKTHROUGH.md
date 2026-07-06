# TamFam on Coolify — simple morning walkthrough

Fresh-start guide for **tampal.tijamo.com**. Assumes: Coolify is installed on the
VPS (`51.89.166.156`), and DNS records `app.tampal.tijamo.com` and
`api.tampal.tijamo.com` both point at that IP. Everything below is done in the
Coolify web UI plus a couple of SSH commands. Follow it in order.

> **Two decisions before you start**
> 1. **Repo access:** the simplest route is a **public repo** (there are no secrets
>    in the code — all keys live in env vars). Ask Claude to flip
>    `tijamo/tampal` to public, or keep it private and use the Deploy Key note in Step 3.
> 2. **Email/SMTP:** magic-link login needs SMTP to *deliver* links. You can skip it
>    for now — Step 8 shows how to get your first login link without email.

---

## Step 1 — Generate your secrets (SSH, once)

SSH in and run this. It prints 4 values — **copy them somewhere safe**, you'll paste
them into Coolify:

```bash
ssh root@51.89.166.156

docker run --rm node:20-alpine node -e '
const c=require("crypto"), b=s=>Buffer.from(s).toString("base64url");
const sign=(p,s)=>{const d=b(JSON.stringify({alg:"HS256",typ:"JWT"}))+"."+b(JSON.stringify(p));
return d+"."+c.createHmac("sha256",s).update(d).digest("base64url")};
const secret=c.randomBytes(32).toString("hex"), iat=(Date.now()/1000|0), exp=iat+315360000;
console.log("POSTGRES_PASSWORD="+c.randomBytes(24).toString("hex"));
console.log("JWT_SECRET="+secret);
console.log("ANON_KEY="+sign({role:"anon",iss:"supabase",iat,exp},secret));
console.log("SERVICE_ROLE_KEY="+sign({role:"service_role",iss:"supabase",iat,exp},secret));'
```

---

## Step 2 — Check the server is connected in Coolify

In Coolify: **Servers** → you should see **localhost** (the VPS itself), status
green/reachable. If it's missing, add it: **+ Add**, name `localhost`, IP
`127.0.0.1`, and validate. (Coolify normally keeps this even after a reset.)

---

## Step 3 — Add the Git source

**Easiest (public repo):** nothing to set up here — you'll paste the repo URL
directly in Steps 5 and 7. (Ask Claude to make the repo public first.)

**Private repo (Deploy Key):**
1. **Sources / Keys** → add a **Private Key** (Coolify generates one) — copy the
   **public** key it shows.
2. GitHub → `tijamo/tampal` → **Settings → Deploy keys → Add deploy key** → paste →
   save (read-only is fine).
3. You'll select this key when adding the repo in Steps 5 & 7.

---

## Step 4 — Create the project

**Projects → + Add** → name it **TamFam**. Open it; you'll add two resources into it.

---

## Step 5 — Resource 1: the Supabase backend

1. **+ New Resource** → (scroll to **Git Based**) → **Public Repository** (or
   **Private Repository (with Deploy Key)**).
2. Repository: `https://github.com/tijamo/tampal`  ·  Branch:
   `claude/tamfam-church-pwa-ixtasz`.
3. **Build Pack → Docker Compose.** Set **both** of these (Coolify resolves the
   compose file's relative paths — `build: ./db`, `build: ./kong` — against
   **Base Directory**, not against the compose file's own folder, so both must
   point inside `self-hosting/`):
   - **Base Directory:** `/self-hosting`
   - **Docker Compose Location:** `/docker-compose.yml` (relative to Base
     Directory above — not `/self-hosting/docker-compose.yml`)
4. **Environment variables** — paste these (fill the 4 secrets from Step 1):

   ```
   POSTGRES_PASSWORD=<from step 1>
   JWT_SECRET=<from step 1>
   ANON_KEY=<from step 1>
   SERVICE_ROLE_KEY=<from step 1>
   API_EXTERNAL_URL=https://api.tampal.tijamo.com
   SITE_URL=https://app.tampal.tijamo.com
   ADDITIONAL_REDIRECT_URLS=https://app.tampal.tijamo.com/auth/callback
   KONG_HTTP_PORT=8000
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=changeme
   SMTP_PASS=changeme
   SMTP_ADMIN_EMAIL=admin@tampal.tijamo.com
   SMTP_SENDER_NAME=TamFam
   ```
   (SMTP can stay as dummy values for now — see Step 8.)
5. **Domain for the API:** in the resource's settings, find the **`kong`** service and
   set its domain to `https://api.tampal.tijamo.com`, port **8000**. Let Coolify's
   proxy handle HTTPS. (Kong no longer publishes a host port — Coolify's dashboard
   uses 8000 itself — so there's no port clash; the compose already `expose`s it and
   Coolify routes the domain internally.)
6. **Deploy.** Watch the logs until **db** and **auth** are healthy (a minute or two).

---

## Step 6 — Load the database schema (SSH, once)

Our tables need `auth.users`, which the auth container creates on first boot — so do
this *after* Step 5 is healthy:

```bash
# still SSH'd into the server
DB=$(docker ps --format '{{.Names}}' | grep -i db | head -1)

# should print: t
docker exec -i "$DB" psql -U postgres -d postgres -tAc "select to_regclass('auth.users') is not null"

# get the schema files and apply them
git clone -b claude/tamfam-church-pwa-ixtasz https://github.com/tijamo/tampal.git
for f in tampal/supabase/migrations/*.sql; do
  echo "applying $f"
  docker exec -i "$DB" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$f"
done
```

(If the clone needs auth because the repo is private, either make it public or use a
GitHub token.)

---

## Step 7 — Resource 2: the app

1. In the **TamFam** project: **+ New Resource** → **Public Repository** (same repo).
2. Repository `https://github.com/tijamo/tampal` · Branch
   `claude/tamfam-church-pwa-ixtasz` · **Build Pack → Dockerfile** (location
   `/Dockerfile`).
3. **Build-time variables** — tick **"Build Variable"** for each (these get baked into
   the front-end at build time):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://api.tampal.tijamo.com
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from step 1>
   NEXT_PUBLIC_SITE_URL=https://app.tampal.tijamo.com
   NEXT_PUBLIC_DATA_CONTROLLER_NAME=Tamworth Christadelphian Church
   NEXT_PUBLIC_DATA_CONTROLLER_EMAIL=privacy@tampal.tijamo.com
   ```
4. **Runtime variable** (do **not** tick "Build Variable"):
   ```
   SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from step 1>
   ```
5. **Domain:** `https://app.tampal.tijamo.com`, port **3000**.
6. **Deploy.** First build takes a few minutes.

Visit `https://app.tampal.tijamo.com` — you should see the TamFam sign-in page over
HTTPS.

---

## Step 8 — Make yourself the admin (no SMTP needed)

Generate your own login link directly from the auth server, then promote yourself:

```bash
# get a one-time magic link (prints JSON containing "action_link")
# redirect_to must be /login (a public route) -- admin-generated links use the
# implicit flow (tokens in the URL fragment), which /auth/callback can't consume
# (it only handles the PKCE ?code= flow used by the normal in-app email link).
# /login detects the fragment tokens client-side and signs you in.
curl -s -X POST "https://api.tampal.tijamo.com/auth/v1/admin/generate_link" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"type":"magiclink","email":"you@tampal.tijamo.com","redirect_to":"https://app.tampal.tijamo.com/login"}' \
  | jq -r '.action_link'
```

Copy the `action_link` value (use `jq -r` as above, not a manual copy — Go's JSON
encoder escapes `&` as the literal six characters backslash-u-zero-zero-two-six, which breaks the
URL's query string if pasted raw), open it in your browser → you're signed in.
Then:

```bash
docker exec -i "$DB" psql -U postgres -d postgres -c \
  "update profiles set role='admin' where user_id=(select id from auth.users where email='you@tampal.tijamo.com');"
```

Refresh the app — you now have the admin menus (People, add Meetings, take registers).

---

## Step 9 — Smoke test

1. **People → Add person**, tick the consent boxes, save.
2. **Meetings → Add meeting**, weekly, save → confirm the next date shows.
3. Open the meeting → **Take register**, tap someone present.
4. On a phone: turn on airplane mode mid-register → toggles still work (queued) →
   turn it back on → they sync.

---

## Step 10 — SMTP for ongoing logins (do this soon)

So members can log in with an emailed link, set real SMTP creds in the **backend**
resource's env (Step 5) and redeploy it. Free/cheap options: Brevo, Mailgun, Postmark,
Amazon SES, or your existing mailbox's SMTP. Until then, use the Step 8 method to hand
out login links.

---

## If Coolify keeps fighting you — plain Docker fallback

You don't strictly need Coolify. On the server you can run the whole backend with one
command and put Caddy in front for HTTPS:

```bash
git clone -b claude/tamfam-church-pwa-ixtasz https://github.com/tijamo/tampal.git
cd tampal/self-hosting
cp .env.example .env   # fill in secrets (node gen-keys.mjs) + domains
docker compose up -d
./migrate.sh
# then run Caddy with the included Caddyfile for api.tampal.tijamo.com
```

See `self-hosting/README.md` for the full version. Ask Claude and we'll walk it
through.
```
