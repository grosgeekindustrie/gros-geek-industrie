"""Service Pinterest local: API v5, tableaux, sections et file persistante."""

from __future__ import annotations

import base64
import hashlib
import json
import mimetypes
import os
import secrets
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from threading import Event, Lock, Thread


PINTEREST_SCOPES = ("boards:read", "boards:write", "pins:read", "pins:write", "user_accounts:read")
MAX_IMAGE_BYTES = 25 * 1024 * 1024


def utc_iso(timestamp: float | None = None) -> str:
    return datetime.fromtimestamp(timestamp or time.time(), timezone.utc).isoformat()


def parse_iso(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return 0.0


class PinterestAPIError(RuntimeError):
    def __init__(self, message: str, status: int = 502, payload=None):
        super().__init__(message)
        self.status = status
        self.payload = payload or {}


class ClosingSQLiteConnection(sqlite3.Connection):
    """Le context manager sqlite standard commit sans fermer la connexion."""

    def __exit__(self, exc_type, exc_value, traceback):
        try:
            return super().__exit__(exc_type, exc_value, traceback)
        finally:
            self.close()


class PinterestService:
    def __init__(self, root: Path):
        self.root = Path(root).resolve()
        self.db_path = self.root / ".pinterest_queue.sqlite3"
        self.spool_dir = self.root / ".pinterest_spool"
        self.token_file = self.root / ".pinterest_oauth_tokens.json"
        self.pending_file = self.root / ".pinterest_oauth_pending.json"
        self._db_lock = Lock()
        self._wake = Event()
        self._stop = Event()
        self._worker: Thread | None = None
        self.spool_dir.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self._recover_interrupted_jobs()

    # ------------------------------------------------------------------ config
    def environment(self) -> str:
        return "production" if os.getenv("PINTEREST_API_ENV", "sandbox").strip().lower() == "production" else "sandbox"

    def api_base(self) -> str:
        return "https://api.pinterest.com/v5" if self.environment() == "production" else "https://api-sandbox.pinterest.com/v5"

    def app_id(self) -> str:
        return (os.getenv("PINTEREST_APP_ID") or "").strip()

    def app_secret(self) -> str:
        return (os.getenv("PINTEREST_APP_SECRET") or "").strip()

    def redirect_uri(self) -> str:
        return (os.getenv("PINTEREST_REDIRECT_URI") or "https://localhost:8443/pinterest/oauth/callback").strip()

    def _read_token_file(self) -> dict:
        try:
            return json.loads(self.token_file.read_text(encoding="utf-8")) if self.token_file.exists() else {}
        except Exception:
            return {}

    def _write_json_atomic(self, path: Path, payload: dict):
        temporary = path.with_name(f"{path.name}.{uuid.uuid4().hex}.tmp")
        temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)

    def access_token(self) -> str:
        configured = (os.getenv("PINTEREST_ACCESS_TOKEN") or "").strip()
        if configured:
            return configured
        token_data = self._read_token_file()
        return str(token_data.get("access_token") or "").strip()

    def status(self) -> dict:
        missing = []
        if not self.app_id():
            missing.append("PINTEREST_APP_ID")
        if not self.app_secret():
            missing.append("PINTEREST_APP_SECRET")
        if not self.access_token():
            missing.append("PINTEREST_ACCESS_TOKEN ou autorisation OAuth")
        token_data = self._read_token_file()
        return {
            "ok": True,
            "environment": self.environment(),
            "apiBase": self.api_base(),
            "redirectUri": self.redirect_uri(),
            "configured": not missing,
            "connected": bool(self.access_token()),
            "missingConfig": missing,
            "oauthTokenStored": bool(token_data.get("access_token")),
            "scopes": list(PINTEREST_SCOPES),
        }

    # ------------------------------------------------------------------- OAuth
    def build_authorization_url(self) -> str:
        if not self.app_id() or not self.app_secret():
            raise ValueError("PINTEREST_APP_ID et PINTEREST_APP_SECRET sont requis")
        state = secrets.token_urlsafe(32)
        verifier = secrets.token_urlsafe(64)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        pending = {
            "state": state,
            "code_verifier": verifier,
            "created_at": utc_iso(),
        }
        self._write_json_atomic(self.pending_file, pending)
        query = urllib.parse.urlencode({
            "client_id": self.app_id(),
            "redirect_uri": self.redirect_uri(),
            "response_type": "code",
            "scope": ",".join(PINTEREST_SCOPES),
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        })
        return f"https://www.pinterest.com/oauth/?{query}"

    def complete_oauth(self, code: str, state: str):
        try:
            pending = json.loads(self.pending_file.read_text(encoding="utf-8"))
        except Exception as exc:
            raise ValueError("Autorisation Pinterest introuvable ou expirée") from exc
        if not state or not secrets.compare_digest(str(pending.get("state") or ""), state):
            raise ValueError("State OAuth Pinterest invalide")
        if time.time() - parse_iso(pending.get("created_at")) > 900:
            raise ValueError("Autorisation Pinterest expirée, recommence la connexion")

        form = urllib.parse.urlencode({
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri(),
            "code_verifier": str(pending.get("code_verifier") or ""),
        }).encode()
        credentials = base64.b64encode(f"{self.app_id()}:{self.app_secret()}".encode()).decode()
        request = urllib.request.Request(
            f"{self.api_base()}/oauth/token",
            data=form,
            method="POST",
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
        )
        payload = self._execute_request(request)
        now = time.time()
        payload["created_at"] = utc_iso(now)
        payload["expires_at"] = utc_iso(now + int(payload.get("expires_in") or 0))
        self._write_json_atomic(self.token_file, payload)
        self.pending_file.unlink(missing_ok=True)
        return payload

    # --------------------------------------------------------------- HTTP / API
    def _execute_request(self, request: urllib.request.Request):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                raw = response.read()
                return json.loads(raw.decode("utf-8")) if raw else {}
        except urllib.error.HTTPError as error:
            raw = error.read().decode("utf-8", errors="replace")
            try:
                payload = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                payload = {"message": raw}
            message = payload.get("message") or payload.get("error_description") or payload.get("code") or str(error)
            raise PinterestAPIError(str(message), error.code, payload) from error
        except urllib.error.URLError as error:
            raise PinterestAPIError(f"Pinterest indisponible : {error.reason}", 503) from error

    def api_request(self, path: str, method: str = "GET", payload: dict | None = None):
        token = self.access_token()
        if not token:
            raise ValueError("Jeton Pinterest absent. Renseigne PINTEREST_ACCESS_TOKEN ou connecte le compte.")
        data = json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None
        request = urllib.request.Request(
            f"{self.api_base()}/{path.lstrip('/')}",
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "GG-Publisher-Pinterest-POC/1.0",
            },
        )
        return self._execute_request(request)

    def profile(self):
        return self.api_request("user_account")

    def list_boards(self) -> list[dict]:
        boards: list[dict] = []
        bookmark = ""
        while True:
            query = {"page_size": "100"}
            if bookmark:
                query["bookmark"] = bookmark
            payload = self.api_request(f"boards?{urllib.parse.urlencode(query)}")
            boards.extend(payload.get("items") or [])
            bookmark = str(payload.get("bookmark") or "")
            if not bookmark:
                break
        for board in boards:
            board["sections"] = self.list_sections(str(board.get("id") or ""))
        return boards

    def list_sections(self, board_id: str) -> list[dict]:
        if not board_id.isdigit():
            return []
        sections: list[dict] = []
        bookmark = ""
        while True:
            query = {"page_size": "100"}
            if bookmark:
                query["bookmark"] = bookmark
            payload = self.api_request(f"boards/{board_id}/sections?{urllib.parse.urlencode(query)}")
            sections.extend(payload.get("items") or [])
            bookmark = str(payload.get("bookmark") or "")
            if not bookmark:
                break
        return sections

    def create_board(self, name: str, description: str = "", privacy: str = "PUBLIC"):
        name = name.strip()
        if not name:
            raise ValueError("Le nom du tableau est obligatoire")
        return self.api_request("boards", "POST", {"name": name, "description": description.strip(), "privacy": privacy})

    def update_board(self, board_id: str, name: str, description: str = ""):
        if not board_id.isdigit() or not name.strip():
            raise ValueError("Tableau ou nom invalide")
        return self.api_request(f"boards/{board_id}", "PATCH", {"name": name.strip(), "description": description.strip()})

    def delete_board(self, board_id: str):
        if not board_id.isdigit():
            raise ValueError("Identifiant de tableau invalide")
        return self.api_request(f"boards/{board_id}", "DELETE")

    def create_section(self, board_id: str, name: str):
        if not board_id.isdigit() or not name.strip():
            raise ValueError("Tableau ou nom de section invalide")
        return self.api_request(f"boards/{board_id}/sections", "POST", {"name": name.strip()})

    def update_section(self, board_id: str, section_id: str, name: str):
        if not board_id.isdigit() or not section_id.isdigit() or not name.strip():
            raise ValueError("Section invalide")
        return self.api_request(f"boards/{board_id}/sections/{section_id}", "PATCH", {"name": name.strip()})

    def delete_section(self, board_id: str, section_id: str):
        if not board_id.isdigit() or not section_id.isdigit():
            raise ValueError("Section invalide")
        return self.api_request(f"boards/{board_id}/sections/{section_id}", "DELETE")

    # --------------------------------------------------------------- persistence
    def _connect(self):
        connection = sqlite3.connect(self.db_path, timeout=20, factory=ClosingSQLiteConnection)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    def _init_db(self):
        with self._db_lock, self._connect() as db:
            db.executescript(
                """
                CREATE TABLE IF NOT EXISTS pinterest_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS pinterest_batches (
                    id TEXT PRIMARY KEY,
                    client_batch_id TEXT NOT NULL UNIQUE,
                    shop_key TEXT NOT NULL,
                    listing_id TEXT NOT NULL,
                    listing_title TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    item_count INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'queued'
                );
                CREATE TABLE IF NOT EXISTS pinterest_jobs (
                    id TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL REFERENCES pinterest_batches(id) ON DELETE CASCADE,
                    position INTEGER NOT NULL,
                    image_path TEXT NOT NULL,
                    image_source_url TEXT NOT NULL,
                    board_id TEXT NOT NULL,
                    board_name TEXT NOT NULL,
                    section_id TEXT NOT NULL DEFAULT '',
                    section_name TEXT NOT NULL DEFAULT '',
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    alt_text TEXT NOT NULL,
                    link TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'queued',
                    attempts INTEGER NOT NULL DEFAULT 0,
                    next_attempt_at TEXT,
                    started_at TEXT,
                    published_at TEXT,
                    pin_id TEXT,
                    last_error TEXT,
                    created_at TEXT NOT NULL,
                    UNIQUE(batch_id, position)
                );
                CREATE INDEX IF NOT EXISTS idx_pinterest_jobs_queue
                    ON pinterest_jobs(status, created_at, position);
                """
            )
            defaults = {
                "interval_seconds": "120" if self.environment() == "sandbox" else "10800",
                "paused": "0",
                "next_due_at": "",
                "last_success_at": "",
            }
            for key, value in defaults.items():
                db.execute("INSERT OR IGNORE INTO pinterest_settings(key, value) VALUES (?, ?)", (key, value))
            if self.environment() == "production":
                current_interval = int(self._get_setting(db, "interval_seconds", "10800") or 10800)
                if current_interval < 3600:
                    self._set_setting(db, "interval_seconds", "10800")

    def _recover_interrupted_jobs(self):
        with self._db_lock, self._connect() as db:
            interrupted = db.execute("SELECT COUNT(*) FROM pinterest_jobs WHERE status = 'publishing'").fetchone()[0]
            if interrupted:
                db.execute(
                    "UPDATE pinterest_jobs SET status = 'needs_review', last_error = ? WHERE status = 'publishing'",
                    ("Le serveur s'est arrêté pendant l'envoi. Vérifie Pinterest avant de réessayer pour éviter un doublon.",),
                )
                self._set_setting(db, "paused", "1")

    def _get_setting(self, db, key: str, default: str = "") -> str:
        row = db.execute("SELECT value FROM pinterest_settings WHERE key = ?", (key,)).fetchone()
        return str(row[0]) if row else default

    def _set_setting(self, db, key: str, value: str):
        db.execute(
            "INSERT INTO pinterest_settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )

    def get_settings(self) -> dict:
        with self._db_lock, self._connect() as db:
            values = {row["key"]: row["value"] for row in db.execute("SELECT key, value FROM pinterest_settings")}
        interval = int(values.get("interval_seconds") or 120)
        return {
            "environment": self.environment(),
            "intervalSeconds": interval,
            "paused": values.get("paused") == "1",
            "nextDueAt": values.get("next_due_at") or None,
            "lastSuccessAt": values.get("last_success_at") or None,
        }

    def update_settings(self, interval_seconds=None, paused=None):
        with self._db_lock, self._connect() as db:
            if interval_seconds is not None:
                interval = int(interval_seconds)
                minimum = 60 if self.environment() == "sandbox" else 3600
                maximum = 24 * 3600
                if not minimum <= interval <= maximum:
                    raise ValueError(f"Intervalle autorisé : {minimum} à {maximum} secondes")
                self._set_setting(db, "interval_seconds", str(interval))
                last_success = parse_iso(self._get_setting(db, "last_success_at"))
                if last_success:
                    self._set_setting(db, "next_due_at", utc_iso(last_success + interval))
            if paused is not None:
                self._set_setting(db, "paused", "1" if bool(paused) else "0")
        self._wake.set()
        return self.get_settings()

    def _download_image(self, url: str, batch_id: str, position: int) -> str:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            raise ValueError("URL d'image non autorisée")
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 GG-Publisher/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                content_type = str(response.headers.get("Content-Type") or "image/jpeg").split(";", 1)[0]
                payload = response.read(MAX_IMAGE_BYTES + 1)
        except urllib.error.URLError as error:
            raise ValueError(f"Téléchargement de l'image impossible : {error.reason}") from error
        if len(payload) > MAX_IMAGE_BYTES:
            raise ValueError("Une image dépasse 25 Mo")
        if not content_type.startswith("image/"):
            raise ValueError("Le média reçu n'est pas une image")
        extension = mimetypes.guess_extension(content_type) or Path(parsed.path).suffix or ".jpg"
        if extension == ".jpe":
            extension = ".jpg"
        filename = f"{batch_id}-{position:03d}{extension.lower()}"
        target = (self.spool_dir / filename).resolve()
        target.relative_to(self.spool_dir.resolve())
        temporary = target.with_suffix(target.suffix + ".tmp")
        temporary.write_bytes(payload)
        temporary.replace(target)
        return filename

    def enqueue_batch(self, payload: dict) -> dict:
        items = payload.get("items") or []
        if not isinstance(items, list) or not items:
            raise ValueError("Le lot ne contient aucune épingle")
        if len(items) > 100:
            raise ValueError("Un lot est limité à 100 épingles")
        client_batch_id = str(payload.get("clientBatchId") or "").strip()
        if not client_batch_id:
            raise ValueError("Identifiant de lot absent")
        batch_id = uuid.uuid4().hex
        created_at = utc_iso()
        downloaded: list[str] = []
        try:
            normalized = []
            for position, item in enumerate(items, 1):
                image_url = str(item.get("imageUrl") or "").strip()
                board_id = str(item.get("boardId") or "").strip()
                title = str(item.get("title") or "").strip()
                description = str(item.get("description") or "").strip()
                alt_text = str(item.get("altText") or "").strip()
                link = str(item.get("link") or "").strip()
                if not board_id.isdigit():
                    raise ValueError(f"Tableau manquant pour l'épingle {position}")
                if not image_url or not title or not description or not link:
                    raise ValueError(f"Contenu incomplet pour l'épingle {position}")
                if len(title) > 100 or len(description) > 800 or len(alt_text) > 500 or len(link) > 2048:
                    raise ValueError(f"Une limite Pinterest est dépassée pour l'épingle {position}")
                filename = self._download_image(image_url, batch_id, position)
                downloaded.append(filename)
                normalized.append({
                    "id": uuid.uuid4().hex,
                    "position": position,
                    "image_path": filename,
                    "image_source_url": image_url,
                    "board_id": board_id,
                    "board_name": str(item.get("boardName") or "").strip(),
                    "section_id": str(item.get("sectionId") or "").strip(),
                    "section_name": str(item.get("sectionName") or "").strip(),
                    "title": title,
                    "description": description,
                    "alt_text": alt_text,
                    "link": link,
                })

            with self._db_lock, self._connect() as db:
                existing = db.execute(
                    "SELECT id FROM pinterest_batches WHERE client_batch_id = ?", (client_batch_id,)
                ).fetchone()
                if existing:
                    for filename in downloaded:
                        (self.spool_dir / filename).unlink(missing_ok=True)
                    return {"ok": True, "duplicate": True, "batchId": existing["id"]}
                db.execute(
                    "INSERT INTO pinterest_batches(id, client_batch_id, shop_key, listing_id, listing_title, created_at, item_count) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (batch_id, client_batch_id, str(payload.get("shopKey") or "grosgeek"), str(payload.get("listingId") or ""), str(payload.get("listingTitle") or ""), created_at, len(normalized)),
                )
                for item in normalized:
                    db.execute(
                        """INSERT INTO pinterest_jobs(
                            id, batch_id, position, image_path, image_source_url, board_id, board_name,
                            section_id, section_name, title, description, alt_text, link, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (item["id"], batch_id, item["position"], item["image_path"], item["image_source_url"], item["board_id"], item["board_name"], item["section_id"], item["section_name"], item["title"], item["description"], item["alt_text"], item["link"], created_at),
                    )
                next_due = self._get_setting(db, "next_due_at")
                if not next_due:
                    self._set_setting(db, "next_due_at", utc_iso())
            self._wake.set()
            return {"ok": True, "duplicate": False, "batchId": batch_id, "itemCount": len(normalized)}
        except Exception:
            for filename in downloaded:
                (self.spool_dir / filename).unlink(missing_ok=True)
            raise

    def queue_snapshot(self, include_history: bool = False) -> dict:
        statuses = ("queued", "publishing", "retry_wait", "needs_review", "failed")
        with self._db_lock, self._connect() as db:
            query = "SELECT * FROM pinterest_jobs"
            parameters: tuple = ()
            if not include_history:
                query += f" WHERE status IN ({','.join('?' for _ in statuses)})"
                parameters = statuses
            query += " ORDER BY created_at ASC, position ASC"
            jobs = [dict(row) for row in db.execute(query, parameters)]
            batches = {row["id"]: dict(row) for row in db.execute("SELECT * FROM pinterest_batches ORDER BY created_at ASC")}
        grouped = []
        by_batch: dict[str, dict] = {}
        for job in jobs:
            job["imageUrl"] = f"/pinterest/spool/{urllib.parse.quote(job.pop('image_path'))}"
            batch = by_batch.get(job["batch_id"])
            if not batch:
                metadata = batches.get(job["batch_id"], {})
                batch = {**metadata, "items": []}
                by_batch[job["batch_id"]] = batch
                grouped.append(batch)
            batch["items"].append(job)
        counts = {}
        for job in jobs:
            counts[job["status"]] = counts.get(job["status"], 0) + 1
        return {"ok": True, "settings": self.get_settings(), "counts": counts, "batches": grouped}

    def queue_action(self, action: str, job_id: str = "", batch_id: str = ""):
        allowed = {"retry", "skip", "delete_job", "delete_batch"}
        if action not in allowed:
            raise ValueError("Action de file inconnue")
        paths: list[str] = []
        with self._db_lock, self._connect() as db:
            if action == "delete_batch":
                paths = [row[0] for row in db.execute("SELECT image_path FROM pinterest_jobs WHERE batch_id = ? AND status != 'published'", (batch_id,))]
                publishing = db.execute(
                    "SELECT COUNT(*) FROM pinterest_jobs WHERE batch_id = ? AND status = 'publishing'", (batch_id,)
                ).fetchone()[0]
                if publishing:
                    raise ValueError("Impossible de retirer un lot pendant une publication")
                db.execute("DELETE FROM pinterest_jobs WHERE batch_id = ? AND status != 'published'", (batch_id,))
                remaining = db.execute("SELECT COUNT(*) FROM pinterest_jobs WHERE batch_id = ?", (batch_id,)).fetchone()[0]
                if remaining:
                    db.execute("UPDATE pinterest_batches SET status = 'partially_removed' WHERE id = ?", (batch_id,))
                else:
                    db.execute("DELETE FROM pinterest_batches WHERE id = ?", (batch_id,))
            elif action == "delete_job":
                row = db.execute("SELECT image_path, status FROM pinterest_jobs WHERE id = ?", (job_id,)).fetchone()
                if row and row["status"] != "publishing":
                    paths = [row["image_path"]]
                    db.execute("DELETE FROM pinterest_jobs WHERE id = ?", (job_id,))
            elif action == "retry":
                db.execute("UPDATE pinterest_jobs SET status = 'queued', next_attempt_at = NULL, last_error = NULL WHERE id = ? AND status IN ('failed','needs_review','retry_wait')", (job_id,))
                self._set_setting(db, "paused", "0")
            elif action == "skip":
                db.execute("UPDATE pinterest_jobs SET status = 'skipped', last_error = NULL WHERE id = ? AND status != 'publishing'", (job_id,))
                self._set_setting(db, "paused", "0")
        for relative in paths:
            (self.spool_dir / relative).unlink(missing_ok=True)
        self._wake.set()
        return self.queue_snapshot()

    def resolve_spool(self, filename: str) -> Path:
        clean = Path(urllib.parse.unquote(filename)).name
        target = (self.spool_dir / clean).resolve()
        target.relative_to(self.spool_dir.resolve())
        if not target.is_file():
            raise FileNotFoundError(clean)
        return target

    # ------------------------------------------------------------------- worker
    def start(self):
        if self._worker and self._worker.is_alive():
            return
        self._stop.clear()
        self._worker = Thread(target=self._worker_loop, name="pinterest-queue-worker", daemon=True)
        self._worker.start()

    def stop(self):
        self._stop.set()
        self._wake.set()
        if self._worker:
            self._worker.join(timeout=5)

    def _next_job(self):
        now = time.time()
        with self._db_lock, self._connect() as db:
            if self._get_setting(db, "paused", "0") == "1":
                return None
            due = parse_iso(self._get_setting(db, "next_due_at"))
            if due and due > now:
                return None
            # Examiner uniquement la tête de file. Si elle attend une nouvelle
            # tentative, les lots suivants ne doivent jamais la dépasser.
            row = db.execute(
                """SELECT * FROM pinterest_jobs
                   WHERE status IN ('queued','retry_wait')
                   ORDER BY created_at ASC, position ASC LIMIT 1""",
            ).fetchone()
            if not row:
                return None
            if row["next_attempt_at"] and parse_iso(row["next_attempt_at"]) > now:
                return None
            updated = db.execute(
                "UPDATE pinterest_jobs SET status = 'publishing', started_at = ?, attempts = attempts + 1 WHERE id = ? AND status IN ('queued','retry_wait')",
                (utc_iso(now), row["id"]),
            ).rowcount
            return dict(row) if updated else None

    def _publish_job(self, job: dict):
        image_path = self.resolve_spool(job["image_path"])
        content_type = mimetypes.guess_type(image_path.name)[0] or "image/jpeg"
        media = {
            "source_type": "image_base64",
            "content_type": content_type,
            "data": base64.b64encode(image_path.read_bytes()).decode(),
        }
        payload = {
            "board_id": job["board_id"],
            "title": job["title"],
            "description": job["description"],
            "alt_text": job["alt_text"],
            "link": job["link"],
            "media_source": media,
        }
        if job.get("section_id"):
            payload["board_section_id"] = job["section_id"]
        return self.api_request("pins", "POST", payload)

    def _mark_success(self, job: dict, response: dict):
        now = time.time()
        with self._db_lock, self._connect() as db:
            db.execute(
                "UPDATE pinterest_jobs SET status = 'published', published_at = ?, pin_id = ?, last_error = NULL WHERE id = ?",
                (utc_iso(now), str(response.get("id") or ""), job["id"]),
            )
            interval = int(self._get_setting(db, "interval_seconds", "120"))
            self._set_setting(db, "last_success_at", utc_iso(now))
            self._set_setting(db, "next_due_at", utc_iso(now + interval))
            remaining = db.execute("SELECT COUNT(*) FROM pinterest_jobs WHERE batch_id = ? AND status IN ('queued','publishing','retry_wait','needs_review','failed')", (job["batch_id"],)).fetchone()[0]
            if not remaining:
                db.execute("UPDATE pinterest_batches SET status = 'completed' WHERE id = ?", (job["batch_id"],))

    def _mark_failure(self, job: dict, error: Exception):
        attempts = int(job.get("attempts") or 0) + 1
        transient = isinstance(error, PinterestAPIError) and (error.status == 429 or error.status >= 500)
        with self._db_lock, self._connect() as db:
            if transient and attempts < 4:
                retry_delay = (300, 900, 3600)[min(attempts - 1, 2)]
                db.execute(
                    "UPDATE pinterest_jobs SET status = 'retry_wait', next_attempt_at = ?, last_error = ? WHERE id = ?",
                    (utc_iso(time.time() + retry_delay), str(error), job["id"]),
                )
            else:
                db.execute("UPDATE pinterest_jobs SET status = 'failed', last_error = ? WHERE id = ?", (str(error), job["id"]))
                self._set_setting(db, "paused", "1")

    def _worker_loop(self):
        while not self._stop.is_set():
            job = self._next_job()
            if not job:
                self._wake.wait(5)
                self._wake.clear()
                continue
            try:
                response = self._publish_job(job)
                self._mark_success(job, response)
            except Exception as error:
                self._mark_failure(job, error)
