import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const AUTH_FILE = path.join(DATA_DIR, 'auth_config.json');
const BOOTSTRAP_KEY_FILE = path.join(DATA_DIR, '.bootstrap_key');

export class AuthService {
  constructor() {
    this.ensureDataDir();
    this.sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
    this.masterSetupKey = this.initMasterSetupKey();
    this.authConfig = this.loadAuthConfig();
    this.activeSessions = new Map(); // token -> { username, expiresAt, ip }
  }

  ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    }
  }

  initMasterSetupKey() {
    // 1. Check environment variable
    if (process.env.MASTER_SETUP_KEY && process.env.MASTER_SETUP_KEY.trim().length >= 8) {
      return process.env.MASTER_SETUP_KEY.trim();
    }

    // 2. Check existing bootstrap key file
    if (fs.existsSync(BOOTSTRAP_KEY_FILE)) {
      try {
        const existing = fs.readFileSync(BOOTSTRAP_KEY_FILE, 'utf-8').trim();
        if (existing.length >= 16) {
          return existing;
        }
      } catch (err) {
        // ignore
      }
    }

    // 3. Generate new cryptographically random 32-character master key
    const generatedKey = crypto.randomBytes(16).toString('hex');
    try {
      fs.writeFileSync(BOOTSTRAP_KEY_FILE, generatedKey, { mode: 0o600 });
    } catch (err) {
      console.error('[BEZPIECZEŃSTWO] Nie można zapisać pliku .bootstrap_key:', err.message);
    }

    return generatedKey;
  }

  loadAuthConfig() {
    if (fs.existsSync(AUTH_FILE)) {
      try {
        const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('[BEZPIECZEŃSTWO] Błąd odczytu auth_config.json:', err.message);
      }
    }
    return {
      isConfigured: false,
      username: '',
      passwordHash: '',
      salt: '',
      iterations: 100000,
      createdAt: null,
      updatedAt: null
    };
  }

  saveAuthConfig() {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(this.authConfig, null, 2), { mode: 0o600 });
  }

  isConfigured() {
    return Boolean(this.authConfig && this.authConfig.isConfigured && this.authConfig.passwordHash);
  }

  printBootstrapBanner() {
    if (!this.isConfigured()) {
      console.log('\n========================================================================');
      console.log('🔒 [BEZPIECZEŃSTWO] WYMAGANA KONFIGURACJA POCZĄTKOWA CANTATEPRESENTER!');
      console.log('------------------------------------------------------------------------');
      console.log('Klucz Konfiguracji Początkowej (Master Setup Key):');
      console.log(`\n    👉  ${this.masterSetupKey}  👈\n`);
      console.log('Otwórz stronę w przeglądarce i podaj powyższy klucz, aby utworzyć konto.');
      console.log('Klucz jest poufny i zapisany z uprawnieniami 0600 w pliku data/.bootstrap_key');
      console.log('========================================================================\n');
    }
  }

  hashPassword(password, salt, iterations = 100000) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, iterations, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString('hex'));
      });
    });
  }

  timingSafeMatch(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  verifyMasterKey(key) {
    if (!key || typeof key !== 'string') return false;
    return this.timingSafeMatch(key.trim(), this.masterSetupKey);
  }

  async setupInitialAdmin(masterKey, username, password) {
    if (this.isConfigured()) {
      throw new Error('Aplikacja została już skonfigurowana. Użyj zwykłego logowania.');
    }

    if (!this.verifyMasterKey(masterKey)) {
      throw new Error('Nieprawidłowy Klucz Konfiguracji Początkowej (Master Setup Key).');
    }

    const cleanUser = (username || '').trim();
    if (cleanUser.length < 3) {
      throw new Error('Nazwa użytkownika musi mieć minimum 3 znaki.');
    }

    if (!password || password.length < 8) {
      throw new Error('Hasło musi mieć minimum 8 znaków.');
    }

    const salt = crypto.randomBytes(32).toString('hex');
    const hash = await this.hashPassword(password, salt, 100000);

    this.authConfig = {
      isConfigured: true,
      username: cleanUser,
      passwordHash: hash,
      salt: salt,
      iterations: 100000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.saveAuthConfig();
    console.log(`[BEZPIECZEŃSTWO] Utworzono konto administratora dla użytkownika '${cleanUser}'.`);
    return true;
  }

  async authenticate(username, password) {
    if (!this.isConfigured()) {
      return { success: false, reason: 'not_configured' };
    }

    const cleanUser = (username || '').trim();
    if (!this.timingSafeMatch(cleanUser, this.authConfig.username)) {
      return { success: false, reason: 'invalid_credentials' };
    }

    const candidateHash = await this.hashPassword(password, this.authConfig.salt, this.authConfig.iterations);
    if (!this.timingSafeMatch(candidateHash, this.authConfig.passwordHash)) {
      return { success: false, reason: 'invalid_credentials' };
    }

    return { success: true, username: this.authConfig.username };
  }

  emergencyReset(masterKey) {
    if (!this.verifyMasterKey(masterKey)) {
      throw new Error('Nieprawidłowy Master Setup Key. Reset odrzucony ze względów bezpieczeństwa.');
    }

    this.authConfig = {
      isConfigured: false,
      username: '',
      passwordHash: '',
      salt: '',
      iterations: 100000,
      createdAt: null,
      updatedAt: null
    };

    this.saveAuthConfig();
    this.activeSessions.clear();
    console.warn('[BEZPIECZEŃSTWO] WYKONANO RESET AWARYJNY. Aplikacja powróciła do stanu wstępnego.');
    return true;
  }

  createSessionToken(username, ip = '') {
    const expireHours = parseInt(process.env.SESSION_EXPIRE_HOURS || '24', 10);
    const expiresAt = Date.now() + expireHours * 3600 * 1000;
    const randomPayload = crypto.randomBytes(24).toString('hex');
    const signature = crypto.createHmac('sha256', this.sessionSecret)
      .update(`${username}:${expiresAt}:${randomPayload}`)
      .digest('hex');

    const token = `${username}.${expiresAt}.${randomPayload}.${signature}`;
    this.activeSessions.set(token, { username, expiresAt, ip });
    return { token, expiresAt };
  }

  verifySessionToken(token, ip = '') {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 4) return null;

    const [username, expiresAtStr, randomPayload, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      this.activeSessions.delete(token);
      return null;
    }

    const expectedSig = crypto.createHmac('sha256', this.sessionSecret)
      .update(`${username}:${expiresAtStr}:${randomPayload}`)
      .digest('hex');

    if (!this.timingSafeMatch(signature, expectedSig)) {
      return null;
    }

    return { username, expiresAt };
  }

  invalidateSession(token) {
    if (token) this.activeSessions.delete(token);
  }
}

export const auth = new AuthService();
