# XPD Cadet Acknowledgement Form — Vercel edition

This is a rebuild of the cadet form specifically for Vercel. It replaces the
things that don't work on serverless hosting:

| Before (Node server) | Now (Vercel) |
|---|---|
| One long-running Express server | Individual serverless functions under `/api` |
| Login state in server memory | Signed JWT cookie (works across serverless instances) |
| `data/db.json` on local disk | Upstash Redis (persists properly on serverless) |
| Rate limiting in memory | Rate limiting in Redis (actually global now) |

## 1. Project layout

```
├── index.html          → the public cadet form, served at "/"
├── admin.html           → the staff review page, served at "/admin"
├── logo.png              → City of Xlantis PD seal
├── vercel.json            → enables clean URLs (/admin instead of /admin.html)
├── package.json
└── api/
    ├── next-form-number.js         GET  — current form counter
    ├── submit.js                   POST — new cadet application
    └── admin/
        ├── login.js                POST — checks credentials, sets session cookie
        ├── logout.js               POST — clears the cookie
        ├── session.js              GET  — "am I logged in?"
        ├── applications.js         GET  — list all applications (auth required)
        ├── config.js               GET/POST — Google Sheet webhook URL (auth required)
        └── decide.js               POST — accept/reject an application (auth required)
    └── _lib/
        ├── db.js         Redis read/write helpers
        └── auth.js       JWT + cookie helpers
```

Files/folders starting with `_` inside `/api` are never turned into public
endpoints — that's why `_lib` is safe to keep helpers in.

## 2. Push this to GitHub correctly

**Don't use GitHub's drag-and-drop "Add files via upload" for this.** That's
almost certainly what stripped the leading dot from `.env` and `.gitignore`
last time, which is why login was failing. Use git from a terminal instead:

```bash
cd xpd-cadet-form-vercel
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Because secrets now live in the Vercel dashboard (not in a committed file),
there's no `.env` file to accidentally mangle on upload anymore — the
`.env.example` in this repo is just a reference, never real credentials.

## 3. Set up the database (Upstash Redis via Vercel Marketplace)

1. In your Vercel project, go to **Storage** (or **Settings → Storage**).
2. Choose **Marketplace Database Integrations** → **Upstash** → **Redis**.
3. Create a new database (the free tier is plenty for this) and connect it
   to this project.
4. Vercel automatically adds `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` to your project's environment variables — you
   don't need to copy/paste anything yourself.

## 4. Set the rest of the environment variables

Go to **Project → Settings → Environment Variables** and add:

| Name | Value |
|---|---|
| `ADMIN_USER` | `Thakkali` (or whatever you want) |
| `ADMIN_PASS` | `Thakkalibiju144` (or whatever you want) |
| `JWT_SECRET` | any long random string, e.g. generate one with `openssl rand -hex 32` |

Apply them to **Production** (and Preview/Development if you want those to
work too). **Redeploy** after adding — Vercel doesn't pick up new env vars
on an existing deployment automatically.

## 5. Deploy

If your GitHub repo is already connected to a Vercel project, pushing to
`main` triggers a deploy automatically. Otherwise:

```bash
npm i -g vercel
vercel login
vercel --prod
```

Your form will be live at `https://<your-project>.vercel.app/`, and the
staff panel at `https://<your-project>.vercel.app/admin`.

## 6. Local development (optional)

```bash
npm install -g vercel
vercel link                                   # link this folder to your Vercel project
vercel env pull .env.development.local        # pulls real values, including the Upstash ones
vercel dev
```

This runs the same serverless functions locally at `http://localhost:3000`.

## 7. Wiring up Google Sheets (optional, same as before)

1. Open a Google Sheet → **Extensions → Apps Script**, and paste:

   ```javascript
   function doPost(e) {
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
     const data = JSON.parse(e.postData.contents);
     sheet.appendRow([
       new Date(), data.formNumber, data.charname, data.discordName,
       data.discordId, data.availability, data.signature, data.date,
       data.status, data.reviewedBy
     ]);
     return ContentService.createTextOutput("ok");
   }
   ```

2. **Deploy → New deployment → Web app.** "Execute as: Me", "Who has access:
   Anyone." Deploy, then copy the URL.
3. Paste that URL into the "Google Sheet webhook URL" field on `/admin` and
   click Save. From then on, every Accept/Reject fires a POST to your sheet
   (handled by `api/admin/decide.js`, server-side, so there's no browser
   CORS issue).

## 8. Invite-only access

The form at `/` is no longer open to anyone with the link — it requires a
personal invite link.

1. In the admin dashboard, go to **Invites**.
2. Enter the person's Discord ID (and optionally a name/label so you can
   recognize them in the list), then click **Create invite link**.
3. Copy the generated link (`yoursite.com/?invite=XXXXXXXX`) and send it to
   that person directly (DM, not a public channel).
4. The link only works once. As soon as they submit the form, it locks.
   Anyone else opening it — or that same person opening it again — sees
   "not authorized," not the form.
5. If you **Reject** their application, the same link automatically reopens
   so they can fix whatever was wrong and resubmit. If you **Delete** an
   application, its invite also reopens.
6. Unused invites can be revoked any time from the Invites tab if you sent
   one by mistake or someone's no longer joining.

The applicant's Discord ID in their submission always comes from the invite
itself, not from a text box they can edit — so it can't be spoofed.

## 9. Multiple admins (Owner + Reviewer roles)

There are two roles:

- **Owner** — full access: applications, Invites, Sync settings, Delete,
  and managing other admin accounts. Your `ADMIN_USER` / `ADMIN_PASS`
  environment variables are a permanent Owner login that always works,
  even if Redis is having issues — so you can never get locked out.
- **Reviewer** — can only view applications and Accept/Reject them. No
  Invites tab, no Sync tab, no Delete button, no admin management.

To add someone:

1. Log in as Owner, go to the **Admins** tab.
2. Enter a username and password (6+ characters), pick a role, click
   **Create account**.
3. Give them that username/password — they log in at `/admin.html` like
   normal.

Passwords are hashed (bcrypt) before being stored in Redis — never in
plain text. One thing worth knowing: sessions last 4 hours and aren't
re-checked against the admin list on every request, so if you remove
someone's account while they're mid-session, they stay logged in until
that session naturally expires rather than being kicked out instantly.

## 10. Security notes

- The admin password is checked inside `api/admin/login.js`, which runs on
  Vercel's servers — it is never sent to or visible in the browser.
- The session is a signed JWT in an `httpOnly` cookie, so client-side
  JavaScript can't read it, and it can't be forged without your
  `JWT_SECRET`.
- Login attempts are rate-limited per IP address via Redis (10 attempts /
  15 minutes) — and because Redis is shared, this limit is now accurate
  across every serverless instance, unlike the old in-memory version.
- `/admin` isn't linked from the public form, but the URL itself isn't a
  secret — the login screen is the actual gate. If you want more obscurity
  on top, rename `admin.html` and update the `fetch` URLs and page title
  accordingly.
- Treat `JWT_SECRET`, `ADMIN_PASS`, and the Upstash token as real secrets:
  they live only in Vercel's Environment Variables UI, never in the repo.
- Invite tokens are random 20-character hex strings — not guessable by
  brute force, but still treat the links themselves as semi-private (send
  by DM, not in a public channel), since anyone with an unused link's exact
  URL can use it.

## 11. If something goes wrong

- **401 on login even with the right password:** double-check
  `ADMIN_USER`/`ADMIN_PASS` are actually set in Vercel's dashboard for the
  environment you're testing (Production vs Preview use separate env vars
  unless you applied them to both), and that you redeployed after adding
  them.
- **500 errors mentioning "database":** means Redis isn't connected —
  re-check the Upstash integration is linked to this exact project.
- **Session doesn't stick between requests:** make sure you're testing over
  HTTPS (Vercel's real domain, not something proxied oddly) — the cookie is
  marked `Secure` in production and browsers will silently drop it over
  plain HTTP.
