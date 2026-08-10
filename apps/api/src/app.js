import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { archiveRouter } from './routes/archive.js';
import { interviewsRouter } from './routes/interviews.js';
import { profileRouter } from './routes/profile.js';
import { afterInterviewRouter } from './routes/afterInterview.js';
import { authenticateRequest } from './middleware/authenticateRequest.js';
import { assertSupabaseConfiguration } from './services/supabaseClient.js';
import { HttpError, isHttpError } from './lib/httpError.js';

function configuredOrigins(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((origin) => origin.trim()).filter(Boolean);
  return null;
}

function desktopLoopbackOrigin(origin) {
  return /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
}

function contentSecurityPolicy() {
  const connectSources = ["'self'"];
  try {
    const supabaseUrl = new URL(process.env.SUPABASE_URL);
    connectSources.push(supabaseUrl.origin, `${supabaseUrl.protocol === 'https:' ? 'wss:' : 'ws:'}//${supabaseUrl.host}`);
  } catch {}
  return [
    "default-src 'self'",
    "base-uri 'self'",
    `connect-src ${connectSources.join(' ')}`,
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:"
  ].join('; ');
}

export function createGhostApiApp({
  allowedOrigins,
  desktopMode = false,
  frontendPath = null,
  isProduction = process.env.NODE_ENV === 'production',
  requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '256kb'
} = {}) {
  assertSupabaseConfiguration();
  const app = express();
  const explicitOrigins = configuredOrigins(allowedOrigins ?? process.env.CORS_ORIGINS);
  const permittedOrigins = explicitOrigins ?? (isProduction ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']);

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({
      'Content-Security-Policy': contentSecurityPolicy(),
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    });
    next();
  });
  app.use(cors({
    origin(origin, callback) {
      if (!origin || permittedOrigins.includes(origin) || (desktopMode && desktopLoopbackOrigin(origin))) {
        return callback(null, true);
      }
      return callback(new HttpError(403, 'CORS_ORIGIN_FORBIDDEN', 'This origin is not allowed to call the API.'));
    }
  }));
  app.use(express.json({ limit: requestBodyLimit }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ghost-api' });
  });

  app.use('/api', authenticateRequest);
  app.use('/api/archive', archiveRouter);
  app.use('/api/interviews', interviewsRouter);
  app.use('/api/after-interview', afterInterviewRouter);
  app.use('/api/profile', profileRouter);

  if (frontendPath) {
    app.use(express.static(frontendPath, { index: false, maxAge: isProduction ? '1h' : 0 }));
    app.get('*', (req, res, next) => {
      if (req.path === '/api' || req.path.startsWith('/api/') || !req.accepts('html')) return next();
      return res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }

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

  return app;
}
