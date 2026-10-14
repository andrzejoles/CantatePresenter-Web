import { getLogoById } from './logoCatalog.js';

const container = document.getElementById('contentContainer');
const badge = document.getElementById('slideBadge');

// Local BroadcastChannel for 0ms same-machine sync (without server roundtrip)
const bc = new BroadcastChannel('cantate_live');
bc.onmessage = (e) => {
  if (e.data) renderState(e.data);
};

// WebSocket for remote sync across network
let socket = null;
try {
  socket = io();
  socket.on('presentation:state', (state) => {
    renderState(state);
  });
} catch (e) {
  console.warn('Socket.io offline, using BroadcastChannel only.');
}

function renderState(state) {
  if (!state) return;

  const { isLive, isBlackScreen, isClearText, currentSlide, settings } = state;
  const cfg = settings || {};

  // Apply colors
  document.body.style.backgroundColor = isBlackScreen ? '#000000' : (cfg.backgroundColorHex || '#000000');

  // 1. Black Screen
  if (isBlackScreen) {
    container.innerHTML = '';
    badge.style.display = 'none';
    return;
  }

  // 2. Clear Text
  if (isClearText) {
    container.innerHTML = '';
    badge.style.display = 'none';
    return;
  }

  // 3. Standby Mode (Not Live or no current slide)
  if (!isLive || !currentSlide) {
    const logo = getLogoById(cfg.activeLogoId || 'equipes_notre_dame');
    badge.style.display = 'none';
    container.innerHTML = `
      <div class="standby-wrap">
        <div class="standby-logo">${logo.svg}</div>
        <h1 class="standby-title">CantatePresenter</h1>
        <div class="standby-version">Wersja 1.0.0</div>
      </div>
    `;
    return;
  }

  // 4. Live Slide Presentation
  const vAlign = cfg.verticalAlignment === 'top' ? 'flex-start' : (cfg.verticalAlignment === 'bottom' ? 'flex-end' : 'center');
  const tAlign = cfg.textAlignment || 'center';
  const shadow = cfg.hasShadow ? 'text-shadow: 2px 2px 8px rgba(0,0,0,0.85);' : 'text-shadow: none;';
  const weight = cfg.isBold ? 'bold' : 'normal';
  const marginPct = (cfg.marginPercent || 0.07) * 100;
  const font = cfg.fontFamily || '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';

  container.style.justifyContent = vAlign;
  container.style.padding = `${marginPct}vh ${marginPct}vw`;

  const formattedText = (currentSlide.text || '').replace(/\n/g, '<br/>');

  container.innerHTML = `
    <div class="slide-text" style="
      font-family: ${font};
      color: ${cfg.textColorHex || '#FFFFFF'};
      font-weight: ${weight};
      line-height: ${cfg.lineSpacingFactor || 1.15};
      text-align: ${tAlign};
      ${shadow}
    ">${formattedText}</div>
  `;

  badge.textContent = currentSlide.label || '';
  badge.style.display = 'block';
}

// Initial fetch in case already running
fetch('/api/live/state')
  .then(res => res.json())
  .then(data => {
    if (data.success && data.state) {
      renderState(data.state);
    }
  })
  .catch(() => {});

// Mouse move reveals cursor briefly
let cursorTimer = null;
window.addEventListener('mousemove', () => {
  document.body.classList.add('show-cursor');
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(() => {
    document.body.classList.remove('show-cursor');
  }, 2000);
});

// Toggle fullscreen on double click or hint click
const fsHint = document.getElementById('fsHint');
if (fsHint) {
  fsHint.addEventListener('click', toggleFullscreen);
}
window.addEventListener('dblclick', toggleFullscreen);

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

// Keyboard navigation
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      window.close();
    }
    return;
  }

  if (e.key === 'F11') {
    return; // let browser handle fullscreen
  }

  let action = null;
  if ([' ', 'ArrowRight', 'ArrowDown'].includes(e.key)) action = 'nextSlide';
  else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) action = 'prevSlide';
  else if (e.key.toLowerCase() === 'b') action = 'toggleBlack';
  else if (e.key.toLowerCase() === 'c') action = 'toggleClear';

  if (action) {
    if (socket) socket.emit('control:action', action);
    fetch('/api/live/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Cantate-Request': '1' },
      body: JSON.stringify({ action })
    }).catch(() => {});
  }
});
