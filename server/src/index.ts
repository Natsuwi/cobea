import express from 'express';
import cors from 'cors';
import { env } from './lib/env.js';
import { authRouter } from './routes/auth.js';
import { foldersRouter } from './routes/folders.js';
import { cardsRouter } from './routes/cards.js';

import { isEnvGoogleConfigured } from './storage/google.js';

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/config', (_req, res) => {
  res.json({
    googleConfigured: isEnvGoogleConfigured(),
    googleRedirectUri: env.GOOGLE_REDIRECT_URI,
  });
});

app.use('/api/auth', authRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/cards', cardsRouter);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
);

app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Cobea API listening on :${env.PORT}`);
});
