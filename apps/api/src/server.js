import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { archiveRouter } from './routes/archive.js';
import { interviewsRouter } from './routes/interviews.js';
import { profileRouter } from './routes/profile.js';
import { authenticateRequest } from './middleware/authenticateRequest.js';
import { assertSupabaseConfiguration } from './services/supabaseClient.js';
import { HttpError, isHttpError } from './lib/httpError.js';

const app = express();
const port = process.env.PORT || 7071;
const isProduction = process.env.NODE_ENV === 'production';
assertSupabaseConfiguration();
const configuredOrigins = process.env.CORS_ORIGINS
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = configuredOrigins ?? (isProduction ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']);

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new HttpError(403, 'CORS_ORIGIN_FORBIDDEN', 'This origin is not allowed to call the API.'));
  }
}));
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '256kb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ghost-api' });
});

app.use('/api', authenticateRequest);
app.use('/api/archive', archiveRouter);
app.use('/api/interviews', interviewsRouter);
app.use('/api/profile', profileRouter);

app.use((_req, _res, next) => {
  next(new HttpError(404, 'ROUTE_NOT_FOUND', 'Route not found.'));
});

app.use((error, _req, res, _next) => {
  const statusCode = isHttpError(error)
    ? error.statusCode
    : Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode < 500
      ? error.statusCode
      : 500;
  const code = isHttpError(error) ? error.code : statusCode === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
  const message = isHttpError(error)
    ? error.message
    : statusCode === 500
      ? 'The request could not be completed.'
      : 'The request could not be processed.';

  console.error(`[ghost-api] ${code}: ${error.message}`);
  res.status(statusCode).json({ error: { code, message } });
});

app.listen(port, () => {
  console.log(`Ghost API listening on http://localhost:${port}`);
});
