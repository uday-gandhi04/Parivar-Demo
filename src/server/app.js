import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import { routes } from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // The API is deployed behind a single trusted hosting proxy (for example Render).
  // This makes req.ip meaningful for the demo-session rate limiter.
  app.set('trust proxy', 1);
  app.use(helmet());

  const allowedOrigins = (process.env.FRONTEND_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
    
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: ${origin} not in allowlist`));
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));


  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}