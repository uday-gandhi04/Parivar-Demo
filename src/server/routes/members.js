import { Router } from 'express';
import { Member, Business, Education } from '../../models/index.js';

export const membersRouter = Router({ mergeParams: true });

function parseMid(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    const err = new Error(`Invalid member ID: "${raw}"`);
    err.status = 400;
    throw err;
  }
  return n;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/families/:fid/members?q=&limit=&skip=
membersRouter.get('/', async (req, res) => {
  const { fid } = req.params;
  const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 2000);
  const skip = Math.max(Number(req.query.skip ?? 0), 0);
  const q = String(req.query.q ?? '').trim();
  const filter = { fid };
  if (q) filter.name = { $regex: escapeRegex(q), $options: 'i' };

  const [members, total] = await Promise.all([
    Member.find(filter).sort({ mid: 1 }).skip(skip).limit(limit).lean(),
    Member.countDocuments(filter),
  ]);
  res.json({ total, limit, skip, returned: members.length, members });
});

// GET /api/families/:fid/members/:mid
membersRouter.get('/:mid', async (req, res) => {
  const { fid } = req.params;
  const mid = parseMid(req.params.mid);
  const member = await Member.findOne({ fid, mid }).lean();
  if (!member) {
    const err = new Error('Member not found.');
    err.status = 404;
    throw err;
  }

  const directIds = [member.fatherId, member.motherId, member.spouseId].filter((v) => v != null);
  const [related, children, businesses, educationRaw] = await Promise.all([
    directIds.length ? Member.find({ fid, mid: { $in: directIds } }).lean() : Promise.resolve([]),
    Member.find({ fid, $or: [{ fatherId: mid }, { motherId: mid }] }).sort({ dob: 1, mid: 1 }).lean(),
    Business.find({ fid, mid }).sort({ isCurrent: -1, createdAt: -1 }).lean(),
    Education.find({ fid, mid }).lean(),
  ]);

  const educations = educationRaw.slice().sort((a, b) => {
    if (!a.year && !b.year) return 0;
    if (!a.year) return 1;
    if (!b.year) return -1;
    return String(b.year).localeCompare(String(a.year));
  });
  const byMid = new Map(related.map((m) => [m.mid, m]));

  res.json({
    member,
    relations: {
      father: byMid.get(member.fatherId) ?? null,
      mother: byMid.get(member.motherId) ?? null,
      spouse: byMid.get(member.spouseId) ?? null,
      children,
    },
    businesses,
    educations,
  });
});

// GET /api/families/:fid/members/:mid/tree?degrees=2 — BFS subgraph.
membersRouter.get('/:mid/tree', async (req, res) => {
  const { fid } = req.params;
  const rootMid = parseMid(req.params.mid);
  const degrees = Math.min(Math.max(Number(req.query.degrees ?? 2), 0), 20);
  const root = await Member.findOne({ fid, mid: rootMid }).lean();
  if (!root) {
    const err = new Error('Member not found.');
    err.status = 404;
    throw err;
  }

  const visited = new Set([rootMid]);
  let frontier = new Set([rootMid]);
  for (let depth = 0; depth < degrees; depth += 1) {
    if (!frontier.size) break;
    const frontierIds = [...frontier];
    const [outgoing, incoming] = await Promise.all([
      Member.find({ fid, mid: { $in: frontierIds } }, { mid: 1, fatherId: 1, motherId: 1, spouseId: 1 }).lean(),
      Member.find({ fid, $or: [{ fatherId: { $in: frontierIds } }, { motherId: { $in: frontierIds } }] }, { mid: 1 }).lean(),
    ]);
    const next = new Set();
    for (const person of outgoing) {
      for (const field of ['fatherId', 'motherId', 'spouseId']) {
        const target = person[field];
        if (target != null && !visited.has(target)) next.add(target);
      }
    }
    for (const child of incoming) if (!visited.has(child.mid)) next.add(child.mid);
    next.forEach((id) => visited.add(id));
    frontier = next;
  }

  const members = await Member.find({ fid, mid: { $in: [...visited] } }).lean();
  res.json({ root: { fid, mid: rootMid, degrees }, count: members.length, members });
});
