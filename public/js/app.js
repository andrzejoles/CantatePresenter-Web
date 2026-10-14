import { LOGO_CATALOG, getLogoById } from './logoCatalog.js';

// Application State
let songs = [];
let plans = [];
let settings = {};
let currentSong = null;
let currentSlideIndex = 0;
let liveState = {
  isLive: false,
  isBlackScreen: false,
  isClearText: false
};
let uiScale = 1.0;
let chordsShift = 0;
let originalChords = '';

// BroadcastChannel for instant same-browser sync (works 100% offline!)
const bc = new BroadcastChannel('cantate_live');

// Socket.io for remote sync across network
let socket = null;
try {
  socket = io();
  socket.on('presentation:state', (state) => {
    applyLiveState(state);
  });
} catch (e) {
  console.warn('Socket.io connection unavailable, operating via BroadcastChannel.');
}

// DOM Elements
const songList = document.getElementById('songList');
const songSearch = document.getElementById('songSearch');
const currentSongTitle = document.getElementById('currentSongTitle');
const currentSongMeta = document.getElementById('currentSongMeta');
const slideCardsContainer = document.getElementById('slideCardsContainer');
const liveMonitor = document.getElementById('liveMonitor');
const nextSlideText = document.getElementById('nextSlideText');
const chordsBar = document.getElementById('chordsBar');
const chordsPreviewWrap = document.getElementById('chordsPreviewWrap');
const transposeShiftLabel = document.getElementById('transposeShiftLabel');
const zoomLevelText = document.getElementById('zoomLevelText');
const screenBadge = document.getElementById('screenBadge');

// ===================================================================
// INITIALIZATION & AUTH CHECK
// ===================================================================
async function initApp() {
  try {
    const authRes = await fetch('/api/auth/status');
    const authData = await authRes.json();

    if (!authData.isConfigured) {
      window.location.href = '/setup.html';
      return;
    }

    if (!authData.isAuthenticated) {
      window.location.href = '/login.html';
      return;
    }

    // Load initial data
    await Promise.all([loadSongs(), loadSettings(), loadPlans(), loadLiveState()]);

    renderSongsList();
    renderLogoGallery();
    initManual();
    setupKeyListeners();
  } catch (err) {
    console.error('Błąd inicjalizacji aplikacji:', err);
  }
}

// ===================================================================
// API DATA LOADERS
// ===================================================================
async function loadSongs() {
  const res = await fetch('/api/songs');
  const data = await res.json();
  if (data.success) {
    songs = data.songs;
    if (songs.length > 0 && !currentSong) {
      currentSong = songs[0];
    }
  }
}

async function loadSettings() {
  const res = await fetch('/api/settings');
  const data = await res.json();
  if (data.success) {
    settings = data.settings;
    if (settings.uiScale) setUiScale(settings.uiScale);
  }
}

async function loadPlans() {
  const res = await fetch('/api/plans');
  const data = await res.json();
  if (data.success) plans = data.plans;
}

async function loadLiveState() {
  const res = await fetch('/api/live/state');
  const data = await res.json();
  if (data.success && data.state) {
    applyLiveState(data.state);
  }
}

// ===================================================================
// RENDERERS
// ===================================================================
function foldString(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/ł/g, 'l').replace(/ą/g, 'a').replace(/ć/g, 'c')
    .replace(/ę/g, 'e').replace(/ń/g, 'n').replace(/ó/g, 'o')
    .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function renderSongsList() {
  const q = foldString(songSearch.value);
  const filtered = songs.filter(s => {
    if (!q) return true;
    return foldString(s.title).includes(q) || foldString(s.author).includes(q) || foldString(s.rawLyrics).includes(q);
  }).sort((a, b) => (a.title || '').trim().localeCompare((b.title || '').trim(), 'pl', { sensitivity: 'base', numeric: true }));

  songList.innerHTML = '';
  filtered.forEach(song => {
    const li = document.createElement('li');
    li.className = `song-item ${currentSong && currentSong.id === song.id ? 'active' : ''}`;
    li.innerHTML = `
      <div>
        <div class="song-item-title">${escapeHTML(song.title)}</div>
        <div class="song-item-author">${escapeHTML(song.author || 'Nieznany')}</div>
      </div>
      <div class="song-item-key">${escapeHTML(song.key || '')}</div>
    `;
    li.addEventListener('click', () => {
      selectSong(song);
    });
    songList.appendChild(li);
  });

  renderCurrentSong();
}

function selectSong(song) {
  currentSong = song;
  currentSlideIndex = 0;
  originalChords = song.chords || '';
  chordsShift = 0;
  renderSongsList();
}

function renderCurrentSong() {
  if (!currentSong) {
    currentSongTitle.textContent = 'Wybierz pieśń z biblioteki';
    currentSongMeta.textContent = '';
    slideCardsContainer.innerHTML = '';
    chordsBar.style.display = 'none';
    chordsPreviewWrap.style.display = 'none';
    return;
  }

  currentSongTitle.textContent = currentSong.title;
  currentSongMeta.textContent = `Autor: ${currentSong.author || 'Nieznany'} ${currentSong.key ? '• Tonacja: ' + currentSong.key : ''}`;

  // Chords Bar
  if (currentSong.chords) {
    chordsBar.style.display = 'flex';
    chordsPreviewWrap.textContent = currentSong.chords;
    transposeShiftLabel.textContent = `(${chordsShift > 0 ? '+' : ''}${chordsShift})`;
  } else {
    chordsBar.style.display = 'none';
    chordsPreviewWrap.style.display = 'none';
  }

  // Render Slide Cards
  slideCardsContainer.innerHTML = '';
  const slides = currentSong.slides || [];

  slides.forEach((slide, idx) => {
    const card = document.createElement('div');
    const isSelected = (currentSlideIndex === idx);
    const isChorus = (slide.type === 'Refren');

    card.className = `slide-card ${isSelected ? 'active' : ''} ${isChorus ? 'chorus' : ''}`;
    card.innerHTML = `
      <div class="slide-card-header">${idx + 1}. ${escapeHTML(slide.label || 'Slajd')}</div>
      <div class="slide-card-text">${escapeHTML(slide.text || '')}</div>
    `;

    card.addEventListener('click', () => {
      currentSlideIndex = idx;
      liveState.isLive = true;
      broadcastState();
      renderCurrentSong();
    });

    slideCardsContainer.appendChild(card);
  });
}

function renderLiveMonitor() {
  if (liveState.isBlackScreen) {
    liveMonitor.style.backgroundColor = '#000000';
    liveMonitor.innerHTML = '<span style="color:#f59e0b; font-weight:bold; font-size:14px;">CZARNY EKRAN (B)</span>';
    return;
  }

  if (liveState.isClearText) {
    liveMonitor.style.backgroundColor = settings.backgroundColorHex || '#000000';
    liveMonitor.innerHTML = '<span style="color:#f59e0b; font-weight:bold; font-size:14px;">TEKST UKRYTY (C)</span>';
    return;
  }

  // Standby (No active slide or not live)
  if (!liveState.isLive || !currentSong || !currentSong.slides || !currentSong.slides[currentSlideIndex]) {
    liveMonitor.style.backgroundColor = '#0b0f19';
    const logo = getLogoById(settings.activeLogoId || 'equipes_notre_dame');
    liveMonitor.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;">
        <div style="width:58px; height:58px; margin-bottom:8px;">${logo.svg}</div>
        <div style="font-weight:bold; font-size:14px; color:#ffffff;">CantatePresenter</div>
        <div style="font-size:11px; color:#94a3b8; margin-top:2px;">Wersja 1.0.0</div>
      </div>
    `;
    nextSlideText.textContent = '— Koniec pieśni —';
    return;
  }

  // Live Slide
  const slide = currentSong.slides[currentSlideIndex];
  liveMonitor.style.backgroundColor = settings.backgroundColorHex || '#000000';
  liveMonitor.innerHTML = `
    <div style="color:${settings.textColorHex || '#ffffff'}; font-weight:${settings.isBold ? 'bold' : 'normal'}; font-size:14px; line-height:1.25; white-space:pre-line;">
      ${escapeHTML(slide.text)}
    </div>
  `;

  // Next Slide
  if (currentSlideIndex + 1 < currentSong.slides.length) {
    const next = currentSong.slides[currentSlideIndex + 1];
    nextSlideText.textContent = `${next.label}:\n${next.text}`;
  } else {
    nextSlideText.textContent = '— Koniec pieśni —';
  }
}

function applyLiveState(state) {
  if (!state) return;
  liveState.isLive = state.isLive;
  liveState.isBlackScreen = state.isBlackScreen;
  liveState.isClearText = state.isClearText;
  if (state.currentSong) {
    const found = songs.find(s => s.id === state.currentSong.id);
    if (found) currentSong = found;
  }
  if (typeof state.slideIndex === 'number') {
    currentSlideIndex = state.slideIndex;
  }
  if (state.settings) {
    settings = { ...settings, ...state.settings };
  }
  renderLiveMonitor();
  renderCurrentSong();
}

function broadcastState() {
  const payload = {
    isLive: liveState.isLive,
    isBlackScreen: liveState.isBlackScreen,
    isClearText: liveState.isClearText,
    currentSong,
    currentSlide: currentSong && currentSong.slides ? currentSong.slides[currentSlideIndex] : null,
    nextSlide: currentSong && currentSong.slides && currentSlideIndex + 1 < currentSong.slides.length ? currentSong.slides[currentSlideIndex + 1] : null,
    slideIndex: currentSlideIndex,
    settings
  };

  // BroadcastChannel (instant local)
  bc.postMessage(payload);

  // WebSocket (remote)
  if (socket) {
    socket.emit('control:selectSlide', {
      songId: currentSong ? currentSong.id : null,
      slideIndex: currentSlideIndex
    });
  }

  // Server API
  fetch('/api/live/select-slide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cantate-Request': '1' },
    body: JSON.stringify({
      songId: currentSong ? currentSong.id : null,
      slideIndex: currentSlideIndex
    })
  }).catch(() => {});

  renderLiveMonitor();
}

function sendAction(action) {
  if (socket) socket.emit('control:action', action);
  fetch('/api/live/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cantate-Request': '1' },
    body: JSON.stringify({ action })
  }).catch(() => {});
}

// ===================================================================
// UI SCALE (ZOOM)
// ===================================================================
function setUiScale(val) {
  uiScale = Math.max(0.85, Math.min(1.5, val));
  document.getElementById('appRoot').style.transform = `scale(${uiScale})`;
  document.getElementById('appRoot').style.width = `${100 / uiScale}%`;
  document.getElementById('appRoot').style.height = `${100 / uiScale}%`;
  zoomLevelText.textContent = `${Math.round(uiScale * 100)}%`;
}

document.getElementById('zoomInBtn').addEventListener('click', () => setUiScale(uiScale + 0.1));
document.getElementById('zoomOutBtn').addEventListener('click', () => setUiScale(uiScale - 0.1));
document.getElementById('zoomResetBtn').addEventListener('click', () => setUiScale(1.0));

// ===================================================================
// KEYBOARD NAVIGATION
// ===================================================================
function setupKeyListeners() {
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    if ([' ', 'ArrowRight', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      nextSlideAction();
    } else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      prevSlideAction();
    } else if (e.key.toLowerCase() === 'b') {
      liveState.isBlackScreen = !liveState.isBlackScreen;
      broadcastState();
    } else if (e.key.toLowerCase() === 'c') {
      liveState.isClearText = !liveState.isClearText;
      broadcastState();
    } else if (e.key === 'F5' || e.key === 'Enter') {
      liveState.isLive = true;
      broadcastState();
    } else if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal-backdrop[style*="display: flex"], .modal-backdrop[style*="display:flex"]');
      if (openModal) {
        openModal.style.display = 'none';
      } else {
        liveState.isLive = false;
        broadcastState();
      }
    }
  });
}

function nextSlideAction() {
  if (!currentSong || !currentSong.slides) return;
  if (currentSlideIndex < currentSong.slides.length - 1) {
    currentSlideIndex++;
    liveState.isLive = true;
    broadcastState();
    renderCurrentSong();
  } else {
    // next song
    const idx = songs.findIndex(s => s.id === currentSong.id);
    if (idx >= 0 && idx < songs.length - 1) {
      selectSong(songs[idx + 1]);
      liveState.isLive = true;
      broadcastState();
    }
  }
}

function prevSlideAction() {
  if (!currentSong || !currentSong.slides) return;
  if (currentSlideIndex > 0) {
    currentSlideIndex--;
    liveState.isLive = true;
    broadcastState();
    renderCurrentSong();
  }
}

// ===================================================================
// TOOLBAR BUTTONS & WINDOWS
// ===================================================================
document.getElementById('btnLiveStart').addEventListener('click', () => {
  liveState.isLive = true;
  broadcastState();
});

document.getElementById('btnBlackScreen').addEventListener('click', () => {
  liveState.isBlackScreen = !liveState.isBlackScreen;
  broadcastState();
});

document.getElementById('btnClearText').addEventListener('click', () => {
  liveState.isClearText = !liveState.isClearText;
  broadcastState();
});

document.getElementById('btnStopPresentation').addEventListener('click', () => {
  liveState.isLive = false;
  broadcastState();
});

document.getElementById('btnOpenProjector').addEventListener('click', () => {
  window.open('/projector.html', 'CantateProjector', 'width=1024,height=768,menubar=no,toolbar=no');
  screenBadge.style.display = 'inline-flex';
});

document.getElementById('btnOpenStage').addEventListener('click', () => {
  window.open('/stage.html', 'CantateStage', 'width=480,height=800,menubar=no,toolbar=no');
});

document.getElementById('btnLogout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-Cantate-Request': '1' } });
  window.location.href = '/login.html';
});

// Chords Transpose
document.getElementById('btnTransposeUp').addEventListener('click', async () => {
  chordsShift++;
  await updateChords();
});

document.getElementById('btnTransposeDown').addEventListener('click', async () => {
  chordsShift--;
  await updateChords();
});

document.getElementById('btnTransposeReset').addEventListener('click', () => {
  chordsShift = 0;
  chordsPreviewWrap.textContent = originalChords;
  transposeShiftLabel.textContent = '(0)';
});

async function updateChords() {
  transposeShiftLabel.textContent = `(${chordsShift > 0 ? '+' : ''}${chordsShift})`;
  const res = await fetch('/api/chords/transpose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cantate-Request': '1' },
    body: JSON.stringify({ chords: originalChords, semitones: chordsShift })
  });
  const data = await res.json();
  if (data.success) {
    chordsPreviewWrap.textContent = data.chords;
  }
}

document.getElementById('btnToggleChords').addEventListener('click', () => {
  const isShown = chordsPreviewWrap.style.display === 'block';
  chordsPreviewWrap.style.display = isShown ? 'none' : 'block';
  document.getElementById('btnToggleChords').textContent = isShown ? 'Rozwiń chwyty' : 'Zwiń chwyty';
});

// Search input
songSearch.addEventListener('input', renderSongsList);

// ===================================================================
// MODAL CONTROLS
// ===================================================================
function openModal(id) {
  document.getElementById(id).style.display = 'flex';
}
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close')));
});

// Song Editor Modal
document.getElementById('btnNewSong').addEventListener('click', () => {
  document.getElementById('editorModalTitle').textContent = 'Nowa Pieśń';
  document.getElementById('editTitle').value = '';
  document.getElementById('editAuthor').value = '';
  document.getElementById('editKey').value = '';
  document.getElementById('editLyrics').value = '[Zwrotka 1]\n\n\n[Refren]\n\n';
  document.getElementById('editorForm').dataset.editId = '';
  openModal('editorModal');
});

document.getElementById('btnEditSong').addEventListener('click', () => {
  if (!currentSong) return;
  document.getElementById('editorModalTitle').textContent = `Edycja: ${currentSong.title}`;
  document.getElementById('editTitle').value = currentSong.title;
  document.getElementById('editAuthor').value = currentSong.author || '';
  document.getElementById('editKey').value = currentSong.key || '';
  document.getElementById('editLyrics').value = currentSong.rawLyrics || '';
  document.getElementById('editorForm').dataset.editId = currentSong.id;
  openModal('editorModal');
});

// Tag insert buttons
document.querySelectorAll('.insert-tag').forEach(btn => {
  btn.addEventListener('click', () => {
    const tag = btn.dataset.tag;
    const txt = document.getElementById('editLyrics');
    const start = txt.selectionStart;
    txt.value = txt.value.slice(0, start) + `\n\n${tag}\n` + txt.value.slice(start);
    txt.focus();
  });
});

document.getElementById('editorForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = e.target.dataset.editId;
  const title = document.getElementById('editTitle').value.trim();
  const author = document.getElementById('editAuthor').value.trim();
  const key = document.getElementById('editKey').value.trim();
  const rawLyrics = document.getElementById('editLyrics').value.trim();

  // Parse slides
  const parsedRes = await fetch('/api/songs/parse-raw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cantate-Request': '1' },
    body: JSON.stringify({ rawText: `Tytuł: ${title}\nAutor: ${author}\nTonacja: ${key}\n\n${rawLyrics}` })
  });
  const parsedData = await parsedRes.json();
  const songPayload = parsedData.song;

  if (id) {
    // Update
    await fetch(`/api/songs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Cantate-Request': '1' },
      body: JSON.stringify(songPayload)
    });
  } else {
    // Create
    await fetch('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Cantate-Request': '1' },
      body: JSON.stringify(songPayload)
    });
  }

  await loadSongs();
  closeModal('editorModal');
  renderSongsList();
});

// Settings Modal & Logo Gallery
document.getElementById('btnSettings').addEventListener('click', () => {
  document.getElementById('settingFont').value = settings.fontFamily || 'Segoe UI, sans-serif';
  document.getElementById('settingTextColor').value = settings.textColorHex || '#ffffff';
  document.getElementById('settingBgColor').value = settings.backgroundColorHex || '#000000';
  document.getElementById('settingBold').checked = settings.isBold !== false;
  openModal('settingsModal');
});

function renderLogoGallery() {
  const grid = document.getElementById('logoGalleryGrid');
  grid.innerHTML = '';
  LOGO_CATALOG.forEach(logo => {
    const card = document.createElement('div');
    const isSelected = (settings.activeLogoId === logo.id);
    card.style.background = isSelected ? '#1e3a8a' : '#1e293b';
    card.style.border = isSelected ? '2px solid #38bdf8' : '1px solid #334155';
    card.style.borderRadius = '8px';
    card.style.padding = '8px';
    card.style.cursor = 'pointer';
    card.innerHTML = `
      <div style="width:48px; height:48px; margin:0 auto 6px auto;">${logo.svg}</div>
      <div style="font-size:11px; font-weight:bold; color:#38bdf8; text-align:center;">${logo.name}</div>
      <div style="font-size:9px; color:#94a3b8; text-align:center;">${logo.category}</div>
    `;
    card.addEventListener('click', () => {
      settings.activeLogoId = logo.id;
      renderLogoGallery();
      broadcastState();
    });
    grid.appendChild(card);
  });
}

document.getElementById('btnSaveSettings').addEventListener('click', async () => {
  settings.fontFamily = document.getElementById('settingFont').value;
  settings.textColorHex = document.getElementById('settingTextColor').value;
  settings.backgroundColorHex = document.getElementById('settingBgColor').value;
  settings.isBold = document.getElementById('settingBold').checked;

  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cantate-Request': '1' },
    body: JSON.stringify(settings)
  });

  closeModal('settingsModal');
  broadcastState();
});

// Backup Modal
document.getElementById('btnBackup').addEventListener('click', () => openModal('backupModal'));

document.getElementById('btnUploadBackup').addEventListener('click', async () => {
  const fileInput = document.getElementById('backupFileInput');
  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Wybierz plik kopii zapasowej.');
    return;
  }

  const formData = new FormData();
  formData.append('backupFile', fileInput.files[0]);

  try {
    const res = await fetch('/api/backup/upload', {
      method: 'POST',
      headers: { 'X-Cantate-Request': '1' },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      alert('Kopia zapasowa przywrócona pomyślnie!');
      closeModal('backupModal');
      await Promise.all([loadSongs(), loadSettings(), loadPlans()]);
      renderSongsList();
      broadcastState();
    } else {
      alert(data.error || 'Błąd przywracania');
    }
  } catch (err) {
    alert('Błąd podczas przesyłania pliku.');
  }
});

// Import Modal
document.getElementById('btnImport').addEventListener('click', () => openModal('importModal'));

document.getElementById('btnConfirmImport').addEventListener('click', async () => {
  const btn = document.getElementById('btnConfirmImport');
  const fileInput = document.getElementById('importFileInput');
  const rawText = document.getElementById('importRawText').value;

  let textToParse = rawText;
  if (fileInput.files && fileInput.files.length > 0) {
    textToParse = await fileInput.files[0].text();
  }

  if (!textToParse.trim()) {
    alert('Wprowadź tekst lub wskaż plik.');
    return;
  }

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Przetwarzanie...';

  try {
    const res = await fetch('/api/songs/parse-raw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Cantate-Request': '1' },
      body: JSON.stringify({ rawText: textToParse })
    });
    const data = await res.json();
    if (data.success && data.song) {
      await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Cantate-Request': '1' },
        body: JSON.stringify(data.song)
      });
      await loadSongs();
      closeModal('importModal');
      renderSongsList();
      alert(`Zaimportowano: ${data.song.title}`);
    }
  } catch (err) {
    alert('Wystąpił błąd podczas importu.');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

// Export JSON
document.getElementById('btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(songs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CantatePresenter_Baza_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Help Modal
document.getElementById('btnHelp').addEventListener('click', () => openModal('manualModal'));

function initManual() {
  const chapters = [
    { title: '1. Wprowadzenie', text: 'CantatePresenter to profesjonalny serwis do prezentacji pieśni i slajdów liturgicznych w przeglądarce internetowej.' },
    { title: '2. Ekrany i Rzutnik', text: 'Kliknij przycisk "🖥️ Otwórz rzutnik", aby otworzyć czysty ekran projekcji. Przeciągnij go na drugi monitor lub rzutnik i naciśnij F11 dla pełnego ekranu.' },
    { title: '3. Pulpit Muzyka', text: 'Uruchom "📱 Pulpit muzyka" na telefonie lub tablecie, aby zespół widział aktualny tekst wraz z chwytami gitarowymi.' },
    { title: '4. Chwyty Gitarowe', text: 'Program umożliwia transpozycję akordów w górę i w dół o dowolną liczbę półtonów z natychmiastowym podglądem.' },
    { title: '5. Kopia Zapasowa', text: 'Plik .cantatebackup można jednym kliknięciem pobrać na dysk komputera lub wczytać w dowolnym momencie bez potrzeby łączenia z chmurą zewnętrzną.' },
    { title: '6. Skróty Klawiszowe', text: 'Spacja / Strzałka w prawo: Następny slajd\nStrzałka w lewo: Poprzedni slajd\nB: Czarny ekran\nC: Ukryj tekst\nESC: Wyjście' }
  ];

  const list = document.getElementById('manualChapterList');
  const content = document.getElementById('manualChapterContent');

  list.innerHTML = '';
  chapters.forEach((ch, idx) => {
    const li = document.createElement('li');
    li.style.padding = '8px 12px';
    li.style.cursor = 'pointer';
    li.style.fontSize = '12px';
    li.style.fontWeight = '600';
    li.style.color = '#38bdf8';
    li.textContent = ch.title;
    li.addEventListener('click', () => {
      content.textContent = ch.text;
    });
    list.appendChild(li);
  });

  if (chapters.length > 0) content.textContent = chapters[0].text;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Start
initApp();
