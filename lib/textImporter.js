import { repairMojibake, restoreTitleDiacritics } from './polishEncoding.js';
import crypto from 'crypto';

export const parseLyricsToSlides = (raw) => {
  if (!raw || !raw.trim()) {
    return [{ id: crypto.randomUUID(), type: 'Zwrotka', label: 'Zwrotka 1', text: '' }];
  }

  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\n+/).map(b => b.trim()).filter(Boolean);

  if (blocks.length === 0) {
    return [{ id: crypto.randomUUID(), type: 'Zwrotka', label: 'Zwrotka 1', text: raw.trim() }];
  }

  const slides = [];
  let verseCounter = 1;
  let chorusCounter = 1;
  let bridgeCounter = 1;
  let codaCounter = 1;
  let interludeCounter = 1;
  let endingCounter = 1;

  const headerRegex = /^\[([^\]]+)\]$|^([0-9]+)\.?$|^(ref(ren)?|chorus|bridge|most(ek)?|coda|koda|interlude|przej[sś]cie|solo|intro|wst[eę]p|outro|zako[nń]czenie|ending|tag|zwrotka|z)(\s*[0-9]*)?:?$/i;

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const firstLine = lines[0];
    const lower = firstLine.toLowerCase();
    let type = 'Zwrotka';
    let label = '';

    if (headerRegex.test(firstLine) || lower.startsWith('[') || lower.startsWith('ref:') || lower.startsWith('refren:') || lower.startsWith('chorus:') || lower.startsWith('coda:') || lower.startsWith('koda:')) {
      const headerContent = firstLine.replace(/[\[\]:]/g, '').trim();
      const hLower = headerContent.toLowerCase();

      if (hLower.includes('coda') || hLower.includes('koda')) {
        type = 'Coda';
        label = codaCounter > 1 ? `Coda ${codaCounter}` : 'Coda';
        codaCounter++;
      } else if (hLower.includes('interlude') || hLower.includes('przejscie') || hLower.includes('przejście') || hLower.includes('solo')) {
        type = 'Przejście';
        label = interludeCounter > 1 ? `Przejście ${interludeCounter}` : 'Przejście';
        interludeCounter++;
      } else if (hLower.includes('zakonczenie') || hLower.includes('zakończenie') || hLower.includes('ending')) {
        type = 'Zakończenie';
        label = endingCounter > 1 ? `Zakończenie ${endingCounter}` : 'Zakończenie';
        endingCounter++;
      } else if (hLower.includes('outro')) {
        type = 'Outro';
        label = 'Outro';
      } else if (hLower.includes('intro') || hLower.includes('wstep') || hLower.includes('wstęp')) {
        type = 'Intro';
        label = 'Intro';
      } else if (hLower.includes('ref') || hLower.includes('chorus') || hLower === 'r') {
        type = 'Refren';
        label = chorusCounter > 1 ? `Refren ${chorusCounter}` : 'Refren';
        chorusCounter++;
      } else if (hLower.includes('bridge') || hLower.includes('most') || hLower === 'b') {
        type = 'Bridge';
        label = bridgeCounter > 1 ? `Bridge ${bridgeCounter}` : 'Bridge';
        bridgeCounter++;
      } else {
        type = 'Zwrotka';
        label = headerContent || `Zwrotka ${verseCounter++}`;
      }
      lines.shift();
    } else {
      type = 'Zwrotka';
      label = `Zwrotka ${verseCounter++}`;
    }

    const text = lines.join('\n').trim();
    if (text) {
      slides.push({
        id: crypto.randomUUID(),
        type,
        label,
        text
      });
    }
  }

  return slides.length > 0 ? slides : [{ id: crypto.randomUUID(), type: 'Zwrotka', label: 'Zwrotka 1', text: raw.trim() }];
};

export const translateHolyricsMarkers = (text) => {
  let result = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  result = result.replace(/##\(Verse\s*(\d+)\)/gi, '[Zwrotka $1]');
  result = result.replace(/##\(Verse\)/gi, '[Zwrotka]');
  result = result.replace(/##\(Chorus\s*(\d*)\)/gi, '[Refren]');
  result = result.replace(/##\(Bridge\s*(\d*)\)/gi, '[Bridge]');
  result = result.replace(/##\(Coda\s*(\d*)\)/gi, '[Coda]');
  result = result.replace(/##\(Intro\s*(\d*)\)/gi, '[Wstęp]');
  result = result.replace(/##\((Outro|Ending)\s*(\d*)\)/gi, '[Zakończenie]');
  result = result.replace(/##\((Tag|Interlude)\s*(\d*)\)/gi, '[Przejście]');
  result = result.replace(/##\(([^)]+)\)/gi, '[$1]');
  return result;
};

export const parseRawSongString = (rawContent, fallbackTitle = 'Nowa pieśń') => {
  let content = repairMojibake(rawContent);
  if (content.includes('##(')) {
    content = translateHolyricsMarkers(content);
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n').map(l => l.trim());
  let title = fallbackTitle;
  let author = '';
  let key = '';
  let tags = [];
  let lyricsStartIndex = 0;

  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i];
    const low = line.toLowerCase();
    if (low.startsWith('tytuł:') || low.startsWith('tytul:') || low.startsWith('title:')) {
      title = line.substring(line.indexOf(':') + 1).trim();
      lyricsStartIndex = Math.max(lyricsStartIndex, i + 1);
    } else if (low.startsWith('autor:') || low.startsWith('author:')) {
      author = line.substring(line.indexOf(':') + 1).trim();
      lyricsStartIndex = Math.max(lyricsStartIndex, i + 1);
    } else if (low.startsWith('tonacja:') || low.startsWith('klucz:') || low.startsWith('key:')) {
      key = line.substring(line.indexOf(':') + 1).trim();
      lyricsStartIndex = Math.max(lyricsStartIndex, i + 1);
    } else if (low.startsWith('tagi:') || low.startsWith('kategoria:') || low.startsWith('tags:')) {
      tags = line.substring(line.indexOf(':') + 1).split(/[,;]/).map(t => t.trim()).filter(Boolean);
      lyricsStartIndex = Math.max(lyricsStartIndex, i + 1);
    } else if (i === 0 && !line.startsWith('[') && !low.startsWith('1.') && !low.startsWith('ref')) {
      title = line;
      lyricsStartIndex = 1;
    }
  }

  const lyrics = lines.slice(lyricsStartIndex).join('\n').trim();

  // Author filter check (e.g. "Łysa Góra" -> "Nieznany")
  if (author.toLowerCase().includes('łysa góra') || author.toLowerCase().includes('lysa gora')) {
    author = 'Nieznany';
  }

  const { title: fixedTitle } = restoreTitleDiacritics(title, lyrics);

  return {
    id: crypto.randomUUID(),
    title: fixedTitle || fallbackTitle,
    author: author || 'Nieznany',
    key: key || '',
    tags: tags || [],
    rawLyrics: lyrics,
    slides: parseLyricsToSlides(lyrics),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};
