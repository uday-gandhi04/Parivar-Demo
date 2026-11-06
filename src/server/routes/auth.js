import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { Member } from '../../models/index.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const demoAttempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 20;

function allowDemoSession(req) {
  const key = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const old = demoAttempts.get(key);
  if (!old || now - old.startedAt > WINDOW_MS) {
    demoAttempts.set(key, { startedAt: now, count: 1 });
    return true;
  }
  old.count += 1;
  return old.count <= MAX_ATTEMPTS;
}

// POST /api/auth/demo-session — one-click access to one fixed fictional member.
authRouter.post('/demo-session', async (req, res) => {
  if (process.env.DEMO_MODE !== 'true') {
    return res.status(404).json({ error: 'Demo access is disabled.' });
  }
  if (!allowDemoSession(req)) {
    return res.status(429).json({ error: 'Too many demo sessions requested. Try again shortly.' });
  }

  const fid = process.env.DEMO_FID || 'PARIVAR_DEMO';
  const mid = Number(process.env.DEMO_MEMBER_ID || 1051);
  if (!process.env.AUTH_JWT_SECRET || process.env.AUTH_JWT_SECRET.length < 32) {
    return res.status(503).json({ error: 'Demo authentication is not configured correctly.' });
  }

  const member = await Member.findOne({ fid, mid }).lean();
  if (!member) {
    return res.status(503).json({ error: 'Demo data has not been imported. Please contact the demo administrator.' });
  }

  const token = jwt.sign(
    { mid, fid, role: 'demo_viewer', demo: true },
    process.env.AUTH_JWT_SECRET,
    { expiresIn: '2h' }
  );

  res.json({
    token,
    member: { mid, fid, name: member.name, role: 'demo_viewer' },
    expiresIn: 7200,
  });
});

// GET /api/auth/me — return the current synthetic viewing identity.
authRouter.get('/me', requireAuth, async (req, res) => {
  const { mid, fid } = req.user;
  const member = await Member.findOne({ fid, mid }).lean();
  if (!member) {
    const err = new Error('Demo member not found.');
    err.status = 401;
    throw err;
  }

  const directIds = [member.fatherId, member.motherId, member.spouseId].filter((v) => v != null);
  const [related, children] = await Promise.all([
    directIds.length ? Member.find({ fid, mid: { $in: directIds } }).lean() : Promise.resolve([]),
    Member.find({ fid, $or: [{ fatherId: mid }, { motherId: mid }] }).sort({ dob: 1, mid: 1 }).lean(),
  ]);
  const byMid = new Map(related.map((m) => [m.mid, m]));

  res.json({
    member: {
      ...member,
      role: 'demo_viewer',
      father: byMid.get(member.fatherId) ?? null,
      mother: byMid.get(member.motherId) ?? null,
      spouse: byMid.get(member.spouseId) ?? null,
      children,
    },
  });
});
