import jwt from 'jsonwebtoken';
import { Member } from '../../models/index.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    const err = new Error('Authentication required.');
    err.status = 401;
    return next(err);
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.AUTH_JWT_SECRET);
  } catch {
    const err = new Error('Invalid or expired demo session. Please enter the demo again.');
    err.status = 401;
    return next(err);
  }

  if (payload.demo === true) {
    const expectedFid = process.env.DEMO_FID || 'PARIVAR_DEMO';
    const expectedMid = Number(process.env.DEMO_MEMBER_ID || 1051);
    if (process.env.DEMO_MODE !== 'true' || payload.fid !== expectedFid || Number(payload.mid) !== expectedMid) {
      const err = new Error('This demo session is not valid for this deployment.');
      err.status = 401;
      return next(err);
    }

    const actor = await Member.findOne(
      { fid: expectedFid, mid: expectedMid },
      { mid: 1, fid: 1, name: 1 }
    ).lean();

    if (!actor) {
      const err = new Error('Demo member not found. Import the synthetic demo workbook first.');
      err.status = 503;
      return next(err);
    }

    req.user = { mid: actor.mid, fid: actor.fid, role: 'demo_viewer', name: actor.name, demo: true };
    return next();
  }

  // Public demo deployments accept only the fixed synthetic demo token.
  const err = new Error('Only the read-only demo session is enabled.');
  err.status = 401;
  return next(err);
}
