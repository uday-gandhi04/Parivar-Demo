import { Router } from 'express';
import { Family, Member } from '../../models/index.js';

export const familiesRouter = Router();

// GET /api/families
familiesRouter.get('/', async (req, res) => {
  const fid = req.user.fid;
  const families = await Family.find({ fid }).sort({ name: 1 }).lean();

  const counts = await Member.aggregate([
    { $match: { fid } },
    { $group: { _id: '$fid', memberCount: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id, c.memberCount]));

  const enriched = families.map((f) => ({
    ...f,
    memberCount: countMap.get(f.fid) ?? 0,
  }));

  res.json({ count: enriched.length, families: enriched });
});

// GET /api/families/:fid
familiesRouter.get('/:fid', async (req, res) => {
  const family = await Family.findOne({ fid: req.params.fid }).lean();
  if (!family) {
    const err = new Error(`Family not found: ${req.params.fid}`);
    err.status = 404;
    throw err;
  }
  res.json(family);
});
