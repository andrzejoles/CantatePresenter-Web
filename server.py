#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CantatePresenter Web — Lokalny i Produkcyjny Serwer (Zero-Dependency Python 3)
Współdzieli dokładnie ten sam frontend, bazę danych, szablony i zabezpieczenia co wersja Node.js.
"""

import os
import sys
import json
import time
import uuid
import hmac
import hashlib
import secrets
import zipfile
import io
import re
from http import cookies
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import urllib.parse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DEFAULT_DIR = os.path.join(DATA_DIR, 'default')
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
AUTH_FILE = os.path.join(DATA_DIR, 'auth_config.json')
BOOTSTRAP_KEY_FILE = os.path.join(DATA_DIR, '.bootstrap_key')
PORT = int(os.environ.get('PORT', 3000))

# -------------------------------------------------------------------
# SECURITY & AUTHENTICATION SERVICE
# -------------------------------------------------------------------
class AuthService:
    def __init__(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        self.session_secret = secrets.token_bytes(32)
        self.master_setup_key = self.init_master_key()
        self.auth_config = self.load_auth_config()
        self.active_sessions = {} # token -> { username, expires_at, ip }
        self.failed_login_attempts = {} # ip -> [timestamps]

    def init_master_key(self):
        env_key = os.environ.get('MASTER_SETUP_KEY', '').strip()
        if len(env_key) >= 8:
            return env_key

        if os.path.exists(BOOTSTRAP_KEY_FILE):
            try:
                with open(BOOTSTRAP_KEY_FILE, 'r', encoding='utf-8') as f:
                    key = f.read().strip()
                    if len(key) >= 16:
                        return key
            except Exception:
                pass

        generated = secrets.token_hex(16)
        try:
            with open(BOOTSTRAP_KEY_FILE, 'w', encoding='utf-8') as f:
                f.write(generated)
            os.chmod(BOOTSTRAP_KEY_FILE, 0o600)
        except Exception as e:
            print('[BEZPIECZEŃSTWO] Nie można zapisać .bootstrap_key:', e)
        return generated

    def load_auth_config(self):
        if os.path.exists(AUTH_FILE):
            try:
                with open(AUTH_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print('[BEZPIECZEŃSTWO] Błąd odczytu auth_config.json:', e)
        return {
            "isConfigured": False,
            "username": "",
            "passwordHash": "",
            "salt": "",
            "iterations": 100000
        }

    def save_auth_config(self):
        with open(AUTH_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.auth_config, f, indent=2)
        try:
            os.chmod(AUTH_FILE, 0o600)
        except Exception:
            pass

    def is_configured(self):
        return bool(self.auth_config.get("isConfigured") and self.auth_config.get("passwordHash"))

    def hash_password(self, password: str, salt_hex: str, iterations=100000) -> str:
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), salt, iterations)
        return key.hex()

    def verify_master_key(self, key: str) -> bool:
        if not key:
            return False
        return hmac.compare_digest(key.strip(), self.master_setup_key)

    def is_ip_rate_limited(self, ip: str) -> bool:
        now = time.time()
        attempts = self.failed_login_attempts.get(ip, [])
        # filter attempts in last 15 minutes
        attempts = [t for t in attempts if now - t < 900]
        self.failed_login_attempts[ip] = attempts
        return len(attempts) >= 5

    def record_failed_login(self, ip: str):
        now = time.time()
        attempts = self.failed_login_attempts.get(ip, [])
        attempts.append(now)
        self.failed_login_attempts[ip] = attempts

    def setup_initial_admin(self, master_key, username, password):
        if self.is_configured():
            raise ValueError('Aplikacja została już skonfigurowana.')
        if not self.verify_master_key(master_key):
            raise ValueError('Nieprawidłowy Klucz Konfiguracji Początkowej (Master Setup Key).')
        clean_user = username.strip()
        if len(clean_user) < 3:
            raise ValueError('Nazwa użytkownika musi mieć minimum 3 znaki.')
        if len(password) < 8:
            raise ValueError('Hasło musi mieć minimum 8 znaków.')

        salt_hex = secrets.token_hex(32)
        pwd_hash = self.hash_password(password, salt_hex)
        self.auth_config = {
            "isConfigured": True,
            "username": clean_user,
            "passwordHash": pwd_hash,
            "salt": salt_hex,
            "iterations": 100000,
            "createdAt": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        }
        self.save_auth_config()
        return True

    def authenticate(self, username, password, ip):
        if not self.is_configured():
            return False, 'not_configured'
        if self.is_ip_rate_limited(ip):
            return False, 'rate_limited'

        clean_user = username.strip()
        if not hmac.compare_digest(clean_user, self.auth_config.get("username", "")):
            self.record_failed_login(ip)
            return False, 'invalid_credentials'

        salt_hex = self.auth_config.get("salt", "")
        expected_hash = self.auth_config.get("passwordHash", "")
        candidate_hash = self.hash_password(password, salt_hex)

        if not hmac.compare_digest(candidate_hash, expected_hash):
            self.record_failed_login(ip)
            return False, 'invalid_credentials'

        return True, clean_user

    def emergency_reset(self, master_key):
        if not self.verify_master_key(master_key):
            raise ValueError('Nieprawidłowy Master Setup Key. Reset odrzucony.')
        self.auth_config = {
            "isConfigured": False,
            "username": "",
            "passwordHash": "",
            "salt": "",
            "iterations": 100000
        }
        self.save_auth_config()
        self.active_sessions.clear()
        return True

    def create_session_token(self, username):
        expires_at = int(time.time()) + 86400 # 24h
        random_bytes = secrets.token_hex(24)
        msg = f"{username}:{expires_at}:{random_bytes}".encode('utf-8')
        sig = hmac.new(self.session_secret, msg, hashlib.sha256).hexdigest()
        token = f"{username}.{expires_at}.{random_bytes}.{sig}"
        self.active_sessions[token] = {"username": username, "expires_at": expires_at}
        return token

    def verify_session_token(self, token):
        if not token:
            return None
        parts = token.split('.')
        if len(parts) != 4:
            return None
        username, expires_at_str, random_bytes, sig = parts
        try:
            expires_at = int(expires_at_str)
        except ValueError:
            return None

        if time.time() > expires_at:
            self.active_sessions.pop(token, None)
            return None

        msg = f"{username}:{expires_at_str}:{random_bytes}".encode('utf-8')
        expected_sig = hmac.new(self.session_secret, msg, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None

        return {"username": username, "expires_at": expires_at}


# -------------------------------------------------------------------
# DATA STORE SERVICE
# -------------------------------------------------------------------
class DataStoreService:
    def __init__(self):
        self.ensure_default_files()
        self.songs = self.read_json('songs.json', [])
        self.settings = self.read_json('settings.json', self.default_settings())
        self.plans = self.read_json('plans.json', [])

        self.live_state = {
            "isLive": False,
            "isBlackScreen": False,
            "isClearText": False,
            "currentSongId": self.songs[0]["id"] if self.songs else None,
            "currentSlideIndex": 0
        }

    def default_settings(self):
        return {
            "appLanguage": "pl",
            "verticalAlignment": "center",
            "activeLogoId": "equipes_notre_dame",
            "selectedScreenIndex": 1,
            "fontFamily": "Segoe UI, sans-serif",
            "uiScale": 1.0,
            "textAlignment": "center",
            "isBold": True,
            "marginPercent": 0.07,
            "lineSpacingFactor": 1.15,
            "textColorHex": "#FFFFFF",
            "backgroundColorHex": "#000000",
            "hasShadow": True,
            "onlineSearchLanguage": "pl"
        }

    def ensure_default_files(self):
        files_to_copy = ['songs.json', 'settings.json', 'plans.json', 'standby.html']
        for f in files_to_copy:
            dst = os.path.join(DATA_DIR, f)
            src = os.path.join(DEFAULT_DIR, f)
            if not os.path.exists(dst) and os.path.exists(src):
                try:
                    import shutil
                    shutil.copyfile(src, dst)
                except Exception:
                    pass

    def read_json(self, filename, fallback):
        p = os.path.join(DATA_DIR, filename)
        if os.path.exists(p):
            try:
                with open(p, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        return fallback

    def save_songs(self):
        p = os.path.join(DATA_DIR, 'songs.json')
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(self.songs, f, indent=2, ensure_ascii=False)

    def save_settings(self):
        p = os.path.join(DATA_DIR, 'settings.json')
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(self.settings, f, indent=2, ensure_ascii=False)

    def save_plans(self):
        p = os.path.join(DATA_DIR, 'plans.json')
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(self.plans, f, indent=2, ensure_ascii=False)

    def get_presentation_payload(self):
        song = next((s for s in self.songs if s.get("id") == self.live_state["currentSongId"]), None)
        slide = None
        next_slide = None
        if song and song.get("slides"):
            idx = max(0, min(self.live_state["currentSlideIndex"], len(song["slides"]) - 1))
            slide = song["slides"][idx]
            if idx + 1 < len(song["slides"]):
                next_slide = song["slides"][idx + 1]

        return {
            "isLive": self.live_state["isLive"],
            "isBlackScreen": self.live_state["isBlackScreen"],
            "isClearText": self.live_state["isClearText"],
            "currentSong": song,
            "currentSlide": slide,
            "nextSlide": next_slide,
            "slideIndex": self.live_state["currentSlideIndex"],
            "settings": self.settings
        }

    def next_slide(self):
        song = next((s for s in self.songs if s.get("id") == self.live_state["currentSongId"]), None)
        if not song or not song.get("slides"):
            return
        if self.live_state["currentSlideIndex"] < len(song["slides"]) - 1:
            self.live_state["currentSlideIndex"] += 1
        else:
            idx = next((i for i, s in enumerate(self.songs) if s.get("id") == song["id"]), -1)
            if idx >= 0 and idx < len(self.songs) - 1:
                self.live_state["currentSongId"] = self.songs[idx + 1]["id"]
                self.live_state["currentSlideIndex"] = 0

    def prev_slide(self):
        song = next((s for s in self.songs if s.get("id") == self.live_state["currentSongId"]), None)
        if not song or not song.get("slides"):
            return
        if self.live_state["currentSlideIndex"] > 0:
            self.live_state["currentSlideIndex"] -= 1

    def create_backup_zip(self) -> bytes:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
            for fn in ['songs.json', 'plans.json', 'settings.json', 'standby.html']:
                fp = os.path.join(DATA_DIR, fn)
                if os.path.exists(fp):
                    z.write(fp, arcname=fn)
            manifest = {
                "version": "1.0.0",
                "appName": "CantatePresenter Web",
                "createdAt": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                "songsCount": len(self.songs),
                "plansCount": len(self.plans),
                "activeLogoId": self.settings.get("activeLogoId", "")
            }
            z.writestr('manifest.json', json.dumps(manifest, indent=2))
        return buf.getvalue()

    def restore_backup_zip(self, zip_bytes: bytes):
        buf = io.BytesIO(zip_bytes)
        with zipfile.ZipFile(buf, 'r') as z:
            for member in z.namelist():
                # zip slip protection
                if '..' in member or member.startswith('/') or member.startswith('\\'):
                    continue
                z.extract(member, DATA_DIR)
        self.songs = self.read_json('songs.json', [])
        self.settings = self.read_json('settings.json', self.default_settings())
        self.plans = self.read_json('plans.json', [])


# -------------------------------------------------------------------
# CHORDS & PARSER
# -------------------------------------------------------------------
CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H"]

def transpose_root(root: str, semitones: int) -> str:
    shift = (semitones % 12 + 12) % 12
    is_lower = root == root.lower()
    upper = root.upper()
    if upper not in CHROMATIC:
        return root
    idx = CHROMATIC.index(upper)
    new_idx = (idx + shift) % 12
    res = CHROMATIC[new_idx]
    return res.lower() if is_lower else res

def transpose_chords(chords: str, semitones: int) -> str:
    if not chords or semitones == 0:
        return chords
    pattern = re.compile(r'\b([A-Ha-h][#b]?)(m|maj|min|dim|sus|add)?([0-9]?)(?:/([A-Ha-h][#b]?))?\b')
    def repl(m):
        r = transpose_root(m.group(1), semitones)
        mod = m.group(2) or ''
        num = m.group(3) or ''
        bass = f"/{transpose_root(m.group(4), semitones)}" if m.group(4) else ''
        return f"{r}{mod}{num}{bass}"
    return pattern.sub(repl, chords)

def parse_raw_song(raw_content: str, fallback_title="Nowa pieśń"):
    lines = raw_content.replace('\r\n', '\n').split('\n')
    title = fallback_title
    author = "Nieznany"
    key = ""
    start_idx = 0

    for i, line in enumerate(lines[:8]):
        l = line.strip().lower()
        if l.startswith("tytuł:") or l.startswith("title:") or l.startswith("tytul:"):
            title = line.split(":", 1)[1].strip()
            start_idx = max(start_idx, i + 1)
        elif l.startswith("autor:") or l.startswith("author:"):
            author = line.split(":", 1)[1].strip()
            start_idx = max(start_idx, i + 1)
        elif l.startswith("tonacja:") or l.startswith("key:"):
            key = line.split(":", 1)[1].strip()
            start_idx = max(start_idx, i + 1)
        elif i == 0 and not l.startswith("[") and not l.startswith("1.") and not l.startswith("ref"):
            title = line.strip()
            start_idx = 1

    if 'łysa góra' in author.lower() or 'lysa gora' in author.lower():
        author = "Nieznany"

    lyrics = "\n".join(lines[start_idx:]).strip()
    slides = []
    blocks = [b.strip() for b in lyrics.split('\n\n') if b.strip()]
    verse_counter = 1
    chorus_counter = 1

    for block in blocks:
        blines = [bl.strip() for bl in block.split('\n') if bl.strip()]
        if not blines: continue
        first = blines[0]
        fl = first.lower()
        stype = 'Zwrotka'
        label = f'Zwrotka {verse_counter}'
        if fl.startswith('[ref') or fl.startswith('ref:') or fl.startswith('[chorus'):
            stype = 'Refren'
            label = 'Refren' if chorus_counter == 1 else f'Refren {chorus_counter}'
            chorus_counter += 1
            blines.pop(0)
        elif fl.startswith('[coda') or fl.startswith('coda:'):
            stype = 'Coda'
            label = 'Coda'
            blines.pop(0)
        elif fl.startswith('[bridge') or fl.startswith('bridge:'):
            stype = 'Bridge'
            label = 'Bridge'
            blines.pop(0)
        elif fl.startswith('[zwrotka') or fl.startswith('[1') or fl.startswith('[2'):
            label = first.strip('[]: ')
            verse_counter += 1
            blines.pop(0)
        else:
            verse_counter += 1

        text = "\n".join(blines).strip()
        if text:
            slides.append({"id": str(uuid.uuid4()), "type": stype, "label": label, "text": text})

    if not slides:
        slides = [{"id": str(uuid.uuid4()), "type": "Zwrotka", "label": "Zwrotka 1", "text": lyrics}]

    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "author": author or "Nieznany",
        "key": key,
        "tags": [],
        "rawLyrics": lyrics,
        "slides": slides,
        "createdAt": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "updatedAt": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    }


# -------------------------------------------------------------------
# HTTP REQUEST HANDLER
# -------------------------------------------------------------------
auth_svc = AuthService()
data_svc = DataStoreService()

class CantateHttpHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def get_client_ip(self):
        return self.headers.get('X-Forwarded-For', self.client_address[0]).split(',')[0].strip()

    def get_cookie(self, name):
        cookie_header = self.headers.get('Cookie')
        if not cookie_header:
            return None
        c = cookies.SimpleCookie()
        c.load(cookie_header)
        if name in c:
            return c[name].value
        return None

    def send_json(self, data, status=200, set_cookie_token=None, clear_cookie=False):
        payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')

        if set_cookie_token:
            # HttpOnly SameSite=Strict cookie
            self.send_header('Set-Cookie', f'cantate_session={set_cookie_token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400')
        elif clear_cookie:
            self.send_header('Set-Cookie', 'cantate_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0')

        self.end_headers()
        self.wfile.write(payload)

    def read_json_body(self):
        clen = int(self.headers.get('Content-Length', 0))
        if clen <= 0:
            return {}
        raw = self.rfile.read(clen).decode('utf-8')
        return json.loads(raw)

    def is_authenticated(self):
        token = self.get_cookie('cantate_session')
        if not token:
            auth_h = self.headers.get('Authorization', '')
            if auth_h.startswith('Bearer '):
                token = auth_h[7:]
        return auth_svc.verify_session_token(token)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. API: Auth status
        if path == '/api/auth/status':
            is_cfg = auth_svc.is_configured()
            session = self.is_authenticated()
            return self.send_json({
                "success": True,
                "isConfigured": is_cfg,
                "isAuthenticated": bool(session),
                "username": session["username"] if session else None
            })

        # 2. Backup download (Protected)
        if path == '/api/backup/download':
            if not self.is_authenticated():
                return self.send_json({"success": False, "error": "unauthorized"}, 401)
            zip_bytes = data_svc.create_backup_zip()
            timestamp = time.strftime('%Y-%m-%d_%H-%M-%S', time.gmtime())
            filename = f"CantatePresenter_Backup_{timestamp}.cantatebackup"

            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
            self.send_header('Content-Length', str(len(zip_bytes)))
            self.end_headers()
            self.wfile.write(zip_bytes)
            return

        # 3. Protected REST APIs
        if path.startswith('/api/'):
            if not self.is_authenticated():
                return self.send_json({"success": False, "error": "unauthorized"}, 401)

            if path == '/api/songs':
                return self.send_json({"success": True, "songs": data_svc.songs})
            elif path == '/api/plans':
                return self.send_json({"success": True, "plans": data_svc.plans})
            elif path == '/api/settings':
                return self.send_json({"success": True, "settings": data_svc.settings})
            elif path == '/api/live/state':
                return self.send_json({"success": True, "state": data_svc.get_presentation_payload()})

        # 4. Static / Data files (e.g. logos)
        if path.startswith('/data/'):
            rel = path[6:]
            real_path = os.path.join(DATA_DIR, rel)
            if os.path.exists(real_path) and os.path.isfile(real_path):
                ext = os.path.splitext(real_path)[1].lower()
                ctype = 'image/png' if ext == '.png' else ('image/svg+xml' if ext == '.svg' else 'application/octet-stream')
                with open(real_path, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', ctype)
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        # 5. Root page: check authentication
        if path == '/' or path == '/index.html':
            if not auth_svc.is_configured():
                self.send_response(302)
                self.send_header('Location', '/setup.html')
                self.end_headers()
                return
            if not self.is_authenticated():
                self.send_response(302)
                self.send_header('Location', '/login.html')
                self.end_headers()
                return

        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        ip = self.get_client_ip()

        # 1. Setup endpoint (Public when unconfigured)
        if path == '/api/auth/setup':
            body = self.read_json_body()
            try:
                auth_svc.setup_initial_admin(body.get('masterKey', ''), body.get('username', ''), body.get('password', ''))
                token = auth_svc.create_session_token(body.get('username', '').strip())
                return self.send_json({"success": True}, set_cookie_token=token)
            except Exception as e:
                return self.send_json({"success": False, "error": str(e)}, 400)

        # 2. Login endpoint (Public)
        if path == '/api/auth/login':
            body = self.read_json_body()
            ok, user_or_reason = auth_svc.authenticate(body.get('username', ''), body.get('password', ''), ip)
            if ok:
                token = auth_svc.create_session_token(user_or_reason)
                return self.send_json({"success": True, "username": user_or_reason}, set_cookie_token=token)
            elif user_or_reason == 'rate_limited':
                return self.send_json({"success": False, "error": "Zbyt wiele nieudanych prób logowania. Dostęp zablokowany na 15 minut."}, 429)
            elif user_or_reason == 'not_configured':
                return self.send_json({"success": False, "error": "Wymagana konfiguracja początkowa."}, 400)
            else:
                return self.send_json({"success": False, "error": "Nieprawidłowa nazwa użytkownika lub hasło."}, 401)

        # 3. Logout endpoint
        if path == '/api/auth/logout':
            token = self.get_cookie('cantate_session')
            if token:
                auth_svc.active_sessions.pop(token, None)
            return self.send_json({"success": True}, clear_cookie=True)

        # 4. Emergency Reset endpoint
        if path == '/api/auth/emergency-reset':
            body = self.read_json_body()
            try:
                auth_svc.emergency_reset(body.get('masterKey', ''))
                return self.send_json({"success": True, "message": "Zresetowano pomyślnie."}, clear_cookie=True)
            except Exception as e:
                return self.send_json({"success": False, "error": str(e)}, 400)

        # -------------------------------------------------------------
        # PROTECTED POST APIs
        # -------------------------------------------------------------
        if not self.is_authenticated():
            return self.send_json({"success": False, "error": "unauthorized"}, 401)

        if path == '/api/songs':
            song = self.read_json_body()
            song['id'] = song.get('id') or str(uuid.uuid4())
            data_svc.songs.insert(0, song)
            data_svc.save_songs()
            return self.send_json({"success": True, "song": song})

        elif path == '/api/songs/parse-raw':
            body = self.read_json_body()
            song = parse_raw_song(body.get('rawText', ''), body.get('fallbackTitle', 'Nowa pieśń'))
            return self.send_json({"success": True, "song": song})

        elif path == '/api/settings':
            body = self.read_json_body()
            data_svc.settings.update(body)
            data_svc.save_settings()
            return self.send_json({"success": True, "settings": data_svc.settings})

        elif path == '/api/live/select-slide':
            body = self.read_json_body()
            if body.get('songId'):
                data_svc.live_state['currentSongId'] = body['songId']
            data_svc.live_state['currentSlideIndex'] = int(body.get('slideIndex', 0))
            data_svc.live_state['isLive'] = True
            return self.send_json({"success": True, "state": data_svc.get_presentation_payload()})

        elif path == '/api/live/action':
            body = self.read_json_body()
            act = body.get('action')
            if act == 'nextSlide':
                data_svc.next_slide()
            elif act == 'prevSlide':
                data_svc.prev_slide()
            elif act == 'toggleBlack':
                data_svc.live_state['isBlackScreen'] = not data_svc.live_state['isBlackScreen']
            elif act == 'toggleClear':
                data_svc.live_state['isClearText'] = not data_svc.live_state['isClearText']
            elif act == 'stop':
                data_svc.live_state['isLive'] = False
            return self.send_json({"success": True, "state": data_svc.get_presentation_payload()})

        elif path == '/api/chords/transpose':
            body = self.read_json_body()
            tr = transpose_chords(body.get('chords', ''), int(body.get('semitones', 0)))
            return self.send_json({"success": True, "chords": tr})

        elif path == '/api/backup/upload':
            # Multipart upload handling
            ctype = self.headers.get('Content-Type', '')
            if 'boundary=' in ctype:
                boundary = ctype.split('boundary=')[1].strip().encode('utf-8')
                clen = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(clen)
                parts = body.split(boundary)
                for p in parts:
                    if b'filename=' in p and b'\r\n\r\n' in p:
                        header_part, data_part = p.split(b'\r\n\r\n', 1)
                        file_data = data_part.rstrip(b'\r\n--')
                        data_svc.restore_backup_zip(file_data)
                        return self.send_json({"success": True, "message": "Przywrócono bazę pomyślnie!"})
            return self.send_json({"success": False, "error": "Brak poprawnego pliku w żądaniu."}, 400)

        self.send_error(404, 'Endpoint nie istnieje')

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if not self.is_authenticated():
            return self.send_json({"success": False, "error": "unauthorized"}, 401)

        if path.startswith('/api/songs/'):
            song_id = path[11:]
            body = self.read_json_body()
            for i, s in enumerate(data_svc.songs):
                if s.get("id") == song_id:
                    data_svc.songs[i].update(body)
                    data_svc.save_songs()
                    return self.send_json({"success": True, "song": data_svc.songs[i]})
            return self.send_json({"success": False, "error": "Nie znaleziono pieśni"}, 404)

        self.send_error(404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if not self.is_authenticated():
            return self.send_json({"success": False, "error": "unauthorized"}, 401)

        if path.startswith('/api/songs/'):
            song_id = path[11:]
            data_svc.songs = [s for s in data_svc.songs if s.get("id") != song_id]
            data_svc.save_songs()
            return self.send_json({"success": True})

        self.send_error(404)


# -------------------------------------------------------------------
# MAIN RUNNER
# -------------------------------------------------------------------
def main():
    server = ThreadingHTTPServer(('0.0.0.0', PORT), CantateHttpHandler)

    if not auth_svc.is_configured():
        print('\n' + '=' * 74)
        print('🔒 [BEZPIECZEŃSTWO] WYMAGANA KONFIGURACJA POCZĄTKOWA CANTATEPRESENTER!')
        print('-' * 74)
        print('Klucz Konfiguracji Początkowej (Master Setup Key):')
        print(f'\n    👉  {auth_svc.master_setup_key}  👈\n')
        print(f'Otwórz w przeglądarce: http://localhost:{PORT}')
        print('Wpisz powyższy klucz w kreatorze, aby zdefiniować konto administratora.')
        print('Klucz jest zapisany w pliku data/.bootstrap_key (uprawnienia 0600).')
        print('=' * 74 + '\n')
    else:
        print('\n' + '=' * 74)
        print(f'🎶 CantatePresenter Web Server działa pod adresem: http://localhost:{PORT}')
        print(f'Konto administratora jest aktywne. Zaloguj się w przeglądarce.')
        print('=' * 74 + '\n')

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nZatrzymywanie serwera...')
        server.server_close()

if __name__ == '__main__':
    main()
