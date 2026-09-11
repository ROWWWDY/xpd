function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

// Decodes a `data:image/png;base64,....` URL into a Buffer + extension,
// rejecting anything that isn't a plain PNG/JPEG or is too large.
function decodeImageDataUrl(dataUrl) {
  const match = /^data:(image\/(png|jpeg|jpg));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || '').trim());
  if (!match) return { error: 'Only PNG or JPEG images are supported.' };
  const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  const buffer = Buffer.from(match[3], 'base64');
  if (buffer.length > MAX_IMAGE_BYTES) return { error: 'Photo is too large — please keep it under 2MB.' };
  if (buffer.length === 0) return { error: 'That photo looks empty — try a different file.' };
  return { buffer, mime, ext };
}

module.exports = async (req, res) => {
  try {
    const crypto = require('crypto');
    const { readDb, writeDb } = require('./_lib/db');
    const { ACK_SECTIONS } = require('./_lib/ackSections');
    const { getClientIp } = require('./_lib/auth');

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

    const body = parseBody(req);
    const { inviteToken, discordName, discordId, charname, availability, notes, description, imageBase64, signature, date, ack } = body;

    if (!inviteToken) {
      return res.status(401).json({ error: 'Missing invite link. Open this form using your personal invite link.' });
    }
    if (!discordName || !discordId || !charname || !signature) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    if (!Array.isArray(ack) || ack.length !== 17 || ack.some((v) => v !== true)) {
      return res.status(400).json({ error: 'All guideline items must be acknowledged.' });
    }

    const db = await readDb();

    const invite = db.invites.find((i) => i.id === inviteToken);
    if (!invite) {
      return res.status(401).json({ error: 'This invite link is not valid.' });
    }
    if (invite.used) {
      return res.status(409).json({ error: 'This invite link has already been used to submit an application.' });
    }

    const cleanDiscordId = String(discordId).trim().slice(0, 100);

    // Block a second pending/accepted application under the same self-reported Discord ID.
    const existing = db.applications.find(
      (a) => a.discordId === cleanDiscordId && (a.status === 'pending' || a.status === 'accepted')
    );
    if (existing) {
      return res.status(409).json({ error: 'An application for this Discord ID is already pending or accepted.' });
    }

    // Photo is optional — if provided, store it on Vercel Blob rather than
    // in Redis, and keep just the resulting URL on the application record.
    let uploadedImageUrl = '';
    if (imageBase64) {
      const decoded = decodeImageDataUrl(imageBase64);
      if (decoded.error) return res.status(400).json({ error: decoded.error });

      let put;
      try {
        ({ put } = require('@vercel/blob'));
      } catch (e) {
        return res.status(500).json({ error: 'Photo storage isn\'t configured yet — ask an admin to enable Vercel Blob, or submit without a photo.' });
      }

      const filename = 'cadets/' + cleanDiscordId + '-' + Date.now() + '.' + decoded.ext;
      let blob;
      try {
        blob = await put(filename, decoded.buffer, { access: 'public', contentType: decoded.mime });
      } catch (blobErr) {
        console.error('blob upload error:', blobErr);
        return res.status(500).json({ error: 'Photo storage isn\'t set up yet on this deployment — ask an admin to connect Vercel Blob (Storage → Create Database → Blob), or submit without a photo for now.' });
      }
      uploadedImageUrl = blob.url;
    }

    const formNumber = db.counter;
    const record = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      formNumber,
      discordName: String(discordName).slice(0, 100),
      discordId: cleanDiscordId,
      charname: String(charname).slice(0, 100),
      availability: String(availability || '').slice(0, 200),
      notes: String(notes || '').slice(0, 1000),
      description: String(description || '').slice(0, 500),
      imageUrl: uploadedImageUrl,
      signature: String(signature).slice(0, 100),
      date: String(date || new Date().toLocaleString()).slice(0, 60),
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      inviteId: invite.id,
      ackSections: ACK_SECTIONS,
      ip: getClientIp(req),
      ts: Date.now()
    };

    db.applications.push(record);
    db.counter = formNumber + 1;

    // Permanent, append-only — kept separate from `applications` so it
    // survives even if this application is later deleted or rejected.
    // Owner can still individually clear entries from the Security tab.
    db.ipLog.push({
      id: crypto.randomBytes(8).toString('hex'),
      formNumber,
      applicationId: record.id,
      charname: record.charname,
      discordName: record.discordName,
      discordId: record.discordId,
      ip: record.ip,
      date: record.date,
      ts: record.ts
    });

    invite.used = true;
    invite.usedAt = Date.now();
    invite.applicationId = record.id;

    await writeDb(db);

    res.status(200).json({ ok: true, formNumber, id: record.id });
  } catch (err) {
    console.error('submit error:', err);
    res.status(500).json({ error: 'Something went wrong submitting your application. Please try again in a moment, or contact an admin if it keeps happening.' });
  }
};
