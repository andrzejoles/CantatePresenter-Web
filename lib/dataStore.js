import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DEFAULT_DIR = path.join(DATA_DIR, 'default');

export class DataStore {
  constructor() {
    this.ensureDatabaseFiles();
    this.songs = this.readJSON('songs.json', []);
    this.settings = this.readJSON('settings.json', this.defaultSettings());
    this.plans = this.readJSON('plans.json', []);

    // Active Live State
    this.liveState = {
      isLive: false,
      isBlackScreen: false,
      isClearText: false,
      currentSongId: this.songs.length > 0 ? this.songs[0].id : null,
      currentSlideIndex: 0
    };

    this.io = null;
  }

  setSocketIO(ioInstance) {
    this.io = ioInstance;
  }

  broadcastLiveState() {
    if (this.io) {
      const payload = this.getPresentationPayload();
      this.io.emit('presentation:state', payload);
    }
  }

  getPresentationPayload() {
    const song = this.songs.find(s => s.id === this.liveState.currentSongId) || null;
    let slide = null;
    let nextSlide = null;

    if (song && song.slides && song.slides.length > 0) {
      const idx = Math.max(0, Math.min(this.liveState.currentSlideIndex, song.slides.length - 1));
      slide = song.slides[idx];
      if (idx + 1 < song.slides.length) {
        nextSlide = song.slides[idx + 1];
      }
    }

    return {
      isLive: this.liveState.isLive,
      isBlackScreen: this.liveState.isBlackScreen,
      isClearText: this.liveState.isClearText,
      currentSong: song,
      currentSlide: slide,
      nextSlide: nextSlide,
      slideIndex: this.liveState.currentSlideIndex,
      settings: this.settings
    };
  }

  defaultSettings() {
    return {
      appLanguage: 'pl',
      verticalAlignment: 'center',
      activeLogoId: 'equipes_notre_dame',
      selectedScreenIndex: 1,
      fontFamily: 'Segoe UI, sans-serif',
      uiScale: 1.0,
      textAlignment: 'center',
      isBold: true,
      marginPercent: 0.07,
      lineSpacingFactor: 1.15,
      textColorHex: '#FFFFFF',
      backgroundColorHex: '#000000',
      hasShadow: true,
      onlineSearchLanguage: 'pl'
    };
  }

  ensureDatabaseFiles() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const filesToCopy = ['songs.json', 'settings.json', 'plans.json', 'standby.html'];
    for (const f of filesToCopy) {
      const target = path.join(DATA_DIR, f);
      const source = path.join(DEFAULT_DIR, f);
      if (!fs.existsSync(target) && fs.existsSync(source)) {
        try {
          fs.copyFileSync(source, target);
        } catch (e) {
          console.warn(`Nie można skopiować pliku domyślnego ${f}:`, e.message);
        }
      }
    }

    // Copy directories logos/ and templates/ if present
    const dirsToCopy = ['logos', 'templates'];
    for (const d of dirsToCopy) {
      const targetDir = path.join(DATA_DIR, d);
      const sourceDir = path.join(DEFAULT_DIR, d);
      if (!fs.existsSync(targetDir) && fs.existsSync(sourceDir)) {
        try {
          fs.cpSync(sourceDir, targetDir, { recursive: true });
        } catch (e) {}
      }
    }
  }

  readJSON(fileName, fallback) {
    const file = path.join(DATA_DIR, fileName);
    if (fs.existsSync(file)) {
      try {
        const raw = fs.readFileSync(file, 'utf-8');
        return JSON.parse(raw);
      } catch (e) {
        console.error(`Błąd odczytu ${fileName}:`, e.message);
      }
    }
    return fallback;
  }

  atomicWriteJSON(fileName, data) {
    const file = path.join(DATA_DIR, fileName);
    const tempFile = path.join(DATA_DIR, `${fileName}.tmp.${Date.now()}`);
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, file);
  }

  saveSongs() {
    this.atomicWriteJSON('songs.json', this.songs);
    this.broadcastLiveState();
  }

  saveSettings() {
    this.atomicWriteJSON('settings.json', this.settings);
    this.broadcastLiveState();
  }

  savePlans() {
    this.atomicWriteJSON('plans.json', this.plans);
  }

  // Live Navigation
  nextSlide() {
    const song = this.songs.find(s => s.id === this.liveState.currentSongId);
    if (!song || !song.slides) return;

    if (this.liveState.currentSlideIndex < song.slides.length - 1) {
      this.liveState.currentSlideIndex++;
    } else {
      this.nextSong();
    }
    this.broadcastLiveState();
  }

  prevSlide() {
    if (this.liveState.currentSlideIndex > 0) {
      this.liveState.currentSlideIndex--;
    } else {
      this.prevSong(true);
    }
    this.broadcastLiveState();
  }

  nextSong() {
    const idx = this.songs.findIndex(s => s.id === this.liveState.currentSongId);
    if (idx >= 0 && idx < this.songs.length - 1) {
      this.liveState.currentSongId = this.songs[idx + 1].id;
      this.liveState.currentSlideIndex = 0;
      this.broadcastLiveState();
    }
  }

  prevSong(toLast = false) {
    const idx = this.songs.findIndex(s => s.id === this.liveState.currentSongId);
    if (idx > 0) {
      const prev = this.songs[idx - 1];
      this.liveState.currentSongId = prev.id;
      this.liveState.currentSlideIndex = toLast && prev.slides ? prev.slides.length - 1 : 0;
      this.broadcastLiveState();
    }
  }

  toggleBlackScreen() {
    this.liveState.isBlackScreen = !this.liveState.isBlackScreen;
    this.broadcastLiveState();
  }

  toggleClearText() {
    this.liveState.isClearText = !this.liveState.isClearText;
    this.broadcastLiveState();
  }

  setLive(status) {
    this.liveState.isLive = Boolean(status);
    this.broadcastLiveState();
  }

  // Backup Archive Creation (Zip / Stream)
  createBackupArchive(res) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `CantatePresenter_Backup_${timestamp}.cantatebackup`;

    res.attachment(filename);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', err => {
      throw err;
    });

    archive.pipe(res);

    // Append files from data
    const files = ['songs.json', 'plans.json', 'settings.json', 'standby.html'];
    for (const f of files) {
      const p = path.join(DATA_DIR, f);
      if (fs.existsSync(p)) {
        archive.file(p, { name: f });
      }
    }

    const dirs = ['logos', 'templates'];
    for (const d of dirs) {
      const dp = path.join(DATA_DIR, d);
      if (fs.existsSync(dp)) {
        archive.directory(dp, d);
      }
    }

    // Manifest
    const manifest = {
      version: '1.0.0',
      appName: 'CantatePresenter Web',
      createdAt: new Date().toISOString(),
      songsCount: this.songs.length,
      plansCount: this.plans.length,
      activeLogoId: this.settings.activeLogoId
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    archive.finalize();
  }

  // Backup Restore from uploaded zip
  restoreBackupArchive(zipBuffer) {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const entryName = entry.entryName;
      if (entryName.includes('..') || path.isAbsolute(entryName)) continue; // Zip Slip protection

      const targetPath = path.join(DATA_DIR, entryName);
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(targetPath, entry.getData());
    }

    // Reload state
    this.songs = this.readJSON('songs.json', []);
    this.settings = this.readJSON('settings.json', this.defaultSettings());
    this.plans = this.readJSON('plans.json', []);
    if (this.songs.length > 0) {
      this.liveState.currentSongId = this.songs[0].id;
      this.liveState.currentSlideIndex = 0;
    }
    this.broadcastLiveState();
    return true;
  }
}

export const dataStore = new DataStore();
