# CantatePresenter — Instrukcja Obsługi Programu

Kompletny podręcznik użytkownika natywnej aplikacji **CantatePresenter** dla systemu **macOS** (Apple Silicon M1–M5).

---

## 📑 Spis Treści
1. [Wprowadzenie i Pierwsze Kroki](#1-wprowadzenie-i-pierwsze-kroki)
2. [Prezentacja na Żywo i Obsługa Ekranów](#2-prezentacja-na-żywo-i-obsługa-ekranów)
3. [Plansza Czuwania (Standby) i Wybór Logo](#3-plansza-czuwania-standby-i-wybór-logo)
4. [Baza Pieśni i Zaawansowany Edytor](#4-baza-pieśni-i-zaawansowany-edytor)
5. [Chwyty Gitarowe i Wzbogacanie z Internetu](#5-chwyty-gitarowe-i-wzbogacanie-z-internetu)
6. [Dyktowanie Głosowe](#6-dyktowanie-głosowe)
7. [Plany Nabożeństw i Spotkań](#7-plany-nabożeństw-i-spotkań)
8. [Import z Holyrics, OpenLyrics, JSON i TXT](#8-import-z-holyrics-openlyrics-json-i-txt)
9. [Kopie Zapasowe i Dysk Google](#9-kopie-zapasowe-i-dysk-google)
10. [Tłumaczenia Interfejsu (i18n)](#10-tłumaczenia-interfejsu-i18n)
11. [Tabela Skrótów Klawiszowych](#11-tabela-skrótów-klawiszowych)

---

## 1. Wprowadzenie i Pierwsze Kroki

**CantatePresenter** to profesjonalne, nowoczesne narzędzie zaprojektowane dla wspólnot chrześcijańskich, zespołów muzycznych, parafii oraz Ruchu **Equipes Notre-Dame (END)** do wyświetlania słów pieśni, chwytów gitarowych i slajdów liturgicznych na projektorach i ekranach zewnętrznych.

### Układ Trzypanelowy
Okno główne programu podzielone jest na 3 intuicyjne strefy:
* **Lewy panel**: Przełącznik między **Biblioteką pieśni** (z błyskawiczną wyszukiwarką pełnotekstową) a **Planem nabożeństwa** (listą przygotowanych utworów).
* **Środkowy panel**: Podgląd slajdów wybranej pieśni wraz z chwytami gitarowymi oraz przyciskami edycji.
* **Prawy panel (Live Monitor)**: Podgląd aktualnego stanu rzutnika na żywo, podgląd następnego slajdu, szybkie sterowanie projekcją oraz wybór docelowego monitora.

---

## 2. Prezentacja na Żywo i Obsługa Ekranów

### Projekcja na monitorze zewnętrznym lub projektorze
1. W prawym panelu w sekcji **Ekrany i Projektor** wybierz podłączony wyświetlacz (np. projektor HDMI, telewizor lub monitor zewnętrzny).
2. Kliknij **Prezentuj na pełnym ekranie** (`⌘P`).
3. Wybierz dowolną pieśń z biblioteki lub planu i kliknij na slajd, aby natychmiast rozpocząć wyświetlanie.

### Prezentacja na pojedynczym ekranie (Single-Screen Mode)
* Gdy do komputera nie jest podłączony żaden zewnętrzny ekran, program automatycznie uruchamia prezentację na pełnym ekranie Twojego Maca.
* **Wyjście z prezentacji**: Wystarczy w dowolnym momencie nacisnąć klawisz **`ESC`**, aby natychmiast zamknąć pełny ekran i wrócić do edytora.
* W trakcie projekcji na pojedynczym ekranie na starcie wyświetla się dyskretna podpowiedź informująca o klawiszu `ESC`.

### Kontrola w trakcie projekcji
* **Następny slajd**: Klawisz `Spacja`, `Strzałka w prawo`, `Strzałka w dół` lub `Page Down`.
* **Poprzedni slajd**: `Strzałka w lewo`, `Strzałka w górę` lub `Page Up`.
* **Czarny ekran (Black Screen)**: Klawisz **`B`** — natychmiast wygasza rzutnik do czerni (np. na czas modlitwy w ciszy lub kazania).
* **Ukrycie tekstu (Clear Text)**: Klawisz **`C`** — zachowuje tło/planszę, ukrywając sam tekst pieśni.
* **Powrót do planszy czuwania**: Przycisk **Stop** (`■`).

---

## 3. Plansza Czuwania (Standby) i Wybór Logo

Gdy żadna pieśń nie jest prezentowana na żywo, projektor wyświetla elegancką planszę czuwania z subtelną animacją ambientową i zegarem.

### Wybór oficjalnego logo:
1. Otwórz menu **Ustawienia** (`⌘,`) i kliknij **Wybierz inne logo z galerii...**.
2. W galerii dostępnych jest **23 profesjonalnych propozycji**, w tym:
   * **Oficjalne logo Equipes Notre-Dame (END)** (oryginalne pobrane ze strony end.org.pl: ryba i obrączki przymierza),
   * Złota gitara akustyczna z rozetą i strunami,
   * Harfa i Lira Dawidowa z falami rezonansu,
   * Klucz wiolinowy z korektorem pasmowym audio,
   * Symfonia i falująca pięciolinia w 3D,
   * Wokal i fale harmoniczne,
   * Promienie chwały, gołębica, wschodzące słońce nad górami, monogram i wiele innych.
3. Po wybraniu logo plansza startowa automatycznie i natychmiast aktualizuje się zarówno w oknie podglądu, jak i na rzutniku.

---

## 4. Baza Pieśni i Zaawansowany Edytor

### Dodawanie i edycja pieśni
* Kliknij **Nowa pieśń** (`⌘N`), aby otworzyć edytor nowego utworu.
* Kliknij **Edytuj** (`⌘E`) lub dwukrotnie kliknij w pieśń na liście, aby zmodyfikować istniejącą pieśń.

### Obsługiwane sekcje utworu
Edytor automatycznie rozpoznaje i formatuje oznaczenia sekcji:
* `[Zwrotka 1]`, `[Zwrotka 2]`, `[1]`, `[2]`
* `[Refren]`, `[Refren 1]`, `[R]`
* `[Coda]` lub `[Koda]` (zwieńczenie utworu)
* `[Bridge]` lub `[Mostek]`
* `[Przejście]` lub `[Interlude]`
* `[Zakończenie]` lub `[Ending]`
* `[Intro]` oraz `[Outro]`

> [!TIP]
> Jeśli nie chcesz wpisywać znaczników w nawiasach, wystarczy oddzielić poszczególne zwrotki **pustą linią** — program sam ponumeruje slajdy jako *Zwrotka 1*, *Zwrotka 2* itd.

---

## 5. Chwyty Gitarowe i Wzbogacanie z Internetu

### Wyświetlanie i transpozycja akordów
* Przy każdej pieśni widoczne jest pole na chwyty gitarowe (np. `D A h G`).
* Za pomocą przycisków **+1 / -1** możesz jednym kliknięciem transponować całą tonację pieśni w górę lub w dół (np. dostosowując ją do możliwości wokalnych prowadzącego).

### Automatyczne pobieranie chwytów z internetu
1. W edytorze lub w panelu środkowym kliknij **Szukaj chwytów online...**.
2. Program przeszuka popularne bazy akordów (np. *tekstowo.pl*, *kompasje.pl* i serwisy tabulaturowe).
3. Wybierz najlepszą wersję chwytów i kliknij **Wstaw chwyty do pieśni**.

### Weryfikacja autora i tytułu
* Funkcja **Zweryfikuj tytuł i autora** przeszukuje sieć i dopasowuje rzeczywistych autorów słów i muzyki.
* Okno podglądu pozwala odznaczyć niepewnych autorów (zapisywanych wówczas jako *"Nieznany"*).

---

## 6. Dyktowanie Głosowe

CantatePresenter posiada zintegrowany moduł rozpoznawania mowy:
* **Dyktowanie tekstu pieśni**: W edytorze kliknij ikonę mikrofonu i podyktuj słowa pieśni — tekst pojawi się automatycznie w polu edycji.
* **Wyszukiwanie głosowe**: Kliknij mikrofon obok paska szukania i wypowiedz tytuł lub fragment pieśni (np. *"Pan kiedyś stanął nad brzegiem"*), aby natychmiast odnaleźć utwór.
* Język dyktowania można zmienić w **Ustawieniach** (domyślnie: Polski `pl-PL`).

---

## 7. Plany Nabożeństw i Spotkań

1. Przełącz lewy panel na zakładkę **Plan**.
2. Kliknij **Nowy plan**, aby utworzyć listę na nabożeństwo, mszę lub spotkanie modlitewne.
3. Przeciągaj pieśni z biblioteki lub kliknij **Dodaj do planu** pod prawym przyciskiem myszy.
4. Kolejność utworów możesz wygodnie zmieniać przeciągając wiersze.
5. Po dojściu do ostatniego slajdu pieśni, kolejne naciśnięcie `Spacji` płynnie przełącza na pierwszą zwrotkę następnej pieśni z planu!

---

## 8. Import z Holyrics, OpenLyrics, JSON i TXT

W oknie **Import/Eksport** (`⌘I`) możesz zasilić bazę z dowolnych istniejących zbiorów:
* **Bazy Holyrics (`.mufl`, `.muf`, `.hly`)**: Natywny deserializator odczytuje kompletne archiwa programu Holyrics wraz z metadanymi i kodowaniem.
* **Pliki i foldery tekstowe (`.txt`)**: Możesz wskazać pojedynczy plik lub **cały folder** zawierający setki plików tekstowych — program automatycznie rozpozna kodowanie znaków (UTF-8, Windows-1250, ISO-8859-2) i naprawi polskie litery (ą, ę, ś, ć, ż, ź, ł, ó, ń).
* **Format JSON (`.json`)**: Importuje zarówno kopie zapasowe, jak i tablice obiektów z innych systemów.
* **Wykrywanie duplikatów**: Przed zatwierdzeniem importu program analizuje bibliotekę i wyświetla raport, chroniąc przed powielaniem istniejących utworów.

---

## 9. Kopie Zapasowe i Dysk Google

Program dba o pełne bezpieczeństwo Twojej bazy:

### Lokalna kopia zapasowa (`.cantatebackup`)
* Wybierz z menu **Plik -> Utwórz pełną kopię zapasową...** (`⌘B`).
* Plik archiwum zawiera kompletną bazę pieśni, chwyty, plany nabożeństw, ustawienia, planszę standby, własne języki oraz wybrane logotypy.
* Przywrócenie kopii na nowym komputerze trwa kilka sekund.

### Kopia w chmurze Google Drive
1. W **Ustawieniach** w sekcji *Kopia zapasowa i Dysk Google* podaj swój `Client ID` z Google Cloud Console i kliknij **Autoryzuj w przeglądarce**.
2. Aplikacja automatycznie utworzy dedykowany folder `CantatePresenter_Backups` na Twoim Dysku Google.
3. Możesz w dowolnym momencie wysłać kopię jednym kliknięciem lub przeglądać i przywracać wcześniejsze wersje bazy bezpośrednio z chmury.
4. Opcja **Automatyczny backup przy zamykaniu** zabezpiecza bazę przed przypadkową utratą danych po każdej próbie lub nabożeństwie.

---

## 10. Tłumaczenia Interfejsu (i18n)

Aplikacja jest w pełni przystosowana do pracy międzynarodowej:
* **Wbudowane języki**: Polski (`pl`), Angielski (`en`), Niemiecki (`de`), Hiszpański (`es`), Ukraiński (`uk`).
* **Eksport do tłumaczenia**: W Ustawieniach w sekcji *Języki i Tłumaczenia* możesz wyeksportować bieżący plik JSON zawierający szczegółowe opisy kontekstowe (`description`) dla modeli AI (np. ChatGPT, Gemini, Claude).
* **Import tłumaczenia**: Wgranie przetłumaczonego pliku natychmiast dodaje nowy język do listy wyboru.

---

## 11. Tabela Skrótów Klawiszowych

| Skrót | Działanie |
|---|---|
| **Spacja** / **→** / **↓** / **Enter** | Następny slajd / Następna pieśń w planie |
| **←** / **↑** | Poprzedni slajd |
| **ESC** | Wyjście z prezentacji na pełnym ekranie (w trybie 1 ekranu) |
| **B** | Przełączenie czarnego ekranu (Black Screen) |
| **C** | Ukrycie tekstu (Clear Text) |
| **⌘ P** | Włącz / Wyłącz prezentację na projektorze |
| **⌘ T** | Otwórz / Zamknij okno testowe podglądu |
| **⌘ N** | Dodaj nową pieśń |
| **⌘ E** | Edytuj zaznaczoną pieśń |
| **⌘ F** | Aktywuj pasek wyszukiwania w bibliotece |
| **⌘ I** | Otwórz okno Importu i Eksportu |
| **⌘ B** | Utwórz pełną kopię zapasową (.cantatebackup) |
| **⌘ ,** | Otwórz Ustawienia aplikacji |
| **⌘ ?** / **F1** | Otwórz Instrukcję obsługi |
| **⌘ +** / **⌘ -** / **⌘ 0** | Powiększenie / Pomniejszenie / Reset skali interfejsu (100%) |
| **⌘ Q** | Zakończenie programu (z opcją auto-backupu na Google Drive) |

---

*CantatePresenter — Śpiewajcie Panu pieśń nową (Cantate Domino canticum novum)*
