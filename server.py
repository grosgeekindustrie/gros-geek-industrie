#!/usr/bin/env python3
"""
Serveur local — Etsy Pipeline DnD
Double-clic pour lancer. Ouvre http://localhost:8080 automatiquement.
Ctrl+C pour arrêter.
"""

import base64
import hashlib
import http.server
import json
import os
import re
import ssl
import sys
import urllib.parse
import urllib.request
import uuid
import webbrowser
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock, Timer

PORT = 8080
ROOT = Path(__file__).parent.resolve()
STATIC_ROOT = ROOT / 'src'
ENV_FILE = ROOT / '.env'
ALLOWED_DIRS = {'prompts', 'biblios'}
ALLOWED_SUBDIRS = {'tabletop', 'collection'}
ANTHROPIC_FILES_CACHE = ROOT / '.anthropic_files_cache.json'
ANTHROPIC_FILES_BETA = 'files-api-2025-04-14'
ANTHROPIC_FILES_CACHE_LOCK = Lock()
SOLO_EXPORT_ROOT = 'export'
ETSY_API_BASE_URL = 'https://api.etsy.com/v3'
ETSY_OAUTH_CONNECT_URL = 'https://www.etsy.com/oauth/connect'
ETSY_OAUTH_TOKEN_URL = f'{ETSY_API_BASE_URL}/public/oauth/token'
ETSY_OAUTH_SCOPES = ('shops_r', 'listings_r')
ETSY_OAUTH_PENDING_FILE = ROOT / '.etsy_oauth_pending.json'
ETSY_OAUTH_TOKEN_FILE = ROOT / '.etsy_oauth_tokens.json'
ETSY_OAUTH_CALLBACK_ROUTE = '/etsy/oauth/callback'
LOCAL_HTTPS_DEFAULT_PORT = 8443
ETSY_OAUTH_EXPIRY_SKEW_SECONDS = 60
ETSY_OAUTH_TOKEN_LOCK = Lock()


def load_dotenv_file(path: Path = ENV_FILE):
    """Charger un .env local sans écraser les variables d'environnement existantes."""
    if not path.exists():
        return

    for raw_line in path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue

        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip())


def get_anthropic_api_key(request_payload: dict | None = None) -> str:
    """Prendre d'abord la clé du .env, puis garder le fallback UI temporaire."""
    env_value = str(os.getenv('ANTHROPIC_API_KEY') or '').strip()
    if env_value:
        return env_value

    if request_payload:
        return str(request_payload.get('apiKey') or '').strip()

    return ''


def get_env_value(name: str) -> str:
    return str(os.getenv(name) or '').strip()


def get_etsy_keystring() -> str:
    return get_env_value('ETSY_KEYSTRING')


def get_etsy_shared_secret() -> str:
    return get_env_value('ETSY_SHARED_SECRET')


def get_etsy_redirect_uri() -> str:
    return get_env_value('ETSY_REDIRECT_URI')


def get_local_https_cert_file() -> str:
    return get_env_value('LOCAL_HTTPS_CERT_FILE')


def get_local_https_key_file() -> str:
    return get_env_value('LOCAL_HTTPS_KEY_FILE')


def get_local_https_port() -> int:
    raw = get_env_value('LOCAL_HTTPS_PORT')
    if not raw:
        return LOCAL_HTTPS_DEFAULT_PORT
    try:
        value = int(raw)
    except ValueError:
        return LOCAL_HTTPS_DEFAULT_PORT
    return value if value > 0 else LOCAL_HTTPS_DEFAULT_PORT


def is_local_https_enabled() -> bool:
    return bool(get_local_https_cert_file() and get_local_https_key_file())


def resolve_local_path(raw_path: str) -> Path:
    path = Path(raw_path).expanduser()
    if not path.is_absolute():
        path = (ROOT / path).resolve()
    return path


def decode_json_bytes(raw: bytes) -> dict:
    if not raw:
        return {}

    text = raw.decode('utf-8', errors='replace')
    if not text.strip():
        return {}

    return json.loads(text)


def load_json_file(path: Path, fallback):
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return fallback


def save_json_file(path: Path, payload):
    tmp_path = path.with_name(f'{path.name}.{uuid.uuid4().hex}.tmp')
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp_path.replace(path)


def forward_anthropic_json_request(url: str, payload: dict, *, use_files_beta: bool = False, timeout: int = 120) -> tuple[int, dict]:
    api_key = get_anthropic_api_key(payload)
    if not api_key:
        raise ValueError('Clé API manquante (.env ou interface)')

    headers = {
        'Content-Type': 'application/json',
        'x-api-key': api_key,
        'anthropic-version': '2023-06-01',
    }
    if use_files_beta:
        headers['anthropic-beta'] = f'prompt-caching-2024-07-31,{ANTHROPIC_FILES_BETA}'

    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
        method='POST',
        headers=headers,
    )

    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.getcode(), decode_json_bytes(response.read())


def build_etsy_api_key_header_value() -> str:
    keystring = get_etsy_keystring()
    shared_secret = get_etsy_shared_secret()
    if not keystring or not shared_secret:
        return ''
    return f'{keystring}:{shared_secret}'


def build_etsy_auth_status() -> dict:
    keystring = get_etsy_keystring()
    shared_secret = get_etsy_shared_secret()
    redirect_uri = get_etsy_redirect_uri()
    token_data = load_json_file(ETSY_OAUTH_TOKEN_FILE, {})
    pending_data = load_json_file(ETSY_OAUTH_PENDING_FILE, {})
    local_https_cert = get_local_https_cert_file()
    local_https_key = get_local_https_key_file()
    local_https_enabled = is_local_https_enabled()
    local_https_cert_path = resolve_local_path(local_https_cert) if local_https_cert else None
    local_https_key_path = resolve_local_path(local_https_key) if local_https_key else None
    local_https_files_ready = bool(
        local_https_cert_path
        and local_https_key_path
        and local_https_cert_path.exists()
        and local_https_key_path.exists()
    )

    missing_config = []
    if not keystring:
        missing_config.append('ETSY_KEYSTRING')
    if not shared_secret:
        missing_config.append('ETSY_SHARED_SECRET')
    if not redirect_uri:
        missing_config.append('ETSY_REDIRECT_URI')
    elif not redirect_uri.startswith('https://'):
        missing_config.append('ETSY_REDIRECT_URI (https requis)')
    elif redirect_uri.startswith('https://localhost'):
        if not local_https_enabled:
            missing_config.append('LOCAL_HTTPS_CERT_FILE + LOCAL_HTTPS_KEY_FILE')
        elif not local_https_files_ready:
            missing_config.append('Fichiers certificat localhost manquants')

    return {
        'configured': not missing_config,
        'connected': bool(token_data.get('access_token')),
        'pending': bool(pending_data.get('state')),
        'missingConfig': missing_config,
        'redirectUri': redirect_uri,
        'scopes': list(ETSY_OAUTH_SCOPES),
        'expiresAt': token_data.get('expires_at'),
        'lastAuthAt': token_data.get('created_at'),
        'tokenType': token_data.get('token_type'),
        'shopUserId': token_data.get('user_id'),
        'pendingCreatedAt': pending_data.get('created_at'),
        'localHttpsEnabled': local_https_enabled,
        'localHttpsFilesReady': local_https_files_ready,
        'localHttpsPort': get_local_https_port(),
        'localHttpsCertFile': str(local_https_cert_path) if local_https_cert_path else '',
        'localHttpsKeyFile': str(local_https_key_path) if local_https_key_path else '',
    }


def generate_pkce_verifier() -> str:
    verifier = base64.urlsafe_b64encode(os.urandom(48)).decode('ascii').rstrip('=')
    return verifier[:128]


def build_pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode('ascii')).digest()
    return base64.urlsafe_b64encode(digest).decode('ascii').rstrip('=')


def build_etsy_authorization_url() -> str:
    status = build_etsy_auth_status()
    if not status['configured']:
        raise ValueError(f"Configuration Etsy incomplète : {', '.join(status['missingConfig'])}")

    state = uuid.uuid4().hex
    verifier = generate_pkce_verifier()
    challenge = build_pkce_challenge(verifier)
    redirect_uri = get_etsy_redirect_uri()

    pending_payload = {
        'state': state,
        'code_verifier': verifier,
        'redirect_uri': redirect_uri,
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    save_json_file(ETSY_OAUTH_PENDING_FILE, pending_payload)

    query = urllib.parse.urlencode({
        'response_type': 'code',
        'client_id': get_etsy_keystring(),
        'redirect_uri': redirect_uri,
        'scope': ' '.join(ETSY_OAUTH_SCOPES),
        'state': state,
        'code_challenge': challenge,
        'code_challenge_method': 'S256',
    })
    return f'{ETSY_OAUTH_CONNECT_URL}?{query}'


def exchange_etsy_authorization_code(code: str, pending_payload: dict) -> dict:
    request_body = urllib.parse.urlencode({
        'grant_type': 'authorization_code',
        'client_id': get_etsy_keystring(),
        'redirect_uri': pending_payload['redirect_uri'],
        'code': code,
        'code_verifier': pending_payload['code_verifier'],
    }).encode('utf-8')

    request = urllib.request.Request(
        ETSY_OAUTH_TOKEN_URL,
        data=request_body,
        method='POST',
        headers={
            'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        },
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        return decode_json_bytes(response.read())


def persist_etsy_token_payload(token_payload: dict):
    access_token = str(token_payload.get('access_token') or '').strip()
    user_id, _, raw_token = access_token.partition('.')
    expires_in = int(token_payload.get('expires_in') or 0)
    now = datetime.now(timezone.utc)
    expires_at = (now.timestamp() + expires_in) if expires_in > 0 else 0

    payload = {
        'access_token': access_token,
        'oauth_token': raw_token,
        'refresh_token': str(token_payload.get('refresh_token') or '').strip(),
        'token_type': str(token_payload.get('token_type') or '').strip(),
        'expires_in': expires_in,
        'expires_at': datetime.fromtimestamp(expires_at, timezone.utc).isoformat() if expires_at else '',
        'created_at': now.isoformat(),
        'user_id': user_id,
        'scopes': list(ETSY_OAUTH_SCOPES),
    }
    save_json_file(ETSY_OAUTH_TOKEN_FILE, payload)
    if ETSY_OAUTH_PENDING_FILE.exists():
        ETSY_OAUTH_PENDING_FILE.unlink()


def build_home_redirect_url(result: str, message: str) -> str:
    query = urllib.parse.urlencode({
        'etsy_oauth': result,
        'etsy_message': message,
    })
    return f'/?{query}'


def get_etsy_oauth_token_data() -> dict:
    return load_json_file(ETSY_OAUTH_TOKEN_FILE, {})


def parse_iso_datetime(value: str) -> datetime | None:
    raw = str(value or '').strip()
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def is_etsy_access_token_expired(token_data: dict) -> bool:
    access_token = str(token_data.get('access_token') or '').strip()
    if not access_token:
        return True

    expires_at = parse_iso_datetime(token_data.get('expires_at'))
    if expires_at is None:
        return True

    refresh_deadline = expires_at.timestamp() - ETSY_OAUTH_EXPIRY_SKEW_SECONDS
    return datetime.now(timezone.utc).timestamp() >= refresh_deadline


def refresh_etsy_access_token(token_data: dict | None = None) -> dict:
    current_token_data = token_data or get_etsy_oauth_token_data()
    refresh_token = str(current_token_data.get('refresh_token') or '').strip()
    if not refresh_token:
        raise ValueError('Refresh token Etsy introuvable')

    request_body = urllib.parse.urlencode({
        'grant_type': 'refresh_token',
        'client_id': get_etsy_keystring(),
        'refresh_token': refresh_token,
    }).encode('utf-8')

    request = urllib.request.Request(
        ETSY_OAUTH_TOKEN_URL,
        data=request_body,
        method='POST',
        headers={
            'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        },
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        refreshed_payload = decode_json_bytes(response.read())

    persist_etsy_token_payload(refreshed_payload)
    return get_etsy_oauth_token_data()


def get_etsy_valid_token_data() -> dict:
    with ETSY_OAUTH_TOKEN_LOCK:
        token_data = get_etsy_oauth_token_data()
        if not is_etsy_access_token_expired(token_data):
            return token_data
        return refresh_etsy_access_token(token_data)


def get_etsy_access_token() -> str:
    return str(get_etsy_valid_token_data().get('access_token') or '').strip()


def get_etsy_user_id() -> str:
    token_data = get_etsy_oauth_token_data()
    access_token = str(token_data.get('access_token') or '').strip()
    if access_token and '.' in access_token:
      return access_token.split('.', 1)[0]
    return str(token_data.get('user_id') or '').strip()


def build_etsy_request_headers(*, include_oauth: bool) -> dict:
    api_key = build_etsy_api_key_header_value()
    if not api_key:
        raise ValueError('Configuration Etsy incomplète : ETSY_KEYSTRING + ETSY_SHARED_SECRET requis')

    headers = {
        'x-api-key': api_key,
        'Accept': 'application/json',
        'User-Agent': 'EtsyPipeline/1.0',
    }

    if include_oauth:
        access_token = get_etsy_access_token()
        if not access_token:
            raise ValueError('Boutique Etsy non autorisée')
        headers['Authorization'] = f'Bearer {access_token}'

    return headers


def perform_etsy_get_request(path: str, *, include_oauth: bool) -> dict:
    url = f'{ETSY_API_BASE_URL}/application/{path.lstrip("/")}'
    request = urllib.request.Request(
        url,
        method='GET',
        headers=build_etsy_request_headers(include_oauth=include_oauth),
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return decode_json_bytes(response.read())


def get_etsy_shop_payload() -> dict:
    user_id = get_etsy_user_id()
    if not user_id:
        raise ValueError('User Etsy introuvable dans le token OAuth')

    return perform_etsy_get_request(f'users/{user_id}/shops', include_oauth=True)


def extract_primary_shop_record(payload: dict) -> dict:
    if isinstance(payload, dict):
        results = payload.get('results')
        if isinstance(results, list) and results:
            first = results[0]
            return first if isinstance(first, dict) else {}
        if payload.get('shop_id'):
            return payload
    return {}


def get_etsy_shop_context() -> dict:
    shop_payload = get_etsy_shop_payload()
    shop_record = extract_primary_shop_record(shop_payload)
    shop_id = shop_record.get('shop_id')
    if not shop_id:
        raise ValueError('Aucune boutique Etsy exploitable trouvée pour cet utilisateur')

    return {
        'user_id': get_etsy_user_id(),
        'shop_id': str(shop_id),
        'shop': shop_record,
        'raw': shop_payload,
    }


def parse_etsy_listing_id(raw_value: str) -> str:
    value = str(raw_value or '').strip()
    if not value:
        return ''
    if value.isdigit():
        return value

    path_match = re.search(r'/listing/(\d+)', value, flags=re.IGNORECASE)
    if path_match:
        return path_match.group(1)

    query_match = re.search(r'(?:\?|&)listing_id=(\d+)', value, flags=re.IGNORECASE)
    if query_match:
        return query_match.group(1)

    return ''


def require_etsy_listing_id(query_params: dict) -> str:
    raw_value = query_params.get('listing_id', [''])[0]
    listing_id = parse_etsy_listing_id(raw_value)
    if not listing_id:
        raise ValueError('Listing ID Etsy introuvable dans la référence fournie')
    return listing_id


def get_listing_shop_id(listing_payload: dict) -> str:
    shop_id = str(listing_payload.get('shop_id') or '').strip()
    if not shop_id:
        raise ValueError('shop_id introuvable dans la fiche Etsy')
    return shop_id


def build_https_context() -> ssl.SSLContext:
    cert_path = resolve_local_path(get_local_https_cert_file())
    key_path = resolve_local_path(get_local_https_key_file())

    if not cert_path.exists():
        raise FileNotFoundError(f'Certificat HTTPS introuvable : {cert_path}')
    if not key_path.exists():
        raise FileNotFoundError(f'Clé HTTPS introuvable : {key_path}')

    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=str(cert_path), keyfile=str(key_path))
    return context


def safe_path(raw: str) -> Path | None:
    """Résoudre le chemin et vérifier qu'il reste dans ROOT/ALLOWED_DIRS."""
    try:
        p = (ROOT / raw.lstrip('/')).resolve()
        # Doit être sous ROOT
        p.relative_to(ROOT)
        # Premier segment doit être dans ALLOWED_DIRS
        parts = p.relative_to(ROOT).parts
        if parts and parts[0] not in ALLOWED_DIRS:
            return None
        # Autoriser les sous-dossiers tabletop/collection
        if len(parts) >= 2 and parts[1] not in ALLOWED_SUBDIRS:
            return None
        return p
    except (ValueError, Exception):
        return None


def load_anthropic_files_cache() -> dict:
    if not ANTHROPIC_FILES_CACHE.exists():
        return {}
    try:
        return json.loads(ANTHROPIC_FILES_CACHE.read_text(encoding='utf-8'))
    except Exception:
        return {}


def save_anthropic_files_cache(cache: dict):
    tmp_path = ANTHROPIC_FILES_CACHE.with_name(f'{ANTHROPIC_FILES_CACHE.name}.{uuid.uuid4().hex}.tmp')
    tmp_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp_path.replace(ANTHROPIC_FILES_CACHE)


def compute_image_content_hash(media_type: str, data: bytes) -> str:
    digest = hashlib.sha256()
    digest.update(media_type.encode('utf-8'))
    digest.update(b'::')
    digest.update(data)
    return digest.hexdigest()


def guess_filename(name: str, media_type: str) -> str:
    safe_name = ''.join(c for c in (name or 'image').strip() if c.isalnum() or c in '._- ') or 'image'
    if '.' in safe_name:
        return safe_name

    ext_map = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
    }
    return f"{safe_name}{ext_map.get(media_type, '.bin')}"


def build_multipart_file_body(filename: str, media_type: str, payload: bytes, boundary: str) -> bytes:
    head = (
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
        f"Content-Type: {media_type}\r\n\r\n"
    ).encode('utf-8')
    tail = f"\r\n--{boundary}--\r\n".encode('utf-8')
    return head + payload + tail


def upload_image_to_anthropic(api_key: str, filename: str, media_type: str, payload: bytes) -> dict:
    boundary = f"----EtsyPipeline{uuid.uuid4().hex}"
    body = build_multipart_file_body(filename, media_type, payload, boundary)
    req = urllib.request.Request(
        'https://api.anthropic.com/v1/files',
        data=body,
        method='POST',
        headers={
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': ANTHROPIC_FILES_BETA,
            'Content-Type': f'multipart/form-data; boundary={boundary}',
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode('utf-8')
    return json.loads(raw)


def resolve_uploaded_images(api_key: str, images: list[dict]) -> list[dict]:
    resolved = []

    for index, image in enumerate(images):
        image_id = str(image.get('imageId') or f'image-{index + 1}')
        media_type = str(image.get('mediaType') or 'image/png')
        base64_payload = str(image.get('base64') or '')
        if not base64_payload:
            raise ValueError(f'Image sans contenu base64: {image_id}')

        try:
            payload = base64.b64decode(base64_payload, validate=True)
        except Exception as exc:
            raise ValueError(f'Base64 invalide pour {image_id}') from exc

        content_hash = compute_image_content_hash(media_type, payload)
        with ANTHROPIC_FILES_CACHE_LOCK:
            cached = load_anthropic_files_cache().get(content_hash)

        if cached and cached.get('file_id'):
            resolved.append({
                'imageId': image_id,
                'fileId': cached['file_id'],
                'contentHash': content_hash,
                'cached': True,
            })
            continue

        filename = guess_filename(str(image.get('name') or image_id), media_type)
        uploaded = upload_image_to_anthropic(api_key, filename, media_type, payload)
        file_id = uploaded.get('id')
        if not file_id:
            raise RuntimeError(f'Réponse Anthropic invalide pour {image_id}')

        with ANTHROPIC_FILES_CACHE_LOCK:
            cache = load_anthropic_files_cache()
            cached = cache.get(content_hash)
            if cached and cached.get('file_id'):
                resolved.append({
                    'imageId': image_id,
                    'fileId': cached['file_id'],
                    'contentHash': content_hash,
                    'cached': True,
                })
                continue

            cache[content_hash] = {
                'file_id': file_id,
                'filename': filename,
                'media_type': media_type,
                'updated_at': datetime.now(timezone.utc).isoformat(),
            }
            save_anthropic_files_cache(cache)

        resolved.append({
            'imageId': image_id,
            'fileId': file_id,
            'contentHash': content_hash,
            'cached': False,
        })

    return resolved


class Handler(http.server.BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        print(f"  {self.command} {self.path} → {args[0]}")

    def save_export_files(self, files, output_root):
        """Écrire les exports uniquement dans le dossier généré attendu."""
        saved = []
        target_root = (ROOT / output_root).resolve()
        target_root.mkdir(parents=True, exist_ok=True)

        for export_file in files:
            filename = str(export_file.get('filename') or 'export.md')
            raw_parts = filename.replace('\\', '/').split('/')
            parts = []

            for raw_part in raw_parts:
                clean_part = ''.join(c for c in raw_part if c.isalnum() or c in '._- ').strip()
                if not clean_part or clean_part in ('.', '..'):
                    continue
                parts.append(clean_part)

            if not parts:
                parts = ['export.md']

            if parts[0] != output_root:
                parts.insert(0, output_root)

            filepath = ROOT.joinpath(*parts).resolve()

            try:
                filepath.relative_to(target_root)
            except ValueError as exc:
                raise ValueError(f'Chemin export non autorisé: {filename}') from exc

            filepath.parent.mkdir(parents=True, exist_ok=True)
            filepath.write_text(export_file.get('content', ''), encoding='utf-8')
            saved.append(str(filepath.relative_to(ROOT)))

        return saved

    def send_json(self, code: int, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, code: int, text: str):
        body = text.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path: Path):
        body = path.read_bytes()
        ext = path.suffix.lower()
        types = {'.html': 'text/html', '.md': 'text/markdown', '.js': 'text/javascript', '.css': 'text/css'}
        ct = types.get(ext, 'application/octet-stream')
        self.send_response(200)
        self.send_header('Content-Type', f'{ct}; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def send_redirect(self, location: str):
        self.send_response(302)
        self.send_header('Location', location)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        path = self.path.split('?')[0]
        raw_qs = self.path.split('?', 1)[1] if '?' in self.path else ''
        query_params = urllib.parse.parse_qs(raw_qs)

        if path == '/etsy/auth/status':
            self.send_json(200, build_etsy_auth_status())
            return

        if path == '/etsy/test/ping':
            try:
                payload = perform_etsy_get_request('openapi-ping', include_oauth=False)
                self.send_json(200, {
                    'ok': True,
                    'endpoint': 'openapi-ping',
                    'payload': payload,
                })
            except ValueError as e:
                self.send_json(400, {'error': str(e)})
            except urllib.error.HTTPError as e:
                try:
                    payload = decode_json_bytes(e.read())
                except Exception:
                    payload = {'error': str(e)}
                self.send_json(e.code, payload or {'error': str(e)})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
            return

        if path == '/etsy/test/oauth-identity':
            try:
                token_data = get_etsy_oauth_token_data()
                user_id = get_etsy_user_id()
                if not user_id:
                    raise ValueError('User Etsy introuvable dans le token OAuth')

                payload = {
                    'user_id': user_id,
                    'token_type': str(token_data.get('token_type') or '').strip(),
                    'expires_at': str(token_data.get('expires_at') or '').strip(),
                    'created_at': str(token_data.get('created_at') or '').strip(),
                    'scopes': list(token_data.get('scopes') or []),
                }
                self.send_json(200, {
                    'ok': True,
                    'endpoint': 'oauth-identity',
                    'payload': payload,
                })
            except ValueError as e:
                self.send_json(400, {'error': str(e)})
            except urllib.error.HTTPError as e:
                try:
                    payload = decode_json_bytes(e.read())
                except Exception:
                    payload = {'error': str(e)}
                self.send_json(e.code, payload or {'error': str(e)})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
            return

        if path == '/etsy/test/shop':
            try:
                shop_context = get_etsy_shop_context()
                payload = {
                    'user_id': shop_context['user_id'],
                    'shop_id': shop_context['shop_id'],
                    'shop': shop_context['shop'],
                }
                self.send_json(200, {
                    'ok': True,
                    'endpoint': 'users/{user_id}/shops',
                    'payload': payload,
                })
            except ValueError as e:
                self.send_json(400, {'error': str(e)})
            except urllib.error.HTTPError as e:
                try:
                    payload = decode_json_bytes(e.read())
                except Exception:
                    payload = {'error': str(e)}
                self.send_json(e.code, payload or {'error': str(e)})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
            return

        if path == '/etsy/test/listings':
            try:
                shop_context = get_etsy_shop_context()
                shop_id = shop_context['shop_id']
                payload = perform_etsy_get_request(
                    f'shops/{shop_id}/listings?state=active&limit=5',
                    include_oauth=True,
                )
                self.send_json(200, {
                    'ok': True,
                    'endpoint': f'shops/{shop_id}/listings',
                    'payload': {
                        'user_id': shop_context['user_id'],
                        'shop_id': shop_id,
                        'query': {
                            'state': 'active',
                            'limit': 5,
                        },
                        'data': payload,
                    },
                })
            except ValueError as e:
                self.send_json(400, {'error': str(e)})
            except urllib.error.HTTPError as e:
                try:
                    payload = decode_json_bytes(e.read())
                except Exception:
                    payload = {'error': str(e)}
                self.send_json(e.code, payload or {'error': str(e)})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
            return

        if path == '/etsy/test/sections':
            try:
                shop_context = get_etsy_shop_context()
                shop_id = shop_context['shop_id']
                payload = perform_etsy_get_request(
                    f'shops/{shop_id}/sections',
                    include_oauth=False,
                )
                self.send_json(200, {
                    'ok': True,
                    'endpoint': f'shops/{shop_id}/sections',
                    'payload': {
                        'user_id': shop_context['user_id'],
                        'shop_id': shop_id,
                        'data': payload,
                    },
                })
            except ValueError as e:
                self.send_json(400, {'error': str(e)})
            except urllib.error.HTTPError as e:
                try:
                    payload = decode_json_bytes(e.read())
                except Exception:
                    payload = {'error': str(e)}
                self.send_json(e.code, payload or {'error': str(e)})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
            return

        if path == '/etsy/test/listing':
            try:
                listing_id = require_etsy_listing_id(query_params)
                includes = 'Images,Videos,Inventory,Shop,User,Shipping,Personalization'
                payload = perform_etsy_get_request(
                    f'listings/{listing_id}?includes={urllib.parse.quote(includes, safe=",")}&legacy=true&allow_suggested_title=true',
                    include_oauth=True,
                )
                self.send_json(200, {
                    'ok': True,
                    'endpoint': f'listings/{listing_id}',
                    'payload': {
                        'listing_id': listing_id,
                        'includes': includes.split(','),
                        'data': payload,
                    },
                })
            except ValueError as e:
                self.send_json(400, {'error': str(e)})
            except urllib.error.HTTPError as e:
                try:
                    payload = decode_json_bytes(e.read())
                except Exception:
                    payload = {'error': str(e)}
                self.send_json(e.code, payload or {'error': str(e)})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
            return

        if path == '/etsy/test/listing/properties':
            try:
                listing_id = require_etsy_listing_id(query_params)
                listing_payload = perform_etsy_get_request(
                    f'listings/{listing_id}?legacy=true',
                    include_oauth=True,
                )
                shop_id = get_listing_shop_id(listing_payload)
                payload = perform_etsy_get_request(
                    f'shops/{shop_id}/listings/{listing_id}/properties',
                    include_oauth=False,
                )
                self.send_json(200, {
                    'ok': True,
                    'endpoint': f'shops/{shop_id}/listings/{listing_id}/properties',
                    'payload': {
                        'listing_id': listing_id,
                        'shop_id': shop_id,
                        'data': payload,
                    },
                })
            except ValueError as e:
                self.send_json(400, {'error': str(e)})
            except urllib.error.HTTPError as e:
                try:
                    payload = decode_json_bytes(e.read())
                except Exception:
                    payload = {'error': str(e)}
                self.send_json(e.code, payload or {'error': str(e)})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
            return

        if path == '/etsy/test/listing/variation-images':
            try:
                listing_id = require_etsy_listing_id(query_params)
                listing_payload = perform_etsy_get_request(
                    f'listings/{listing_id}?legacy=true',
                    include_oauth=True,
                )
                shop_id = get_listing_shop_id(listing_payload)
                payload = perform_etsy_get_request(
                    f'shops/{shop_id}/listings/{listing_id}/variation-images',
                    include_oauth=False,
                )
                self.send_json(200, {
                    'ok': True,
                    'endpoint': f'shops/{shop_id}/listings/{listing_id}/variation-images',
                    'payload': {
                        'listing_id': listing_id,
                        'shop_id': shop_id,
                        'data': payload,
                    },
                })
            except ValueError as e:
                self.send_json(400, {'error': str(e)})
            except urllib.error.HTTPError as e:
                try:
                    payload = decode_json_bytes(e.read())
                except Exception:
                    payload = {'error': str(e)}
                self.send_json(e.code, payload or {'error': str(e)})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
            return

        if path == '/etsy/auth/start':
            try:
                auth_url = build_etsy_authorization_url()
                self.send_json(200, {'ok': True, 'authUrl': auth_url})
            except ValueError as e:
                self.send_json(400, {'error': str(e)})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
            return

        if path == ETSY_OAUTH_CALLBACK_ROUTE:
            error_code = query_params.get('error', [''])[0]
            error_description = query_params.get('error_description', [''])[0]
            state = query_params.get('state', [''])[0]
            code = query_params.get('code', [''])[0]
            pending_payload = load_json_file(ETSY_OAUTH_PENDING_FILE, {})

            if error_code:
                message = error_description or error_code
                self.send_redirect(build_home_redirect_url('error', f'OAuth Etsy refusé : {message}'))
                return

            if not code or not state:
                self.send_redirect(build_home_redirect_url('error', 'Réponse OAuth Etsy incomplète'))
                return

            if not pending_payload or pending_payload.get('state') != state:
                self.send_redirect(build_home_redirect_url('error', 'State OAuth Etsy invalide'))
                return

            try:
                token_payload = exchange_etsy_authorization_code(code, pending_payload)
                persist_etsy_token_payload(token_payload)
                self.send_redirect(build_home_redirect_url('success', 'Boutique Etsy autorisée'))
            except urllib.error.HTTPError as e:
                try:
                    payload = decode_json_bytes(e.read())
                    message = payload.get('error_description') or payload.get('error') or str(e)
                except Exception:
                    message = str(e)
                self.send_redirect(build_home_redirect_url('error', f'Échange OAuth Etsy échoué : {message}'))
            except Exception as e:
                self.send_redirect(build_home_redirect_url('error', f'Échange OAuth Etsy échoué : {e}'))
            return

        # Servir le HTML principal
        if path in ('/', '/index.html'):
            html_files = list(STATIC_ROOT.glob('*.html'))
            if html_files:
                self.send_file(html_files[0])
            else:
                self.send_text(404, 'Aucun fichier HTML trouvé dans src/.')
            return

        # API : lister un dossier — GET /files/prompts/ ou /files/biblios/
        if path.startswith('/files/') and path.endswith('/'):
            folder_name = path[7:].strip('/')
            if folder_name not in ALLOWED_DIRS:
                self.send_json(403, {'error': f'Dossier non autorisé: {folder_name}'})
                return
            folder = ROOT / folder_name
            folder.mkdir(exist_ok=True)
            files = [f.name for f in sorted(folder.glob('*.md'))]
            self.send_json(200, {'folder': folder_name, 'files': files})
            return

        # API : lire un fichier — GET /files/prompts/marcus.md
        if path.startswith('/files/'):
            rel = path[7:]  # retire /files/
            p = safe_path(rel)
            if p is None:
                self.send_json(403, {'error': 'Chemin non autorisé'})
                return
            if not p.exists():
                self.send_json(404, {'error': f'Fichier introuvable: {rel}'})
                return
            self.send_text(200, p.read_text(encoding='utf-8'))
            return

        # Servir les fichiers statiques depuis src/ (html, js, css)
        static = STATIC_ROOT / path.lstrip('/')
        if static.exists() and static.is_file() and static.suffix in ('.html', '.js', '.css'):
            self.send_file(static)
            return

        # API : fetch URL externe — GET /fetch-url?url=https://...
        if path == '/fetch-url':
            target = query_params.get('url', [None])[0]
            if not target:
                self.send_json(400, {'error': 'Paramètre url manquant'})
                return
            if not target.startswith('https://'):
                self.send_json(400, {'error': 'URL invalide — https uniquement'})
                return
            parsed = urllib.parse.urlparse(target)
            if parsed.hostname in ('localhost', '127.0.0.1', '0.0.0.0'):
                self.send_json(403, {'error': 'URL locale non autorisée'})
                return
            try:
                req = urllib.request.Request(
                    target,
                    headers={'User-Agent': 'Mozilla/5.0 (compatible; EtsyPipeline/1.1)'}
                )
                with urllib.request.urlopen(req, timeout=8) as resp:
                    raw_html = resp.read().decode('utf-8', errors='replace')
                # Retirer scripts, styles, balises
                raw_html = re.sub(r'<script[^>]*>.*?</script>', '', raw_html, flags=re.DOTALL | re.IGNORECASE)
                raw_html = re.sub(r'<style[^>]*>.*?</style>', '', raw_html, flags=re.DOTALL | re.IGNORECASE)
                raw_html = re.sub(r'<!--.*?-->', '', raw_html, flags=re.DOTALL)
                text = re.sub(r'<[^>]+>', ' ', raw_html)
                text = re.sub(r'[ \t]+', ' ', text)
                text = re.sub(r'\n{3,}', '\n\n', text)
                text = text.strip()
                # Tronquer à 1500 caractères, coupe à la dernière phrase
                MAX = 1500
                if len(text) > MAX:
                    cut = text[:MAX].rfind('.')
                    text = text[:cut + 1] if cut > 0 else text[:MAX]
                self.send_json(200, {'ok': True, 'text': text, 'chars': len(text)})
            except urllib.error.URLError as e:
                self.send_json(502, {'error': f'Fetch impossible : {str(e)}'})
            except Exception as e:
                self.send_json(500, {'error': f'Erreur serveur : {str(e)}'})
            return

        self.send_json(404, {'error': 'Route inconnue'})


    def do_POST(self):
        path = self.path.split('?')[0]

        if path == '/anthropic/files/upload':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            try:
                data = json.loads(body)
                api_key = get_anthropic_api_key(data)
                if not api_key:
                    self.send_json(400, {'error': 'Clé API manquante (.env ou interface)'})
                    return

                images = data.get('images') or []
                if not isinstance(images, list) or not images:
                    self.send_json(400, {'error': 'Aucune image à uploader'})
                    return

                resolved = resolve_uploaded_images(api_key, images)
                self.send_json(200, {'ok': True, 'images': resolved, 'count': len(resolved)})
            except ValueError as e:
                self.send_json(400, {'error': str(e)})
            except urllib.error.HTTPError as e:
                raw_error = e.read().decode('utf-8', errors='replace') if hasattr(e, 'read') else ''
                try:
                    payload = json.loads(raw_error) if raw_error else {}
                except Exception:
                    payload = {}
                self.send_json(e.code, {'error': payload.get('error', {}).get('message') or raw_error or str(e)})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
            return

        if path == '/anthropic/messages':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            try:
                data = json.loads(body)
                use_files_beta = bool(data.pop('useFilesBeta', False))
                status, payload = forward_anthropic_json_request(
                    'https://api.anthropic.com/v1/messages',
                    data,
                    use_files_beta=use_files_beta,
                )
                self.send_json(status, payload)
            except ValueError as e:
                self.send_json(400, {'error': str(e)})
            except urllib.error.HTTPError as e:
                try:
                    payload = decode_json_bytes(e.read())
                except Exception:
                    payload = {'error': str(e)}
                self.send_json(e.code, payload or {'error': str(e)})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
            return

        if path == '/anthropic/messages/count_tokens':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            try:
                data = json.loads(body)
                status, payload = forward_anthropic_json_request(
                    'https://api.anthropic.com/v1/messages/count_tokens',
                    data,
                )
                self.send_json(status, payload)
            except ValueError as e:
                self.send_json(400, {'error': str(e)})
            except urllib.error.HTTPError as e:
                try:
                    payload = decode_json_bytes(e.read())
                except Exception:
                    payload = {'error': str(e)}
                self.send_json(e.code, payload or {'error': str(e)})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
            return

        if path == '/solo/export':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')

            try:
                data = json.loads(body)
                files = data.get('files', [])
                saved = self.save_export_files(files, SOLO_EXPORT_ROOT)
                self.send_json(200, {'ok': True, 'saved': saved, 'count': len(saved)})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
            return

        self.send_json(404, {'error': 'Route inconnue'})

    def do_PUT(self):
        path = self.path.split('?')[0]
        if not path.startswith('/files/'):
            self.send_json(404, {'error': 'Route inconnue'})
            return

        rel = path[7:]
        p = safe_path(rel)
        if p is None:
            self.send_json(403, {'error': 'Chemin non autorisé'})
            return
        if not rel.endswith('.md'):
            self.send_json(400, {'error': 'Seuls les fichiers .md sont acceptés'})
            return

        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')

        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(body, encoding='utf-8')
        self.send_json(200, {'ok': True, 'path': rel, 'bytes': len(body.encode())})

    def do_DELETE(self):
        path = self.path.split('?')[0]
        if not path.startswith('/files/'):
            self.send_json(404, {'error': 'Route inconnue'})
            return

        rel = path[7:]
        p = safe_path(rel)
        if p is None:
            self.send_json(403, {'error': 'Chemin non autorisé'})
            return
        if not p.exists():
            self.send_json(404, {'error': 'Fichier introuvable'})
            return

        p.unlink()
        self.send_json(200, {'ok': True, 'deleted': rel})


class ThreadingLocalServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

def main():
    load_dotenv_file()

    # Créer les dossiers s'ils n'existent pas
    for d in ALLOWED_DIRS:
        (ROOT / d).mkdir(exist_ok=True)
        for sub in ALLOWED_SUBDIRS:
            (ROOT / d / sub).mkdir(exist_ok=True)

    server_port = PORT
    scheme = 'http'
    https_context = None

    if is_local_https_enabled():
        https_context = build_https_context()
        server_port = get_local_https_port()
        scheme = 'https'

    server = ThreadingLocalServer(('localhost', server_port), Handler)
    if https_context is not None:
        server.socket = https_context.wrap_socket(server.socket, server_side=True)

    url = f'{scheme}://localhost:{server_port}'

    print(f'\n  Etsy Pipeline DnD — Serveur local')
    print(f'  ───────────────────────────────────')
    print(f'  Racine  : {ROOT}')
    print(f'  URL     : {url}')
    print(f'  Ctrl+C  : arrêter\n')

    Timer(0.8, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  Serveur arrêté.')
        server.server_close()
        sys.exit(0)


if __name__ == '__main__':
    main()
