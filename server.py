#!/usr/bin/env python3
"""
Serveur local — Etsy Pipeline DnD
Double-clic pour lancer. Ouvre http://localhost:8080 automatiquement.
Ctrl+C pour arrêter.
"""

import base64
import hashlib
import http.client
import http.server
import json
import os
import re
import shutil
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
from threading import Lock, Thread, Timer, local

from pinterest_service import PinterestAPIError, PinterestService

PORT = 8080
ROOT = Path(__file__).parent.resolve()
STATIC_ROOT = ROOT / 'src'
ENV_FILE = ROOT / '.env'
ALLOWED_DIRS = {'prompts', 'biblios'}
ALLOWED_SUBDIRS = {'tabletop', 'collection', 'traduction', 'doubleX', 'pinterest', 'instagram'}
LOCAL_HTTPS_FALLBACK_CERT_FILES = ('local-certs/localhost.crt', 'localhost.pem')
LOCAL_HTTPS_FALLBACK_KEY_FILES = ('local-certs/localhost.key', 'localhost-key.pem')
ANTHROPIC_FILES_CACHE = ROOT / '.anthropic_files_cache.json'
ANTHROPIC_FILES_BETA = 'files-api-2025-04-14'
ANTHROPIC_FILES_CACHE_LOCK = Lock()
SOLO_EXPORT_ROOT = 'export'
ETSY_API_BASE_URL = 'https://api.etsy.com/v3'
ETSY_OAUTH_CONNECT_URL = 'https://www.etsy.com/oauth/connect'
ETSY_OAUTH_TOKEN_URL = f'{ETSY_API_BASE_URL}/public/oauth/token'
ETSY_OAUTH_SCOPES = ('shops_r', 'listings_r', 'listings_w', 'transactions_r')
INSTAGRAM_GRAPH_API_BASE_URL = 'https://graph.instagram.com'
INSTAGRAM_GRAPH_API_DEFAULT_VERSION = 'v22.0'
FACEBOOK_GRAPH_API_BASE_URL = 'https://graph.facebook.com'
FACEBOOK_GRAPH_API_DEFAULT_VERSION = 'v26.0'
THREADS_GRAPH_API_BASE_URL = 'https://graph.threads.net'
THREADS_GRAPH_API_DEFAULT_VERSION = 'v1.0'
TIKTOK_API_BASE_URL = 'https://open.tiktokapis.com'
TIKTOK_AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/'
TIKTOK_OAUTH_TOKEN_URL = f'{TIKTOK_API_BASE_URL}/v2/oauth/token/'
TIKTOK_OAUTH_SCOPES = ('user.info.basic', 'video.publish')
INSTAGRAM_MEDIA_CACHE_DIR = ROOT / '.instagram_media_cache'
INSTAGRAM_MEDIA_LOCAL_PORT = 8766
INSTAGRAM_MEDIA_MAX_BYTES = 10 * 1024 * 1024
INSTAGRAM_VIDEO_MAX_BYTES = 1024 * 1024 * 1024
INSTAGRAM_MEDIA_PUBLIC_BASE = ''
INSTAGRAM_MEDIA_TUNNEL_PROCESS = None
INSTAGRAM_MEDIA_TUNNEL_LOG = None
INSTAGRAM_MEDIA_TUNNEL_LOCK = Lock()
OPERA_BROWSER_PATH = Path(r'C:\Users\raficraft\AppData\Local\Programs\Opera\opera.exe')
ETSY_OAUTH_PENDING_FILE = ROOT / '.etsy_oauth_pending.json'
ETSY_OAUTH_TOKEN_FILE = ROOT / '.etsy_oauth_tokens.json'
ETSY_OAUTH_CALLBACK_ROUTE = '/etsy/oauth/callback'
LOCAL_HTTPS_DEFAULT_PORT = 8443
ETSY_OAUTH_EXPIRY_SKEW_SECONDS = 60
TIKTOK_OAUTH_PENDING_FILE = ROOT / '.tiktok_oauth_pending.json'
TIKTOK_OAUTH_TOKEN_FILE = ROOT / '.tiktok_oauth_tokens.json'
TIKTOK_OAUTH_CALLBACK_ROUTE = '/tiktok/oauth/callback'
TIKTOK_OAUTH_EXPIRY_SKEW_SECONDS = 120
TIKTOK_UPLOAD_CHUNK_BYTES = 10_000_000
TIKTOK_MAX_SINGLE_CHUNK_BYTES = 64_000_000
TIKTOK_VIDEO_MAX_BYTES = 4 * 1024 * 1024 * 1024
TIKTOK_TOKEN_LOCK = Lock()
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

ETSY_SHOP_KEYS = ('grosgeek', 'doublex')
REQUEST_CONTEXT = local()
PINTEREST_SERVICE = None


def get_pinterest_service() -> PinterestService:
    if PINTEREST_SERVICE is None:
        raise RuntimeError('Le service Pinterest n’est pas encore démarré')
    return PINTEREST_SERVICE


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


def get_tiktok_client_key() -> str:
    return get_env_value('TIKTOK_CLIENT_KEY')


def get_tiktok_client_secret() -> str:
    return get_env_value('TIKTOK_CLIENT_SECRET')


def get_tiktok_redirect_uri() -> str:
    return get_env_value('TIKTOK_REDIRECT_URI') or 'https://127.0.0.1:8443/tiktok/oauth/callback'


def build_tiktok_pkce_challenge(verifier: str) -> str:
    # TikTok Desktop demande explicitement le SHA-256 encodé en hexadécimal.
    return hashlib.sha256(verifier.encode('ascii')).hexdigest()


def build_tiktok_auth_status() -> dict:
    token_data = load_json_file(TIKTOK_OAUTH_TOKEN_FILE, {})
    pending_data = load_json_file(TIKTOK_OAUTH_PENDING_FILE, {})
    missing_config = []
    if not get_tiktok_client_key():
        missing_config.append('TIKTOK_CLIENT_KEY')
    if not get_tiktok_client_secret():
        missing_config.append('TIKTOK_CLIENT_SECRET')
    redirect_uri = get_tiktok_redirect_uri()
    if not re.fullmatch(r'https?://(?:localhost|127\.0\.0\.1):\d+/[^?#]+', redirect_uri):
        missing_config.append('TIKTOK_REDIRECT_URI (loopback avec port requis)')

    return {
        'configured': not missing_config,
        'connected': bool(token_data.get('access_token') or token_data.get('refresh_token')),
        'pending': bool(pending_data.get('state')),
        'missingConfig': missing_config,
        'redirectUri': redirect_uri,
        'scopes': list(TIKTOK_OAUTH_SCOPES),
        'expiresAt': token_data.get('expires_at'),
        'refreshExpiresAt': token_data.get('refresh_expires_at'),
        'lastAuthAt': token_data.get('created_at'),
        'openId': token_data.get('open_id'),
    }


def build_tiktok_authorization_url() -> str:
    status = build_tiktok_auth_status()
    if not status['configured']:
        raise ValueError(f"Configuration TikTok incomplète : {', '.join(status['missingConfig'])}")

    state = uuid.uuid4().hex
    verifier = generate_pkce_verifier()
    redirect_uri = get_tiktok_redirect_uri()
    save_json_file(TIKTOK_OAUTH_PENDING_FILE, {
        'state': state,
        'code_verifier': verifier,
        'redirect_uri': redirect_uri,
        'created_at': datetime.now(timezone.utc).isoformat(),
    })
    query = urllib.parse.urlencode({
        'client_key': get_tiktok_client_key(),
        'response_type': 'code',
        'scope': ','.join(TIKTOK_OAUTH_SCOPES),
        'redirect_uri': redirect_uri,
        'state': state,
        'code_challenge': build_tiktok_pkce_challenge(verifier),
        'code_challenge_method': 'S256',
    })
    return f'{TIKTOK_AUTHORIZE_URL}?{query}'


def perform_tiktok_token_request(form_data: dict) -> dict:
    request = urllib.request.Request(
        TIKTOK_OAUTH_TOKEN_URL,
        data=urllib.parse.urlencode(form_data).encode('utf-8'),
        method='POST',
        headers={
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cache-Control': 'no-cache',
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = decode_json_bytes(response.read())
    except urllib.error.HTTPError as error:
        try:
            payload = decode_json_bytes(error.read())
        except Exception:
            payload = {}
        message = str(payload.get('error_description') or payload.get('error') or f'TikTok OAuth HTTP {error.code}')
        raise ValueError(message) from error
    if payload.get('error'):
        raise ValueError(str(payload.get('error_description') or payload.get('error')))
    return payload


def persist_tiktok_token_payload(token_payload: dict):
    access_token = str(token_payload.get('access_token') or '').strip()
    refresh_token = str(token_payload.get('refresh_token') or '').strip()
    if not access_token or not refresh_token:
        raise ValueError('TikTok n’a pas retourné les jetons OAuth attendus')

    now = datetime.now(timezone.utc)
    expires_in = int(token_payload.get('expires_in') or 0)
    refresh_expires_in = int(token_payload.get('refresh_expires_in') or 0)
    payload = {
        'access_token': access_token,
        'refresh_token': refresh_token,
        'token_type': str(token_payload.get('token_type') or 'Bearer').strip(),
        'open_id': str(token_payload.get('open_id') or '').strip(),
        'scope': str(token_payload.get('scope') or '').strip(),
        'expires_in': expires_in,
        'refresh_expires_in': refresh_expires_in,
        'expires_at': datetime.fromtimestamp(now.timestamp() + expires_in, timezone.utc).isoformat(),
        'refresh_expires_at': datetime.fromtimestamp(
            now.timestamp() + refresh_expires_in,
            timezone.utc,
        ).isoformat(),
        'created_at': now.isoformat(),
    }
    save_json_file(TIKTOK_OAUTH_TOKEN_FILE, payload)
    if TIKTOK_OAUTH_PENDING_FILE.exists():
        TIKTOK_OAUTH_PENDING_FILE.unlink()


def exchange_tiktok_authorization_code(code: str, pending_payload: dict) -> dict:
    return perform_tiktok_token_request({
        'client_key': get_tiktok_client_key(),
        'client_secret': get_tiktok_client_secret(),
        'code': urllib.parse.unquote(str(code or '')),
        'grant_type': 'authorization_code',
        'redirect_uri': pending_payload['redirect_uri'],
        'code_verifier': pending_payload['code_verifier'],
    })


def refresh_tiktok_access_token(token_data: dict) -> dict:
    refresh_token = str(token_data.get('refresh_token') or '').strip()
    if not refresh_token:
        raise ValueError('Refresh token TikTok introuvable, reconnecte le compte')
    payload = perform_tiktok_token_request({
        'client_key': get_tiktok_client_key(),
        'client_secret': get_tiktok_client_secret(),
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token,
    })
    persist_tiktok_token_payload(payload)
    return load_json_file(TIKTOK_OAUTH_TOKEN_FILE, {})


def get_tiktok_valid_token_data() -> dict:
    with TIKTOK_TOKEN_LOCK:
        token_data = load_json_file(TIKTOK_OAUTH_TOKEN_FILE, {})
        expires_at = parse_iso_datetime(token_data.get('expires_at'))
        if token_data.get('access_token') and expires_at:
            deadline = expires_at.timestamp() - TIKTOK_OAUTH_EXPIRY_SKEW_SECONDS
            if datetime.now(timezone.utc).timestamp() < deadline:
                return token_data
        return refresh_tiktok_access_token(token_data)


def get_tiktok_access_token() -> str:
    return str(get_tiktok_valid_token_data().get('access_token') or '').strip()


def extract_tiktok_api_error(payload: dict, fallback: str) -> str:
    error = payload.get('error') if isinstance(payload, dict) else None
    if not isinstance(error, dict):
        return fallback
    code = str(error.get('code') or '').strip()
    message = str(error.get('message') or '').strip()
    log_id = str(error.get('log_id') or error.get('logid') or '').strip()
    if code and code != 'ok':
        details = message or code
        return f'{details} (code TikTok {code}' + (f', log {log_id}' if log_id else '') + ')'
    return fallback


def perform_tiktok_json_request(path: str, payload: dict | None = None) -> dict:
    token = get_tiktok_access_token()
    if not token:
        raise ValueError('Compte TikTok non connecté')
    request = urllib.request.Request(
        f'{TIKTOK_API_BASE_URL}/{path.lstrip("/")}',
        data=json.dumps(payload or {}, ensure_ascii=False).encode('utf-8'),
        method='POST',
        headers={
            'Authorization': f'Bearer {token}',
            'Accept': 'application/json',
            'Content-Type': 'application/json; charset=UTF-8',
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            response_payload = decode_json_bytes(response.read())
    except urllib.error.HTTPError as error:
        try:
            response_payload = decode_json_bytes(error.read())
        except Exception:
            response_payload = {}
        raise ValueError(extract_tiktok_api_error(response_payload, f'TikTok API HTTP {error.code}')) from error

    api_error = response_payload.get('error') if isinstance(response_payload, dict) else None
    if isinstance(api_error, dict) and str(api_error.get('code') or 'ok') != 'ok':
        raise ValueError(extract_tiktok_api_error(response_payload, 'TikTok API a refusé la requête'))
    return response_payload


def get_tiktok_profile() -> dict:
    token = get_tiktok_access_token()
    fields = 'open_id,union_id,avatar_url,display_name'
    request = urllib.request.Request(
        f'{TIKTOK_API_BASE_URL}/v2/user/info/?fields={urllib.parse.quote(fields, safe=",")}',
        method='GET',
        headers={'Authorization': f'Bearer {token}', 'Accept': 'application/json'},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = decode_json_bytes(response.read())
    except urllib.error.HTTPError as error:
        try:
            payload = decode_json_bytes(error.read())
        except Exception:
            payload = {}
        raise ValueError(extract_tiktok_api_error(payload, f'Profil TikTok HTTP {error.code}')) from error
    api_error = payload.get('error') if isinstance(payload, dict) else None
    if isinstance(api_error, dict) and str(api_error.get('code') or 'ok') != 'ok':
        raise ValueError(extract_tiktok_api_error(payload, 'Lecture du profil TikTok impossible'))
    data = payload.get('data') if isinstance(payload.get('data'), dict) else {}
    user = data.get('user') if isinstance(data.get('user'), dict) else {}
    return user


def get_tiktok_creator_info() -> dict:
    payload = perform_tiktok_json_request('/v2/post/publish/creator_info/query/')
    return payload.get('data') if isinstance(payload.get('data'), dict) else {}


def get_tiktok_publish_status(publish_id: str) -> dict:
    normalized_publish_id = str(publish_id or '').strip()
    if not normalized_publish_id:
        raise ValueError('Identifiant de publication TikTok manquant')
    payload = perform_tiktok_json_request('/v2/post/publish/status/fetch/', {
        'publish_id': normalized_publish_id,
    })
    return payload.get('data') if isinstance(payload.get('data'), dict) else {}


def get_tiktok_upload_plan(file_size: int) -> tuple[int, int]:
    if file_size <= 0:
        raise ValueError('La vidéo TikTok est vide')
    if file_size > TIKTOK_VIDEO_MAX_BYTES:
        raise ValueError('La vidéo TikTok dépasse la limite de 4 Go')
    # TikTok expects decimal byte counts for its 5 MB-64 MB chunk range.
    # With a single chunk, advertise the exact file size: TikTok rejects plans
    # where total_chunk_count=1 but chunk_size and video_size differ.
    if file_size <= TIKTOK_MAX_SINGLE_CHUNK_BYTES:
        return file_size, 1
    chunk_size = TIKTOK_UPLOAD_CHUNK_BYTES
    return chunk_size, max(1, file_size // chunk_size)


def is_allowed_tiktok_upload_url(upload_url: str) -> bool:
    parsed = urllib.parse.urlparse(str(upload_url or '').strip())
    hostname = str(parsed.hostname or '').lower().rstrip('.')
    return bool(
        parsed.scheme == 'https'
        and not parsed.username
        and not parsed.password
        and re.fullmatch(r'(?:open-upload|upload(?:\.[a-z0-9-]+)*)\.tiktokapis\.com', hostname)
    )


def upload_tiktok_video(upload_url: str, video_path: Path, chunk_size: int, total_chunk_count: int):
    if not is_allowed_tiktok_upload_url(upload_url):
        raise ValueError('TikTok a retourné une URL d’upload non autorisée')
    file_size = video_path.stat().st_size
    offset = 0
    with video_path.open('rb') as source:
        for chunk_index in range(total_chunk_count):
            is_last = chunk_index == total_chunk_count - 1
            bytes_to_read = file_size - offset if is_last else min(chunk_size, file_size - offset)
            chunk = source.read(bytes_to_read)
            if len(chunk) != bytes_to_read:
                raise ValueError('Lecture incomplète de la vidéo TikTok')
            last_byte = offset + len(chunk) - 1
            request = urllib.request.Request(
                upload_url,
                data=chunk,
                method='PUT',
                headers={
                    'Content-Type': {
                        '.mov': 'video/quicktime',
                        '.webm': 'video/webm',
                    }.get(video_path.suffix.lower(), 'video/mp4'),
                    'Content-Length': str(len(chunk)),
                    'Content-Range': f'bytes {offset}-{last_byte}/{file_size}',
                },
            )
            try:
                with urllib.request.urlopen(request, timeout=180) as response:
                    expected_status = 201 if is_last else 206
                    if response.status != expected_status:
                        raise ValueError(
                            f'Upload TikTok inattendu : HTTP {response.status}, attendu {expected_status}'
                        )
            except urllib.error.HTTPError as error:
                raise ValueError(f'Upload vidéo TikTok HTTP {error.code}') from error
            offset = last_byte + 1


def publish_tiktok_video(
    video_path: Path,
    *,
    title: str,
    privacy_level: str,
    disable_comment: bool,
    disable_duet: bool,
    disable_stitch: bool,
    brand_organic: bool,
    brand_content: bool,
    cover_timestamp_ms: int,
    duration_seconds: float,
) -> dict:
    creator = get_tiktok_creator_info()
    privacy_options = [str(value) for value in creator.get('privacy_level_options') or []]
    if privacy_level not in privacy_options:
        raise ValueError('Niveau de confidentialité TikTok non disponible pour ce compte')
    max_duration = int(creator.get('max_video_post_duration_sec') or 0)
    if max_duration and duration_seconds > max_duration:
        raise ValueError(f'La vidéo dépasse la limite TikTok de ce compte ({max_duration} s)')
    if brand_content and privacy_level == 'SELF_ONLY':
        raise ValueError('Le contenu de marque tierce ne peut pas être publié en mode privé')

    file_size = video_path.stat().st_size
    chunk_size, total_chunk_count = get_tiktok_upload_plan(file_size)
    print(
        f'[TikTok] Plan upload : video_size={file_size}, chunk_size={chunk_size}, '
        f'total_chunk_count={total_chunk_count}',
        flush=True,
    )
    init_payload = perform_tiktok_json_request('/v2/post/publish/video/init/', {
        'post_info': {
            'title': str(title or '')[:2200],
            'privacy_level': privacy_level,
            'disable_comment': bool(disable_comment or creator.get('comment_disabled')),
            'disable_duet': bool(disable_duet or creator.get('duet_disabled')),
            'disable_stitch': bool(disable_stitch or creator.get('stitch_disabled')),
            'video_cover_timestamp_ms': max(0, int(cover_timestamp_ms or 0)),
            'brand_content_toggle': bool(brand_content),
            'brand_organic_toggle': bool(brand_organic),
            'is_aigc': False,
        },
        'source_info': {
            'source': 'FILE_UPLOAD',
            'video_size': file_size,
            'chunk_size': chunk_size,
            'total_chunk_count': total_chunk_count,
        },
    })
    data = init_payload.get('data') if isinstance(init_payload.get('data'), dict) else {}
    publish_id = str(data.get('publish_id') or '').strip()
    upload_url = str(data.get('upload_url') or '').strip()
    if not publish_id or not upload_url:
        raise ValueError('TikTok n’a pas retourné les informations d’upload')
    upload_tiktok_video(upload_url, video_path, chunk_size, total_chunk_count)
    return {
        'publishId': publish_id,
        'creator': creator,
        'privacyLevel': privacy_level,
    }


def chunk_list(values, size: int):
    normalized_size = max(1, int(size or 1))
    for index in range(0, len(values), normalized_size):
        yield values[index:index + normalized_size]


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


def get_instagram_access_token() -> str:
    return get_env_value('INSTAGRAM_ACCESS_TOKEN')


def get_facebook_graph_api_version() -> str:
    raw = get_env_value('FACEBOOK_GRAPH_API_VERSION') or FACEBOOK_GRAPH_API_DEFAULT_VERSION
    normalized = raw.strip().lower()
    if not re.fullmatch(r'v\d+\.\d+', normalized):
        raise ValueError('Version Facebook Graph API invalide')
    return normalized


def get_facebook_page_id(shop_key: str = '') -> str:
    # Les deux boutiques Etsy publient sur l'unique Page Facebook Gros Geek.
    # shop_key décrit la source commerciale du contenu, pas une Page Facebook.
    return get_env_value('FACEBOOK_GROSGEEK_PAGE_ID') or get_env_value('FACEBOOK_PAGE_ID')


def get_facebook_page_access_token(shop_key: str = '') -> str:
    return (
        get_env_value('FACEBOOK_GROSGEEK_PAGE_ACCESS_TOKEN')
        or get_env_value('FACEBOOK_PAGE_ACCESS_TOKEN')
    )


def set_current_facebook_page_access_token(token: str = ''):
    REQUEST_CONTEXT.facebook_page_access_token = str(token or '').strip()


def get_current_facebook_page_access_token() -> str:
    return str(getattr(REQUEST_CONTEXT, 'facebook_page_access_token', '') or '').strip()


def build_facebook_graph_url(path: str) -> str:
    version = get_facebook_graph_api_version()
    return f'{FACEBOOK_GRAPH_API_BASE_URL}/{version}/{path.lstrip("/")}'


class FacebookAPIError(ValueError):
    def __init__(self, message: str, *, http_status: int = 0, endpoint: str = '', payload: dict | None = None):
        super().__init__(message)
        self.http_status = int(http_status or 0)
        self.endpoint = str(endpoint or '')
        self.payload = payload if isinstance(payload, dict) else {}

    def public_details(self) -> dict:
        error = self.payload.get('error') if isinstance(self.payload, dict) else None
        error = error if isinstance(error, dict) else {}
        details = {
            'httpStatus': self.http_status or None,
            'endpoint': self.endpoint,
            'type': str(error.get('type') or '').strip() or None,
            'code': error.get('code'),
            'subcode': error.get('error_subcode'),
            'fbtraceId': str(error.get('fbtrace_id') or '').strip() or None,
        }
        return {key: value for key, value in details.items() if value not in (None, '')}


def perform_facebook_request(
    path: str,
    method: str = 'GET',
    data: dict | None = None,
    *,
    shop_key: str = '',
    access_token: str = '',
) -> dict:
    token = (
        str(access_token or '').strip()
        or get_current_facebook_page_access_token()
        or get_facebook_page_access_token(shop_key)
    )
    if not token:
        normalized_shop_key = normalize_etsy_shop_key(shop_key or get_current_request_shop_key())
        raise ValueError(f'Token Facebook de Page absent pour la boutique {normalized_shop_key}')

    endpoint = path.split('?', 1)[0]
    encoded_data = urllib.parse.urlencode(data).encode('utf-8') if data is not None else None
    request = urllib.request.Request(
        build_facebook_graph_url(path),
        data=encoded_data,
        method=method,
        headers={
            'Authorization': f'Bearer {token}',
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return decode_json_bytes(response.read())
    except urllib.error.HTTPError as error:
        try:
            payload = decode_json_bytes(error.read())
        except Exception:
            payload = {}
        message = extract_instagram_error(payload, f'Facebook API HTTP {error.code}')
        raise FacebookAPIError(
            message,
            http_status=error.code,
            endpoint=endpoint,
            payload=payload,
        ) from error
    except urllib.error.URLError as error:
        raise FacebookAPIError(
            f'Connexion à Facebook impossible : {getattr(error, "reason", error)}',
            endpoint=endpoint,
        ) from error


def get_facebook_page_profile(shop_key: str = '') -> dict:
    normalized_shop_key = normalize_etsy_shop_key(shop_key or get_current_request_shop_key())
    configured_token = get_facebook_page_access_token(normalized_shop_key)
    if not configured_token:
        raise ValueError(f'Token Facebook absent pour la boutique {normalized_shop_key}')

    set_current_facebook_page_access_token('')
    derived_from_user_token = False
    try:
        payload = perform_facebook_request(
            'me?fields=id,name,category',
            shop_key=normalized_shop_key,
            access_token=configured_token,
        )
        page_token = configured_token
    except FacebookAPIError as error:
        error_message = str(error).lower()
        facebook_error = error.payload.get('error') if isinstance(error.payload, dict) else None
        facebook_error = facebook_error if isinstance(facebook_error, dict) else {}
        is_user_token = facebook_error.get('code') == 100 and 'category' in error_message
        if not is_user_token:
            raise

        accounts_payload = perform_facebook_request(
            'me/accounts?fields=id,name,access_token,tasks',
            shop_key=normalized_shop_key,
            access_token=configured_token,
        )
        pages = accounts_payload.get('data') if isinstance(accounts_payload.get('data'), list) else []
        if not pages:
            raise ValueError('Le token utilisateur Facebook ne donne accès à aucune Page gérée')

        configured_page_id = get_facebook_page_id(normalized_shop_key)
        selected_pages = [
            page for page in pages
            if configured_page_id and str(page.get('id') or '') == str(configured_page_id)
        ]
        if not selected_pages:
            expected_names = ('gros geek', 'grosgeek')
            selected_pages = [
                page for page in pages
                if any(expected in str(page.get('name') or '').lower() for expected in expected_names)
            ]
        if not selected_pages and len(pages) == 1:
            selected_pages = pages
        if len(selected_pages) != 1:
            available_pages = ', '.join(
                f'{str(page.get("name") or "Page sans nom")} ({str(page.get("id") or "ID inconnu")})'
                for page in pages
            )
            raise ValueError(
                'Impossible de choisir automatiquement la Page Facebook. '
                f'Pages disponibles : {available_pages}. Configure le PAGE_ID correspondant.'
            )

        selected_page = selected_pages[0]
        page_token = str(selected_page.get('access_token') or '').strip()
        if not page_token:
            raise ValueError('Facebook n’a pas retourné de Page Access Token pour la Page sélectionnée')
        payload = {
            'id': str(selected_page.get('id') or '').strip(),
            'name': str(selected_page.get('name') or '').strip(),
        }
        derived_from_user_token = True

    set_current_facebook_page_access_token(page_token)
    resolved_page_id = str(payload.get('id') or '').strip()
    if not resolved_page_id:
        raise ValueError('Facebook n’a pas retourné l’identifiant de la Page')
    return {
        'id': resolved_page_id,
        'name': str(payload.get('name') or '').strip(),
        'shopKey': normalized_shop_key,
        'derivedFromUserToken': derived_from_user_token,
    }


def upload_facebook_hosted_reel(upload_url: str, video_url: str, shop_key: str = '') -> dict:
    parsed_upload_url = urllib.parse.urlparse(str(upload_url or '').strip())
    if parsed_upload_url.scheme != 'https' or parsed_upload_url.hostname != 'rupload.facebook.com':
        raise ValueError('Facebook a retourné une URL d’upload Reel non autorisée')

    token = get_current_facebook_page_access_token() or get_facebook_page_access_token(shop_key)
    request = urllib.request.Request(
        upload_url,
        data=b'',
        method='POST',
        headers={
            'Authorization': f'OAuth {token}',
            'Accept': 'application/json',
            'file_url': video_url,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return decode_json_bytes(response.read())
    except urllib.error.HTTPError as error:
        try:
            payload = decode_json_bytes(error.read())
        except Exception:
            payload = {}
        message = extract_instagram_error(payload, f'Upload Reel Facebook HTTP {error.code}')
        raise FacebookAPIError(
            message,
            http_status=error.code,
            endpoint='rupload.facebook.com/video-upload',
            payload=payload,
        ) from error
    except urllib.error.URLError as error:
        raise FacebookAPIError(
            f'Upload du Reel Facebook impossible : {getattr(error, "reason", error)}',
            endpoint='rupload.facebook.com/video-upload',
        ) from error


def upload_facebook_local_reel(upload_url: str, video_path: Path, shop_key: str = '') -> dict:
    parsed_upload_url = urllib.parse.urlparse(str(upload_url or '').strip())
    if parsed_upload_url.scheme != 'https' or parsed_upload_url.hostname != 'rupload.facebook.com':
        raise ValueError('Facebook a retourné une URL d’upload Reel non autorisée')

    resolved_video_path = Path(video_path).resolve()
    if not resolved_video_path.is_file():
        raise ValueError('Le fichier vidéo à transférer vers Facebook est introuvable')
    file_size = resolved_video_path.stat().st_size
    if file_size <= 0:
        raise ValueError('Le fichier vidéo à transférer vers Facebook est vide')
    if file_size > INSTAGRAM_VIDEO_MAX_BYTES:
        raise ValueError('La vidéo à transférer vers Facebook dépasse la limite de 1 Go')

    token = get_current_facebook_page_access_token() or get_facebook_page_access_token(shop_key)
    request_path = parsed_upload_url.path or '/'
    if parsed_upload_url.query:
        request_path = f'{request_path}?{parsed_upload_url.query}'

    connection = http.client.HTTPSConnection('rupload.facebook.com', timeout=120)
    try:
        connection.putrequest('POST', request_path)
        connection.putheader('Authorization', f'OAuth {token}')
        connection.putheader('offset', '0')
        connection.putheader('file_size', str(file_size))
        connection.putheader('Content-Type', 'application/octet-stream')
        connection.putheader('Content-Length', str(file_size))
        connection.endheaders()
        with resolved_video_path.open('rb') as source:
            while True:
                chunk = source.read(1024 * 1024)
                if not chunk:
                    break
                connection.send(chunk)

        response = connection.getresponse()
        raw_payload = response.read()
        try:
            payload = decode_json_bytes(raw_payload)
        except Exception:
            payload = {}
        if response.status < 200 or response.status >= 300:
            message = extract_instagram_error(payload, f'Upload Reel Facebook HTTP {response.status}')
            raise FacebookAPIError(
                message,
                http_status=response.status,
                endpoint='rupload.facebook.com/video-upload',
                payload=payload,
            )
        return payload
    except FacebookAPIError:
        raise
    except OSError as error:
        raise FacebookAPIError(
            f'Upload du Reel Facebook impossible : {error}',
            endpoint='rupload.facebook.com/video-upload',
        ) from error
    finally:
        connection.close()


def download_instagram_reel(video_url: str) -> Path:
    parsed_video_url = urllib.parse.urlparse(str(video_url or '').strip())
    if parsed_video_url.scheme != 'https' or not parsed_video_url.hostname:
        raise ValueError('Instagram a retourné une URL vidéo non sécurisée')

    request = urllib.request.Request(
        video_url,
        method='GET',
        headers={'User-Agent': 'GrosGeekPublisher/1.0'},
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            content_type = str(response.headers.get_content_type() or '').lower()
            if content_type not in {'video/mp4', 'video/quicktime', 'application/octet-stream'}:
                raise ValueError(f'Instagram a retourné un type de vidéo inattendu : {content_type or "inconnu"}')
            raw_length = str(response.headers.get('Content-Length') or '').strip()
            if not raw_length.isdigit():
                raise ValueError('Instagram n’a pas indiqué la taille de la vidéo à récupérer')
            return resolve_instagram_media_path(
                store_instagram_video_stream(response, int(raw_length), content_type)
            )
    except urllib.error.HTTPError as error:
        raise ValueError(f'Téléchargement du Reel Instagram impossible : HTTP {error.code}') from error
    except urllib.error.URLError as error:
        raise ValueError(
            f'Téléchargement du Reel Instagram impossible : {getattr(error, "reason", error)}'
        ) from error


def get_threads_access_token() -> str:
    return get_env_value('THREADS_ACCESS_TOKEN')


def get_threads_graph_api_version() -> str:
    raw = get_env_value('THREADS_GRAPH_API_VERSION') or THREADS_GRAPH_API_DEFAULT_VERSION
    normalized = raw.strip().lower()
    if not re.fullmatch(r'v\d+\.\d+', normalized):
        raise ValueError('Version Threads Graph API invalide')
    return normalized


def build_threads_graph_url(path: str) -> str:
    version = get_threads_graph_api_version()
    return f'{THREADS_GRAPH_API_BASE_URL}/{version}/{path.lstrip("/")}'


class ThreadsAPIError(ValueError):
    def __init__(self, message: str, *, http_status: int = 0, endpoint: str = '', payload: dict | None = None):
        super().__init__(message)
        self.http_status = int(http_status or 0)
        self.endpoint = str(endpoint or '')
        self.payload = payload if isinstance(payload, dict) else {}

    def public_details(self) -> dict:
        error = self.payload.get('error') if isinstance(self.payload, dict) else None
        error = error if isinstance(error, dict) else {}
        details = {
            'httpStatus': self.http_status or None,
            'endpoint': self.endpoint,
            'type': str(error.get('type') or '').strip() or None,
            'code': error.get('code'),
            'subcode': error.get('error_subcode'),
            'fbtraceId': str(error.get('fbtrace_id') or '').strip() or None,
        }
        return {key: value for key, value in details.items() if value not in (None, '')}


def format_threads_api_error(error: ThreadsAPIError) -> str:
    details = error.public_details()
    extras = []
    if details.get('httpStatus'):
        extras.append(f"HTTP {details['httpStatus']}")
    if details.get('code') is not None:
        extras.append(f"code Meta {details['code']}")
    if details.get('subcode') is not None:
        extras.append(f"sous-code {details['subcode']}")
    if details.get('type'):
        extras.append(str(details['type']))
    if details.get('fbtraceId'):
        extras.append(f"trace {details['fbtraceId']}")
    suffix = f" ({', '.join(extras)})" if extras else ''
    return f'{str(error)}{suffix}'


def perform_threads_request(path: str, method: str = 'GET', data: dict | None = None) -> dict:
    token = get_threads_access_token()
    if not token:
        raise ValueError('THREADS_ACCESS_TOKEN absent du fichier .env')

    endpoint = path.split('?', 1)[0]
    encoded_data = urllib.parse.urlencode(data).encode('utf-8') if data is not None else None
    request = urllib.request.Request(
        build_threads_graph_url(path),
        data=encoded_data,
        method=method,
        headers={
            'Authorization': f'Bearer {token}',
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return decode_json_bytes(response.read())
    except urllib.error.HTTPError as error:
        try:
            payload = decode_json_bytes(error.read())
        except Exception:
            payload = {}
        message = extract_instagram_error(payload, f'Threads API HTTP {error.code}')
        api_error = ThreadsAPIError(
            message,
            http_status=error.code,
            endpoint=endpoint,
            payload=payload,
        )
        print(f'[Threads API] {method} {endpoint} -> {format_threads_api_error(api_error)}')
        raise api_error from error
    except urllib.error.URLError as error:
        message = f'Connexion à Threads impossible : {getattr(error, "reason", error)}'
        print(f'[Threads API] {method} {endpoint} -> {message}')
        raise ThreadsAPIError(message, endpoint=endpoint) from error


def get_threads_profile() -> dict:
    payload = perform_threads_request('me?fields=id,username')
    user_id = str(payload.get('id') or '').strip()
    if not user_id:
        raise ValueError('Identifiant du compte Threads introuvable')
    return {
        'id': user_id,
        'username': str(payload.get('username') or '').strip(),
    }



def wait_for_threads_container(container_id: str, attempts: int = 30, delay_seconds: float = 2.0):
    """Attendre qu'un conteneur Threads soit prêt avant sa publication."""
    last_status = ''
    last_detail = ''
    for attempt in range(attempts):
        try:
            payload = perform_threads_request(f'{container_id}?fields=status,error_message')
        except ValueError as error:
            # Juste après sa création, le conteneur peut ne pas être encore
            # lisible sur tous les nœuds de l'API Threads.
            last_detail = str(error)
            if attempt < attempts - 1 and 'requested resource does not exist' in last_detail.lower():
                time.sleep(delay_seconds)
                continue
            raise

        status = str(payload.get('status') or '').strip().upper()
        detail = str(payload.get('error_message') or '').strip()
        last_status = status
        last_detail = detail

        if status in {'FINISHED', 'PUBLISHED'}:
            return
        if status in {'ERROR', 'EXPIRED'}:
            raise ValueError(f'Conteneur Threads non publiable : {detail or status}')
        if attempt < attempts - 1:
            time.sleep(delay_seconds)

    suffix = f' ({last_status or last_detail})' if (last_status or last_detail) else ''
    raise ValueError(f'Le traitement du média Threads a dépassé le délai prévu{suffix}')


def publish_threads_container(profile_id: str, container_id: str, attempts: int = 8, delay_seconds: float = 2.0) -> dict:
    """Publier un conteneur Threads avec reprise sur propagation retardée."""
    last_error = ''
    for attempt in range(attempts):
        try:
            return perform_threads_request(
                f'{profile_id}/threads_publish',
                method='POST',
                data={'creation_id': container_id},
            )
        except ValueError as error:
            last_error = str(error)
            retriable = 'requested resource does not exist' in last_error.lower()
            if not retriable or attempt >= attempts - 1:
                raise
            time.sleep(delay_seconds)
    raise ValueError(last_error or 'Publication Threads impossible')


def create_threads_carousel_container(
    profile_id: str,
    child_container_ids: list[str],
    text: str,
    attempts: int = 5,
    delay_seconds: float = 2.0,
) -> dict:
    """Créer le parent après propagation des enfants, avec reprise ciblée Meta."""
    last_error = None
    for attempt in range(attempts):
        try:
            return perform_threads_request(
                f'{profile_id}/threads',
                method='POST',
                data={
                    'media_type': 'CAROUSEL',
                    'children': ','.join(child_container_ids),
                    'text': text,
                },
            )
        except ThreadsAPIError as error:
            last_error = error
            details = error.public_details()
            propagation_error = (
                details.get('code') == 100
                and details.get('subcode') == 4279004
            )
            if not propagation_error or attempt >= attempts - 1:
                raise
            print(
                '[Threads] Parent carrousel pas encore accepté par Meta; '
                f'nouvel essai {attempt + 2}/{attempts}'
            )
            time.sleep(delay_seconds)
    if last_error is not None:
        raise last_error
    raise ValueError('Création du carrousel Threads impossible')


def get_instagram_graph_api_version() -> str:
    raw = get_env_value('INSTAGRAM_GRAPH_API_VERSION') or INSTAGRAM_GRAPH_API_DEFAULT_VERSION
    normalized = raw.strip().lower()
    if not re.fullmatch(r'v\d+\.\d+', normalized):
        raise ValueError('Version Instagram Graph API invalide')
    return normalized


def build_instagram_graph_url(path: str) -> str:
    version = get_instagram_graph_api_version()
    return f'{INSTAGRAM_GRAPH_API_BASE_URL}/{version}/{path.lstrip("/")}'


def extract_instagram_error(payload: dict, fallback: str) -> str:
    error = payload.get('error') if isinstance(payload, dict) else None
    if isinstance(error, dict):
        message = str(error.get('message') or '').strip()
        if message:
            return message
    return fallback


def perform_instagram_request(path: str, method: str = 'GET', data: dict | None = None) -> dict:
    token = get_instagram_access_token()
    if not token:
        raise ValueError('INSTAGRAM_ACCESS_TOKEN absent du fichier .env')

    encoded_data = None
    if data is not None:
        encoded_data = urllib.parse.urlencode(data).encode('utf-8')

    request = urllib.request.Request(
        build_instagram_graph_url(path),
        data=encoded_data,
        method=method,
        headers={
            'Authorization': f'Bearer {token}',
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return decode_json_bytes(response.read())
    except urllib.error.HTTPError as error:
        try:
            payload = decode_json_bytes(error.read())
        except Exception:
            payload = {}
        message = extract_instagram_error(payload, f'Instagram API HTTP {error.code}')
        raise ValueError(message) from error


def get_instagram_profile() -> dict:
    payload = perform_instagram_request('me?fields=user_id,username')
    user_id = str(payload.get('user_id') or payload.get('id') or '').strip()
    if not user_id:
        raise ValueError('Identifiant du compte Instagram introuvable')
    return {
        'id': user_id,
        'username': str(payload.get('username') or '').strip(),
    }


def build_instagram_reel_container_data(
    video_url: str,
    caption: str,
    thumb_offset_ms: int,
    cover_url: str = '',
) -> dict:
    payload = {
        'media_type': 'REELS',
        'video_url': video_url,
        'caption': caption,
    }
    if cover_url:
        payload['cover_url'] = cover_url
    else:
        payload['thumb_offset'] = str(max(0, int(thumb_offset_ms or 0)))
    return payload


def get_instagram_media_item(media_id: str) -> dict:
    normalized_media_id = str(media_id or '').strip()
    if not re.fullmatch(r'\d+', normalized_media_id):
        raise ValueError('Identifiant de publication Instagram invalide')
    fields = ','.join((
        'id',
        'caption',
        'media_type',
        'media_product_type',
        'media_url',
        'permalink',
        'thumbnail_url',
        'timestamp',
        'children{id,media_type,media_url,thumbnail_url}',
    ))
    return perform_instagram_request(
        f'{normalized_media_id}?fields={urllib.parse.quote(fields, safe=",{}")}'
    )


def wait_for_instagram_container(container_id: str, attempts: int = 6, delay_seconds: float = 2.0):
    for attempt in range(attempts):
        payload = perform_instagram_request(f'{container_id}?fields=status_code,status')
        status_code = str(payload.get('status_code') or '').strip().upper()
        if status_code == 'FINISHED':
            return
        if status_code in {'ERROR', 'EXPIRED'}:
            status = str(payload.get('status') or status_code).strip()
            raise ValueError(f'Conteneur Instagram non publiable : {status}')
        if attempt < attempts - 1:
            time.sleep(delay_seconds)
    raise ValueError('Le traitement de l’image Instagram a dépassé le délai prévu')


def clear_instagram_media_cache():
    INSTAGRAM_MEDIA_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    for path in INSTAGRAM_MEDIA_CACHE_DIR.iterdir():
        try:
            path.unlink()
        except OSError:
            pass


def store_instagram_media(payload: bytes) -> str:
    if not payload:
        raise ValueError('Le fichier image est vide')
    if len(payload) > INSTAGRAM_MEDIA_MAX_BYTES:
        raise ValueError('L’image dépasse la limite temporaire de 10 Mo')
    if not payload.startswith(b'\xff\xd8\xff'):
        raise ValueError('Le fichier préparé doit être une image JPEG')

    media_id = f'{uuid.uuid4().hex}.jpg'
    (INSTAGRAM_MEDIA_CACHE_DIR / media_id).write_bytes(payload)
    return media_id


def store_instagram_video_stream(source, length: int, content_type: str) -> str:
    if length <= 0:
        raise ValueError('Le fichier vidéo est vide')
    if length > INSTAGRAM_VIDEO_MAX_BYTES:
        raise ValueError('La vidéo dépasse la limite de 1 Go')
    extension = '.mov' if content_type == 'video/quicktime' else '.mp4'
    media_id = f'{uuid.uuid4().hex}{extension}'
    target = INSTAGRAM_MEDIA_CACHE_DIR / media_id
    remaining = length
    try:
        with target.open('wb') as output:
            while remaining > 0:
                chunk = source.read(min(1024 * 1024, remaining))
                if not chunk:
                    raise ValueError('Réception de la vidéo interrompue')
                output.write(chunk)
                remaining -= len(chunk)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return media_id


def resolve_instagram_media_path(media_id: str) -> Path:
    normalized = str(media_id or '').strip().lower()
    if not re.fullmatch(r'[a-f0-9]{32}\.(?:jpg|mp4|mov)', normalized):
        raise ValueError('Identifiant du média temporaire invalide')

    target = (INSTAGRAM_MEDIA_CACHE_DIR / normalized).resolve()
    try:
        target.relative_to(INSTAGRAM_MEDIA_CACHE_DIR.resolve())
    except ValueError as error:
        raise ValueError('Chemin du média temporaire invalide') from error
    if not target.is_file():
        raise ValueError('Le média temporaire est introuvable, dépose-le de nouveau')
    return target


def get_instagram_media_public_url(media_id: str) -> str:
    if not INSTAGRAM_MEDIA_PUBLIC_BASE:
        raise ValueError('Le tunnel HTTPS temporaire Instagram n’est pas prêt')
    return f'{INSTAGRAM_MEDIA_PUBLIC_BASE}/media/{urllib.parse.quote(media_id)}'


def find_cloudflared_executable() -> str:
    local_executable = ROOT / '.tools' / 'cloudflared.exe'
    if local_executable.is_file():
        return str(local_executable)

    installed = shutil.which('cloudflared')
    if installed:
        return installed
    raise ValueError('cloudflared est introuvable')


def start_instagram_media_tunnel() -> tuple[subprocess.Popen, str, object]:
    log_dir = ROOT / 'tmp'
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / 'instagram-media-tunnel.log'
    log_handle = log_path.open('w', encoding='utf-8')
    process = subprocess.Popen(
        [
            find_cloudflared_executable(),
            'tunnel',
            '--url',
            f'http://127.0.0.1:{INSTAGRAM_MEDIA_LOCAL_PORT}',
            '--no-autoupdate',
        ],
        cwd=str(ROOT),
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
    )

    deadline = time.time() + 30
    public_base = ''
    while time.time() < deadline:
        if process.poll() is not None:
            break
        time.sleep(0.25)
        try:
            log_text = log_path.read_text(encoding='utf-8', errors='replace')
        except OSError:
            continue
        match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', log_text)
        if match:
            public_base = match.group(0)
            break

    if not public_base:
        process.terminate()
        log_handle.close()
        raise ValueError('Impossible d’ouvrir le tunnel HTTPS temporaire Instagram')
    return process, public_base, log_handle


def stop_instagram_media_tunnel():
    global INSTAGRAM_MEDIA_PUBLIC_BASE, INSTAGRAM_MEDIA_TUNNEL_PROCESS, INSTAGRAM_MEDIA_TUNNEL_LOG

    process = INSTAGRAM_MEDIA_TUNNEL_PROCESS
    log_handle = INSTAGRAM_MEDIA_TUNNEL_LOG

    # Réinitialiser immédiatement l'état partagé pour éviter qu'une autre requête
    # considère encore le tunnel comme disponible pendant son arrêt.
    INSTAGRAM_MEDIA_PUBLIC_BASE = ''
    INSTAGRAM_MEDIA_TUNNEL_PROCESS = None
    INSTAGRAM_MEDIA_TUNNEL_LOG = None

    if process is not None and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                pass

    if log_handle is not None:
        try:
            log_handle.close()
        except OSError:
            pass


def ensure_instagram_media_tunnel(media_id: str = '') -> str:
    global INSTAGRAM_MEDIA_PUBLIC_BASE, INSTAGRAM_MEDIA_TUNNEL_PROCESS, INSTAGRAM_MEDIA_TUNNEL_LOG

    def probe(public_base: str) -> bool:
        if not public_base or not media_id:
            return bool(public_base)
        target = f'{public_base}/media/{urllib.parse.quote(media_id)}'
        expected_type = 'video/' if media_id.endswith(('.mp4', '.mov')) else 'image/'
        try:
            request = urllib.request.Request(target, method='HEAD', headers={'User-Agent': 'Meta-Media-Preflight/1.0'})
            with urllib.request.urlopen(request, timeout=8) as response:
                content_type = str(response.headers.get('Content-Type') or '').lower()
                return response.status == 200 and content_type.startswith(expected_type)
        except Exception:
            return False

    with INSTAGRAM_MEDIA_TUNNEL_LOCK:
        process_alive = INSTAGRAM_MEDIA_TUNNEL_PROCESS is not None and INSTAGRAM_MEDIA_TUNNEL_PROCESS.poll() is None
        if process_alive and probe(INSTAGRAM_MEDIA_PUBLIC_BASE):
            return INSTAGRAM_MEDIA_PUBLIC_BASE

        stop_instagram_media_tunnel()
        INSTAGRAM_MEDIA_PUBLIC_BASE = ''
        INSTAGRAM_MEDIA_TUNNEL_PROCESS, INSTAGRAM_MEDIA_PUBLIC_BASE, INSTAGRAM_MEDIA_TUNNEL_LOG = start_instagram_media_tunnel()
        for _ in range(6):
            if probe(INSTAGRAM_MEDIA_PUBLIC_BASE):
                return INSTAGRAM_MEDIA_PUBLIC_BASE
            time.sleep(1)
        stop_instagram_media_tunnel()
        INSTAGRAM_MEDIA_PUBLIC_BASE = ''
        raise ValueError('Le tunnel HTTPS des médias est indisponible, réessaie la publication')


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


def normalize_etsy_shop_key(raw_value: str = '') -> str:
    return 'doublex' if str(raw_value or '').strip().lower() == 'doublex' else 'grosgeek'


def build_shop_scoped_json_path(base_path: Path, shop_key: str) -> Path:
    normalized_shop_key = normalize_etsy_shop_key(shop_key)
    if normalized_shop_key == 'grosgeek':
        return base_path
    return base_path.with_name(f'{base_path.stem}.{normalized_shop_key}{base_path.suffix}')


def get_etsy_pending_file(shop_key: str = '') -> Path:
    return build_shop_scoped_json_path(ETSY_OAUTH_PENDING_FILE, shop_key)


def get_etsy_token_file(shop_key: str = '') -> Path:
    return build_shop_scoped_json_path(ETSY_OAUTH_TOKEN_FILE, shop_key)


def resolve_requested_shop_key(
    query_params: dict | None = None,
    body_data: dict | None = None,
    headers=None,
) -> str:
    if isinstance(body_data, dict):
        body_shop = str(
            body_data.get('shop')
            or body_data.get('shopKey')
            or body_data.get('shop_key')
            or ''
        ).strip()
        if body_shop:
            return normalize_etsy_shop_key(body_shop)

    if isinstance(query_params, dict):
        query_shop_values = query_params.get('shop') or query_params.get('shop_key') or []
        if isinstance(query_shop_values, list) and query_shop_values:
            return normalize_etsy_shop_key(query_shop_values[0])

    if headers is not None:
        header_shop = str(
            headers.get('X-Etsy-Shop')
            or headers.get('x-etsy-shop')
            or ''
        ).strip()
        if header_shop:
            return normalize_etsy_shop_key(header_shop)

    return 'grosgeek'


def log_server_event(message: str):
    print(f'[server] {message}')


def set_current_request_shop_key(shop_key: str = ''):
    REQUEST_CONTEXT.shop_key = normalize_etsy_shop_key(shop_key)


def get_current_request_shop_key() -> str:
    return normalize_etsy_shop_key(getattr(REQUEST_CONTEXT, 'shop_key', 'grosgeek'))


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


def build_etsy_auth_status(shop_key: str = 'grosgeek') -> dict:
    normalized_shop_key = normalize_etsy_shop_key(shop_key)
    keystring = get_etsy_keystring()
    shared_secret = get_etsy_shared_secret()
    redirect_uri = get_etsy_redirect_uri()
    token_data = load_json_file(get_etsy_token_file(normalized_shop_key), {})
    pending_data = load_json_file(get_etsy_pending_file(normalized_shop_key), {})
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
        'shopKey': normalized_shop_key,
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


def build_etsy_authorization_url(shop_key: str = 'grosgeek') -> str:
    normalized_shop_key = normalize_etsy_shop_key(shop_key)
    status = build_etsy_auth_status(normalized_shop_key)
    if not status['configured']:
        raise ValueError(f"Configuration Etsy incomplète : {', '.join(status['missingConfig'])}")

    state = uuid.uuid4().hex
    verifier = generate_pkce_verifier()
    challenge = build_pkce_challenge(verifier)
    redirect_uri = get_etsy_redirect_uri()

    pending_payload = {
        'shop_key': normalized_shop_key,
        'state': state,
        'code_verifier': verifier,
        'redirect_uri': redirect_uri,
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    save_json_file(get_etsy_pending_file(normalized_shop_key), pending_payload)

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


def persist_etsy_token_payload(token_payload: dict, fallback_scopes: list[str] | None = None, shop_key: str = 'grosgeek'):
    normalized_shop_key = normalize_etsy_shop_key(shop_key)
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
        'shop_key': normalized_shop_key,
    }
    save_json_file(get_etsy_token_file(normalized_shop_key), payload)
    pending_file = get_etsy_pending_file(normalized_shop_key)
    if pending_file.exists():
        pending_file.unlink()


def build_home_redirect_url(result: str, message: str) -> str:
    query = urllib.parse.urlencode({
        'etsy_oauth': result,
        'etsy_message': message,
    })
    return f'/?{query}'


def build_tiktok_home_redirect_url(result: str, message: str) -> str:
    query = urllib.parse.urlencode({
        'tiktok_oauth': result,
        'tiktok_message': message,
    })
    return f'/?{query}'


def find_pending_oauth_context_by_state(state: str) -> tuple[str, dict]:
    normalized_state = str(state or '').strip()
    for shop_key in ETSY_SHOP_KEYS:
        pending_payload = load_json_file(get_etsy_pending_file(shop_key), {})
        if isinstance(pending_payload, dict) and str(pending_payload.get('state') or '').strip() == normalized_state:
            return shop_key, pending_payload
    return 'grosgeek', {}


def get_etsy_oauth_token_data(shop_key: str = 'grosgeek') -> dict:
    return load_json_file(get_etsy_token_file(shop_key), {})


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


def refresh_etsy_access_token(token_data: dict | None = None, shop_key: str = 'grosgeek') -> dict:
    normalized_shop_key = normalize_etsy_shop_key(shop_key)
    current_token_data = token_data or get_etsy_oauth_token_data(normalized_shop_key)
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
        shop_key=normalized_shop_key,
    )
    return get_etsy_oauth_token_data(normalized_shop_key)


def get_etsy_valid_token_data(shop_key: str = 'grosgeek') -> dict:
    normalized_shop_key = normalize_etsy_shop_key(shop_key)
    with ETSY_OAUTH_TOKEN_LOCK:
        token_data = get_etsy_oauth_token_data(normalized_shop_key)
        if not is_etsy_access_token_expired(token_data):
            return token_data
        return refresh_etsy_access_token(token_data, normalized_shop_key)


def get_etsy_access_token(shop_key: str = 'grosgeek') -> str:
    return str(get_etsy_valid_token_data(shop_key).get('access_token') or '').strip()


def get_etsy_user_id(shop_key: str = 'grosgeek') -> str:
    token_data = get_etsy_oauth_token_data(shop_key)
    access_token = str(token_data.get('access_token') or '').strip()
    if access_token and '.' in access_token:
      return access_token.split('.', 1)[0]
    return str(token_data.get('user_id') or '').strip()


def build_etsy_request_headers(*, include_oauth: bool, shop_key: str | None = None) -> dict:
    resolved_shop_key = normalize_etsy_shop_key(shop_key or get_current_request_shop_key())
    api_key = build_etsy_api_key_header_value()
    if not api_key:
        raise ValueError('Configuration Etsy incomplète : ETSY_KEYSTRING + ETSY_SHARED_SECRET requis')

    headers = {
        'x-api-key': api_key,
        'Accept': 'application/json',
        'User-Agent': 'EtsyPipeline/1.0',
    }

    if include_oauth:
        access_token = get_etsy_access_token(resolved_shop_key)
        if not access_token:
            raise ValueError('Boutique Etsy non autorisée')
        headers['Authorization'] = f'Bearer {access_token}'

    return headers


def perform_etsy_get_request(path: str, *, include_oauth: bool, shop_key: str | None = None) -> dict:
    url = f'{ETSY_API_BASE_URL}/application/{path.lstrip("/")}'
    request = urllib.request.Request(
        url,
        method='GET',
        headers=build_etsy_request_headers(include_oauth=include_oauth, shop_key=shop_key),
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


def perform_etsy_form_request(path: str, form_data: dict, *, include_oauth: bool, method: str = 'POST', shop_key: str | None = None) -> dict:
    url = f'{ETSY_API_BASE_URL}/application/{path.lstrip("/")}'
    encoded_items = encode_etsy_form_items(form_data)
    request_body = urllib.parse.urlencode(encoded_items).encode('utf-8')
    headers = build_etsy_request_headers(include_oauth=include_oauth, shop_key=shop_key)
    headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8'

    request = urllib.request.Request(
        url,
        data=request_body,
        method=method.upper(),
        headers=headers,
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return decode_json_bytes(response.read())


def perform_etsy_post_form_request(path: str, form_data: dict, *, include_oauth: bool, shop_key: str | None = None) -> dict:
    return perform_etsy_form_request(path, form_data, include_oauth=include_oauth, method='POST', shop_key=shop_key)


def perform_etsy_put_form_request(path: str, form_data: dict, *, include_oauth: bool, shop_key: str | None = None) -> dict:
    return perform_etsy_form_request(path, form_data, include_oauth=include_oauth, method='PUT', shop_key=shop_key)


def perform_etsy_patch_form_request(path: str, form_data: dict, *, include_oauth: bool, shop_key: str | None = None) -> dict:
    return perform_etsy_form_request(path, form_data, include_oauth=include_oauth, method='PATCH', shop_key=shop_key)


def perform_etsy_put_json_request(path: str, payload: dict, *, include_oauth: bool, shop_key: str | None = None) -> dict:
    url = f'{ETSY_API_BASE_URL}/application/{path.lstrip("/")}'
    headers = build_etsy_request_headers(include_oauth=include_oauth, shop_key=shop_key)
    headers['Content-Type'] = 'application/json; charset=utf-8'
    request = urllib.request.Request(
        url,
        data=json.dumps(payload or {}, ensure_ascii=False).encode('utf-8'),
        method='PUT',
        headers=headers,
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return decode_json_bytes(response.read())


def perform_etsy_delete_request(path: str, *, include_oauth: bool, shop_key: str | None = None) -> dict:
    url = f'{ETSY_API_BASE_URL}/application/{path.lstrip("/")}'
    request = urllib.request.Request(
        url,
        method='DELETE',
        headers=build_etsy_request_headers(include_oauth=include_oauth, shop_key=shop_key),
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return decode_json_bytes(response.read())


def get_etsy_granted_scopes(shop_key: str | None = None) -> list[str]:
    resolved_shop_key = normalize_etsy_shop_key(shop_key or get_current_request_shop_key())
    token_data = get_etsy_oauth_token_data(resolved_shop_key)
    return [str(scope or '').strip() for scope in token_data.get('scopes') or [] if str(scope or '').strip()]


def require_etsy_scope(scope_name: str, shop_key: str | None = None):
    granted_scopes = set(get_etsy_granted_scopes(shop_key))
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


def extract_etsy_results_collection(value) -> list[dict]:
    if isinstance(value, list):
        return [entry for entry in value if isinstance(entry, dict)]
    if isinstance(value, dict):
        if isinstance(value.get('results'), list):
            return [entry for entry in value.get('results') if isinstance(entry, dict)]
        if isinstance(value.get('data'), list):
            return [entry for entry in value.get('data') if isinstance(entry, dict)]
        if isinstance(value.get('items'), list):
            return [entry for entry in value.get('items') if isinstance(entry, dict)]
    return []


def extract_etsy_pagination_count(payload: dict) -> int:
    if not isinstance(payload, dict):
        return 0
    raw_count = payload.get('count')
    numeric_count = int(raw_count or 0) if str(raw_count or '').strip().isdigit() else 0
    if numeric_count > 0:
        return numeric_count
    return len(extract_etsy_results_collection(payload))


def parse_etsy_datetime_value(value) -> datetime | None:
    if value is None or value == '':
        return None

    if isinstance(value, (int, float)):
        timestamp = float(value)
        if timestamp <= 0:
            return None
        if timestamp < 1e12:
            timestamp = timestamp
        else:
            timestamp = timestamp / 1000.0
        try:
            return datetime.fromtimestamp(timestamp, timezone.utc)
        except Exception:
            return None

    text = str(value or '').strip()
    if not text:
        return None

    if text.isdigit():
        try:
            timestamp = float(text)
            if timestamp > 1e12:
                timestamp = timestamp / 1000.0
            return datetime.fromtimestamp(timestamp, timezone.utc)
        except Exception:
            return None

    try:
        parsed = datetime.fromisoformat(text.replace('Z', '+00:00'))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def resolve_etsy_transaction_datetime(transaction: dict, receipt: dict | None = None) -> tuple[datetime | None, str]:
    transaction = transaction if isinstance(transaction, dict) else {}
    receipt = receipt if isinstance(receipt, dict) else {}

    transaction_fields = (
        'create_timestamp',
        'created_timestamp',
        'transaction_timestamp',
        'transaction_date',
        'created_tsz',
        'creation_tsz',
        'create_date',
    )
    for field_name in transaction_fields:
        parsed = parse_etsy_datetime_value(transaction.get(field_name))
        if parsed is not None:
            return parsed, f'transaction.{field_name}'

    receipt_fields = (
        'paid_timestamp',
        'was_paid_tsz',
        'create_timestamp',
        'created_timestamp',
        'created_tsz',
        'creation_tsz',
        'create_date',
        'update_date',
    )
    for field_name in receipt_fields:
        parsed = parse_etsy_datetime_value(receipt.get(field_name))
        if parsed is not None:
            return parsed, f'receipt.{field_name}'

    return None, ''


def aggregate_listing_sales_from_transactions(
    transactions: list[dict],
    sales_by_listing: dict[str, int],
    sales_windows_by_listing: dict[str, dict[str, int]],
    dated_sales_by_listing: dict[str, int],
    coverage_by_listing: dict[str, dict[str, str | int]],
    *,
    receipt: dict | None = None,
    now: datetime | None = None,
):
    now_dt = now if isinstance(now, datetime) else datetime.now(timezone.utc)
    for transaction in transactions:
        listing_id = str(transaction.get('listing_id') or transaction.get('listingId') or '').strip()
        if not listing_id:
            continue
        try:
            quantity = int(transaction.get('quantity') or 1)
        except Exception:
            quantity = 1
        if quantity <= 0:
            quantity = 1
        sales_by_listing[listing_id] = int(sales_by_listing.get(listing_id, 0) or 0) + quantity
        windows = sales_windows_by_listing.setdefault(listing_id, {
            '7d': 0,
            '30d': 0,
            'lifetime': 0,
        })
        windows['lifetime'] = int(windows.get('lifetime', 0) or 0) + quantity

        sale_datetime, sale_date_source = resolve_etsy_transaction_datetime(transaction, receipt)
        coverage = coverage_by_listing.setdefault(listing_id, {
            'dated_transactions': 0,
            'undated_transactions': 0,
            'last_date_source': '',
        })
        if sale_datetime is None:
            coverage['undated_transactions'] = int(coverage.get('undated_transactions', 0) or 0) + 1
            continue

        coverage['dated_transactions'] = int(coverage.get('dated_transactions', 0) or 0) + 1
        if sale_date_source:
            coverage['last_date_source'] = sale_date_source
        dated_sales_by_listing[listing_id] = int(dated_sales_by_listing.get(listing_id, 0) or 0) + quantity

        delta_days = (now_dt - sale_datetime).total_seconds() / 86400.0
        if delta_days < 0:
            delta_days = 0
        if delta_days <= 7:
            windows['7d'] = int(windows.get('7d', 0) or 0) + quantity
        if delta_days <= 30:
            windows['30d'] = int(windows.get('30d', 0) or 0) + quantity


def fetch_shop_receipt_transactions_summary(shop_id: str, shop_key: str = 'grosgeek') -> dict:
    require_etsy_scope('transactions_r', shop_key)
    sales_by_listing: dict[str, int] = {}
    sales_windows_by_listing: dict[str, dict[str, int]] = {}
    dated_sales_by_listing: dict[str, int] = {}
    coverage_by_listing: dict[str, dict[str, str | int]] = {}
    receipts_seen = 0
    transactions_seen = 0
    page_count = 0
    offset = 0
    limit = 100
    now_dt = datetime.now(timezone.utc)

    while True:
        page_count += 1
        receipts_payload = perform_etsy_get_request(
            f'shops/{shop_id}/receipts?limit={limit}&offset={offset}&was_paid=true&includes=Transactions',
            include_oauth=True,
            shop_key=shop_key,
        )
        receipts = extract_etsy_results_collection(receipts_payload)
        if not receipts:
            break

        receipts_seen += len(receipts)
        for receipt in receipts:
            transactions = (
                extract_etsy_results_collection(receipt.get('Transactions'))
                or extract_etsy_results_collection(receipt.get('transactions'))
            )
            if transactions:
                transactions_seen += len(transactions)
                aggregate_listing_sales_from_transactions(
                    transactions,
                    sales_by_listing,
                    sales_windows_by_listing,
                    dated_sales_by_listing,
                    coverage_by_listing,
                    receipt=receipt,
                    now=now_dt,
                )
                continue

            receipt_id = str(receipt.get('receipt_id') or receipt.get('receiptId') or '').strip()
            if not receipt_id:
                continue
            receipt_transactions_payload = perform_etsy_get_request(
                f'shops/{shop_id}/receipts/{receipt_id}/transactions',
                include_oauth=True,
                shop_key=shop_key,
            )
            receipt_transactions = extract_etsy_results_collection(receipt_transactions_payload)
            if receipt_transactions:
                transactions_seen += len(receipt_transactions)
                aggregate_listing_sales_from_transactions(
                    receipt_transactions,
                    sales_by_listing,
                    sales_windows_by_listing,
                    dated_sales_by_listing,
                    coverage_by_listing,
                    receipt=receipt,
                    now=now_dt,
                )

        total_count = extract_etsy_pagination_count(receipts_payload)
        offset += len(receipts)
        if len(receipts) < limit:
            break
        if total_count and offset >= total_count:
            break

    return {
        'sales_by_listing': sales_by_listing,
        'sales_windows_by_listing': sales_windows_by_listing,
        'dated_sales_by_listing': dated_sales_by_listing,
        'coverage_by_listing': coverage_by_listing,
        'receipt_count': receipts_seen,
        'transaction_count': transactions_seen,
        'page_count': page_count,
    }


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


def prepare_publication_image_uploads(images_payload: list[dict]) -> list[dict]:
    prepared_images: list[dict] = []
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
        prepared_images.append({
            'index': image_index + 1,
            'mode': mode,
            'filename': filename_hint,
            'media_type': media_type,
            'payload': image_bytes,
            'fields_sent': image_fields,
        })
    return prepared_images


def get_oversized_publication_alt_text_indexes(images_payload: list[dict], max_length: int = 500) -> list[int]:
    return [
        image_index + 1
        for image_index, image_entry in enumerate(images_payload)
        if isinstance(image_entry, dict)
        and len(str(image_entry.get('alt_text') or '').strip()) > max_length
    ]


def prepare_publication_video_uploads(videos_payload: list[dict]) -> list[dict]:
    prepared_videos: list[dict] = []
    for video_index, video_entry in enumerate(videos_payload):
        if not isinstance(video_entry, dict):
            continue

        mode = str(video_entry.get('mode') or '').strip().lower()
        if mode == 'upload':
            media_type, video_bytes = decode_data_url_payload(str(video_entry.get('data_url') or ''))
        elif mode == 'upload_remote':
            media_type, video_bytes = fetch_publication_video_payload(str(video_entry.get('remote_url') or ''))
        else:
            continue

        filename_hint = guess_filename(str(video_entry.get('filename') or f'etsy-video-{video_index + 1}'), media_type)
        prepared_videos.append({
            'index': video_index + 1,
            'mode': mode,
            'filename': filename_hint,
            'media_type': media_type,
            'payload': video_bytes,
            'fields_sent': {
                'name': filename_hint,
            },
        })
    return prepared_videos


def upload_listing_image_payloads(
    shop_id: str,
    listing_id: str,
    prepared_images: list[dict],
    *,
    shop_key: str | None = None,
) -> list[dict]:
    uploaded_images = []
    for prepared_image in prepared_images:
        pause_etsy_publication_requests()
        image_response = perform_etsy_post_multipart_request(
            f'shops/{shop_id}/listings/{listing_id}/images',
            include_oauth=True,
            shop_key=shop_key,
            fields=prepared_image['fields_sent'],
            file_field_name='image',
            filename=prepared_image['filename'],
            media_type=prepared_image['media_type'],
            payload=prepared_image['payload'],
        )
        uploaded_images.append({
            'index': prepared_image['index'],
            'mode': prepared_image['mode'],
            'fields_sent': prepared_image['fields_sent'],
            'response': image_response,
        })
    return uploaded_images


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


def get_etsy_shop_payload(shop_key: str = 'grosgeek') -> dict:
    normalized_shop_key = normalize_etsy_shop_key(shop_key)
    user_id = get_etsy_user_id(normalized_shop_key)
    if not user_id:
        raise ValueError('User Etsy introuvable dans le token OAuth')

    return perform_etsy_get_request(f'users/{user_id}/shops', include_oauth=True, shop_key=normalized_shop_key)


def extract_primary_shop_record(payload: dict) -> dict:
    if isinstance(payload, dict):
        results = payload.get('results')
        if isinstance(results, list) and results:
            first = results[0]
            return first if isinstance(first, dict) else {}
        if payload.get('shop_id'):
            return payload
    return {}


def get_etsy_shop_context(shop_key: str = 'grosgeek') -> dict:
    normalized_shop_key = normalize_etsy_shop_key(shop_key)
    shop_payload = get_etsy_shop_payload(normalized_shop_key)
    shop_record = extract_primary_shop_record(shop_payload)
    shop_id = shop_record.get('shop_id')
    if not shop_id:
        raise ValueError('Aucune boutique Etsy exploitable trouvée pour cet utilisateur')

    return {
        'user_id': get_etsy_user_id(normalized_shop_key),
        'shop_id': str(shop_id),
        'shop_key': normalized_shop_key,
        'shop': shop_record,
        'raw': shop_payload,
    }


def list_etsy_shipping_profiles(shop_id: str, shop_key: str = 'grosgeek') -> list[dict]:
    payload = perform_etsy_get_request(
        f'shops/{shop_id}/shipping-profiles',
        include_oauth=True,
        shop_key=shop_key,
    )
    results = payload.get('results')
    if isinstance(results, list):
        return [entry for entry in results if isinstance(entry, dict)]
    data = payload.get('data')
    if isinstance(data, list):
        return [entry for entry in data if isinstance(entry, dict)]
    return []


def resolve_etsy_shipping_profile_id_for_shop(
    shop_id: str,
    shop_key: str = 'grosgeek',
    preferred_profile_id: int | str | None = None,
) -> int:
    profiles = list_etsy_shipping_profiles(shop_id, shop_key)
    if not profiles:
        return 0

    preferred_id = int(preferred_profile_id or 0) or 0
    if preferred_id:
        for profile in profiles:
            profile_id = int(profile.get('shipping_profile_id') or profile.get('profile_id') or 0) or 0
            if profile_id == preferred_id:
                return profile_id

    for profile in profiles:
        profile_id = int(profile.get('shipping_profile_id') or profile.get('profile_id') or 0) or 0
        if profile_id:
            return profile_id

    return 0


def list_etsy_readiness_state_definitions(shop_id: str, shop_key: str = 'grosgeek') -> list[dict]:
    payload = perform_etsy_get_request(
        f'shops/{shop_id}/readiness-state-definitions',
        include_oauth=True,
        shop_key=shop_key,
    )
    results = payload.get('results')
    if isinstance(results, list):
        return [entry for entry in results if isinstance(entry, dict)]
    data = payload.get('data')
    if isinstance(data, list):
        return [entry for entry in data if isinstance(entry, dict)]
    return []


def resolve_etsy_readiness_state_id_for_shop(
    shop_id: str,
    shop_key: str = 'grosgeek',
    preferred_readiness_state_id: int | str | None = None,
) -> int:
    definitions = list_etsy_readiness_state_definitions(shop_id, shop_key)
    if not definitions:
        return 0

    preferred_id = int(preferred_readiness_state_id or 0) or 0
    if preferred_id:
        for definition in definitions:
            readiness_state_id = int(
                definition.get('readiness_state_id')
                or definition.get('readinessStateId')
                or definition.get('id')
                or 0
            ) or 0
            if readiness_state_id == preferred_id:
                return readiness_state_id

    for definition in definitions:
        readiness_state_id = int(
            definition.get('readiness_state_id')
            or definition.get('readinessStateId')
            or definition.get('id')
            or 0
        ) or 0
        if readiness_state_id:
            return readiness_state_id

    return 0


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


def infer_etsy_shop_key_from_shop_id(shop_id: str) -> str:
    normalized_shop_id = str(shop_id or '').strip()
    if not normalized_shop_id:
        return 'grosgeek'

    for candidate_shop_key in ETSY_SHOP_KEYS:
        try:
            shop_context = get_etsy_shop_context(candidate_shop_key)
        except Exception:
            continue
        if str(shop_context.get('shop_id') or '').strip() == normalized_shop_id:
            return candidate_shop_key

    return 'grosgeek'


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
    shop_key: str | None = None,
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
            **build_etsy_request_headers(include_oauth=include_oauth, shop_key=shop_key),
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
        requested_shop_key = resolve_requested_shop_key(query_params=query_params, headers=self.headers)
        set_current_request_shop_key(requested_shop_key)

        if path == '/pinterest/status':
            try:
                service = get_pinterest_service()
                status = service.status()
                if status['connected']:
                    try:
                        status['profile'] = service.profile()
                    except Exception as error:
                        status['connectionError'] = str(error)
                self.send_json(200, status)
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path == '/pinterest/oauth/start':
            try:
                self.send_json(200, {'ok': True, 'authUrl': get_pinterest_service().build_authorization_url()})
            except ValueError as error:
                self.send_json(400, {'error': str(error)})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path == '/pinterest/oauth/callback':
            error_code = str(query_params.get('error', [''])[0] or '').strip()
            error_description = str(query_params.get('error_description', [''])[0] or '').strip()
            if error_code:
                message = urllib.parse.quote(error_description or error_code)
                self.send_redirect(f'/?pinterest_oauth=error&message={message}')
                return
            try:
                code = str(query_params.get('code', [''])[0] or '').strip()
                state = str(query_params.get('state', [''])[0] or '').strip()
                if not code:
                    raise ValueError('Code OAuth Pinterest absent')
                get_pinterest_service().complete_oauth(code, state)
                self.send_redirect('/?pinterest_oauth=success')
            except Exception as error:
                self.send_redirect(f'/?pinterest_oauth=error&message={urllib.parse.quote(str(error))}')
            return

        if path == '/pinterest/boards':
            try:
                boards = get_pinterest_service().list_boards()
                self.send_json(200, {'ok': True, 'boards': boards, 'count': len(boards)})
            except PinterestAPIError as error:
                self.send_json(error.status, {'error': str(error), 'pinterest': error.payload})
            except ValueError as error:
                self.send_json(400, {'error': str(error)})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path == '/pinterest/queue':
            try:
                include_history = str(query_params.get('history', ['0'])[0]).lower() in {'1', 'true', 'yes'}
                self.send_json(200, get_pinterest_service().queue_snapshot(include_history))
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path == '/pinterest/settings':
            try:
                self.send_json(200, {'ok': True, **get_pinterest_service().get_settings()})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path.startswith('/pinterest/spool/'):
            try:
                target = get_pinterest_service().resolve_spool(path.removeprefix('/pinterest/spool/'))
                content_type = {
                    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                    '.webp': 'image/webp', '.gif': 'image/gif',
                }.get(target.suffix.lower(), 'application/octet-stream')
                self.send_binary_file(target, content_type)
            except (FileNotFoundError, ValueError):
                self.send_json(404, {'error': 'Image Pinterest introuvable'})
            return

        if path == '/instagram/test/status':
            try:
                self.send_json(200, {
                    'ok': True,
                    'configured': bool(get_instagram_access_token()),
                    'apiVersion': get_instagram_graph_api_version(),
                    'mediaUploadReady': bool(INSTAGRAM_MEDIA_PUBLIC_BASE),
                })
            except ValueError as error:
                self.send_json(400, {'error': str(error)})
            return

        if path == '/instagram/test/profile':
            try:
                profile = get_instagram_profile()
                self.send_json(200, {'ok': True, 'profile': profile})
            except ValueError as error:
                self.send_json(400, {'error': str(error)})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path == '/instagram/media/recent':
            try:
                raw_limit = query_params.get('limit', ['25'])[0]
                limit = min(50, max(1, int(raw_limit)))
                fields = ','.join((
                    'id',
                    'caption',
                    'media_type',
                    'media_product_type',
                    'media_url',
                    'permalink',
                    'thumbnail_url',
                    'timestamp',
                    'children{id,media_type,media_url,thumbnail_url}',
                ))
                payload = perform_instagram_request(
                    f'me/media?fields={urllib.parse.quote(fields, safe=",{}")}&limit={limit}'
                )
                media = payload.get('data') if isinstance(payload.get('data'), list) else []
                self.send_json(200, {'ok': True, 'media': media, 'count': len(media)})
            except (TypeError, ValueError) as error:
                self.send_json(400, {'error': str(error)})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path == '/facebook/status':
            try:
                shop_key = normalize_etsy_shop_key(requested_shop_key)
                self.send_json(200, {
                    'ok': True,
                    'configured': bool(get_facebook_page_access_token(shop_key)),
                    'pageIdConfigured': bool(get_facebook_page_id(shop_key)),
                    'apiVersion': get_facebook_graph_api_version(),
                    'shopKey': shop_key,
                })
            except ValueError as error:
                self.send_json(400, {'error': str(error)})
            return

        if path == '/facebook/profile':
            try:
                profile = get_facebook_page_profile(requested_shop_key)
                self.send_json(200, {'ok': True, 'profile': profile})
            except FacebookAPIError as error:
                self.send_json(
                    error.http_status if 400 <= error.http_status < 600 else 502,
                    {'error': str(error), 'facebook': error.public_details()},
                )
            except ValueError as error:
                self.send_json(400, {'error': str(error)})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path == '/threads/status':
            try:
                self.send_json(200, {
                    'ok': True,
                    'configured': bool(get_threads_access_token()),
                    'apiVersion': get_threads_graph_api_version(),
                    'mediaUploadReady': bool(INSTAGRAM_MEDIA_PUBLIC_BASE),
                })
            except ValueError as error:
                self.send_json(400, {'error': str(error)})
            return

        if path == '/threads/profile':
            try:
                profile = get_threads_profile()
                self.send_json(200, {'ok': True, 'profile': profile})
            except ValueError as error:
                self.send_json(400, {'error': str(error)})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path == '/tiktok/oauth/status':
            try:
                self.send_json(200, build_tiktok_auth_status())
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path == '/tiktok/oauth/start':
            try:
                self.send_json(200, {
                    'ok': True,
                    'authUrl': build_tiktok_authorization_url(),
                    'scopes': list(TIKTOK_OAUTH_SCOPES),
                })
            except ValueError as error:
                self.send_json(400, {'error': str(error)})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path == TIKTOK_OAUTH_CALLBACK_ROUTE:
            error_code = str(query_params.get('error', [''])[0] or '').strip()
            error_description = str(query_params.get('error_description', [''])[0] or '').strip()
            state = str(query_params.get('state', [''])[0] or '').strip()
            code = str(query_params.get('code', [''])[0] or '').strip()
            pending_payload = load_json_file(TIKTOK_OAUTH_PENDING_FILE, {})

            if error_code:
                self.send_redirect(build_tiktok_home_redirect_url(
                    'error',
                    f'OAuth TikTok refusé : {error_description or error_code}',
                ))
                return
            if not code or not state:
                self.send_redirect(build_tiktok_home_redirect_url('error', 'Réponse OAuth TikTok incomplète'))
                return
            if not pending_payload or str(pending_payload.get('state') or '') != state:
                self.send_redirect(build_tiktok_home_redirect_url('error', 'State OAuth TikTok invalide'))
                return

            try:
                token_payload = exchange_tiktok_authorization_code(code, pending_payload)
                persist_tiktok_token_payload(token_payload)
                self.send_redirect(build_tiktok_home_redirect_url('success', 'Compte TikTok autorisé'))
            except Exception as error:
                self.send_redirect(build_tiktok_home_redirect_url(
                    'error',
                    f'Échange OAuth TikTok échoué : {error}',
                ))
            return

        if path == '/tiktok/profile':
            try:
                self.send_json(200, {'ok': True, 'profile': get_tiktok_profile()})
            except ValueError as error:
                self.send_json(400, {'error': str(error)})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path == '/tiktok/creator-info':
            try:
                self.send_json(200, {'ok': True, 'creator': get_tiktok_creator_info()})
            except ValueError as error:
                self.send_json(400, {'error': str(error)})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path == '/tiktok/publish/status':
            try:
                publish_id = str(query_params.get('publishId', [''])[0] or '').strip()
                self.send_json(200, {'ok': True, 'status': get_tiktok_publish_status(publish_id)})
            except ValueError as error:
                self.send_json(400, {'error': str(error)})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path == '/etsy/auth/status':
            self.send_json(200, build_etsy_auth_status(requested_shop_key))
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
                log_server_event(f'POST {path} validation_error shop={get_current_request_shop_key()} error={e}')
                self.send_json(400, {'error': str(e)})
            except urllib.error.HTTPError as e:
                log_server_event(f'POST {path} etsy_http_error shop={get_current_request_shop_key()} status={e.code}')
                try:
                    payload = decode_json_bytes(e.read())
                except Exception:
                    payload = {'error': str(e)}
                self.send_json(e.code, payload or {'error': str(e)})
            except Exception as e:
                log_server_event(f'POST {path} server_error shop={get_current_request_shop_key()} error={e}')
                self.send_json(500, {'error': str(e)})
            return

        if path == '/etsy/test/oauth-identity':
            try:
                token_data = get_etsy_oauth_token_data(requested_shop_key)
                user_id = get_etsy_user_id(requested_shop_key)
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
                log_server_event(f'POST {path} validation_error shop={get_current_request_shop_key()} error={e}')
                self.send_json(400, {'error': str(e)})
            except urllib.error.HTTPError as e:
                log_server_event(f'POST {path} etsy_http_error shop={get_current_request_shop_key()} status={e.code}')
                try:
                    payload = decode_json_bytes(e.read())
                except Exception:
                    payload = {'error': str(e)}
                self.send_json(e.code, payload or {'error': str(e)})
            except Exception as e:
                log_server_event(f'POST {path} server_error shop={get_current_request_shop_key()} error={e}')
                self.send_json(500, {'error': str(e)})
            return

        if path == '/etsy/test/shop':
            try:
                shop_context = get_etsy_shop_context(requested_shop_key)
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
                shop_context = get_etsy_shop_context(requested_shop_key)
                shop_id = shop_context['shop_id']
                requested_state = str((query_params.get('state') or ['active'])[0] or 'active').strip().lower() or 'active'
                requested_buyer_country = str((query_params.get('buyer_country') or ['FR'])[0] or 'FR').strip().upper() or 'FR'
                requested_currency = str((query_params.get('currency') or [shop_context['shop'].get('currency_code') or 'EUR'])[0] or (shop_context['shop'].get('currency_code') or 'EUR')).strip().upper() or 'EUR'
                try:
                    requested_limit = int(str((query_params.get('limit') or ['5'])[0] or '5').strip())
                except ValueError:
                    requested_limit = 5
                try:
                    requested_offset = int(str((query_params.get('offset') or ['0'])[0] or '0').strip())
                except ValueError:
                    requested_offset = 0

                if requested_limit <= 0:
                    requested_limit = 5
                requested_limit = min(requested_limit, 100)
                requested_offset = max(0, requested_offset)
                payload = perform_etsy_get_request(
                    f'shops/{shop_id}/listings?state={urllib.parse.quote(requested_state)}&limit={requested_limit}&offset={requested_offset}',
                    include_oauth=True,
                    shop_key=requested_shop_key,
                )
                results = payload.get('results') if isinstance(payload, dict) else []
                if isinstance(results, list) and results:
                    listing_ids = [
                        str(item.get('listing_id') or '').strip()
                        for item in results
                        if isinstance(item, dict) and str(item.get('listing_id') or '').strip()
                    ]
                    buyer_price_by_listing_id = {}

                    for listing_ids_chunk in chunk_list(listing_ids, 100):
                        batch_query = urllib.parse.urlencode({
                            'listing_ids': ','.join(str(listing_id).strip() for listing_id in listing_ids_chunk if str(listing_id).strip()),
                            'includes': 'BuyerPrice',
                            'legacy': 'true',
                            'buyer_country': requested_buyer_country,
                            'currency': requested_currency,
                        })
                        batch_payload = perform_etsy_get_request(
                            f'listings/batch?{batch_query}',
                            include_oauth=True,
                            shop_key=requested_shop_key,
                        )
                        batch_results = batch_payload.get('results') if isinstance(batch_payload, dict) else []
                        if not isinstance(batch_results, list):
                            continue
                        for batch_item in batch_results:
                            if not isinstance(batch_item, dict):
                                continue
                            listing_id = str(batch_item.get('listing_id') or '').strip()
                            buyer_price = batch_item.get('buyer_price')
                            if not isinstance(buyer_price, dict):
                                buyer_price = batch_item.get('buyerPrice')
                            if listing_id and isinstance(buyer_price, dict):
                                buyer_price_by_listing_id[listing_id] = buyer_price

                    if buyer_price_by_listing_id:
                        for item in results:
                            if not isinstance(item, dict):
                                continue
                            listing_id = str(item.get('listing_id') or '').strip()
                            if listing_id and listing_id in buyer_price_by_listing_id:
                                item['buyer_price'] = buyer_price_by_listing_id[listing_id]

                self.send_json(200, {
                    'ok': True,
                    'endpoint': f'shops/{shop_id}/listings',
                    'payload': {
                        'user_id': shop_context['user_id'],
                        'shop_id': shop_id,
                        'query': {
                            'state': requested_state,
                            'limit': requested_limit,
                            'offset': requested_offset,
                            'buyer_country': requested_buyer_country,
                            'currency': requested_currency,
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
                shop_context = get_etsy_shop_context(requested_shop_key)
                shop_id = shop_context['shop_id']
                payload = perform_etsy_get_request(
                    f'shops/{shop_id}/sections',
                    include_oauth=False,
                    shop_key=requested_shop_key,
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
                shop_context = get_etsy_shop_context(requested_shop_key)
                shop_id = shop_context['shop_id']
                payload = perform_etsy_get_request(
                    f'shops/{shop_id}/shipping-profiles',
                    include_oauth=True,
                    shop_key=requested_shop_key,
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
                shop_context = get_etsy_shop_context(requested_shop_key)
                shop_id = shop_context['shop_id']
                payload = perform_etsy_get_request(
                    f'shops/{shop_id}/readiness-state-definitions',
                    include_oauth=True,
                    shop_key=requested_shop_key,
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
                includes = 'Images,Videos,Shop,User,Personalization'
                payload = perform_etsy_get_request(
                    f'listings/{listing_id}?includes={urllib.parse.quote(includes, safe=",")}&legacy=true&allow_suggested_title=true',
                    include_oauth=True,
                    shop_key=requested_shop_key,
                )
                images_payload = perform_etsy_get_request(
                    f'listings/{listing_id}/images',
                    include_oauth=False,
                    shop_key=requested_shop_key,
                )
                videos_payload = perform_etsy_get_request(
                    f'listings/{listing_id}/videos',
                    include_oauth=False,
                    shop_key=requested_shop_key,
                )
                inventory_payload = perform_etsy_get_request(
                    f'listings/batch/inventory?listing_ids={listing_id}',
                    include_oauth=True,
                    shop_key=requested_shop_key,
                )
                shipping_payload = perform_etsy_get_request(
                    f'listings/batch/shipping?listing_ids={listing_id}',
                    include_oauth=True,
                    shop_key=requested_shop_key,
                )
                inventory_entries = extract_etsy_results_collection(inventory_payload)
                shipping_entries = extract_etsy_results_collection(shipping_payload)
                inventory_entry = inventory_entries[0] if inventory_entries else {}
                shipping_entry = shipping_entries[0] if shipping_entries else {}
                payload['images'] = extract_etsy_results_collection(images_payload)
                payload['videos'] = extract_etsy_results_collection(videos_payload)
                payload['inventory'] = inventory_entry.get('inventory')
                payload['shipping_profile'] = shipping_entry.get('shipping_profile')
                source_shop_id = get_listing_shop_id(payload)
                source_shop_key = infer_etsy_shop_key_from_shop_id(source_shop_id)
                self.send_json(200, {
                    'ok': True,
                    'endpoint': f'listings/{listing_id}',
                    'payload': {
                        'listing_id': listing_id,
                        'includes': includes.split(','),
                        'shop_id': source_shop_id,
                        'source_shop_key': source_shop_key,
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

        if path == '/etsy/test/listing/sales':
            try:
                listing_ids_raw = str((query_params.get('listing_ids') or [''])[0] or '').strip()
                listing_ids = [
                    listing_id for listing_id in (
                        str(part or '').strip() for part in listing_ids_raw.split(',')
                    ) if listing_id
                ]
                if not listing_ids:
                    self.send_json(400, {'error': 'listing_ids manquants pour lecture des ventes Etsy'})
                    return

                shop_context = get_etsy_shop_context(requested_shop_key)
                shop_id = shop_context['shop_id']
                summary = fetch_shop_receipt_transactions_summary(shop_id, requested_shop_key)
                sales_by_listing = summary.get('sales_by_listing') if isinstance(summary, dict) else {}
                filtered_sales = {
                    listing_id: int(sales_by_listing.get(listing_id, 0) or 0)
                    for listing_id in listing_ids
                }
                sales_windows_by_listing = summary.get('sales_windows_by_listing') if isinstance(summary, dict) else {}
                coverage_by_listing = summary.get('coverage_by_listing') if isinstance(summary, dict) else {}
                filtered_windows = {
                    listing_id: (
                        sales_windows_by_listing.get(listing_id)
                        if isinstance(sales_windows_by_listing.get(listing_id), dict)
                        else {'7d': 0, '30d': 0, 'lifetime': int(filtered_sales.get(listing_id, 0) or 0)}
                    )
                    for listing_id in listing_ids
                }
                filtered_coverage = {
                    listing_id: (
                        coverage_by_listing.get(listing_id)
                        if isinstance(coverage_by_listing.get(listing_id), dict)
                        else {'dated_transactions': 0, 'undated_transactions': 0, 'last_date_source': ''}
                    )
                    for listing_id in listing_ids
                }
                self.send_json(200, {
                    'ok': True,
                    'endpoint': f'shops/{shop_id}/receipts',
                    'payload': {
                        'shop_id': shop_id,
                        'listing_ids': listing_ids,
                        'sales_by_listing': filtered_sales,
                        'sales_windows_by_listing': filtered_windows,
                        'coverage_by_listing': filtered_coverage,
                        'receipt_count': int(summary.get('receipt_count', 0) or 0),
                        'transaction_count': int(summary.get('transaction_count', 0) or 0),
                        'page_count': int(summary.get('page_count', 0) or 0),
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
                    shop_key=requested_shop_key,
                )
                shop_id = get_listing_shop_id(listing_payload)
                payload = perform_etsy_get_request(
                    f'shops/{shop_id}/listings/{listing_id}/properties',
                    include_oauth=False,
                    shop_key=requested_shop_key,
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
                    shop_key=requested_shop_key,
                )
                shop_id = get_listing_shop_id(listing_payload)
                payload = perform_etsy_get_request(
                    f'shops/{shop_id}/listings/{listing_id}/variation-images',
                    include_oauth=False,
                    shop_key=requested_shop_key,
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
                auth_url = build_etsy_authorization_url(requested_shop_key)
                browser = str(query_params.get('browser', [''])[0] or '').strip().lower()
                launched = None
                if browser == 'opera':
                    launched = open_url_in_opera(auth_url)
                log_server_event(f'etsy auth start shop={requested_shop_key} browser={browser or "default"}')
                self.send_json(200, {
                    'ok': True,
                    'authUrl': auth_url,
                    'shopKey': requested_shop_key,
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
            requested_shop_key, pending_payload = find_pending_oauth_context_by_state(state)

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
                    shop_key=requested_shop_key,
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
        raw_qs = self.path.split('?', 1)[1] if '?' in self.path else ''
        query_params = urllib.parse.parse_qs(raw_qs)
        set_current_request_shop_key(resolve_requested_shop_key(query_params=query_params, headers=self.headers))

        if path.startswith('/pinterest/'):
            try:
                length = int(self.headers.get('Content-Length', 0))
                data = json.loads(self.rfile.read(length).decode('utf-8') or '{}')
                service = get_pinterest_service()
                if path == '/pinterest/boards/create':
                    result = service.create_board(
                        str(data.get('name') or ''),
                        str(data.get('description') or ''),
                        str(data.get('privacy') or 'PUBLIC'),
                    )
                elif path == '/pinterest/boards/update':
                    result = service.update_board(
                        str(data.get('boardId') or ''),
                        str(data.get('name') or ''),
                        str(data.get('description') or ''),
                    )
                elif path == '/pinterest/boards/delete':
                    result = service.delete_board(str(data.get('boardId') or ''))
                elif path == '/pinterest/sections/create':
                    result = service.create_section(str(data.get('boardId') or ''), str(data.get('name') or ''))
                elif path == '/pinterest/sections/update':
                    result = service.update_section(
                        str(data.get('boardId') or ''),
                        str(data.get('sectionId') or ''),
                        str(data.get('name') or ''),
                    )
                elif path == '/pinterest/sections/delete':
                    result = service.delete_section(
                        str(data.get('boardId') or ''),
                        str(data.get('sectionId') or ''),
                    )
                elif path == '/pinterest/queue/enqueue':
                    result = service.enqueue_batch(data)
                elif path == '/pinterest/queue/action':
                    result = service.queue_action(
                        str(data.get('action') or ''),
                        str(data.get('jobId') or ''),
                        str(data.get('batchId') or ''),
                    )
                elif path == '/pinterest/settings':
                    result = service.update_settings(data.get('intervalSeconds'), data.get('paused'))
                else:
                    self.send_json(404, {'error': 'Route Pinterest inconnue'})
                    return
                self.send_json(200, {'ok': True, 'result': result})
            except PinterestAPIError as error:
                self.send_json(error.status, {'error': str(error), 'pinterest': error.payload})
            except (TypeError, ValueError, json.JSONDecodeError) as error:
                self.send_json(400, {'error': str(error)})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path == '/instagram/test/media':
            length = int(self.headers.get('Content-Length', 0))
            try:
                if length <= 0:
                    raise ValueError('Aucune image reçue')
                if length > INSTAGRAM_MEDIA_MAX_BYTES:
                    raise ValueError('L’image dépasse la limite temporaire de 10 Mo')
                media_id = store_instagram_media(self.rfile.read(length))
                self.send_json(200, {
                    'ok': True,
                    'mediaId': media_id,
                    'bytes': length,
                })
            except ValueError as error:
                self.send_json(400, {'error': str(error)})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return
        if path == '/instagram/test/video':
            length = int(self.headers.get('Content-Length', 0))
            content_type = str(self.headers.get('Content-Type') or '').split(';', 1)[0].strip().lower()
            try:
                if content_type not in {'video/mp4', 'video/quicktime'}:
                    raise ValueError('La vidéo doit être un fichier MP4 ou MOV')
                media_id = store_instagram_video_stream(self.rfile, length, content_type)
                self.send_json(200, {
                    'ok': True,
                    'mediaId': media_id,
                    'bytes': length,
                })
            except ValueError as error:
                self.send_json(400, {'error': str(error)})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            return

        if path == '/tiktok/publish':
            length = int(self.headers.get('Content-Length', 0))
            media_paths = []
            try:
                data = json.loads(self.rfile.read(length).decode('utf-8') or '{}')
                if str(data.get('mode') or '').strip().lower() != 'reel':
                    raise ValueError(
                        'La review TikTok utilise une vidéo. Les carrousels photo nécessitent '
                        'un hébergement média stable vérifié.'
                    )
                raw_media_ids = data.get('mediaIds') or [data.get('mediaId')]
                media_ids = [
                    str(media_id or '').strip()
                    for media_id in raw_media_ids
                    if str(media_id or '').strip()
                ]
                if len(media_ids) != 1:
                    raise ValueError('Une publication vidéo TikTok exige exactement un fichier')
                media_paths = [resolve_instagram_media_path(media_ids[0])]
                video_path = media_paths[0]
                if video_path.suffix.lower() not in {'.mp4', '.mov', '.webm'}:
                    raise ValueError('Le média TikTok préparé n’est pas une vidéo compatible')

                result = publish_tiktok_video(
                    video_path,
                    title=str(data.get('title') or '').strip(),
                    privacy_level=str(data.get('privacyLevel') or 'SELF_ONLY').strip(),
                    disable_comment=bool(data.get('disableComment')),
                    disable_duet=bool(data.get('disableDuet')),
                    disable_stitch=bool(data.get('disableStitch')),
                    brand_organic=bool(data.get('brandOrganic')),
                    brand_content=bool(data.get('brandContent')),
                    cover_timestamp_ms=int(data.get('coverTimestampMs') or 0),
                    duration_seconds=float(data.get('durationSeconds') or 0),
                )
                self.send_json(200, {'ok': True, **result})
            except (TypeError, ValueError, json.JSONDecodeError) as error:
                self.send_json(400, {'error': str(error)})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            finally:
                for media_path in media_paths:
                    try:
                        media_path.unlink(missing_ok=True)
                    except OSError:
                        pass
            return


        if path == '/threads/publish':
            length = int(self.headers.get('Content-Length', 0))
            media_paths = []
            publication_id = ''
            stage = 'lecture de la demande'
            stage_details = {}
            try:
                data = json.loads(self.rfile.read(length).decode('utf-8') or '{}')
                raw_media_ids = data.get('mediaIds') or [data.get('mediaId')]
                media_ids = [
                    str(media_id or '').strip()
                    for media_id in raw_media_ids
                    if str(media_id or '').strip()
                ]
                text = str(data.get('text') or '').strip()
                mode = 'reel' if str(data.get('mode') or '').strip().lower() == 'reel' else 'carousel'

                if not media_ids:
                    raise ValueError('Aucun média préparé pour Threads')
                if len(media_ids) > 20:
                    raise ValueError('Threads accepte 20 médias maximum dans un carrousel')

                stage = 'vérification des médias locaux'
                media_paths = [resolve_instagram_media_path(media_id) for media_id in media_ids]
                stage = 'vérification du tunnel HTTPS'
                ensure_instagram_media_tunnel(media_ids[0])
                image_urls = [get_instagram_media_public_url(media_id) for media_id in media_ids]

                stage = 'lecture du profil Threads'
                profile = get_threads_profile()
                child_container_ids = []
                print(f'[Threads] Début publication mode={mode} médias={len(media_ids)} compte={profile.get("username") or profile["id"]}')

                if mode == 'reel':
                    if len(image_urls) != 1:
                        raise ValueError('Une publication vidéo Threads exige un seul fichier')
                    if media_paths[0].suffix not in {'.mp4', '.mov'}:
                        raise ValueError('Le média Threads préparé n’est pas une vidéo')
                    stage = 'création du conteneur vidéo'
                    container = perform_threads_request(
                        f'{profile["id"]}/threads',
                        method='POST',
                        data={'media_type': 'VIDEO', 'video_url': image_urls[0], 'text': text},
                    )
                    container_id = str(container.get('id') or '').strip()
                elif len(image_urls) == 1:
                    stage = 'création du conteneur image'
                    container = perform_threads_request(
                        f'{profile["id"]}/threads',
                        method='POST',
                        data={
                            'media_type': 'IMAGE',
                            'image_url': image_urls[0],
                            'text': text,
                        },
                    )
                    container_id = str(container.get('id') or '').strip()
                else:
                    total_children = len(image_urls)
                    for index, image_url in enumerate(image_urls, start=1):
                        stage = f'création du conteneur enfant {index}/{total_children}'
                        stage_details = {'childIndex': index, 'childCount': total_children}
                        child = perform_threads_request(
                            f'{profile["id"]}/threads',
                            method='POST',
                            data={
                                'media_type': 'IMAGE',
                                'image_url': image_url,
                                'is_carousel_item': 'true',
                            },
                        )
                        child_id = str(child.get('id') or '').strip()
                        if not child_id:
                            raise ValueError(f'Threads n’a pas retourné de conteneur enfant ({index}/{total_children})')
                        child_container_ids.append(child_id)
                        print(f'[Threads] Conteneur enfant {index}/{total_children} créé : {child_id}')

                    # Meta ne peut rattacher au parent que des enfants dont le
                    # média a fini d'être téléchargé et traité. L'ancien ordre
                    # créait le parent immédiatement, puis attendait les enfants,
                    # ce qui provoquait par intermittence le sous-code 4279004.
                    for index, child_id in enumerate(child_container_ids, start=1):
                        stage = f'attente du conteneur enfant {index}/{len(child_container_ids)}'
                        stage_details = {
                            'childIndex': index,
                            'childCount': len(child_container_ids),
                            'containerId': child_id,
                        }
                        wait_for_threads_container(child_id)

                    stage = 'création du conteneur carrousel'
                    stage_details = {'childCount': len(child_container_ids)}
                    parent = create_threads_carousel_container(
                        profile['id'],
                        child_container_ids,
                        text,
                    )
                    container_id = str(parent.get('id') or '').strip()

                if not container_id:
                    raise ValueError('Threads n’a pas retourné d’identifiant de conteneur')
                print(f'[Threads] Conteneur principal créé : {container_id}')

                stage = 'attente du conteneur principal'
                stage_details = {'containerId': container_id}
                wait_for_threads_container(
                    container_id,
                    attempts=90 if mode == 'reel' else 30,
                    delay_seconds=2.0,
                )

                stage = 'publication du conteneur Threads'
                stage_details = {'containerId': container_id}
                publication = publish_threads_container(profile['id'], container_id)
                publication_id = str(publication.get('id') or '').strip()
                if not publication_id:
                    raise ValueError('Threads n’a pas retourné d’identifiant de publication')

                print(f'[Threads] Publication réussie : {publication_id}')
                self.send_json(200, {
                    'ok': True,
                    'profile': profile,
                    'containerId': container_id,
                    'childContainerIds': child_container_ids,
                    'publicationId': publication_id,
                    'mediaCount': len(media_ids),
                })
            except json.JSONDecodeError:
                self.send_json(400, {'error': 'Corps JSON invalide', 'stage': stage})
            except ThreadsAPIError as error:
                readable_error = format_threads_api_error(error)
                diagnostic = {
                    'error': f'Échec Threads pendant {stage} : {readable_error}',
                    'stage': stage,
                    'threads': error.public_details(),
                    **stage_details,
                }
                print(f'[Threads] ÉCHEC étape={stage} détails={json.dumps(diagnostic, ensure_ascii=False)}')
                self.send_json(error.http_status if 400 <= error.http_status < 600 else 502, diagnostic)
            except ValueError as error:
                diagnostic = {
                    'error': f'Échec Threads pendant {stage} : {error}',
                    'stage': stage,
                    **stage_details,
                }
                print(f'[Threads] ÉCHEC étape={stage} erreur={error}')
                self.send_json(400, diagnostic)
            except Exception as error:
                diagnostic = {
                    'error': f'Échec Threads pendant {stage} : {type(error).__name__}: {error}',
                    'stage': stage,
                    **stage_details,
                }
                print(f'[Threads] ERREUR INATTENDUE étape={stage} type={type(error).__name__} erreur={error}')
                self.send_json(500, diagnostic)
            finally:
                if publication_id:
                    for media_path in media_paths:
                        try:
                            media_path.unlink()
                        except OSError:
                            pass
            return

        if path == '/facebook/publish-instagram':
            length = int(self.headers.get('Content-Length', 0))
            stage = 'lecture de la demande'
            stage_details = {}
            try:
                data = json.loads(self.rfile.read(length).decode('utf-8') or '{}')
                shop_key = normalize_etsy_shop_key(data.get('shopKey') or get_current_request_shop_key())
                set_current_request_shop_key(shop_key)
                instagram_media_id = str(data.get('instagramMediaId') or '').strip()

                stage = 'lecture de la publication Instagram'
                instagram_media = get_instagram_media_item(instagram_media_id)
                message = str(instagram_media.get('caption') or '').strip()
                media_type = str(instagram_media.get('media_type') or '').strip().upper()
                stage = 'vérification de la connexion Facebook'
                profile = get_facebook_page_profile(shop_key)
                child_media_ids = []
                video_id = ''

                if media_type == 'VIDEO':
                    media_url = str(instagram_media.get('media_url') or '').strip()
                    if not media_url:
                        raise ValueError('La vidéo Instagram n’a pas d’URL récupérable')
                    stage = 'téléchargement du Reel Instagram'
                    downloaded_reel_path = download_instagram_reel(media_url)
                    stage = 'création de la session Reel Facebook'
                    try:
                        reel = perform_facebook_request(
                            'me/video_reels',
                            method='POST',
                            data={'upload_phase': 'start'},
                            shop_key=shop_key,
                        )
                        video_id = str(reel.get('video_id') or '').strip()
                        upload_url = str(reel.get('upload_url') or '').strip()
                        if not video_id or not upload_url:
                            raise ValueError('Facebook n’a pas retourné de session d’upload Reel complète')
                        stage_details = {'videoId': video_id, 'instagramMediaId': instagram_media_id}
                        stage = 'transfert du Reel Instagram vers Facebook'
                        uploaded = upload_facebook_local_reel(upload_url, downloaded_reel_path, shop_key)
                        if uploaded.get('success') is not True:
                            raise ValueError('Facebook n’a pas confirmé le transfert du Reel')
                        stage = 'publication du Reel Facebook'
                        finished = perform_facebook_request(
                            'me/video_reels',
                            method='POST',
                            data={
                                'upload_phase': 'finish',
                                'video_id': video_id,
                                'video_state': 'PUBLISHED',
                                'description': message,
                            },
                            shop_key=shop_key,
                        )
                        if finished.get('success') is not True:
                            raise ValueError('Facebook n’a pas confirmé la publication du Reel')
                    finally:
                        downloaded_reel_path.unlink(missing_ok=True)
                    publication_id = video_id
                    mode = 'reel'
                    media_count = 1
                elif media_type == 'CAROUSEL_ALBUM':
                    children = instagram_media.get('children', {}).get('data', [])
                    children = children if isinstance(children, list) else []
                    if not children:
                        raise ValueError('Le carrousel Instagram ne contient aucun média récupérable')
                    if len(children) > 10:
                        raise ValueError('Le carrousel Instagram dépasse la limite de 10 médias de cet écran')
                    non_image_children = [
                        child for child in children
                        if str(child.get('media_type') or '').strip().upper() != 'IMAGE'
                    ]
                    if non_image_children:
                        raise ValueError(
                            'Le rattrapage automatique ne prend pas encore en charge les carrousels Instagram contenant des vidéos'
                        )
                    for index, child in enumerate(children, start=1):
                        media_url = str(child.get('media_url') or '').strip()
                        if not media_url:
                            raise ValueError(f'La photo Instagram {index} n’a pas d’URL récupérable')
                        stage = f'préparation de la photo Facebook {index}/{len(children)}'
                        stage_details = {
                            'mediaIndex': index,
                            'mediaCount': len(children),
                            'instagramMediaId': instagram_media_id,
                        }
                        photo = perform_facebook_request(
                            f'{profile["id"]}/photos',
                            method='POST',
                            data={'url': media_url, 'published': 'false'},
                            shop_key=shop_key,
                        )
                        photo_id = str(photo.get('id') or '').strip()
                        if not photo_id:
                            raise ValueError(f'Facebook n’a pas retourné l’identifiant de la photo {index}')
                        child_media_ids.append(photo_id)
                    stage = 'publication du carrousel Facebook'
                    feed_data = {'message': message}
                    for index, photo_id in enumerate(child_media_ids):
                        feed_data[f'attached_media[{index}]'] = json.dumps({'media_fbid': photo_id})
                    post = perform_facebook_request(
                        f'{profile["id"]}/feed',
                        method='POST',
                        data=feed_data,
                        shop_key=shop_key,
                    )
                    publication_id = str(post.get('id') or '').strip()
                    mode = 'carousel'
                    media_count = len(children)
                elif media_type == 'IMAGE':
                    media_url = str(instagram_media.get('media_url') or '').strip()
                    if not media_url:
                        raise ValueError('La photo Instagram n’a pas d’URL récupérable')
                    stage = 'publication de la photo Facebook'
                    photo = perform_facebook_request(
                        f'{profile["id"]}/photos',
                        method='POST',
                        data={'url': media_url, 'message': message},
                        shop_key=shop_key,
                    )
                    publication_id = str(photo.get('post_id') or photo.get('id') or '').strip()
                    mode = 'image'
                    media_count = 1
                else:
                    raise ValueError(f'Type de publication Instagram non pris en charge : {media_type or "inconnu"}')

                if not publication_id:
                    raise ValueError('Facebook n’a pas retourné d’identifiant de publication')
                print(
                    f'[Facebook] Rattrapage Instagram réussi : instagram={instagram_media_id} '
                    f'facebook={publication_id} boutique={shop_key}'
                )
                self.send_json(200, {
                    'ok': True,
                    'profile': profile,
                    'instagramMediaId': instagram_media_id,
                    'publicationId': publication_id,
                    'videoId': video_id or None,
                    'childMediaIds': child_media_ids,
                    'mediaCount': media_count,
                    'mode': mode,
                    'shopKey': shop_key,
                })
            except json.JSONDecodeError:
                self.send_json(400, {'error': 'Corps JSON invalide', 'stage': stage})
            except FacebookAPIError as error:
                diagnostic = {
                    'error': f'Échec du rattrapage Facebook pendant {stage} : {error}',
                    'stage': stage,
                    'facebook': error.public_details(),
                    **stage_details,
                }
                print(f'[Facebook] ÉCHEC RATTRAPAGE étape={stage} détails={json.dumps(diagnostic, ensure_ascii=False)}')
                self.send_json(error.http_status if 400 <= error.http_status < 600 else 502, diagnostic)
            except ValueError as error:
                self.send_json(400, {
                    'error': f'Échec du rattrapage Facebook pendant {stage} : {error}',
                    'stage': stage,
                    **stage_details,
                })
            except Exception as error:
                self.send_json(500, {
                    'error': f'Échec du rattrapage Facebook pendant {stage} : {type(error).__name__}: {error}',
                    'stage': stage,
                    **stage_details,
                })
            return

        if path == '/facebook/publish':
            length = int(self.headers.get('Content-Length', 0))
            media_paths = []
            publication_id = ''
            stage = 'lecture de la demande'
            stage_details = {}
            dry_run = False
            try:
                data = json.loads(self.rfile.read(length).decode('utf-8') or '{}')
                shop_key = normalize_etsy_shop_key(data.get('shopKey') or get_current_request_shop_key())
                set_current_request_shop_key(shop_key)
                raw_media_ids = data.get('mediaIds') or [data.get('mediaId')]
                media_ids = [
                    str(media_id or '').strip()
                    for media_id in raw_media_ids
                    if str(media_id or '').strip()
                ]
                message = str(data.get('message') or '').strip()
                mode = 'reel' if str(data.get('mode') or '').strip().lower() == 'reel' else 'carousel'
                dry_run = bool(data.get('dryRun'))

                if not media_ids:
                    raise ValueError('Aucun média préparé pour Facebook')
                if len(media_ids) > 10:
                    raise ValueError('La publication Facebook est limitée à 10 médias dans cet écran')
                if not message:
                    raise ValueError('Le texte de la publication Facebook est vide')

                stage = 'vérification de la configuration Facebook'
                profile = get_facebook_page_profile(shop_key)
                stage = 'vérification des médias locaux'
                media_paths = [resolve_instagram_media_path(media_id) for media_id in media_ids]
                stage = 'vérification du tunnel HTTPS'
                ensure_instagram_media_tunnel(media_ids[0])
                media_urls = [get_instagram_media_public_url(media_id) for media_id in media_ids]

                if dry_run:
                    self.send_json(200, {
                        'ok': True,
                        'dryRun': True,
                        'profile': profile,
                        'mediaIds': media_ids,
                        'mediaCount': len(media_ids),
                        'mode': mode,
                    })
                    return

                print(
                    f'[Facebook] Début publication mode={mode} médias={len(media_ids)} '
                    f'page={profile.get("name") or profile["id"]} boutique={shop_key}'
                )
                child_media_ids = []
                video_id = ''

                if mode == 'reel':
                    if len(media_urls) != 1:
                        raise ValueError('Un Reel Facebook exige une seule vidéo')
                    if media_paths[0].suffix not in {'.mp4', '.mov'}:
                        raise ValueError('Le média Facebook préparé n’est pas une vidéo')

                    stage = 'création de la session Reel Facebook'
                    reel = perform_facebook_request(
                        'me/video_reels',
                        method='POST',
                        data={'upload_phase': 'start'},
                        shop_key=shop_key,
                    )
                    video_id = str(reel.get('video_id') or '').strip()
                    upload_url = str(reel.get('upload_url') or '').strip()
                    if not video_id or not upload_url:
                        raise ValueError('Facebook n’a pas retourné de session d’upload Reel complète')

                    stage = 'upload du Reel Facebook'
                    stage_details = {'videoId': video_id}
                    uploaded = upload_facebook_local_reel(upload_url, media_paths[0], shop_key)
                    if uploaded.get('success') is not True:
                        raise ValueError('Facebook n’a pas confirmé l’upload du Reel')

                    stage = 'publication du Reel Facebook'
                    finished = perform_facebook_request(
                        'me/video_reels',
                        method='POST',
                        data={
                            'upload_phase': 'finish',
                            'video_id': video_id,
                            'video_state': 'PUBLISHED',
                            'description': message,
                        },
                        shop_key=shop_key,
                    )
                    if finished.get('success') is not True:
                        raise ValueError('Facebook n’a pas confirmé la publication du Reel')
                    publication_id = video_id
                elif len(media_urls) == 1:
                    if media_paths[0].suffix != '.jpg':
                        raise ValueError('La publication photo Facebook attend une image JPEG')
                    stage = 'publication de la photo Facebook'
                    photo = perform_facebook_request(
                        f'{profile["id"]}/photos',
                        method='POST',
                        data={'url': media_urls[0], 'message': message},
                        shop_key=shop_key,
                    )
                    publication_id = str(photo.get('post_id') or photo.get('id') or '').strip()
                else:
                    for index, media_url in enumerate(media_urls, start=1):
                        if media_paths[index - 1].suffix != '.jpg':
                            raise ValueError('Le carrousel Facebook attend uniquement des images JPEG')
                        stage = f'préparation de la photo Facebook {index}/{len(media_urls)}'
                        stage_details = {'mediaIndex': index, 'mediaCount': len(media_urls)}
                        photo = perform_facebook_request(
                            f'{profile["id"]}/photos',
                            method='POST',
                            data={'url': media_url, 'published': 'false'},
                            shop_key=shop_key,
                        )
                        photo_id = str(photo.get('id') or '').strip()
                        if not photo_id:
                            raise ValueError(f'Facebook n’a pas retourné l’identifiant de la photo {index}')
                        child_media_ids.append(photo_id)

                    stage = 'publication du carrousel Facebook'
                    stage_details = {'childCount': len(child_media_ids)}
                    feed_data = {'message': message}
                    for index, photo_id in enumerate(child_media_ids):
                        feed_data[f'attached_media[{index}]'] = json.dumps({'media_fbid': photo_id})
                    post = perform_facebook_request(
                        f'{profile["id"]}/feed',
                        method='POST',
                        data=feed_data,
                        shop_key=shop_key,
                    )
                    publication_id = str(post.get('id') or '').strip()

                if not publication_id:
                    raise ValueError('Facebook n’a pas retourné d’identifiant de publication')

                print(f'[Facebook] Publication réussie : {publication_id}')
                self.send_json(200, {
                    'ok': True,
                    'profile': profile,
                    'publicationId': publication_id,
                    'videoId': video_id or None,
                    'childMediaIds': child_media_ids,
                    'mediaCount': len(media_ids),
                    'mode': mode,
                    'shopKey': shop_key,
                })
            except json.JSONDecodeError:
                self.send_json(400, {'error': 'Corps JSON invalide', 'stage': stage})
            except FacebookAPIError as error:
                diagnostic = {
                    'error': f'Échec Facebook pendant {stage} : {error}',
                    'stage': stage,
                    'facebook': error.public_details(),
                    **stage_details,
                }
                print(f'[Facebook] ÉCHEC étape={stage} détails={json.dumps(diagnostic, ensure_ascii=False)}')
                self.send_json(error.http_status if 400 <= error.http_status < 600 else 502, diagnostic)
            except ValueError as error:
                diagnostic = {
                    'error': f'Échec Facebook pendant {stage} : {error}',
                    'stage': stage,
                    **stage_details,
                }
                print(f'[Facebook] ÉCHEC étape={stage} erreur={error}')
                self.send_json(400, diagnostic)
            except Exception as error:
                diagnostic = {
                    'error': f'Échec Facebook pendant {stage} : {type(error).__name__}: {error}',
                    'stage': stage,
                    **stage_details,
                }
                print(f'[Facebook] ERREUR INATTENDUE étape={stage} type={type(error).__name__} erreur={error}')
                self.send_json(500, diagnostic)
            finally:
                if publication_id and not dry_run:
                    for media_path in media_paths:
                        try:
                            media_path.unlink()
                        except OSError:
                            pass
            return

        if path == '/instagram/test/publish':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            media_paths = []
            dry_run = False
            try:
                data = json.loads(body or '{}')
                raw_media_ids = data.get('mediaIds') or [data.get('mediaId')]
                media_ids = [str(media_id or '').strip() for media_id in raw_media_ids if str(media_id or '').strip()]
                caption = str(data.get('caption') or '').strip()
                first_comment = str(data.get('firstComment') or '').strip()
                cover_media_id = str(data.get('coverMediaId') or '').strip()
                dry_run = bool(data.get('dryRun'))
                mode = 'reel' if str(data.get('mode') or '').strip().lower() == 'reel' else 'carousel'
                if cover_media_id and mode != 'reel':
                    raise ValueError('Une couverture personnalisée est réservée aux Reels Instagram')
                raw_thumb_offset = data.get('thumbOffsetMs')
                thumb_offset_ms = 0
                if mode == 'reel' and raw_thumb_offset not in (None, ''):
                    try:
                        thumb_offset_ms = int(raw_thumb_offset)
                    except (TypeError, ValueError) as error:
                        raise ValueError('La position de la couverture du Reel est invalide') from error
                    if thumb_offset_ms < 0:
                        raise ValueError('La position de la couverture du Reel doit être positive')

                if not media_ids:
                    raise ValueError('Aucun média préparé pour Instagram')
                if len(media_ids) > 10:
                    raise ValueError('Instagram accepte 10 images maximum dans ce carrousel')
                if not caption:
                    raise ValueError('Le texte de la publication est vide')
                if len(caption) > 2200:
                    raise ValueError('Le texte Instagram dépasse 2200 caractères')

                media_paths = [resolve_instagram_media_path(media_id) for media_id in media_ids]
                cover_path = None
                if cover_media_id:
                    cover_path = resolve_instagram_media_path(cover_media_id)
                    if cover_path.suffix != '.jpg':
                        raise ValueError('La couverture personnalisée Instagram doit être une image JPEG')
                    media_paths.append(cover_path)
                ensure_instagram_media_tunnel(media_ids[0])
                image_urls = [get_instagram_media_public_url(media_id) for media_id in media_ids]
                cover_url = get_instagram_media_public_url(cover_media_id) if cover_media_id else ''
                if dry_run:
                    self.send_json(200, {
                        'ok': True,
                        'dryRun': True,
                        'mediaIds': media_ids,
                        'mediaCount': len(media_ids),
                        'imageUrls': image_urls,
                        'thumbOffsetMs': thumb_offset_ms if mode == 'reel' else None,
                        'coverMediaId': cover_media_id or None,
                        'coverUrl': cover_url or None,
                    })
                    return

                profile = get_instagram_profile()
                child_container_ids = []
                if mode == 'reel':
                    if len(image_urls) != 1:
                        raise ValueError('Un Reel Instagram exige une seule vidéo')
                    if media_paths[0].suffix not in {'.mp4', '.mov'}:
                        raise ValueError('Le média Instagram préparé n’est pas une vidéo')
                    reel_data = build_instagram_reel_container_data(
                        image_urls[0],
                        caption,
                        thumb_offset_ms,
                        cover_url,
                    )
                    container = perform_instagram_request(
                        f'{profile["id"]}/media',
                        method='POST',
                        data=reel_data,
                    )
                    container_id = str(container.get('id') or '').strip()
                elif len(image_urls) == 1:
                    container = perform_instagram_request(
                        f'{profile["id"]}/media',
                        method='POST',
                        data={'image_url': image_urls[0], 'caption': caption},
                    )
                    container_id = str(container.get('id') or '').strip()
                else:
                    for image_url in image_urls:
                        child = perform_instagram_request(
                            f'{profile["id"]}/media',
                            method='POST',
                            data={'image_url': image_url, 'is_carousel_item': 'true'},
                        )
                        child_id = str(child.get('id') or '').strip()
                        if not child_id:
                            raise ValueError('Instagram n’a pas retourné un conteneur enfant du carrousel')
                        wait_for_instagram_container(child_id)
                        child_container_ids.append(child_id)
                    parent = perform_instagram_request(
                        f'{profile["id"]}/media',
                        method='POST',
                        data={
                            'media_type': 'CAROUSEL',
                            'children': ','.join(child_container_ids),
                            'caption': caption,
                        },
                    )
                    container_id = str(parent.get('id') or '').strip()

                if not container_id:
                    raise ValueError('Instagram n’a pas retourné d’identifiant de conteneur')
                wait_for_instagram_container(container_id, attempts=90 if mode == 'reel' else 6)
                publication = perform_instagram_request(
                    f'{profile["id"]}/media_publish',
                    method='POST',
                    data={'creation_id': container_id},
                )
                publication_id = str(publication.get('id') or '').strip()
                if not publication_id:
                    raise ValueError('Instagram n’a pas retourné d’identifiant de publication')

                comment_id = ''
                comment_error = ''
                if first_comment:
                    try:
                        comment = perform_instagram_request(
                            f'{publication_id}/comments',
                            method='POST',
                            data={'message': first_comment},
                        )
                        comment_id = str(comment.get('id') or '').strip()
                    except Exception as error:
                        comment_error = str(error)

                self.send_json(200, {
                    'ok': True,
                    'profile': profile,
                    'containerId': container_id,
                    'childContainerIds': child_container_ids,
                    'publicationId': publication_id,
                    'commentId': comment_id,
                    'commentError': comment_error,
                    'mediaCount': len(media_ids),
                })
            except json.JSONDecodeError:
                self.send_json(400, {'error': 'Corps JSON invalide'})
            except ValueError as error:
                self.send_json(400, {'error': str(error)})
            except Exception as error:
                self.send_json(500, {'error': str(error)})
            finally:
                if not dry_run:
                    for media_path in media_paths:
                        try:
                            media_path.unlink()
                        except OSError:
                            pass
            return
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
                requested_shop_key = resolve_requested_shop_key(query_params=query_params, body_data=data, headers=self.headers)
                set_current_request_shop_key(requested_shop_key)
                log_server_event(f'POST {path} shop={requested_shop_key}')
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

                oversized_alt_indexes = get_oversized_publication_alt_text_indexes(images_payload)
                if oversized_alt_indexes:
                    self.send_json(400, {
                        'error': 'Balise ALT Etsy superieure a 500 caracteres',
                        'image_indexes': oversized_alt_indexes,
                        'max_length': 500,
                    })
                    return

                publication_mode = str(data.get('mode') or 'create_draft').strip().lower() or 'create_draft'
                source_shop_key_raw = str(
                    data.get('sourceShopKey') or data.get('source_shop_key') or ''
                ).strip()
                source_shop_key = normalize_etsy_shop_key(source_shop_key_raw) if source_shop_key_raw else ''
                target_listing_id = str(
                    data.get('targetListingId')
                    or listing_payload.get('listing_id')
                    or update_payload.get('listing_id')
                    or ''
                ).strip()

                require_etsy_scope('listings_w', requested_shop_key)
                shop_context = get_etsy_shop_context(requested_shop_key)
                shop_id = shop_context['shop_id']
                is_cross_shop_draft_copy = publication_mode == 'create_draft' and source_shop_key and source_shop_key != requested_shop_key
                log_server_event(
                    f'POST {path} publication_mode={publication_mode} source_shop={source_shop_key or "unknown"} '
                    f'target_shop={requested_shop_key} cross_shop={str(is_cross_shop_draft_copy).lower()} '
                    f'images={len(images_payload) if isinstance(images_payload, list) else 0} '
                    f'videos={len(videos_payload) if isinstance(videos_payload, list) else 0}'
                )

                if publication_mode in {'update_listing', 'update_expired_listing'}:
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

                    if publication_mode == 'update_expired_listing':
                        current_listing_response = perform_etsy_get_request(
                            f'listings/{target_listing_id}?includes=Images,Videos&legacy=true&allow_suggested_title=true',
                            include_oauth=True,
                            shop_key=requested_shop_key,
                        )
                    else:
                        current_listing_response = perform_etsy_get_request(
                            f'shops/{shop_id}/listings/{target_listing_id}?includes=Images,Videos',
                            include_oauth=True,
                            shop_key=requested_shop_key,
                        )
                    current_listing_data = current_listing_response.get('results', [{}])[0] if isinstance(current_listing_response.get('results'), list) and current_listing_response.get('results') else current_listing_response.get('data', current_listing_response)
                    current_listing_state = str(current_listing_data.get('state') or '').strip().lower()

                    operations = [{
                        'step': 'load_target_listing',
                        'listing_id': target_listing_id,
                        'source_state': current_listing_state,
                    }]

                    prepared_images = prepare_publication_image_uploads(images_payload) if images_payload else []
                    prepared_videos = prepare_publication_video_uploads(videos_payload) if videos_payload else []
                    existing_image_ids = extract_etsy_listing_image_ids(current_listing_response) if images_payload else []
                    existing_video_ids = extract_etsy_listing_video_ids(current_listing_response) if videos_payload else []

                    if media_plan_payload:
                        operations.append({
                            'step': 'prepare_listing_media',
                            'source_image_count': int(media_plan_payload.get('sourceImageCount') or 0),
                            'source_video_count': int(media_plan_payload.get('sourceVideoCount') or 0),
                            'local_image_count': int(media_plan_payload.get('localImageCount') or 0),
                            'local_video_count': int(media_plan_payload.get('localVideoCount') or 0),
                            'ordered_media_count': int(media_plan_payload.get('orderedMediaCount') or 0),
                            'planned_image_count': int(media_plan_payload.get('plannedImageCount') or 0),
                            'planned_video_count': int(media_plan_payload.get('plannedVideoCount') or 0),
                            'skipped_video_count': int(media_plan_payload.get('skippedVideoCount') or 0),
                        })

                    if images_payload and not prepared_images:
                        self.send_json(400, {'error': 'Aucune image publiable preparee pour la mise a jour Etsy'})
                        return
                    if images_payload and len(prepared_images) != len(images_payload):
                        self.send_json(400, {
                            'error': 'Certaines images n ont pas pu etre preparees pour la mise a jour Etsy',
                            'requested_image_count': len(images_payload),
                            'prepared_image_count': len(prepared_images),
                            'source_image_count': int(media_plan_payload.get('sourceImageCount') or 0),
                            'planned_image_count': int(media_plan_payload.get('plannedImageCount') or 0),
                        })
                        return

                    if normalized_update_listing_payload:
                        update_tags = normalized_update_listing_payload.get('tags') or []
                        has_long_tag = any(len(str(tag or '').strip()) > 20 for tag in update_tags)
                        use_french_translation_tags = (
                            publication_mode == 'update_expired_listing'
                            and current_listing_state == 'expired'
                            and has_long_tag
                        )
                        main_update_payload = (
                            {
                                key: value
                                for key, value in normalized_update_listing_payload.items()
                                if key != 'tags'
                            }
                            if use_french_translation_tags
                            else normalized_update_listing_payload
                        )

                        if main_update_payload:
                            pause_etsy_publication_requests()
                            update_response = perform_etsy_patch_form_request(
                                f'shops/{shop_id}/listings/{target_listing_id}',
                                main_update_payload,
                                include_oauth=True,
                                shop_key=requested_shop_key,
                            )
                            operations.append({
                                'step': 'update_listing',
                                'endpoint': f'shops/{shop_id}/listings/{target_listing_id}',
                                'mode': publication_mode,
                                'payload_sent': main_update_payload,
                                'response': update_response,
                            })

                        if use_french_translation_tags:
                            translation_path = f'shops/{shop_id}/listings/{target_listing_id}/translations/fr'
                            translation_payload = {
                                'title': str(normalized_update_listing_payload.get('title') or '').strip(),
                                'description': str(normalized_update_listing_payload.get('description') or ''),
                                'tags': [str(tag or '').strip() for tag in update_tags if str(tag or '').strip()],
                            }
                            try:
                                perform_etsy_get_request(
                                    translation_path,
                                    include_oauth=True,
                                    shop_key=requested_shop_key,
                                )
                                translation_method = 'PUT'
                            except urllib.error.HTTPError as translation_get_error:
                                if translation_get_error.code != 404:
                                    raise
                                translation_method = 'POST'

                            pause_etsy_publication_requests()
                            if translation_method == 'PUT':
                                translation_response = perform_etsy_put_form_request(
                                    translation_path,
                                    translation_payload,
                                    include_oauth=True,
                                    shop_key=requested_shop_key,
                                )
                            else:
                                translation_response = perform_etsy_post_form_request(
                                    translation_path,
                                    translation_payload,
                                    include_oauth=True,
                                    shop_key=requested_shop_key,
                                )
                            operations.append({
                                'step': 'update_expired_listing_french_tags',
                                'endpoint': translation_path,
                                'method': translation_method,
                                'payload_sent': translation_payload,
                                'response': translation_response,
                            })

                        if not main_update_payload and not use_french_translation_tags:
                            raise ValueError('Aucun champ de mise a jour Etsy exploitable')

                    if images_payload:
                        deleted_image_ids = []

                        # Etsy refuse de supprimer la derniere image d'une fiche.
                        # Sequence sure:
                        # - garder 1 image source si elle existe
                        # - supprimer le reste
                        # - uploader la premiere nouvelle image
                        # - supprimer l image retenue
                        # - uploader les autres nouvelles images
                        retained_image_id = existing_image_ids[0] if existing_image_ids else 0
                        removable_image_ids = existing_image_ids[1:] if retained_image_id else []

                        for image_id in removable_image_ids:
                            pause_etsy_publication_requests()
                            delete_response = perform_etsy_delete_request(
                                f'shops/{shop_id}/listings/{target_listing_id}/images/{image_id}',
                                include_oauth=True,
                                shop_key=requested_shop_key,
                            )
                            deleted_image_ids.append({
                                'listing_image_id': image_id,
                                'response': delete_response,
                            })

                        uploaded_images = []
                        remaining_prepared_images = list(prepared_images)
                        if retained_image_id and remaining_prepared_images:
                            first_uploaded_images = upload_listing_image_payloads(
                                shop_id,
                                target_listing_id,
                                [remaining_prepared_images[0]],
                                shop_key=requested_shop_key,
                            )
                            uploaded_images.extend(first_uploaded_images)
                            remaining_prepared_images = remaining_prepared_images[1:]

                            pause_etsy_publication_requests()
                            retained_delete_response = perform_etsy_delete_request(
                                f'shops/{shop_id}/listings/{target_listing_id}/images/{retained_image_id}',
                                include_oauth=True,
                                shop_key=requested_shop_key,
                            )
                            deleted_image_ids.append({
                                'listing_image_id': retained_image_id,
                                'response': retained_delete_response,
                            })
                        elif retained_image_id and not remaining_prepared_images:
                            deleted_image_ids.append({
                                'listing_image_id': retained_image_id,
                                'response': {'status': 'kept', 'reason': 'aucune nouvelle image preparee'},
                            })

                        if remaining_prepared_images:
                            uploaded_images.extend(upload_listing_image_payloads(
                                shop_id,
                                target_listing_id,
                                remaining_prepared_images,
                                shop_key=requested_shop_key,
                            ))

                        operations.append({
                            'step': 'delete_listing_images',
                            'endpoint': f'shops/{shop_id}/listings/{target_listing_id}/images/{{listing_image_id}}',
                            'deleted_count': len(deleted_image_ids),
                            'images': deleted_image_ids,
                        })
                        operations.append({
                            'step': 'upload_listing_images',
                            'endpoint': f'shops/{shop_id}/listings/{target_listing_id}/images',
                            'requested_count': len(images_payload),
                            'uploaded_count': len(uploaded_images),
                            'images': uploaded_images,
                        })

                    if videos_payload:
                        deleted_video_ids = []
                        for video_id in existing_video_ids:
                            pause_etsy_publication_requests()
                            delete_response = perform_etsy_delete_request(
                                f'shops/{shop_id}/listings/{target_listing_id}/videos/{video_id}',
                                include_oauth=True,
                                shop_key=requested_shop_key,
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

                    uploaded_videos = []
                    for prepared_video in prepared_videos:
                        pause_etsy_publication_requests()
                        video_response = perform_etsy_post_multipart_request(
                            f'shops/{shop_id}/listings/{target_listing_id}/videos',
                            include_oauth=True,
                            shop_key=requested_shop_key,
                            fields=prepared_video['fields_sent'],
                            file_field_name='video',
                            filename=prepared_video['filename'],
                            media_type=prepared_video['media_type'],
                            payload=prepared_video['payload'],
                        )
                        uploaded_videos.append({
                            'index': prepared_video['index'],
                            'mode': prepared_video['mode'],
                            'fields_sent': prepared_video['fields_sent'],
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
                        'mode': publication_mode,
                        'listing_id': target_listing_id,
                        'payload_sent': normalized_update_listing_payload,
                        'payload': current_listing_response,
                        'operations': operations,
                    })
                    return

                prepared_images = prepare_publication_image_uploads(images_payload) if images_payload else []
                prepared_videos = prepare_publication_video_uploads(videos_payload) if videos_payload else []

                if images_payload and not prepared_images:
                    self.send_json(400, {'error': 'Aucune image publiable preparee pour la creation du draft Etsy'})
                    return
                if images_payload and len(prepared_images) != len(images_payload):
                    self.send_json(400, {
                        'error': 'Certaines images n ont pas pu etre preparees pour la creation du draft Etsy',
                        'requested_image_count': len(images_payload),
                        'prepared_image_count': len(prepared_images),
                        'source_image_count': int(media_plan_payload.get('sourceImageCount') or 0),
                        'planned_image_count': int(media_plan_payload.get('plannedImageCount') or 0),
                    })
                    return

                if videos_payload and not prepared_videos:
                    self.send_json(400, {'error': 'Aucune video publiable preparee pour la creation du draft Etsy'})
                    return

                create_payload = {
                    key: value
                    for key, value in listing_payload.items()
                    if key not in {'listing_id', 'state', 'inventory', 'images', 'videos'}
                }

                if is_cross_shop_draft_copy:
                    create_payload.pop('section_id', None)
                    create_payload.pop('shop_section_id', None)
                    update_payload = {
                        key: value
                        for key, value in update_payload.items()
                        if key != 'section_id'
                    }
                    resolved_shipping_profile_id = resolve_etsy_shipping_profile_id_for_shop(
                        shop_id,
                        requested_shop_key,
                        create_payload.get('shipping_profile_id'),
                    )
                    if resolved_shipping_profile_id:
                        create_payload['shipping_profile_id'] = resolved_shipping_profile_id
                    else:
                        self.send_json(400, {'error': 'Aucun profil de livraison disponible sur la boutique cible pour le transfert inter-boutique'})
                        return
                    resolved_readiness_state_id = resolve_etsy_readiness_state_id_for_shop(
                        shop_id,
                        requested_shop_key,
                        create_payload.get('readiness_state_id'),
                    )
                    if resolved_readiness_state_id:
                        create_payload['readiness_state_id'] = resolved_readiness_state_id
                    else:
                        create_payload.pop('readiness_state_id', None)
                    if isinstance(inventory_payload, dict):
                        inventory_payload = {
                            **inventory_payload,
                            'readiness_state_on_property': [],
                            'products': [
                                {
                                    **product,
                                    'offerings': [
                                        {
                                            **offering,
                                            **(
                                                {'readiness_state_id': create_payload['readiness_state_id']}
                                                if create_payload.get('readiness_state_id')
                                                else {}
                                            ),
                                        }
                                        for offering in (product.get('offerings') or [])
                                        if isinstance(offering, dict)
                                    ],
                                }
                                for product in (inventory_payload.get('products') or [])
                                if isinstance(product, dict)
                            ],
                        }

                create_response = perform_etsy_post_form_request(
                    f'shops/{shop_id}/listings',
                    create_payload,
                    include_oauth=True,
                    shop_key=requested_shop_key,
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
                        'local_video_count': int(media_plan_payload.get('localVideoCount') or 0),
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
                        shop_key=requested_shop_key,
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
                            shop_key=requested_shop_key,
                        )
                        operations.append({
                            'step': 'update_listing_inventory',
                            'endpoint': f'listings/{created_listing_id}/inventory',
                            'payload_sent': normalized_inventory_payload,
                            'response': inventory_response,
                        })

                uploaded_images = upload_listing_image_payloads(
                    shop_id,
                    created_listing_id,
                    prepared_images,
                    shop_key=requested_shop_key,
                ) if prepared_images else []

                if uploaded_images:
                    operations.append({
                        'step': 'upload_listing_images',
                        'endpoint': f'shops/{shop_id}/listings/{created_listing_id}/images',
                        'requested_count': len(images_payload),
                        'uploaded_count': len(uploaded_images),
                        'images': uploaded_images,
                    })

                uploaded_videos = []
                for prepared_video in prepared_videos:
                    pause_etsy_publication_requests()
                    video_response = perform_etsy_post_multipart_request(
                        f'shops/{shop_id}/listings/{created_listing_id}/videos',
                        include_oauth=True,
                        shop_key=requested_shop_key,
                        fields=prepared_video['fields_sent'],
                        file_field_name='video',
                        filename=prepared_video['filename'],
                        media_type=prepared_video['media_type'],
                        payload=prepared_video['payload'],
                    )

                    uploaded_videos.append({
                        'index': prepared_video['index'],
                        'mode': prepared_video['mode'],
                        'fields_sent': prepared_video['fields_sent'],
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
                                shop_key=requested_shop_key,
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
                                shop_key=requested_shop_key,
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
                requested_shop_key = resolve_requested_shop_key(query_params=query_params, body_data=data, headers=self.headers)
                set_current_request_shop_key(requested_shop_key)
                log_server_event(f'POST {path} shop={requested_shop_key}')
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
                if language not in {'en', 'de', 'es', 'fr', 'it', 'nl', 'pt'}:
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

                require_etsy_scope('listings_w', requested_shop_key)
                shop_context = get_etsy_shop_context(requested_shop_key)
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


class InstagramMediaHandler(http.server.BaseHTTPRequestHandler):
    def send_media(self, include_body: bool):
        path = urllib.parse.unquote(self.path.split('?', 1)[0])
        if not path.startswith('/media/'):
            self.send_error(404)
            return

        try:
            media_path = resolve_instagram_media_path(path.removeprefix('/media/'))
        except ValueError:
            self.send_error(404)
            return

        size = media_path.stat().st_size
        content_type = {'.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.mov': 'video/quicktime'}[media_path.suffix]
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(size))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        if include_body:
            with media_path.open('rb') as source:
                shutil.copyfileobj(source, self.wfile)

    def do_GET(self):
        self.send_media(include_body=True)

    def do_HEAD(self):
        self.send_media(include_body=False)

    def log_message(self, format, *args):
        return


class ThreadingLocalServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def start_instagram_media_server() -> ThreadingLocalServer:
    server = ThreadingLocalServer(('127.0.0.1', INSTAGRAM_MEDIA_LOCAL_PORT), InstagramMediaHandler)
    Thread(target=server.serve_forever, name='instagram-media-server', daemon=True).start()
    return server


def main():
    global INSTAGRAM_MEDIA_PUBLIC_BASE, INSTAGRAM_MEDIA_TUNNEL_PROCESS, INSTAGRAM_MEDIA_TUNNEL_LOG, PINTEREST_SERVICE

    load_dotenv_file()
    PINTEREST_SERVICE = PinterestService(ROOT)
    PINTEREST_SERVICE.start()
    try:
        sys.stdout.reconfigure(errors='replace')
    except Exception:
        pass

    # Créer les dossiers s'ils n'existent pas
    for d in ALLOWED_DIRS:
        (ROOT / d).mkdir(exist_ok=True)
        for sub in ALLOWED_SUBDIRS:
            (ROOT / d / sub).mkdir(exist_ok=True)

    clear_instagram_media_cache()
    instagram_media_server = start_instagram_media_server()

    # Le tunnel lancé au démarrage doit être enregistré dans les mêmes variables
    # globales que celles utilisées par ensure_instagram_media_tunnel(). Sans cela,
    # la première publication croit que le tunnel n'existe pas et en lance un second.
    stop_instagram_media_tunnel()
    try:
        (
            INSTAGRAM_MEDIA_TUNNEL_PROCESS,
            INSTAGRAM_MEDIA_PUBLIC_BASE,
            INSTAGRAM_MEDIA_TUNNEL_LOG,
        ) = start_instagram_media_tunnel()
    except ValueError as error:
        INSTAGRAM_MEDIA_PUBLIC_BASE = ''
        INSTAGRAM_MEDIA_TUNNEL_PROCESS = None
        INSTAGRAM_MEDIA_TUNNEL_LOG = None
        print(f'  Avertissement Instagram : {error}')

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
    try:
        sys.stdout.reconfigure(errors='replace')
    except Exception:
        pass
    print(f'  Racine  : {ROOT}')
    print(f'  URL     : {url}')
    print(f'  Instagram media : {INSTAGRAM_MEDIA_PUBLIC_BASE or "tunnel indisponible"}')
    print(f'  Ctrl+C  : arrêter\n')

    if get_env_value('GROS_GEEK_NO_BROWSER').lower() not in {'1', 'true', 'yes', 'on'}:
        Timer(0.8, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  Serveur arrêté.')
    finally:
        if PINTEREST_SERVICE is not None:
            PINTEREST_SERVICE.stop()
        server.server_close()
        instagram_media_server.shutdown()
        instagram_media_server.server_close()

        # Arrêter le processus cloudflared réellement suivi par l'application, y
        # compris s'il a été relancé pendant une tentative de publication.
        stop_instagram_media_tunnel()
        clear_instagram_media_cache()

if __name__ == '__main__':
    main()
