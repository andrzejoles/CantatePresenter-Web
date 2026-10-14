const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];

export const transposeRoot = (root, semitones) => {
  const shift = ((semitones % 12) + 12) % 12;
  const isLower = root === root.toLowerCase();
  const upper = root.toUpperCase();
  const idx = CHROMATIC_SCALE.indexOf(upper);
  if (idx < 0) return root;
  const newIdx = (idx + shift) % 12;
  const res = CHROMATIC_SCALE[newIdx];
  return isLower ? res.toLowerCase() : res;
};

export const transposeChords = (chordsSheet, semitones) => {
  if (!chordsSheet || semitones === 0) return chordsSheet;

  const chordRegex = /\b([A-Ha-h][#b]?)(m|maj|min|dim|sus|add)?([0-9]?)(?:\/([A-Ha-h][#b]?))?\b/g;

  return chordsSheet.replace(chordRegex, (match, root, mod = '', num = '', bass = '') => {
    let transposed = transposeRoot(root, semitones) + mod + num;
    if (bass) {
      transposed += '/' + transposeRoot(bass, semitones);
    }
    return transposed;
  });
};

export const extractChordsAndCleanLyrics = (raw) => {
  const lines = (raw || '').split(/\r?\n/);
  const cleanLines = [];
  const chordLines = [];
  let foundAny = false;

  const chordLineRegex = /^\s*([A-Ha-h][#b]?(?:m|maj|min|dim|sus|add)?[0-9]?(?:\/[A-Ha-h][#b]?)?(\s+|$))+$/;
  const inlineBracketsRegex = /\[([A-Ha-h0-9#b\/]{1,6})\]/g;

  for (const line of lines) {
    if (chordLineRegex.test(line) && !line.trim().startsWith('[Zwrotka') && !line.trim().startsWith('[Refren')) {
      chordLines.push(line);
      foundAny = true;
      continue;
    }

    let clean = line;
    if (inlineBracketsRegex.test(clean) && !clean.trim().startsWith('[Zwrotka') && !clean.trim().startsWith('[Refren') && !clean.trim().startsWith('[Coda')) {
      foundAny = true;
      chordLines.push(clean);
      clean = clean.replace(inlineBracketsRegex, '');
    } else {
      chordLines.push(line);
    }

    cleanLines.push(clean.trimEnd());
  }

  return {
    cleanLyrics: cleanLines.join('\n').trim(),
    extractedChords: foundAny ? chordLines.join('\n').trim() : null
  };
};
