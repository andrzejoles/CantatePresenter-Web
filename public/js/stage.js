const stageSongTitle = document.getElementById('stageSongTitle');
const stageSongMeta = document.getElementById('stageSongMeta');
const stageKeyBadge = document.getElementById('stageKeyBadge');
const stageChordsBox = document.getElementById('stageChordsBox');
const currentLabel = document.getElementById('currentLabel');
const currentLyrics = document.getElementById('currentLyrics');
const nextLyrics = document.getElementById('nextLyrics');

// BroadcastChannel + Socket.io
const bc = new BroadcastChannel('cantate_live');
bc.onmessage = (e) => {
  if (e.data) renderStage(e.data);
};

let socket = null;
try {
  socket = io();
  socket.on('presentation:state', renderStage);
} catch (e) {}

function renderStage(state) {
  if (!state) return;
  const { isLive, currentSong, currentSlide, nextSlide } = state;

  if (currentSong) {
    stageSongTitle.textContent = currentSong.title;
    stageSongMeta.textContent = currentSong.author ? `Autor: ${currentSong.author}` : '';
    stageKeyBadge.textContent = currentSong.key ? `Tonacja: ${currentSong.key}` : '';

    if (currentSong.chords) {
      stageChordsBox.textContent = currentSong.chords;
      stageChordsBox.style.display = 'block';
    } else {
      stageChordsBox.style.display = 'none';
    }
  } else {
    stageSongTitle.textContent = 'CantatePresenter';
    stageSongMeta.textContent = 'Wersja 1.0.0';
    stageKeyBadge.textContent = '';
    stageChordsBox.style.display = 'none';
  }

  if (isLive && currentSlide) {
    currentLabel.textContent = currentSlide.label || 'SLAJD';
    currentLyrics.textContent = currentSlide.text || '';
  } else {
    currentLabel.textContent = 'STANDBY';
    currentLyrics.textContent = '— Plansza Czuwania —';
  }

  if (nextSlide) {
    nextLyrics.textContent = `${nextSlide.label}:\n${nextSlide.text}`;
  } else {
    nextLyrics.textContent = '— Koniec pieśni —';
  }
}

// Initial fetch
fetch('/api/live/state')
  .then(res => res.json())
  .then(d => { if (d.success) renderStage(d.state); })
  .catch(() => {});

// Touch control buttons
document.getElementById('nextBtn').addEventListener('click', () => {
  if (socket) socket.emit('control:action', 'nextSlide');
  fetch('/api/live/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cantate-Request': '1' },
    body: JSON.stringify({ action: 'nextSlide' })
  }).catch(() => {});
});

document.getElementById('prevBtn').addEventListener('click', () => {
  if (socket) socket.emit('control:action', 'prevSlide');
  fetch('/api/live/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cantate-Request': '1' },
    body: JSON.stringify({ action: 'prevSlide' })
  }).catch(() => {});
});
