import { Router } from 'express';
import { healthRouter } from './health.js';
import { familiesRouter } from './families.js';
import { membersRouter } from './members.js';
import { authRouter } from './auth.js';
import { requireAuth } from '../middleware/auth.js';

export const routes = Router();

routes.use('/health', healthRouter);
routes.use('/auth', authRouter);

// Everything below this line requires the fixed, synthetic demo session.
routes.use((req, res, next) => requireAuth(req, res, next));

// Hard server-side read-only enforcement. Never rely on hiding frontend buttons.
routes.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return res.status(403).json({ error: 'Parivar Demo is read-only. Changes are disabled.' });
  }
  next();
});

// A demo token can only access its own synthetic family, even if another fid is guessed.
routes.use('/families/:fid', (req, res, next) => {
  if (req.params.fid !== req.user.fid) {
    return res.status(403).json({ error: 'This demo session cannot access another family.' });
  }
  next();
});

routes.use('/families', familiesRouter);
routes.use('/families/:fid/members', membersRouter);
