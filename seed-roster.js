// One-time helper to populate your roster with the sample officers used in
// the reference design mockup (John Carter, Sarah Mitchell, etc.) so the
// site has something to show while you get real members added.
//
// This is NOT part of the deployed site — it's a script you run once from
// your own machine against your live deployment. Requires Node 18+.
//
// Usage:
//   node seed-roster.js https://yoursite.vercel.app YOUR_ADMIN_USER YOUR_ADMIN_PASS
//
// Uses the ADMIN_USER/ADMIN_PASS bootstrap login (the same env vars your
// deployment already has set) — no need to create a separate admin account
// just to run this.
//
// Every discordId/discordName below is a placeholder. Edit the OFFICERS
// list, or just fix each entry later from the admin dashboard's roster
// tab once you know who's actually filling these slots.

const OFFICERS = [
  { charname: 'John Carter',    discordName: 'johncarter',    discordId: '000000000000000001', rank: 'CHIEF OF POLICE' },
  { charname: 'Sarah Mitchell', discordName: 'sarahmitchell', discordId: '000000000000000002', rank: 'DEPUTY CHIEF OF POLICE' },
  { charname: 'Michael Reyes',  discordName: 'michaelreyes',  discordId: '000000000000000003', rank: 'CAPTAIN' },
  { charname: 'Emma Lawson',    discordName: 'emmalawson',    discordId: '000000000000000004', rank: 'LIEUTENANT' },
  { charname: 'Daniel Brooks',  discordName: 'danielbrooks',  discordId: '000000000000000005', rank: 'SERGEANT' },
  { charname: 'Olivia Carter',  discordName: 'oliviacarter',  discordId: '000000000000000006', rank: 'SERGEANT FIRST CLASS' },
  { charname: 'James Walker',   discordName: 'jameswalker',   discordId: '000000000000000007', rank: 'CORPORAL' },
  { charname: 'Aiden Murphy',   discordName: 'aidenmurphy',   discordId: '000000000000000008', rank: 'OFFICER' },
  { charname: 'Sophia Ramirez', discordName: 'sophiaramirez', discordId: '000000000000000009', rank: 'OFFICER FIRST CLASS' },
  { charname: 'Liam Foster',    discordName: 'liamfoster',    discordId: '000000000000000010', rank: 'OFFICER SECOND CLASS' }
];

async function main() {
  const [, , baseUrlArg, username, password] = process.argv;
  if (!baseUrlArg || !username || !password) {
    console.error('Usage: node seed-roster.js https://yoursite.vercel.app ADMIN_USER ADMIN_PASS');
    process.exit(1);
  }
  const baseUrl = baseUrlArg.replace(/\/$/, '');

  console.log('Logging in...');
  const loginRes = await fetch(baseUrl + '/api/admin/auth?action=login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    process.exit(1);
  }
  const setCookie = loginRes.headers.get('set-cookie');
  if (!setCookie) {
    console.error('No session cookie returned — login may have failed silently.');
    process.exit(1);
  }
  const cookie = setCookie.split(';')[0];

  for (const officer of OFFICERS) {
    const res = await fetch(baseUrl + '/api/admin/roster?action=add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(officer)
    });
    const data = await res.json();
    if (res.ok) {
      console.log('Added:', officer.charname, '(' + officer.rank + ')');
    } else {
      console.log('Skipped:', officer.charname, '-', data.error);
    }
  }

  console.log('Done. Check /officers on your site, or the roster tab in the admin dashboard.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
