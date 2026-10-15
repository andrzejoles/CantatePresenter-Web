// CantatePresenter AutoFit & Slide Canvas Engine

let measurerDiv = null;

function getMeasurer() {
  if (typeof document === 'undefined') return null;
  if (!measurerDiv) {
    measurerDiv = document.createElement('div');
    measurerDiv.id = 'cantate-font-measurer';
    measurerDiv.style.position = 'fixed';
    measurerDiv.style.visibility = 'hidden';
    measurerDiv.style.pointerEvents = 'none';
    measurerDiv.style.left = '-9999px';
    measurerDiv.style.top = '-9999px';
    measurerDiv.style.whiteSpace = 'pre-line';
    measurerDiv.style.wordBreak = 'break-word';
    measurerDiv.style.boxSizing = 'border-box';
    measurerDiv.style.padding = '0';
    measurerDiv.style.margin = '0';
    measurerDiv.style.border = 'none';
    if (document.body) {
      document.body.appendChild(measurerDiv);
    } else if (document.documentElement) {
      document.documentElement.appendChild(measurerDiv);
    }
  }
  return measurerDiv;
}

export function parseAspectRatio(ratioStr) {
  if (!ratioStr) return { ratio: 16 / 9, css: '16 / 9', label: '16:9' };
  const parts = String(ratioStr).split(':').map(n => parseFloat(n.trim()));
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
    return {
      ratio: parts[0] / parts[1],
      css: `${parts[0]} / ${parts[1]}`,
      label: `${parts[0]}:${parts[1]}`
    };
  }
  return { ratio: 16 / 9, css: '16 / 9', label: '16:9' };
}

export function calculateOptimalFontSize(text, containerWidth, containerHeight, options = {}) {
  if (!text || !text.trim()) return 24;
  if (containerWidth <= 20 || containerHeight <= 20) return 12;

  const {
    fontFamily = '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    isBold = true,
    lineSpacingFactor = 1.15,
    marginPercent = 0.07,
    minFontSize = 7,
    maxFontSize = 260
  } = options;

  const usableWidth = Math.max(30, containerWidth * (1 - 2 * marginPercent));
  const usableHeight = Math.max(30, containerHeight * (1 - 2 * marginPercent));

  const measurer = getMeasurer();

  // 1. Try DOM measurement when available in active browser context
  if (measurer) {
    measurer.style.width = `${usableWidth}px`;
    measurer.style.fontFamily = fontFamily;
    measurer.style.fontWeight = isBold ? 'bold' : 'normal';
    measurer.style.lineHeight = String(lineSpacingFactor);
    measurer.textContent = text;

    let low = minFontSize;
    let high = Math.min(maxFontSize, usableHeight * 0.95);
    let bestFit = minFontSize;
    let measured = false;

    for (let i = 0; i < 12; i++) {
      const mid = (low + high) / 2;
      if (mid < minFontSize) break;

      measurer.style.fontSize = `${mid}px`;
      const h = measurer.offsetHeight;
      const w = measurer.scrollWidth;

      if (h > 0 || w > 0) {
        measured = true;
        const fitsHeight = h <= usableHeight;
        const fitsWidth = w <= usableWidth + 2;

        if (fitsHeight && fitsWidth) {
          bestFit = mid;
          low = mid + 0.5;
        } else {
          high = mid - 0.5;
        }
      } else {
        break; // layout not available, use analytical fallback below
      }
    }

    if (measured && bestFit > minFontSize) {
      return Math.max(minFontSize, Math.floor(bestFit));
    }
  }

  // 2. Analytical estimation fallback
  const lines = text.split('\n');
  const words = text.split(/\s+/).filter(Boolean);
  const maxWordChars = Math.max(...words.map(w => w.length), 1);
  const charWidthRatio = isBold ? 0.58 : 0.52;

  let low = minFontSize;
  let high = Math.min(maxFontSize, usableHeight * 0.95);
  let bestFit = minFontSize;

  for (let i = 0; i < 14; i++) {
    const mid = (low + high) / 2;
    const estCharWidth = mid * charWidthRatio;
    const estLineHeight = mid * lineSpacingFactor;

    if (maxWordChars * estCharWidth > usableWidth) {
      high = mid;
      continue;
    }

    let totalLines = 0;
    for (const line of lines) {
      const lineLen = line.length || 1;
      const wrapped = Math.max(1, Math.ceil((lineLen * estCharWidth) / usableWidth));
      totalLines += wrapped;
    }

    const totalHeight = totalLines * estLineHeight;
    if (totalHeight <= usableHeight) {
      bestFit = mid;
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.max(minFontSize, Math.floor(bestFit));
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderSlideCanvas(container, slide, options = {}) {
  if (!container) return;
  if (!slide || !slide.text) {
    container.innerHTML = `<div class="monitor-empty-msg">${escapeHtml(options.emptyText || '— Brak slajdu —')}</div>`;
    return;
  }

  const rect = container.getBoundingClientRect();
  const width = rect.width > 20 ? rect.width : (container.clientWidth || 320);
  const height = rect.height > 20 ? rect.height : (container.clientHeight || 180);

  const {
    fontFamily = '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    textColorHex = '#ffffff',
    backgroundColorHex = '#000000',
    verticalAlignment = 'center',
    textAlignment = 'center',
    marginPercent = 0.07,
    lineSpacingFactor = 1.15,
    isBold = true,
    hasShadow = true,
    isDimmed = false,
    showLabel = false,
    label = ''
  } = options;

  const fontSize = calculateOptimalFontSize(slide.text, width, height, {
    fontFamily,
    isBold,
    lineSpacingFactor,
    marginPercent,
    minFontSize: 7,
    maxFontSize: 160
  });

  const vAlign = verticalAlignment === 'top' ? 'flex-start' : (verticalAlignment === 'bottom' ? 'flex-end' : 'center');
  const tAlign = textAlignment === 'left' ? 'left' : (textAlignment === 'right' ? 'right' : 'center');
  const hPad = Math.max(4, Math.round(width * marginPercent));
  const vPad = Math.max(4, Math.round(height * marginPercent));
  const shadowStyle = hasShadow ? 'text-shadow: 1px 1px 4px rgba(0,0,0,0.85);' : 'text-shadow: none;';
  const formattedText = escapeHtml(slide.text);

  container.style.backgroundColor = backgroundColorHex;
  container.innerHTML = `
    <div class="monitor-canvas" style="justify-content: ${vAlign}; padding: ${vPad}px ${hPad}px;">
      ${isDimmed ? '<div class="next-dim-overlay"></div>' : ''}
      ${showLabel && label ? `<span class="next-label-badge">${escapeHtml(label)}</span>` : ''}
      <div class="monitor-slide-text" style="
        font-family: ${fontFamily};
        font-size: ${fontSize}px;
        font-weight: ${isBold ? 'bold' : 'normal'};
        color: ${textColorHex};
        line-height: ${lineSpacingFactor};
        text-align: ${tAlign};
        ${shadowStyle}
        opacity: ${isDimmed ? 0.72 : 1};
      ">${formattedText}</div>
    </div>
  `;
}
