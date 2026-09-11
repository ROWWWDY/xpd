# Xlantis Police Department — Vercel edition

A public marketing site plus a cadet acknowledgement/intake form and staff
admin dashboard, all on Vercel serverless functions + Upstash Redis.

## 1. Project layout

```
├── index.html          → public landing page, served at "/"
├── officers.html         → public officer roster (live data), served at "/officers"
├── divisions.html          → public divisions page, served at "/divisions"
├── news.html                 → public news page, served at "/news"
├── join.html                   → public "how to join" page, served at "/join"
├── contact.html                  → public contact page, served at "/contact"
├── public.css                      → shared styles for all six pages above
├── site.js                           → shared JS (nav toggle, skyline generator) for the pages above
├── acknowledge.html                    → XPD Acknowledgement Form — invite-only, served at "/acknowledge"
├── admin.html                            → staff dashboard, served at "/admin"
├── logo.png                                → City of Xlantis PD seal, used everywhere
├── vercel.json                               → enables clean URLs (/officers instead of /officers.html)
├── package.json
└── api/
    ├── submit.js                    POST — new cadet application (photo + bio included)
    ├── public-roster.js             GET  — public officer directory (used by officers.html)
    ├── invite-check.js              GET  — is this invite token valid?
    ├── next-form-number.js          GET  — current form counter
    ├── admin/
    │   ├── auth.js                  POST/GET — login, logout, session check (merged into one file)
    │   ├── applications.js          GET/DELETE — application list + security IP log
    │   ├── decide.js                POST — accept/reject/delete an application
    │   ├── invites.js               GET/POST/DELETE — invite links
    │   ├── roster.js                GET/POST/DELETE — roster management, promotions
    │   ├── admins.js                GET/POST/DELETE — manage other admin accounts
    │   └── config.js                GET/POST — Google Sheet webhook URL
    └── _lib/
        ├── db.js                    Redis read/write helpers
        ├── auth.js                  JWT + cookie helpers
        ├── permissions.js           role → capability table
        ├── ranks.js                 the 21-rank ladder
        └── ackSections.js           canonical acknowledgement text, snapshotted per submission
```

Files/folders starting with `_` inside `/api` are never turned into public
endpoints. Several admin endpoints are deliberately merged (e.g. login +
logout + session all live in `admin/auth.js`) to stay under Vercel's Hobby
plan limit of 12 serverless functions — this project uses 11.

**Important:** deploy this as a complete folder, not a patchwork of files
added over time. If pages or links seem broken, the most common cause is a
partial deploy — some old files still present, some new ones missing, or
the two out of sync. Easiest fix: clear the repo/deployment and push this
entire folder fresh.

## 2. Push this to GitHub correctly

**Don't use GitHub's drag-and-drop "Add files via upload"** — it can mangle
dotfiles and makes it easy to accidentally miss a file. Use git from a
terminal instead:

```bash
cd xpd-site
git init
git add .
git commit -m "Full site rebuild"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

If you already have a repo for this project, consider deleting its
contents first (or starting a fresh repo) so there's no leftover file from
an earlier partial upload conflicting with what's here now.

## 3. Set up the database (Upstash Redis via Vercel Marketplace)

1. In your Vercel project, go to **Storage** (or **Settings → Storage**).
2. Choose **Marketplace Database Integrations** → **Upstash** → **Redis**.
3. Create a new database (the free tier is plenty) and connect it to this
   project.
4. Vercel automatically adds `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` to your project's environment variables.

## 4. Set up photo storage (Vercel Blob)

Cadets can attach a photo on the acknowledgement form, and it needs
somewhere persistent to live (not Redis — that's for structured data, not
image files).

1. In your Vercel project, go to **Storage → Create Database → Blob**.
2. Create a store and connect it to this project.
3. Vercel automatically adds a `BLOB_READ_WRITE_TOKEN` environment
   variable — nothing else to configure.

If this isn't set up yet, the form still works — submissions without a
photo attached go through fine. Only the photo upload itself will show an
error until Blob storage is connected.

## 5. Set the rest of the environment variables

Go to **Project → Settings → Environment Variables** and add:

| Name | Value |
|---|---|
| `ADMIN_USER` | your bootstrap admin username |
| `ADMIN_PASS` | your bootstrap admin password |
| `JWT_SECRET` | any long random string, e.g. `openssl rand -hex 32` |

Apply them to **Production** (and Preview/Development if you want those to
work too). **Redeploy** after adding — Vercel doesn't pick up new env vars
on an existing deployment automatically.

## 6. Deploy

If your GitHub repo is already connected to a Vercel project, pushing to
`main` triggers a deploy automatically. Otherwise:

```bash
npm i -g vercel
vercel login
vercel --prod
```

Your site will be live at `https://<your-project>.vercel.app/`, the roster
at `/officers`, the acknowledgement form at `/acknowledge` (only reachable
via a valid invite link), and the staff panel at `/admin`.

## 7. Local development (optional)

```bash
npm install
npm install -g vercel
vercel link                                   # link this folder to your Vercel project
vercel env pull .env.development.local        # pulls real values, including Upstash + Blob
vercel dev
```

This runs the same serverless functions locally at `http://localhost:3000`.

## 8. Invite-only acknowledgement form

The acknowledgement form at `/acknowledge` requires a personal invite link
— it isn't open to just anyone with the URL.

1. In the admin dashboard, go to **Invites**.
2. Enter a label (optional, just for your own reference) and quantity,
   then click **Create invite link(s)**.
3. Copy the generated link (`yoursite.com/acknowledge?invite=XXXXXXXX`) and
   send it to that person directly (DM, not a public channel).
4. The link only works once. As soon as they submit the form, it locks.
   Opening it again — by them or anyone else — shows "not authorized," not
   the form.
5. If you **Reject** their application, the same link automatically
   reopens so they can fix whatever was wrong and resubmit. If you
   **Delete** an application, its invite also reopens.
6. Unused invites can be revoked any time from the Invites tab.

The applicant's Discord name/ID are entered by them on the form itself
(not tied to the invite) — the invite just gates *access* to the form.

## 9. Photo & bio on the acknowledgement form

Section 02 of the form ("Photo & Bio") lets the applicant:

- Upload a PNG or JPEG photo of themselves (up to 2MB) — stored on Vercel
  Blob, so it persists properly rather than living as a temporary link.
- Write a short bio (up to 500 characters).

Both are optional — the form can be submitted without either. Whatever
they provide is saved on their application, and if you **Accept** them, it
carries straight over to their new roster entry (shown on `/officers`).
You (as Owner) can always edit or replace either one afterward from the
roster tab in `/admin`, in case something needs fixing.

## 10. Wiring up Google Sheets (optional)

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

2. **Deploy → New deployment → Web app.** "Execute as: Me", "Who has
   access: Anyone." Deploy, then copy the URL.
3. Paste that URL into the "Google Sheet webhook URL" field on `/admin`
   and click Save. From then on, every Accept/Reject fires a POST to your
   sheet, server-side, so there's no browser CORS issue.

## 11. Multiple admins (Owner / Coordinator / Reviewer roles)

- **Owner** — full access: applications, Invites, roster, Sync settings,
  Delete, and managing other admin accounts. Your `ADMIN_USER` /
  `ADMIN_PASS` environment variables are a permanent Owner login that
  always works, even if Redis is having issues.
- **Coordinator** — can view/decide applications and manage invite links,
  but not Sync settings, Delete, or admin accounts.
- **Reviewer** — can only view applications and Accept/Reject them.

To add someone: log in as Owner, go to the **Admins** tab, enter a
username/password (6+ characters), pick a role, and click **Create
account**. Passwords are hashed (bcrypt) before being stored in Redis.

## 12. Security notes

- Admin login is checked inside `api/admin/auth.js`, which runs on
  Vercel's servers — credentials are never exposed to the browser.
- The session is a signed JWT in an `httpOnly` cookie, so client-side
  JavaScript can't read it, and it can't be forged without your
  `JWT_SECRET`.
- Login attempts are rate-limited per IP via Redis.
- `/admin` isn't linked from any public page, but the URL itself isn't a
  secret — the login screen is the actual gate.
- Treat `JWT_SECRET`, `ADMIN_PASS`, and the Upstash/Blob tokens as real
  secrets — they live only in Vercel's Environment Variables UI, never in
  the repo.
- Invite tokens are random hex strings, not guessable by brute force, but
  still treat the links as semi-private (send by DM).

## 13. If something goes wrong

- **A page 404s:** almost always means the deploy is out of sync — see the
  note at the end of section 1. Confirm every file in this folder actually
  made it into the deployed project.
- **401 on login even with the right password:** double-check
  `ADMIN_USER`/`ADMIN_PASS` are set in Vercel's dashboard for the
  environment you're testing, and that you redeployed after adding them.
- **500 errors mentioning "database":** Redis isn't connected — re-check
  the Upstash integration is linked to this exact project.
- **Photo upload fails but the rest of the form works:** Vercel Blob isn't
  connected yet — see section 4. The form still submits fine without a
  photo in the meantime.
- **Session doesn't stick between requests:** make sure you're testing
  over HTTPS — the session cookie is marked `Secure` in production and
  browsers silently drop it over plain HTTP.
