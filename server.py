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
import subprocess
import sys
import time
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
ALLOWED_SUBDIRS = {'tabletop', 'collection', 'traduction', 'doubleX'}
LOCAL_HTTPS_FALLBACK_CERT_FILES = ('local-certs/localhost.crt', 'localhost.pem')
LOCAL_HTTPS_FALLBACK_KEY_FILES = ('local-certs/localhost.key', 'localhost-key.pem')
ANTHROPIC_FILES_CACHE = ROOT / '.anthropic_files_cache.json'
ANTHROPIC_FILES_BETA = 'files-api-2025-04-14'
ANTHROPIC_FILES_CACHE_LOCK = Lock()
SOLO_EXPORT_ROOT = 'export'
ETSY_API_BASE_URL = 'https://api.etsy.com/v3'
ETSY_OAUTH_CONNECT_URL = 'https://www.etsy.com/oauth/connect'
ETSY_OAUTH_TOKEN_URL = f'{ETSY_API_BASE_URL}/public/oauth/token'
ETSY_OAUTH_SCOPES = ('shops_r', 'listings_r', 'listings_w')
OPERA_BROWSER_PATH = Path(r'C:\Users\raficraft\AppData\Local\Programs\Opera\opera.exe')
ETSY_OAUTH_PENDING_FILE = ROOT / '.etsy_oauth_pending.json'
ETSY_OAUTH_TOKEN_FILE = ROOT / '.etsy_oauth_tokens.json'
ETSY_OAUTH_CALLBACK_ROUTE = '/etsy/oauth/callback'
LOCAL_HTTPS_DEFAULT_PORT = 8443
ETSY_OAUTH_EXPIRY_SKEW_SECONDS = 60
ETSY_OAUTH_TOKEN_LOCK = Lock()
ETSY_MEDIA_CACHE_DIR = ROOT / '.etsy_media_cache'
ETSY_TAXONOMY_CACHE_TTL_SECONDS = 1800
ETSY_TAXONOMY_CACHE = {
    'seller': {
        'fetched_at': 0.0,
        'payload': None,
        'entries': [],
        'by_id': {},
    },
}


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


def resolve_first_existing_path(candidates: list[str] | tuple[str, ...]) -> Path | None:
    for candidate in candidates:
        raw_candidate = str(candidate or '').strip()
        if not raw_candidate:
            continue
        path = resolve_local_path(raw_candidate)
        if path.exists():
            return path
    return None


def resolve_local_https_cert_path() -> Path | None:
    configured = str(get_local_https_cert_file() or '').strip()
    candidates = [configured] if configured else []
    candidates.extend(LOCAL_HTTPS_FALLBACK_CERT_FILES)
    return resolve_first_existing_path(candidates)


def resolve_local_https_key_path() -> Path | None:
    configured = str(get_local_https_key_file() or '').strip()
    candidates = [configured] if configured else []
    candidates.extend(LOCAL_HTTPS_FALLBACK_KEY_FILES)
    return resolve_first_existing_path(candidates)


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


def guess_media_extension(content_type: str, url: str) -> str:
    normalized = str(content_type or '').split(';', 1)[0].strip().lower()
    if normalized == 'image/jpeg':
        return '.jpg'
    if normalized == 'image/png':
        return '.png'
    if normalized == 'image/webp':
        return '.webp'
    if normalized == 'image/gif':
        return '.gif'

    suffix = Path(urllib.parse.urlparse(url).path).suffix.lower()
    if suffix in {'.jpg', '.jpeg', '.png', '.webp', '.gif'}:
        return '.jpg' if suffix == '.jpeg' else suffix
    return '.jpg'


def is_allowed_etsy_media_url(url: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(str(url or '').strip())
    except Exception:
        return False

    if parsed.scheme != 'https':
        return False

    hostname = str(parsed.hostname or '').lower()
    if not hostname:
        return False

    return hostname == 'i.etsystatic.com' or hostname.endswith('.etsystatic.com')


def build_etsy_media_cache_filename(url: str, extension: str) -> str:
    digest = hashlib.sha256(str(url).encode('utf-8')).hexdigest()
    normalized_extension = extension if extension.startswith('.') else f'.{extension}'
    return f'{digest}{normalized_extension}'


def cache_etsy_media_url(url: str) -> str:
    if not is_allowed_etsy_media_url(url):
        raise ValueError('URL media Etsy non autorisee')

    request = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (compatible; EtsyPipeline/1.1)'},
    )

    with urllib.request.urlopen(request, timeout=20) as response:
        content_type = str(response.headers.get('Content-Type') or '').strip().lower()
        if not content_type.startswith('image/'):
            raise ValueError(f'Ressource non image: {content_type or "type inconnu"}')
        payload = response.read()

    extension = guess_media_extension(content_type, url)
    filename = build_etsy_media_cache_filename(url, extension)
    ETSY_MEDIA_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = ETSY_MEDIA_CACHE_DIR / filename
    if not target.exists():
        target.write_bytes(payload)
    return filename


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
    headers['anthropic-beta'] = (
        f'prompt-caching-2024-07-31,{ANTHROPIC_FILES_BETA}'
        if use_files_beta
        else 'prompt-caching-2024-07-31'
    )

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
    local_https_cert_path = resolve_local_https_cert_path()
    local_https_key_path = resolve_local_https_key_path()
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


def open_url_in_opera(url: str) -> dict:
    normalized_url = str(url or '').strip()
    if not normalized_url:
        raise ValueError('URL Opera invalide')
    if not OPERA_BROWSER_PATH.exists():
        raise FileNotFoundError(f'Opera introuvable : {OPERA_BROWSER_PATH}')

    subprocess.Popen([str(OPERA_BROWSER_PATH), normalized_url])
    return {
        'ok': True,
        'browser': 'opera',
        'browserPath': str(OPERA_BROWSER_PATH),
        'url': normalized_url,
    }


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


def extract_etsy_token_scopes(token_payload: dict, fallback_scopes: list[str] | None = None) -> list[str]:
    if isinstance(token_payload, dict):
        raw_scope = token_payload.get('scope')
        if isinstance(raw_scope, str) and raw_scope.strip():
            return [part.strip() for part in raw_scope.split() if part.strip()]

        raw_scopes = token_payload.get('scopes')
        if isinstance(raw_scopes, list) and raw_scopes:
            return [str(part or '').strip() for part in raw_scopes if str(part or '').strip()]

    return list(fallback_scopes or [])


def persist_etsy_token_payload(token_payload: dict, fallback_scopes: list[str] | None = None):
    access_token = str(token_payload.get('access_token') or '').strip()
    user_id, _, raw_token = access_token.partition('.')
    expires_in = int(token_payload.get('expires_in') or 0)
    now = datetime.now(timezone.utc)
    expires_at = (now.timestamp() + expires_in) if expires_in > 0 else 0
    granted_scopes = extract_etsy_token_scopes(token_payload, fallback_scopes)

    payload = {
        'access_token': access_token,
        'oauth_token': raw_token,
        'refresh_token': str(token_payload.get('refresh_token') or '').strip(),
        'token_type': str(token_payload.get('token_type') or '').strip(),
        'expires_in': expires_in,
        'expires_at': datetime.fromtimestamp(expires_at, timezone.utc).isoformat() if expires_at else '',
        'created_at': now.isoformat(),
        'user_id': user_id,
        'scopes': granted_scopes,
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

    persist_etsy_token_payload(
        refreshed_payload,
        fallback_scopes=list(current_token_data.get('scopes') or []),
    )
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


def encode_etsy_form_items(form_data: dict) -> list[tuple[str, str]]:
    encoded_items: list[tuple[str, str]] = []

    for key, value in (form_data or {}).items():
        if value is None:
            continue
        if isinstance(value, bool):
            encoded_items.append((key, 'true' if value else 'false'))
            continue
        if isinstance(value, (list, tuple)):
            normalized_list = [str(item).strip() for item in value if str(item).strip()]
            if not normalized_list:
                continue
            encoded_items.append((key, ','.join(normalized_list)))
            continue

        normalized_value = str(value).strip()
        if not normalized_value:
            continue
        encoded_items.append((key, normalized_value))

    return encoded_items


def perform_etsy_form_request(path: str, form_data: dict, *, include_oauth: bool, method: str = 'POST') -> dict:
    url = f'{ETSY_API_BASE_URL}/application/{path.lstrip("/")}'
    encoded_items = encode_etsy_form_items(form_data)
    request_body = urllib.parse.urlencode(encoded_items).encode('utf-8')
    headers = build_etsy_request_headers(include_oauth=include_oauth)
    headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8'

    request = urllib.request.Request(
        url,
        data=request_body,
        method=method.upper(),
        headers=headers,
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return decode_json_bytes(response.read())


def perform_etsy_post_form_request(path: str, form_data: dict, *, include_oauth: bool) -> dict:
    return perform_etsy_form_request(path, form_data, include_oauth=include_oauth, method='POST')


def perform_etsy_put_form_request(path: str, form_data: dict, *, include_oauth: bool) -> dict:
    return perform_etsy_form_request(path, form_data, include_oauth=include_oauth, method='PUT')


def perform_etsy_patch_form_request(path: str, form_data: dict, *, include_oauth: bool) -> dict:
    return perform_etsy_form_request(path, form_data, include_oauth=include_oauth, method='PATCH')


def perform_etsy_put_json_request(path: str, payload: dict, *, include_oauth: bool) -> dict:
    url = f'{ETSY_API_BASE_URL}/application/{path.lstrip("/")}'
    headers = build_etsy_request_headers(include_oauth=include_oauth)
    headers['Content-Type'] = 'application/json; charset=utf-8'
    request = urllib.request.Request(
        url,
        data=json.dumps(payload or {}, ensure_ascii=False).encode('utf-8'),
        method='PUT',
        headers=headers,
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return decode_json_bytes(response.read())


def perform_etsy_delete_request(path: str, *, include_oauth: bool) -> dict:
    url = f'{ETSY_API_BASE_URL}/application/{path.lstrip("/")}'
    request = urllib.request.Request(
        url,
        method='DELETE',
        headers=build_etsy_request_headers(include_oauth=include_oauth),
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return decode_json_bytes(response.read())


def get_etsy_granted_scopes() -> list[str]:
    token_data = get_etsy_oauth_token_data()
    return [str(scope or '').strip() for scope in token_data.get('scopes') or [] if str(scope or '').strip()]


def require_etsy_scope(scope_name: str):
    granted_scopes = set(get_etsy_granted_scopes())
    if not granted_scopes:
        return
    if scope_name not in granted_scopes:
        raise ValueError(f'Scope Etsy manquant : {scope_name}. Reconnecter OAuth avec ce scope.')


def extract_etsy_listing_id(payload: dict) -> str:
    if not isinstance(payload, dict):
        return ''

    direct_id = str(payload.get('listing_id') or payload.get('listingId') or '').strip()
    if direct_id:
        return direct_id

    results = payload.get('results')
    if isinstance(results, list) and results:
        first_result = results[0]
        if isinstance(first_result, dict):
            return str(first_result.get('listing_id') or first_result.get('listingId') or '').strip()

    nested = payload.get('data')
    if isinstance(nested, dict):
        return extract_etsy_listing_id(nested)

    return ''


def normalize_etsy_association_collection(value) -> list[dict]:
    if isinstance(value, list):
        return [entry for entry in value if isinstance(entry, dict)]
    if isinstance(value, dict):
        for key in ('results', 'data', 'items'):
            nested = value.get(key)
            if isinstance(nested, list):
                return [entry for entry in nested if isinstance(entry, dict)]
    return []


def extract_etsy_listing_image_ids(payload: dict) -> list[int]:
    source = payload if isinstance(payload, dict) else {}
    data = source.get('results', [{}])[0] if isinstance(source.get('results'), list) and source.get('results') else source.get('data', source)
    images = normalize_etsy_association_collection(data.get('images')) or normalize_etsy_association_collection(data.get('Images'))
    image_ids: list[int] = []
    for entry in images:
        image_id = int(entry.get('listing_image_id') or entry.get('image_id') or 0) or 0
        if image_id:
            image_ids.append(image_id)
    return image_ids


def extract_etsy_listing_video_ids(payload: dict) -> list[int]:
    source = payload if isinstance(payload, dict) else {}
    data = source.get('results', [{}])[0] if isinstance(source.get('results'), list) and source.get('results') else source.get('data', source)
    videos = normalize_etsy_association_collection(data.get('videos')) or normalize_etsy_association_collection(data.get('Videos'))
    video_ids: list[int] = []
    for entry in videos:
        video_id = int(entry.get('listing_video_id') or entry.get('video_id') or 0) or 0
        if video_id:
            video_ids.append(video_id)
    return video_ids


def pause_etsy_publication_requests():
    time.sleep(0.35)


def decode_data_url_payload(data_url: str) -> tuple[str, bytes]:
    raw_value = str(data_url or '').strip()
    match = re.match(r'^data:(?P<media_type>[\w.+/-]+);base64,(?P<data>.+)$', raw_value, re.IGNORECASE)
    if not match:
        raise ValueError('Data URL image invalide')

    media_type = str(match.group('media_type') or '').strip().lower() or 'application/octet-stream'
    try:
        payload = base64.b64decode(match.group('data'), validate=True)
    except Exception as exc:
        raise ValueError('Base64 image invalide') from exc
    return media_type, payload


def fetch_publication_remote_media_payload(remote_url: str, expected_kind: str) -> tuple[str, bytes]:
    target_url = str(remote_url or '').strip()
    if not target_url.startswith('https://'):
        raise ValueError(f'URL {expected_kind} distante invalide')
    if not any(domain in target_url for domain in ('etsyimg.com', 'etsystatic.com', 'etsy.com')):
        raise ValueError(f'URL {expected_kind} distante non autorisee')

    request = urllib.request.Request(
        target_url,
        headers={'User-Agent': 'Mozilla/5.0 (compatible; EtsyPipeline/1.1)'},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        media_type = str(response.headers.get('Content-Type') or '').split(';')[0].strip().lower()
        expected_prefix = f'{expected_kind}/'
        if not media_type.startswith(expected_prefix):
            raise ValueError(f'Ressource distante non {expected_kind}: {media_type or "type inconnu"}')
        payload = response.read()
    return media_type, payload


def fetch_publication_image_payload(remote_url: str) -> tuple[str, bytes]:
    return fetch_publication_remote_media_payload(remote_url, 'image')


def fetch_publication_video_payload(remote_url: str) -> tuple[str, bytes]:
    return fetch_publication_remote_media_payload(remote_url, 'video')


def _flatten_taxonomy_nodes(nodes, parents: list[str] | None = None) -> list[dict]:
    parents = list(parents or [])
    flattened: list[dict] = []
    if not isinstance(nodes, list):
        return flattened

    for raw_node in nodes:
        if not isinstance(raw_node, dict):
            continue

        label = str(
            raw_node.get('name')
            or raw_node.get('display_name')
            or raw_node.get('category_name')
            or ''
        ).strip()
        taxonomy_id = str(raw_node.get('taxonomy_id') or raw_node.get('id') or '').strip()
        if not taxonomy_id:
            continue

        path_parts = [*parents, label] if label else [*parents]
        path_text = ' > '.join([part for part in path_parts if part])
        entry = {
            'taxonomy_id': taxonomy_id,
            'name': label or f'Taxonomy {taxonomy_id}',
            'path': path_parts,
            'path_text': path_text or (label or f'Taxonomy {taxonomy_id}'),
            'level': len(path_parts) - 1,
            'parent_taxonomy_id': str(raw_node.get('parent') or raw_node.get('parent_taxonomy_id') or '').strip(),
            'is_supplies_top_level': bool(raw_node.get('is_supplies_top_level')),
            'search_text': ' '.join([
                taxonomy_id,
                label,
                path_text,
            ]).strip().lower(),
        }
        flattened.append(entry)

        children = raw_node.get('children')
        if isinstance(children, list) and children:
            flattened.extend(_flatten_taxonomy_nodes(children, path_parts))

    return flattened


def get_cached_seller_taxonomy_entries(*, force_refresh: bool = False) -> list[dict]:
    cache = ETSY_TAXONOMY_CACHE['seller']
    now_ts = time.time()
    if (
        not force_refresh
        and cache['entries']
        and (now_ts - float(cache['fetched_at'] or 0.0)) < ETSY_TAXONOMY_CACHE_TTL_SECONDS
    ):
        return cache['entries']

    payload = perform_etsy_get_request('seller-taxonomy/nodes', include_oauth=False)
    nodes = payload.get('results') if isinstance(payload, dict) else payload
    entries = _flatten_taxonomy_nodes(nodes if isinstance(nodes, list) else [])
    entries.sort(key=lambda item: (item['level'], item['path_text'].lower(), item['taxonomy_id']))

    cache['fetched_at'] = now_ts
    cache['payload'] = payload
    cache['entries'] = entries
    cache['by_id'] = {entry['taxonomy_id']: entry for entry in entries}
    return entries


def search_seller_taxonomy_entries(query: str, *, limit: int = 20) -> list[dict]:
    needle = str(query or '').strip().lower()
    entries = get_cached_seller_taxonomy_entries()
    if not needle:
        return entries[:limit]

    exact_name = []
    prefix_name = []
    contains_name = []
    contains_path = []
    for entry in entries:
        name = str(entry.get('name') or '').lower()
        path_text = str(entry.get('path_text') or '').lower()
        if name == needle:
            exact_name.append(entry)
        elif name.startswith(needle):
            prefix_name.append(entry)
        elif needle in name:
            contains_name.append(entry)
        elif needle in path_text:
            contains_path.append(entry)

    ranked = [*exact_name, *prefix_name, *contains_name, *contains_path]
    seen = set()
    results = []
    for entry in ranked:
        taxonomy_id = entry['taxonomy_id']
        if taxonomy_id in seen:
            continue
        seen.add(taxonomy_id)
        results.append(entry)
        if len(results) >= limit:
            break
    return results


def get_seller_taxonomy_properties(taxonomy_id: str) -> list[dict]:
    normalized = str(taxonomy_id or '').strip()
    if not normalized:
        return []

    payload = perform_etsy_get_request(f'seller-taxonomy/nodes/{normalized}/properties', include_oauth=False)
    results = []
    if isinstance(payload, dict):
        raw_results = payload.get('results')
        if isinstance(raw_results, list):
            results = raw_results
    elif isinstance(payload, list):
        results = payload
    return [entry for entry in results if isinstance(entry, dict)]


def find_taxonomy_property_by_names(properties: list[dict], names: list[str]) -> dict | None:
    normalized_names = [str(name or '').strip().lower() for name in names if str(name or '').strip()]
    for entry in properties:
        haystack = ' '.join([
            str(entry.get('name') or '').strip().lower(),
            str(entry.get('display_name') or '').strip().lower(),
        ]).strip()
        if any(name in haystack for name in normalized_names):
            return entry
    return None


def find_taxonomy_property_value(property_entry: dict, aliases: list[str]) -> dict | None:
    normalized_aliases = [str(alias or '').strip().lower() for alias in aliases if str(alias or '').strip()]
    for entry in property_entry.get('possible_values') or []:
        if not isinstance(entry, dict):
            continue
        haystack = str(entry.get('name') or '').strip().lower()
        if haystack in normalized_aliases or any(alias in haystack for alias in normalized_aliases):
            return entry
    return None


def resolve_occasion_taxonomy_assignment(taxonomy_id: str, occasion_value: str) -> dict | None:
    normalized_occasion = str(occasion_value or '').strip().lower()
    if not taxonomy_id or not normalized_occasion:
        return None

    properties = get_seller_taxonomy_properties(taxonomy_id)
    if not properties:
        return None

    holiday_property = find_taxonomy_property_by_names(properties, ['holiday', 'occasion', 'recipient'])
    if not holiday_property:
        return None

    alias_map = {
        'christmas': ['christmas', 'noel', 'noël', 'xmas'],
        'halloween': ['halloween'],
        'birthday': ['birthday', 'anniversaire'],
    }
    selected_value = find_taxonomy_property_value(holiday_property, alias_map.get(normalized_occasion, [normalized_occasion]))
    if not selected_value:
        return None

    assignment = {
        'property_id': int(holiday_property.get('property_id') or 0) or 0,
        'property_name': str(holiday_property.get('display_name') or holiday_property.get('name') or '').strip(),
        'value_id': int(selected_value.get('value_id') or 0) or 0,
        'value_name': str(selected_value.get('name') or '').strip(),
    }
    scale_id = int(selected_value.get('scale_id') or 0) or int(holiday_property.get('scale_id') or 0) or 0
    if scale_id:
        assignment['scale_id'] = scale_id
    return assignment if assignment['property_id'] and assignment['value_id'] else None


def build_listing_property_payload(property_entry: dict) -> dict:
    payload = {}
    value_ids = [
        int(value) for value in (property_entry.get('value_ids') or [])
        if str(value).strip().isdigit()
    ]
    values = [
        str(value or '').strip()
        for value in (property_entry.get('values') or [])
        if str(value or '').strip()
    ]
    scale_id = int(property_entry.get('scale_id') or 0) or 0

    if value_ids:
        payload['value_ids'] = value_ids
    if values:
        payload['values'] = values
    if scale_id:
        payload['scale_id'] = scale_id
    return payload


def get_seller_taxonomy_entry_by_id(taxonomy_id: str) -> dict:
    normalized = str(taxonomy_id or '').strip()
    if not normalized:
        return {}

    entries = get_cached_seller_taxonomy_entries()
    cache = ETSY_TAXONOMY_CACHE['seller']
    by_id = cache.get('by_id') if isinstance(cache, dict) else {}
    if isinstance(by_id, dict) and normalized in by_id:
        return by_id[normalized]

    for entry in entries:
        if entry.get('taxonomy_id') == normalized:
            return entry
    return {}


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
    cert_path = resolve_local_https_cert_path()
    key_path = resolve_local_https_key_path()

    if not cert_path or not cert_path.exists():
        raise FileNotFoundError(f'Certificat HTTPS introuvable : {cert_path}')
    if not key_path or not key_path.exists():
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


def build_multipart_form_body(
    boundary: str,
    fields: dict[str, object] | None = None,
    *,
    file_field_name: str | None = None,
    filename: str | None = None,
    media_type: str | None = None,
    payload: bytes | None = None,
) -> bytes:
    body_parts: list[bytes] = []

    for key, value in (fields or {}).items():
        normalized_value = str(value or '').strip()
        if not normalized_value:
            continue
        body_parts.extend([
            f"--{boundary}\r\n".encode('utf-8'),
            f"Content-Disposition: form-data; name=\"{key}\"\r\n\r\n".encode('utf-8'),
            normalized_value.encode('utf-8'),
            b"\r\n",
        ])

    if file_field_name and filename and media_type and payload is not None:
        body_parts.extend([
            f"--{boundary}\r\n".encode('utf-8'),
            f"Content-Disposition: form-data; name=\"{file_field_name}\"; filename=\"{filename}\"\r\n".encode('utf-8'),
            f"Content-Type: {media_type}\r\n\r\n".encode('utf-8'),
            payload,
            b"\r\n",
        ])

    body_parts.append(f"--{boundary}--\r\n".encode('utf-8'))
    return b''.join(body_parts)


def perform_etsy_post_multipart_request(
    path: str,
    *,
    include_oauth: bool,
    fields: dict[str, object] | None = None,
    file_field_name: str | None = None,
    filename: str | None = None,
    media_type: str | None = None,
    payload: bytes | None = None,
) -> dict:
    url = f'{ETSY_API_BASE_URL}/application/{path.lstrip("/")}'
    boundary = f"----EtsyPipeline{uuid.uuid4().hex}"
    body = build_multipart_form_body(
        boundary,
        fields or {},
        file_field_name=file_field_name,
        filename=filename,
        media_type=media_type,
        payload=payload,
    )
    req = urllib.request.Request(
        url,
        data=body,
        method='POST',
        headers={
            **build_etsy_request_headers(include_oauth=include_oauth),
            'Content-Type': f'multipart/form-data; boundary={boundary}',
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return decode_json_bytes(resp.read())


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

    def send_binary_file(self, path: Path, content_type: str):
        body = path.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', content_type)
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

        if path == '/etsy/test/shipping-profiles':
            try:
                shop_context = get_etsy_shop_context()
                shop_id = shop_context['shop_id']
                payload = perform_etsy_get_request(
                    f'shops/{shop_id}/shipping-profiles',
                    include_oauth=True,
                )
                self.send_json(200, {
                    'ok': True,
                    'endpoint': f'shops/{shop_id}/shipping-profiles',
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

        if path == '/etsy/test/readiness-states':
            try:
                shop_context = get_etsy_shop_context()
                shop_id = shop_context['shop_id']
                payload = perform_etsy_get_request(
                    f'shops/{shop_id}/readiness-state-definitions',
                    include_oauth=True,
                )
                self.send_json(200, {
                    'ok': True,
                    'endpoint': f'shops/{shop_id}/readiness-state-definitions',
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

        if path == '/etsy/test/seller-taxonomy/search':
            try:
                query = str(query_params.get('q', [''])[0] or '').strip()
                taxonomy_id = str(query_params.get('taxonomy_id', [''])[0] or '').strip()
                limit_raw = str(query_params.get('limit', ['20'])[0] or '20').strip()
                force_refresh = str(query_params.get('refresh', [''])[0] or '').strip().lower() in {'1', 'true', 'yes'}
                try:
                    limit = max(1, min(int(limit_raw or '20'), 50))
                except Exception:
                    limit = 20

                if force_refresh:
                    get_cached_seller_taxonomy_entries(force_refresh=True)

                if taxonomy_id:
                    entry = get_seller_taxonomy_entry_by_id(taxonomy_id)
                    if not entry:
                        self.send_json(404, {'error': f'Taxonomy Etsy introuvable : {taxonomy_id}'})
                        return
                    self.send_json(200, {
                        'ok': True,
                        'endpoint': 'seller-taxonomy/search',
                        'payload': {
                            'query': query,
                            'taxonomy_id': taxonomy_id,
                            'limit': limit,
                            'results': [entry],
                        },
                    })
                    return

                results = search_seller_taxonomy_entries(query, limit=limit)
                self.send_json(200, {
                    'ok': True,
                    'endpoint': 'seller-taxonomy/search',
                    'payload': {
                        'query': query,
                        'limit': limit,
                        'results': results,
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
                browser = str(query_params.get('browser', [''])[0] or '').strip().lower()
                launched = None
                if browser == 'opera':
                    launched = open_url_in_opera(auth_url)
                self.send_json(200, {
                    'ok': True,
                    'authUrl': auth_url,
                    'browser': browser or 'default',
                    'launched': launched,
                })
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
                persist_etsy_token_payload(
                    token_payload,
                    fallback_scopes=list(ETSY_OAUTH_SCOPES),
                )
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

        if path.startswith('/etsy/media-cache/'):
            filename = path.removeprefix('/etsy/media-cache/').strip()
            if not filename or '/' in filename or '\\' in filename:
                self.send_json(400, {'error': 'Nom de fichier cache invalide'})
                return

            target = (ETSY_MEDIA_CACHE_DIR / filename).resolve()
            try:
                target.relative_to(ETSY_MEDIA_CACHE_DIR.resolve())
            except ValueError:
                self.send_json(403, {'error': 'Chemin cache non autorise'})
                return

            if not target.exists() or not target.is_file():
                self.send_json(404, {'error': 'Media cache introuvable'})
                return

            ext = target.suffix.lower()
            content_type = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp',
                '.gif': 'image/gif',
            }.get(ext, 'application/octet-stream')
            self.send_binary_file(target, content_type)
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

        if path == '/etsy/media-cache/prepare':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            try:
                data = json.loads(body or '{}')
                target_url = str(data.get('url') or '').strip()
                if not target_url:
                    self.send_json(400, {'error': 'URL image manquante'})
                    return

                filename = cache_etsy_media_url(target_url)
                self.send_json(200, {
                    'ok': True,
                    'originalUrl': target_url,
                    'cachedUrl': f'/etsy/media-cache/{filename}',
                })
            except ValueError as e:
                self.send_json(400, {'error': str(e)})
            except urllib.error.HTTPError as e:
                self.send_json(e.code, {'error': f'Lecture media Etsy impossible: {e.reason}'})
            except urllib.error.URLError as e:
                self.send_json(502, {'error': f'Lecture media Etsy impossible: {e.reason}'})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
            return

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

        if path == '/etsy/test/listing/draft':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            try:
                data = json.loads(body or '{}')
                if isinstance(data.get('payload'), dict):
                    listing_payload = data.get('payload') or {}
                    update_payload = data.get('updatePayload') or {}
                    inventory_payload = data.get('inventory') or {}
                    images_payload = data.get('images') or []
                    videos_payload = data.get('videos') or []
                    media_plan_payload = data.get('mediaPlan') or {}
                    attributes_payload = data.get('attributes') or {}
                else:
                    listing_payload = data.get('createPayload') or {}
                    update_payload = data.get('updatePayload') or {}
                    inventory_payload = data.get('inventory') or {}
                    images_payload = data.get('images') or []
                    videos_payload = data.get('videos') or []
                    media_plan_payload = data.get('mediaPlan') or {}
                    attributes_payload = data.get('attributes') or {}

                if not isinstance(listing_payload, dict):
                    self.send_json(400, {'error': 'Payload draft Etsy invalide'})
                    return
                if update_payload and not isinstance(update_payload, dict):
                    self.send_json(400, {'error': 'Payload update Etsy invalide'})
                    return
                if inventory_payload and not isinstance(inventory_payload, dict):
                    self.send_json(400, {'error': 'Payload inventory Etsy invalide'})
                    return
                if images_payload and not isinstance(images_payload, list):
                    self.send_json(400, {'error': 'Payload images Etsy invalide'})
                    return
                if videos_payload and not isinstance(videos_payload, list):
                    self.send_json(400, {'error': 'Payload videos Etsy invalide'})
                    return
                if media_plan_payload and not isinstance(media_plan_payload, dict):
                    self.send_json(400, {'error': 'Payload mediaPlan Etsy invalide'})
                    return
                if attributes_payload and not isinstance(attributes_payload, dict):
                    self.send_json(400, {'error': 'Payload attributs Etsy invalide'})
                    return

                publication_mode = str(data.get('mode') or 'create_draft').strip().lower() or 'create_draft'
                target_listing_id = str(
                    data.get('targetListingId')
                    or listing_payload.get('listing_id')
                    or update_payload.get('listing_id')
                    or ''
                ).strip()

                require_etsy_scope('listings_w')
                shop_context = get_etsy_shop_context()
                shop_id = shop_context['shop_id']

                if publication_mode == 'update_listing':
                    if not target_listing_id:
                        self.send_json(400, {'error': 'listing_id cible manquant pour la mise a jour Etsy'})
                        return

                    base_listing_payload = {
                        key: value
                        for key, value in listing_payload.items()
                        if key in {'title', 'description'}
                    }
                    normalized_update_listing_payload = {
                        **base_listing_payload,
                        **{
                            key: value
                            for key, value in (update_payload or {}).items()
                            if key in {'tags'}
                        },
                    }

                    current_listing_response = perform_etsy_get_request(
                        f'shops/{shop_id}/listings/{target_listing_id}?includes=Images,Videos',
                        include_oauth=True,
                    )
                    current_listing_data = current_listing_response.get('results', [{}])[0] if isinstance(current_listing_response.get('results'), list) and current_listing_response.get('results') else current_listing_response.get('data', current_listing_response)
                    current_listing_state = str(current_listing_data.get('state') or '').strip().lower()
                    if current_listing_state and current_listing_state != 'active':
                        normalized_update_listing_payload['state'] = 'active'

                    operations = [{
                        'step': 'load_target_listing',
                        'listing_id': target_listing_id,
                        'source_state': current_listing_state,
                    }]

                    if media_plan_payload:
                        operations.append({
                            'step': 'prepare_listing_media',
                            'source_image_count': int(media_plan_payload.get('sourceImageCount') or 0),
                            'source_video_count': int(media_plan_payload.get('sourceVideoCount') or 0),
                            'local_image_count': int(media_plan_payload.get('localImageCount') or 0),
                            'ordered_media_count': int(media_plan_payload.get('orderedMediaCount') or 0),
                            'planned_image_count': int(media_plan_payload.get('plannedImageCount') or 0),
                            'planned_video_count': int(media_plan_payload.get('plannedVideoCount') or 0),
                            'skipped_video_count': int(media_plan_payload.get('skippedVideoCount') or 0),
                        })

                    if normalized_update_listing_payload:
                        pause_etsy_publication_requests()
                        update_response = perform_etsy_patch_form_request(
                            f'shops/{shop_id}/listings/{target_listing_id}',
                            normalized_update_listing_payload,
                            include_oauth=True,
                        )
                        operations.append({
                            'step': 'update_listing',
                            'endpoint': f'shops/{shop_id}/listings/{target_listing_id}',
                            'payload_sent': normalized_update_listing_payload,
                            'response': update_response,
                        })

                    if images_payload:
                        deleted_image_ids = []
                        for image_id in extract_etsy_listing_image_ids(current_listing_response):
                            pause_etsy_publication_requests()
                            delete_response = perform_etsy_delete_request(
                                f'shop/{shop_id}/listings/{target_listing_id}/images/{image_id}',
                                include_oauth=True,
                            )
                            deleted_image_ids.append({
                                'listing_image_id': image_id,
                                'response': delete_response,
                            })
                        operations.append({
                            'step': 'delete_listing_images',
                            'endpoint': f'shop/{shop_id}/listings/{target_listing_id}/images/{{listing_image_id}}',
                            'deleted_count': len(deleted_image_ids),
                            'images': deleted_image_ids,
                        })

                    if videos_payload:
                        deleted_video_ids = []
                        for video_id in extract_etsy_listing_video_ids(current_listing_response):
                            pause_etsy_publication_requests()
                            delete_response = perform_etsy_delete_request(
                                f'shops/{shop_id}/listings/{target_listing_id}/videos/{video_id}',
                                include_oauth=True,
                            )
                            deleted_video_ids.append({
                                'listing_video_id': video_id,
                                'response': delete_response,
                            })
                        operations.append({
                            'step': 'delete_listing_videos',
                            'endpoint': f'shops/{shop_id}/listings/{target_listing_id}/videos/{{listing_video_id}}',
                            'deleted_count': len(deleted_video_ids),
                            'videos': deleted_video_ids,
                        })

                    uploaded_images = []
                    for image_index, image_entry in enumerate(images_payload):
                        if not isinstance(image_entry, dict):
                            continue

                        mode = str(image_entry.get('mode') or '').strip().lower()
                        if mode == 'upload':
                            media_type, image_bytes = decode_data_url_payload(str(image_entry.get('data_url') or ''))
                        elif mode == 'upload_remote':
                            media_type, image_bytes = fetch_publication_image_payload(str(image_entry.get('remote_url') or ''))
                        else:
                            continue

                        filename_hint = guess_filename(str(image_entry.get('filename') or f'etsy-image-{image_index + 1}'), media_type)
                        image_fields = {
                            'rank': int(image_entry.get('order') or image_index + 1),
                            'alt_text': str(image_entry.get('alt_text') or '').strip(),
                        }
                        pause_etsy_publication_requests()
                        image_response = perform_etsy_post_multipart_request(
                            f'shops/{shop_id}/listings/{target_listing_id}/images',
                            include_oauth=True,
                            fields=image_fields,
                            file_field_name='image',
                            filename=filename_hint,
                            media_type=media_type,
                            payload=image_bytes,
                        )
                        uploaded_images.append({
                            'index': image_index + 1,
                            'mode': mode,
                            'fields_sent': image_fields,
                            'response': image_response,
                        })

                    if uploaded_images:
                        operations.append({
                            'step': 'upload_listing_images',
                            'endpoint': f'shops/{shop_id}/listings/{target_listing_id}/images',
                            'requested_count': len(images_payload),
                            'uploaded_count': len(uploaded_images),
                            'images': uploaded_images,
                        })

                    uploaded_videos = []
                    for video_index, video_entry in enumerate(videos_payload):
                        if not isinstance(video_entry, dict):
                            continue
                        mode = str(video_entry.get('mode') or '').strip().lower()
                        if mode != 'upload_remote':
                            continue

                        media_type, video_bytes = fetch_publication_video_payload(str(video_entry.get('remote_url') or ''))
                        filename_hint = guess_filename(str(video_entry.get('filename') or f'etsy-video-{video_index + 1}'), media_type)
                        video_fields = {
                            'name': filename_hint,
                        }
                        pause_etsy_publication_requests()
                        video_response = perform_etsy_post_multipart_request(
                            f'shops/{shop_id}/listings/{target_listing_id}/videos',
                            include_oauth=True,
                            fields=video_fields,
                            file_field_name='video',
                            filename=filename_hint,
                            media_type=media_type,
                            payload=video_bytes,
                        )
                        uploaded_videos.append({
                            'index': video_index + 1,
                            'mode': mode,
                            'fields_sent': video_fields,
                            'response': video_response,
                        })

                    if uploaded_videos:
                        operations.append({
                            'step': 'upload_listing_videos',
                            'endpoint': f'shops/{shop_id}/listings/{target_listing_id}/videos',
                            'requested_count': len(videos_payload),
                            'uploaded_count': len(uploaded_videos),
                            'videos': uploaded_videos,
                        })

                    self.send_json(200, {
                        'ok': True,
                        'endpoint': f'shops/{shop_id}/listings/{target_listing_id}',
                        'mode': 'update_listing',
                        'listing_id': target_listing_id,
                        'payload_sent': normalized_update_listing_payload,
                        'payload': current_listing_response,
                        'operations': operations,
                    })
                    return

                create_payload = {
                    key: value
                    for key, value in listing_payload.items()
                    if key not in {'listing_id', 'state', 'inventory', 'images', 'videos'}
                }

                create_response = perform_etsy_post_form_request(
                    f'shops/{shop_id}/listings',
                    create_payload,
                    include_oauth=True,
                )
                created_listing_id = extract_etsy_listing_id(create_response)
                if not created_listing_id:
                    raise ValueError('Listing draft cree, mais listing_id introuvable dans la reponse Etsy')

                operations = [{
                    'step': 'create_draft_listing',
                    'endpoint': f'shops/{shop_id}/listings',
                    'listing_id': created_listing_id,
                    'payload_sent': create_payload,
                    'response': create_response,
                }]

                if media_plan_payload:
                    operations.append({
                        'step': 'prepare_listing_media',
                        'source_image_count': int(media_plan_payload.get('sourceImageCount') or 0),
                        'source_video_count': int(media_plan_payload.get('sourceVideoCount') or 0),
                        'local_image_count': int(media_plan_payload.get('localImageCount') or 0),
                        'ordered_media_count': int(media_plan_payload.get('orderedMediaCount') or 0),
                        'planned_image_count': int(media_plan_payload.get('plannedImageCount') or 0),
                        'planned_video_count': int(media_plan_payload.get('plannedVideoCount') or 0),
                        'skipped_video_count': int(media_plan_payload.get('skippedVideoCount') or 0),
                    })

                normalized_update_payload = {
                    key: value
                    for key, value in (update_payload or {}).items()
                    if key not in {'listing_id', 'state', 'inventory', 'images', 'videos'}
                }
                if normalized_update_payload:
                    pause_etsy_publication_requests()
                    update_response = perform_etsy_patch_form_request(
                        f'shops/{shop_id}/listings/{created_listing_id}',
                        normalized_update_payload,
                        include_oauth=True,
                    )
                    operations.append({
                        'step': 'update_listing',
                        'endpoint': f'shops/{shop_id}/listings/{created_listing_id}',
                        'payload_sent': normalized_update_payload,
                        'response': update_response,
                    })

                inventory_products = inventory_payload.get('products') if isinstance(inventory_payload, dict) else None
                if isinstance(inventory_products, list) and inventory_products:
                    normalized_inventory_payload = {
                        'products': [],
                        'price_on_property': [
                            int(value) for value in (inventory_payload.get('price_on_property') or [])
                            if str(value).strip().isdigit()
                        ],
                        'sku_on_property': [
                            int(value) for value in (inventory_payload.get('sku_on_property') or [])
                            if str(value).strip().isdigit()
                        ],
                        'quantity_on_property': [
                            int(value) for value in (inventory_payload.get('quantity_on_property') or [])
                            if str(value).strip().isdigit()
                        ],
                        'readiness_state_on_property': [
                            int(value) for value in (inventory_payload.get('readiness_state_on_property') or [])
                            if str(value).strip().isdigit()
                        ],
                    }
                    fallback_readiness_state_id = int(create_payload.get('readiness_state_id') or 0) or None

                    for product in inventory_products:
                        if not isinstance(product, dict):
                            continue
                        offerings = []
                        for offering in (product.get('offerings') or []):
                            if not isinstance(offering, dict):
                                continue
                            normalized_offering = {
                                'price': float(offering.get('price') or 0),
                                'quantity': int(offering.get('quantity') or 0),
                                'is_enabled': bool(offering.get('is_enabled', True)),
                            }
                            readiness_state_id = int(offering.get('readiness_state_id') or fallback_readiness_state_id or 0) or 0
                            if readiness_state_id:
                                normalized_offering['readiness_state_id'] = readiness_state_id
                            offerings.append(normalized_offering)

                        property_values = []
                        for property_value in (product.get('property_values') or []):
                            if not isinstance(property_value, dict):
                                continue
                            normalized_property_value = {
                                'property_id': int(property_value.get('property_id') or 0),
                                'property_name': str(property_value.get('property_name') or '').strip(),
                                'values': [
                                    str(value or '').strip()
                                    for value in (property_value.get('values') or [])
                                    if str(value or '').strip()
                                ],
                            }
                            scale_id = int(property_value.get('scale_id') or 0) or 0
                            if scale_id:
                                normalized_property_value['scale_id'] = scale_id
                            value_ids = [
                                int(value) for value in (property_value.get('value_ids') or [])
                                if str(value).strip().isdigit()
                            ]
                            if value_ids:
                                normalized_property_value['value_ids'] = value_ids
                            if normalized_property_value['property_id'] or normalized_property_value['values']:
                                property_values.append(normalized_property_value)

                        if offerings:
                            normalized_inventory_payload['products'].append({
                                'sku': str(product.get('sku') or '').strip(),
                                'property_values': property_values,
                                'offerings': offerings,
                            })

                    if normalized_inventory_payload['products']:
                        pause_etsy_publication_requests()
                        inventory_response = perform_etsy_put_json_request(
                            f'listings/{created_listing_id}/inventory',
                            normalized_inventory_payload,
                            include_oauth=True,
                        )
                        operations.append({
                            'step': 'update_listing_inventory',
                            'endpoint': f'listings/{created_listing_id}/inventory',
                            'payload_sent': normalized_inventory_payload,
                            'response': inventory_response,
                        })

                uploaded_images = []
                for image_index, image_entry in enumerate(images_payload):
                    if not isinstance(image_entry, dict):
                        continue

                    mode = str(image_entry.get('mode') or '').strip().lower()
                    if mode == 'upload':
                        media_type, image_bytes = decode_data_url_payload(str(image_entry.get('data_url') or ''))
                    elif mode == 'upload_remote':
                        media_type, image_bytes = fetch_publication_image_payload(str(image_entry.get('remote_url') or ''))
                    else:
                        continue

                    filename_hint = guess_filename(str(image_entry.get('filename') or f'etsy-image-{image_index + 1}'), media_type)
                    image_fields = {
                        'rank': int(image_entry.get('order') or image_index + 1),
                        'alt_text': str(image_entry.get('alt_text') or '').strip(),
                    }
                    pause_etsy_publication_requests()
                    image_response = perform_etsy_post_multipart_request(
                        f'shops/{shop_id}/listings/{created_listing_id}/images',
                        include_oauth=True,
                        fields=image_fields,
                        file_field_name='image',
                        filename=filename_hint,
                        media_type=media_type,
                        payload=image_bytes,
                    )

                    uploaded_images.append({
                        'index': image_index + 1,
                        'mode': mode,
                        'fields_sent': image_fields,
                        'response': image_response,
                    })

                if uploaded_images:
                    operations.append({
                        'step': 'upload_listing_images',
                        'endpoint': f'shops/{shop_id}/listings/{created_listing_id}/images',
                        'requested_count': len(images_payload),
                        'uploaded_count': len(uploaded_images),
                        'images': uploaded_images,
                    })

                uploaded_videos = []
                for video_index, video_entry in enumerate(videos_payload):
                    if not isinstance(video_entry, dict):
                        continue

                    mode = str(video_entry.get('mode') or '').strip().lower()
                    if mode != 'upload_remote':
                        continue

                    media_type, video_bytes = fetch_publication_video_payload(str(video_entry.get('remote_url') or ''))
                    filename_hint = guess_filename(str(video_entry.get('filename') or f'etsy-video-{video_index + 1}'), media_type)
                    video_fields = {
                        'name': filename_hint,
                    }
                    pause_etsy_publication_requests()
                    video_response = perform_etsy_post_multipart_request(
                        f'shops/{shop_id}/listings/{created_listing_id}/videos',
                        include_oauth=True,
                        fields=video_fields,
                        file_field_name='video',
                        filename=filename_hint,
                        media_type=media_type,
                        payload=video_bytes,
                    )

                    uploaded_videos.append({
                        'index': video_index + 1,
                        'mode': mode,
                        'fields_sent': video_fields,
                        'response': video_response,
                    })

                if uploaded_videos:
                    operations.append({
                        'step': 'upload_listing_videos',
                        'endpoint': f'shops/{shop_id}/listings/{created_listing_id}/videos',
                        'requested_count': len(videos_payload),
                        'uploaded_count': len(uploaded_videos),
                        'videos': uploaded_videos,
                    })

                occasion_value = str(attributes_payload.get('occasion') or '').strip().lower()
                taxonomy_id = str(create_payload.get('taxonomy_id') or '').strip()
                dimension_properties = attributes_payload.get('dimension_properties') if isinstance(attributes_payload, dict) else None
                if isinstance(dimension_properties, list):
                    for property_entry in dimension_properties:
                        if not isinstance(property_entry, dict):
                            continue
                        property_id = int(property_entry.get('property_id') or 0) or 0
                        property_payload = build_listing_property_payload(property_entry)
                        if not property_id or not property_payload:
                            continue

                        try:
                            pause_etsy_publication_requests()
                            property_response = perform_etsy_put_form_request(
                                f'shops/{shop_id}/listings/{created_listing_id}/properties/{property_id}',
                                property_payload,
                                include_oauth=True,
                            )
                            operations.append({
                                'step': 'update_listing_property_dimension',
                                'endpoint': f'shops/{shop_id}/listings/{created_listing_id}/properties/{property_id}',
                                'payload_sent': property_payload,
                                'response': property_response,
                                'property_name': str(property_entry.get('property_name') or '').strip(),
                            })
                        except urllib.error.HTTPError as property_error:
                            try:
                                property_error_payload = decode_json_bytes(property_error.read())
                            except Exception:
                                property_error_payload = {'error': str(property_error)}
                            operations.append({
                                'step': 'update_listing_property_dimension',
                                'endpoint': f'shops/{shop_id}/listings/{created_listing_id}/properties/{property_id}',
                                'payload_sent': property_payload,
                                'status': 'failed',
                                'error_status': property_error.code,
                                'error_payload': property_error_payload,
                                'property_name': str(property_entry.get('property_name') or '').strip(),
                            })

                if taxonomy_id and occasion_value:
                    assignment = resolve_occasion_taxonomy_assignment(taxonomy_id, occasion_value)
                    if assignment:
                        property_payload = {
                            'value_ids': [assignment['value_id']],
                            'values': [assignment['value_name']],
                        }
                        if assignment.get('scale_id'):
                            property_payload['scale_id'] = assignment['scale_id']

                        try:
                            pause_etsy_publication_requests()
                            property_response = perform_etsy_put_form_request(
                                f'shops/{shop_id}/listings/{created_listing_id}/properties/{assignment["property_id"]}',
                                property_payload,
                                include_oauth=True,
                            )
                            operations.append({
                                'step': 'update_listing_property_occasion',
                                'endpoint': f'shops/{shop_id}/listings/{created_listing_id}/properties/{assignment["property_id"]}',
                                'payload_sent': property_payload,
                                'response': property_response,
                                'resolved_property': assignment,
                            })
                        except urllib.error.HTTPError as property_error:
                            try:
                                property_error_payload = decode_json_bytes(property_error.read())
                            except Exception:
                                property_error_payload = {'error': str(property_error)}
                            operations.append({
                                'step': 'update_listing_property_occasion',
                                'endpoint': f'shops/{shop_id}/listings/{created_listing_id}/properties/{assignment["property_id"]}',
                                'payload_sent': property_payload,
                                'status': 'failed',
                                'error_status': property_error.code,
                                'error_payload': property_error_payload,
                                'resolved_property': assignment,
                            })
                    else:
                        operations.append({
                            'step': 'update_listing_property_occasion',
                            'status': 'skipped',
                            'reason': f'Property/value introuvable pour occasion={occasion_value} taxonomy_id={taxonomy_id}',
                        })

                self.send_json(200, {
                    'ok': True,
                    'endpoint': f'shops/{shop_id}/listings',
                    'mode': 'create_draft_listing_copy',
                    'listing_id': created_listing_id,
                    'payload_sent': create_payload,
                    'payload': create_response,
                    'operations': operations,
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

        if path == '/etsy/test/listing/translation':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            try:
                data = json.loads(body or '{}')
                listing_id = str(data.get('listingId') or data.get('listing_id') or '').strip()
                language = str(data.get('language') or '').strip().lower()
                title = str(data.get('title') or '').strip()
                description = str(data.get('description') or '')
                tags = data.get('tags') or []
                if isinstance(tags, str):
                    tags = [part.strip() for part in tags.split(',') if part.strip()]
                if not isinstance(tags, list):
                    self.send_json(400, {'error': 'Payload tags traduction Etsy invalide'})
                    return
                if not listing_id:
                    self.send_json(400, {'error': 'listing_id traduction Etsy manquant'})
                    return
                if language not in {'en', 'de', 'es', 'fr', 'it'}:
                    self.send_json(400, {'error': f'Langue traduction Etsy non supportee: {language or "vide"}'})
                    return
                if not title:
                    self.send_json(400, {'error': 'title traduction Etsy manquant'})
                    return
                if not description:
                    self.send_json(400, {'error': 'description traduction Etsy manquante'})
                    return
                if not tags:
                    self.send_json(400, {'error': 'tags traduction Etsy manquants'})
                    return

                require_etsy_scope('listings_w')
                shop_context = get_etsy_shop_context()
                shop_id = shop_context['shop_id']
                translation_path = f'shops/{shop_id}/listings/{listing_id}/translations/{language}'
                translation_payload = {
                    'title': title,
                    'description': description,
                    'tags': [str(tag or '').strip() for tag in tags if str(tag or '').strip()],
                }

                existing_translation = None
                translation_exists = False
                try:
                    existing_translation = perform_etsy_get_request(translation_path, include_oauth=True)
                    translation_exists = True
                except urllib.error.HTTPError as get_error:
                    if get_error.code != 404:
                        raise

                pause_etsy_publication_requests()
                if translation_exists:
                    response_payload = perform_etsy_put_form_request(
                        translation_path,
                        translation_payload,
                        include_oauth=True,
                    )
                    operation = 'update_listing_translation'
                    method = 'PUT'
                else:
                    response_payload = perform_etsy_post_form_request(
                        translation_path,
                        translation_payload,
                        include_oauth=True,
                    )
                    operation = 'create_listing_translation'
                    method = 'POST'

                self.send_json(200, {
                    'ok': True,
                    'endpoint': translation_path,
                    'listing_id': listing_id,
                    'language': language,
                    'operation': operation,
                    'method': method,
                    'translation_exists': translation_exists,
                    'payload_sent': translation_payload,
                    'existing_translation': existing_translation,
                    'payload': response_payload,
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
