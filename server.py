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
import sys
import urllib.parse
import urllib.request
import uuid
import webbrowser
from datetime import datetime, timezone
from pathlib import Path
from threading import Timer

PORT = 8080
ROOT = Path(__file__).parent.resolve()
STATIC_ROOT = ROOT / 'src'
ALLOWED_DIRS = {'prompts', 'biblios'}
ALLOWED_SUBDIRS = {'tabletop', 'collection'}
ANTHROPIC_FILES_CACHE = ROOT / '.anthropic_files_cache.json'
ANTHROPIC_FILES_BETA = 'files-api-2025-04-14'


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
    ANTHROPIC_FILES_CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding='utf-8')


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
    cache = load_anthropic_files_cache()
    resolved = []
    cache_dirty = False

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

        content_hash = str(image.get('contentHash') or '').strip() or compute_image_content_hash(media_type, payload)
        cached = cache.get(content_hash)

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

        cache[content_hash] = {
            'file_id': file_id,
            'filename': filename,
            'media_type': media_type,
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }
        cache_dirty = True
        resolved.append({
            'imageId': image_id,
            'fileId': file_id,
            'contentHash': content_hash,
            'cached': False,
        })

    if cache_dirty:
        save_anthropic_files_cache(cache)

    return resolved


class Handler(http.server.BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        print(f"  {self.command} {self.path} → {args[0]}")

    def save_export_files(self, files):
        """Écrire une liste de fichiers exportés en sanitizant chaque segment du chemin."""
        saved = []

        for export_file in files:
            filename = export_file.get('filename', 'export.md')
            parts = filename.replace('\\', '/').split('/')
            parts = [''.join(c for c in part if c.isalnum() or c in '._- ') for part in parts]
            parts = [part for part in parts if part]
            filepath = ROOT.joinpath(*parts)
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

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        path = self.path.split('?')[0]

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
            raw_qs = self.path.split('?', 1)[1] if '?' in self.path else ''
            params = urllib.parse.parse_qs(raw_qs)
            target = params.get('url', [None])[0]
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
                api_key = str(data.get('apiKey') or '').strip()
                if not api_key:
                    self.send_json(400, {'error': 'Clé API manquante'})
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

        if path in ('/batch/export', '/solo/export'):
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            try:
                data = json.loads(body)
                files = data.get('files', [])
                saved = self.save_export_files(files)
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
    # Créer les dossiers s'ils n'existent pas
    for d in ALLOWED_DIRS:
        (ROOT / d).mkdir(exist_ok=True)
        for sub in ALLOWED_SUBDIRS:
            (ROOT / d / sub).mkdir(exist_ok=True)

    server = ThreadingLocalServer(('localhost', PORT), Handler)
    url = f'http://localhost:{PORT}'

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
