import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { auth } from './auth.js';

export const configureSecurityHeaders = (app) => {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
          fontSrc: ["'self'", 'fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          frameAncestors: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-origin' }
    })
  );
};

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 5, // Maksymalnie 5 prób logowania na IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Zbyt wiele nieudanych prób logowania. Ze względów bezpieczeństwa zablokowano dostęp na 15 minut.'
  }
});

export const setupLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Zbyt wiele prób konfiguracji. Spróbuj ponownie za 30 minut.'
  }
});

export const requireAuthMiddleware = (req, res, next) => {
  // Check if server is configured
  if (!auth.isConfigured()) {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ success: false, error: 'setup_required' });
    }
    return res.redirect('/setup.html');
  }

  // Check session cookie or Authorization header
  const token = req.cookies?.cantate_session || req.headers['authorization']?.replace('Bearer ', '');
  const session = auth.verifySessionToken(token, req.ip);

  if (!session) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }
    return res.redirect('/login.html');
  }

  req.user = session;
  next();
};

export const csrfProtectionMiddleware = (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const customHeader = req.headers['x-cantate-request'];
    if (customHeader !== '1' && !req.path.startsWith('/api/backup/upload')) {
      return res.status(403).json({
        success: false,
        error: 'Błąd ochrony CSRF: brak wymaganego nagłówka żądania.'
      });
    }
  }
  next();
};
