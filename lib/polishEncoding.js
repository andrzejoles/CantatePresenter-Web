const POLISH_DIACRITICS = new Set('ąćęłńóśźżĄĆĘŁŃÓŚŹŻ');

const MOJIBAKE_MAP = [
  ['Ã³', 'ó'], ['Ã“', 'Ó'],
  ['Å‚', 'ł'], ['Å\u0081', 'Ł'], ['Å\u009A', 'Ś'],
  ['Å›', 'ś'], ['Åš', 'Ś'],
  ['Å¼', 'ż'], ['Å»', 'Ż'],
  ['Åº', 'ź'], ['Å¹', 'Ź'],
  ['Ä™', 'ę'], ['Ä\u0098', 'Ę'], ['Ä˜', 'Ę'],
  ['Ä…', 'ą'], ['Ä„', 'Ą'],
  ['Ä‡', 'ć'], ['Ä†', 'Ć'],
  ['Å„', 'ń'], ['Åƒ', 'Ń'],
  ['\u00B9', 'ą'], ['\u00A5', 'Ą'],
  ['\u00E6', 'ć'], ['\u00C6', 'Ć'],
  ['\u00EA', 'ę'], ['\u00CA', 'Ę'],
  ['\u00B3', 'ł'], ['\u00A3', 'Ł'],
  ['\u00F1', 'ń'], ['\u00D1', 'Ń'],
  ['\u00F3', 'ó'], ['\u00D3', 'Ó'],
  ['\u009C', 'ś'], ['\u008C', 'Ś'],
  ['\u009F', 'ź'], ['\u008F', 'Ź'],
  ['\u00BF', 'ż'], ['\u00AF', 'Ż'],
  ['\u0096', '–'], ['\u0097', '—'],
  ['\u0091', '‘'], ['\u0092', '’'],
  ['\u0093', '“'], ['\u0094', '”'],
  ['â€ž', '„'], ['â€\u009D', '”'], ['â€“', '–'], ['â€”', '—']
];

const KNOWN_WORDS = {
  badz: 'Bądź', bog: 'Bóg', boga: 'Boga', bogu: 'Bogu', bogiem: 'Bogiem',
  boze: 'Boże', blogoslaw: 'Błogosław', blogoslawcie: 'Błogosławcie',
  blogoslawiony: 'Błogosławiony', blogoslawieni: 'Błogosławieni',
  milosierni: 'miłosierni', milosierdzia: 'miłosierdzia', milosierdzie: 'miłosierdzie',
  milosc: 'miłość', milosci: 'miłości', krolowa: 'Królowa', krolowo: 'Królowo',
  krol: 'Król', krola: 'Króla', swiety: 'Święty', swieta: 'Święta',
  swiete: 'Święte', swieci: 'Święci', spiewaj: 'Śpiewaj', spiewajcie: 'Śpiewajcie',
  spiew: 'Śpiew', piesn: 'Pieśń', piesni: 'Pieśni', tys: 'Tyś', jestes: 'Jesteś',
  moj: 'mój', twoj: 'Twój', twoja: 'Twoja', twoje: 'Twoje', wsrod: 'wśród',
  coz: 'Cóż', zycie: 'życie', zyje: 'żyje', zrodlo: 'źródło', wez: 'weź',
  pojdz: 'pójdź', przyjdz: 'przyjdź', wstan: 'wstań', krzyz: 'krzyż', pokoj: 'pokój',
  zwyciezca: 'zwycięzca', smierc: 'śmierć', zmiluj: 'zmiłuj', ufnosc: 'ufność',
  otworz: 'otwórz', slonce: 'słońce', aniol: 'Anioł'
};

export const foldString = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/ł/g, 'l')
    .replace(/ą/g, 'a')
    .replace(/ć/g, 'c')
    .replace(/ę/g, 'e')
    .replace(/ń/g, 'n')
    .replace(/ó/g, 'o')
    .replace(/ś/g, 's')
    .replace(/ź/g, 'z')
    .replace(/ż/g, 'z')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

export const repairMojibake = (text) => {
  if (!text) return '';
  let repaired = text;
  for (const [mojibake, correct] of MOJIBAKE_MAP) {
    if (repaired.includes(mojibake)) {
      repaired = repaired.split(mojibake).join(correct);
    }
  }
  return repaired;
};

export const hasPolishDiacritics = (text) => {
  if (!text) return false;
  for (const char of text) {
    if (POLISH_DIACRITICS.has(char)) return true;
  }
  return false;
};

export const restoreTitleDiacritics = (title, lyrics) => {
  const fixedTitle = repairMojibake((title || '').trim());
  if (hasPolishDiacritics(fixedTitle)) {
    return { title: fixedTitle, wasRestored: fixedTitle !== title };
  }

  const lyricsRepaired = repairMojibake(lyrics || '');
  const words = lyricsRepaired.split(/[\s,\.\?!;:"\(\)\[\]]+/);
  const map = new Map();

  for (const w of words) {
    if (hasPolishDiacritics(w) && w.length >= 2) {
      const f = foldString(w);
      if (!map.has(f)) map.set(f, w);
    }
  }

  const titleWords = fixedTitle.split(' ');
  let changed = false;

  for (let i = 0; i < titleWords.length; i++) {
    const raw = titleWords[i];
    const letters = raw.replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '');
    const punct = raw.replace(/[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '');
    if (!letters) continue;

    const folded = foldString(letters);
    let repl = null;

    if (map.has(folded)) {
      repl = map.get(folded);
    } else if (KNOWN_WORDS[folded]) {
      repl = KNOWN_WORDS[folded];
    }

    if (repl) {
      let styled = repl;
      if (letters === letters.toUpperCase()) {
        styled = repl.toUpperCase();
      } else if (letters[0] === letters[0].toUpperCase()) {
        styled = repl.charAt(0).toUpperCase() + repl.slice(1).toLowerCase();
      } else {
        styled = repl.toLowerCase();
      }

      const finalWord = styled + punct;
      if (finalWord !== raw) {
        titleWords[i] = finalWord;
        changed = true;
      }
    }
  }

  return { title: titleWords.join(' '), wasRestored: changed };
};
