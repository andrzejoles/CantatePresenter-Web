import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import { auth } from './lib/auth.js';
import { dataStore } from './lib/dataStore.js';
import {
  configureSecurityHeaders,
  loginLimiter,
  setupLimiter,
  requireAuthMiddleware,
  csrfProtectionMiddleware
} from './lib/security.js';
import { transposeChords } from './lib/guitarChords.js';
import { parseRawSongString } from './lib/textImporter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

dataStore.setSocketIO(io);

// Trust proxy if configured (e.g. Nginx on VPS)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// 1. Security Headers & Parsers
configureSecurityHeaders(app);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser(auth.sessionSecret));

// Multer for Backup upload (stored in memory, max 50MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Print master setup key on first launch if not configured
auth.printBootstrapBanner();

// -------------------------------------------------------------------
// PUBLIC AUTHENTICATION & SETUP ENDPOINTS
// -------------------------------------------------------------------

app.get('/api/auth/status', (req, res) => {
  const isConfigured = auth.isConfigured();
  const token = req.cookies?.cantate_session || req.headers['authorization']?.replace('Bearer ', '');
  const session = auth.verifySessionToken(token, req.ip);

  res.json({
    success: true,
    isConfigured,
    isAuthenticated: Boolean(session),
    username: session ? session.username : null
  });
});

app.post('/api/auth/setup', setupLimiter, async (req, res) => {
  try {
    const { masterKey, username, password } = req.body;
    await auth.setupInitialAdmin(masterKey, username, password);

    // Auto login
    const { token, expiresAt } = auth.createSessionToken(username, req.ip);
    res.cookie('cantate_session', token, {
      httpOnly: true,
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'strict',
      maxAge: expiresAt - Date.now()
    });

    res.json({ success: true, message: 'Konto administratora zostało pomyślnie utworzone!' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await auth.authenticate(username, password);

    if (!result.success) {
      if (result.reason === 'not_configured') {
        return res.status(400).json({ success: false, error: 'Wymagana konfiguracja początkowa (/setup.html)' });
      }
      return res.status(401).json({ success: false, error: 'Nieprawidłowa nazwa użytkownika lub hasło.' });
    }

    const { token, expiresAt } = auth.createSessionToken(result.username, req.ip);
    res.cookie('cantate_session', token, {
      httpOnly: true,
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'strict',
      maxAge: expiresAt - Date.now()
    });

    res.json({ success: true, username: result.username });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Błąd serwera podczas logowania.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.cantate_session;
  auth.invalidateSession(token);
  res.clearCookie('cantate_session');
  res.json({ success: true });
});

app.post('/api/auth/emergency-reset', setupLimiter, (req, res) => {
  try {
    const { masterKey } = req.body;
    auth.emergencyReset(masterKey);
    res.clearCookie('cantate_session');
    res.json({ success: true, message: 'Wykonano reset awaryjny. Możesz teraz przejść do /setup.html.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------------
// PUBLIC STATIC DISPLAY SCREENS (Can be opened on projector/phone)
// -------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------------
// PROTECTED API ENDPOINTS (Require Authentication + CSRF check)
// -------------------------------------------------------------------
app.use('/api', requireAuthMiddleware, csrfProtectionMiddleware);

// Songs CRUD
app.get('/api/songs', (req, res) => {
  res.json({ success: true, songs: dataStore.songs });
});

app.post('/api/songs', (req, res) => {
  const newSong = req.body;
  if (!newSong.title) return res.status(400).json({ success: false, error: 'Brak tytułu' });
  newSong.id = newSong.id || crypto.randomUUID();
  newSong.createdAt = newSong.createdAt || new Date().toISOString();
  newSong.updatedAt = new Date().toISOString();

  dataStore.songs.unshift(newSong);
  dataStore.saveSongs();
  res.json({ success: true, song: newSong });
});

app.put('/api/songs/:id', (req, res) => {
  const id = req.params.id;
  const idx = dataStore.songs.findIndex(s => s.id === id);
  if (idx < 0) return res.status(404).json({ success: false, error: 'Nie znaleziono pieśni' });

  const updated = { ...dataStore.songs[idx], ...req.body, updatedAt: new Date().toISOString() };
  dataStore.songs[idx] = updated;
  dataStore.saveSongs();
  res.json({ success: true, song: updated });
});

app.delete('/api/songs/:id', (req, res) => {
  const id = req.params.id;
  dataStore.songs = dataStore.songs.filter(s => s.id !== id);
  dataStore.saveSongs();
  res.json({ success: true });
});

// Song Import from raw text
app.post('/api/songs/parse-raw', (req, res) => {
  const { rawText, fallbackTitle } = req.body;
  const parsed = parseRawSongString(rawText, fallbackTitle);
  res.json({ success: true, song: parsed });
});

// Plans CRUD
app.get('/api/plans', (req, res) => {
  res.json({ success: true, plans: dataStore.plans });
});

app.post('/api/plans', (req, res) => {
  const plan = req.body;
  plan.id = plan.id || crypto.randomUUID();
  plan.createdAt = new Date().toISOString();
  plan.updatedAt = new Date().toISOString();
  dataStore.plans.unshift(plan);
  dataStore.savePlans();
  res.json({ success: true, plan });
});

app.put('/api/plans/:id', (req, res) => {
  const id = req.params.id;
  const idx = dataStore.plans.findIndex(p => p.id === id);
  if (idx < 0) return res.status(404).json({ success: false, error: 'Nie znaleziono planu' });

  dataStore.plans[idx] = { ...dataStore.plans[idx], ...req.body, updatedAt: new Date().toISOString() };
  dataStore.savePlans();
  res.json({ success: true, plan: dataStore.plans[idx] });
});

app.delete('/api/plans/:id', (req, res) => {
  const id = req.params.id;
  dataStore.plans = dataStore.plans.filter(p => p.id !== id);
  dataStore.savePlans();
  res.json({ success: true });
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json({ success: true, settings: dataStore.settings });
});

app.post('/api/settings', (req, res) => {
  dataStore.settings = { ...dataStore.settings, ...req.body };
  dataStore.saveSettings();
  res.json({ success: true, settings: dataStore.settings });
});

// Live Presentation Controls
app.get('/api/live/state', (req, res) => {
  res.json({ success: true, state: dataStore.getPresentationPayload() });
});

app.post('/api/live/select-slide', (req, res) => {
  const { songId, slideIndex } = req.body;
  if (songId) dataStore.liveState.currentSongId = songId;
  dataStore.liveState.currentSlideIndex = typeof slideIndex === 'number' ? slideIndex : 0;
  dataStore.liveState.isLive = true;
  dataStore.broadcastLiveState();
  res.json({ success: true, state: dataStore.getPresentationPayload() });
});

app.post('/api/live/action', (req, res) => {
  const { action } = req.body;
  switch (action) {
    case 'nextSlide':
      dataStore.nextSlide();
      break;
    case 'prevSlide':
      dataStore.prevSlide();
      break;
    case 'toggleBlack':
      dataStore.toggleBlackScreen();
      break;
    case 'toggleClear':
      dataStore.toggleClearText();
      break;
    case 'stop':
      dataStore.setLive(false);
      break;
    default:
      break;
  }
  res.json({ success: true, state: dataStore.getPresentationPayload() });
});

// Chords Transposition
app.post('/api/chords/transpose', (req, res) => {
  const { chords, semitones } = req.body;
  const transposed = transposeChords(chords, parseInt(semitones || '0', 10));
  res.json({ success: true, chords: transposed });
});

// -------------------------------------------------------------------
// BACKUP ENDPOINTS (Download & Upload)
// -------------------------------------------------------------------
app.get('/api/backup/download', (req, res) => {
  try {
    dataStore.createBackupArchive(res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/backup/upload', upload.single('backupFile'), (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'Nie przesłano pliku kopii zapasowej.' });
    }
    dataStore.restoreBackupArchive(req.file.buffer);
    res.json({ success: true, message: 'Baza danych została pomyślnie przywrócona!' });
  } catch (err) {
    res.status(500).json({ success: false, error: `Błąd podczas przywracania kopii: ${err.message}` });
  }
});

// Root protected route: if not authenticated redirect to login
app.get('/', requireAuthMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------------------------------------------------------------------
// REAL-TIME WEBSOCKETS (Socket.io)
// -------------------------------------------------------------------
io.on('connection', socket => {
  // Send current state to newly connected client
  socket.emit('presentation:state', dataStore.getPresentationPayload());

  // Listen for actions from remote / stage / operator
  socket.on('control:action', action => {
    // Check if operator sent command
    switch (action) {
      case 'nextSlide':
        dataStore.nextSlide();
        break;
      case 'prevSlide':
        dataStore.prevSlide();
        break;
      case 'toggleBlack':
        dataStore.toggleBlackScreen();
        break;
      case 'toggleClear':
        dataStore.toggleClearText();
        break;
      case 'stop':
        dataStore.setLive(false);
        break;
      default:
        break;
    }
  });

  socket.on('control:selectSlide', ({ songId, slideIndex }) => {
    if (songId) dataStore.liveState.currentSongId = songId;
    dataStore.liveState.currentSlideIndex = slideIndex;
    dataStore.liveState.isLive = true;
    dataStore.broadcastLiveState();
  });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================================================`);
  console.log(`🎶 CantatePresenter Web Server nasłuchuje na porcie http://localhost:${PORT}`);
  console.log(`========================================================================\n`);
});
