# CantatePresenter Web — Wersja Internetowa (Node.js + PWA)

> **Profesjonalny, bezpieczny serwis webowy do prezentacji pieśni, slajdów i chwytów gitarowych.**  
> Zaprojektowany z myślą o wdrożeniu na własnym serwerze VPS oraz odporności na brak internetu (PWA + Offline).

---

## 🔒 Architektura Bezpieczeństwa (Spełniająca Najwyższe Rygory)

1. **Brak dostępu publicznego:**
   - Wszystkie trasy aplikacji i API wymagają uwierzytelnionej sesji.
2. **Procedura pierwszego uruchomienia (Bootstrap Setup Wizard):**
   - Przy pierwszym starcie serwera generowany jest w 100% losowy, poufny **Klucz Konfiguracji Początkowej (Master Setup Key)**, zapisywany z uprawnieniami `0600` w pliku `data/.bootstrap_key` oraz wypisywany jednorazowo w konsoli serwera.
   - Klucz **nigdy nie trafia do repozytorium Git** (jest wykluczony w `.gitignore`).
   - Dopiero po podaniu tego klucza pod adresem `/setup.html` administrator definiuje własną nazwę użytkownika oraz silne hasło.
   - Po zakończeniu kreatora, adres `/setup.html` zostaje bezpowrotnie zablokowany, a do serwisu może zalogować się **wyłącznie zdefiniowany użytkownik**.
3. **Reset awaryjny (Emergency Master Reset):**
   - W oknie logowania (`/login.html`) znajduje się opcja resetu awaryjnego. Wymaga ona znajomości poufnego klucza `Master Setup Key`. Pozwala to na wyczyszczenie konta i ponowne uruchomienie kreatora w razie utraty hasła.
4. **Kryptografia i ochrona przed atakami:**
   - **Haszowanie haseł:** PBKDF2 (SHA-512, 100 000 iteracji) z unikalną 32-bajtową solą kryptograficzną.
   - **Ochrona przed atakami czasowymi:** `crypto.timingSafeEqual`.
   - **Ochrona przed brute-force:** Ograniczenie liczby prób logowania (`express-rate-limit`) – maksymalnie 5 błędnych prób na 15 minut.
   - **Ciasteczka sesyjne:** Flagi `HttpOnly`, `SameSite=Strict` oraz `Secure` (pod HTTPS).
   - **Nagłówki bezpieczeństwa:** Pakiet `helmet` (Content Security Policy, HSTS, X-Frame-Options, nosniff).
   - **Ochrona CSRF:** Wymuszenie dedykowanych nagłówków żądań dla operacji modyfikujących.

---

## 🚀 Jak wdrożyć na Twoim VPS

Po wycięciu WordPressa Twój serwer VPS zyska mnóstwo wolnej pamięci RAM. Aplikacja CantatePresenter Web zużywa zaledwie **~35-45 MB RAM**, dzięki czemu idealnie współistnieje z serwerem poczty (Postfix/Dovecot).

### Metoda 1: Za pomocą Dockera (Najprostsza)
```bash
# 1. Przejdź do katalogu projektu na VPS
cd /var/www/cantate-presenter

# 2. Skopiuj szablon zmiennych środowiskowych i wygeneruj losowy sekret
cp .env.example .env

# 3. Uruchom kontener w tle
docker compose up -d

# 4. Sprawdź wygenerowany Master Setup Key w logach:
docker logs cantate-presenter
```

### Metoda 2: Bezpośrednio przez Node.js i Systemd
```bash
# 1. Zainstaluj zależności na VPS
npm install --omit=dev

# 2. Skopiuj plik usługi systemd
sudo cp cantate.service /etc/systemd/system/

# 3. Włącz i uruchom usługę
sudo systemctl daemon-reload
sudo systemctl enable cantate --now

# 4. Sprawdź wygenerowany Master Setup Key w dzienniku:
sudo journalctl -u cantate -n 50
```

---

## 🌐 Konfiguracja Nginx i Darmowy Certyfikat SSL

1. Skopiuj plik konfiguracji:
   ```bash
   sudo cp nginx_cantate.conf /etc/nginx/sites-available/cantate
   sudo ln -s /etc/nginx/sites-available/cantate /etc/nginx/sites-enabled/
   ```
2. Zmień `prezenter.twojadomena.pl` na swoją właściwą domenę.
3. Przetestuj i przeładuj Nginx:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```
4. Wygeneruj bezpłatny certyfikat SSL za pomocą Certbota:
   ```bash
   sudo certbot --nginx -d prezenter.twojadomena.pl
   ```

---

## 🖥️ Ekrany i Prezentacja w Przeglądarce

| Ścieżka URL | Przeznaczenie |
| :--- | :--- |
| **`/`** | **Pulpit Operatora** — 3-panelowy pulpit sterowania, wyszukiwarka, dodawanie pieśni, chwyty gitarowe, monitor. |
| **`/projector.html`** | **Ekran Rzutnika** — Czysty ekran projekcyjny. Otwórz w nowym oknie, przeciągnij na projektor i wciśnij **F11** (pełny ekran). |
| **`/stage.html`** | **Pulpit Muzyka / Organisty** — Lekki widok mobilny na telefon lub tablet z tekstem i **chwytami gitarowymi**. |
| **`/login.html`** | Ekran logowania + opcja resetu awaryjnego. |
| **`/setup.html`** | Kreator pierwszego uruchomienia. |

---

## 💾 Kopia Zapasowa (Download & Upload)

* **Pobranie:** W pasku narzędzi kliknij `💾 Kopia zapasowa` -> `Pobierz plik .cantatebackup`. Gotowe archiwum pobiera się bezpośrednio przez przeglądarkę na Twój komputer.
* **Przywrócenie:** W tym samym oknie wskaż plik kopii z dysku i kliknij `Przywróć dane z pliku`. Baza zostanie natychmiast odświeżona bez restartu serwera.
