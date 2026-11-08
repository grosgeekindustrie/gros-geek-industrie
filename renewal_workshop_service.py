"""Persistent preparation queue for expired Etsy listing reworks.

The service intentionally stores only the structured form approved by the
operator and the selected media. Legacy copy remains in the catalog
snapshot for preparation, but is never copied into a generation job.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Callable


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class RenewalWorkshopService:
    VALID_STATES = {
        "prepared", "queued", "running", "review_ready", "ready_to_publish",
        "publishing", "published", "failed", "cancelled",
    }

    def __init__(self, root: Path, catalog_loader: Callable[[str], dict]):
        self.root = Path(root).resolve()
        self.db_path = self.root / ".renewal_workshop.sqlite3"
        self.catalog_loader = catalog_loader
        self._lock = Lock()
        self._init_db()
        self._recover_interrupted_jobs()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        return connection

    @contextmanager
    def _connection(self):
        connection = self._connect()
        try:
            yield connection
        finally:
            connection.close()

    def _init_db(self) -> None:
        with self._lock, self._connection() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS renewal_catalog (
                    shop_key TEXT NOT NULL,
                    listing_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    scanned_at TEXT NOT NULL,
                    PRIMARY KEY (shop_key, listing_id)
                );

                CREATE TABLE IF NOT EXISTS renewal_jobs (
                    job_id TEXT PRIMARY KEY,
                    shop_key TEXT NOT NULL,
                    listing_id TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    state TEXT NOT NULL,
                    title TEXT NOT NULL DEFAULT '',
                    form_json TEXT NOT NULL,
                    images_json TEXT NOT NULL,
                    outputs_json TEXT NOT NULL DEFAULT '{}',
                    review_json TEXT NOT NULL DEFAULT '{}',
                    usage_json TEXT NOT NULL DEFAULT '{}',
                    error TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    started_at TEXT,
                    completed_at TEXT,
                    UNIQUE (shop_key, listing_id)
                );

                CREATE INDEX IF NOT EXISTS idx_renewal_jobs_queue
                ON renewal_jobs(state, updated_at);
                """
            )
            connection.commit()

    def _recover_interrupted_jobs(self) -> None:
        now = utc_iso()
        with self._lock, self._connection() as connection:
            connection.execute(
                "UPDATE renewal_jobs SET state='queued', error='', updated_at=? WHERE state='running'",
                (now,),
            )
            connection.commit()

    @staticmethod
    def _shop_key(value: str) -> str:
        return "doublex" if str(value or "").strip().lower() == "doublex" else "grosgeek"

    @staticmethod
    def _mode(value: str) -> str:
        return "tabletop" if str(value or "").strip().lower() == "tabletop" else "collection"

    @staticmethod
    def _json(value, fallback):
        try:
            return json.loads(value) if value else fallback
        except (TypeError, json.JSONDecodeError):
            return fallback

    def refresh_catalog(self, shop_key: str) -> dict:
        shop_key = self._shop_key(shop_key)
        payload = self.catalog_loader(shop_key)
        listings = payload.get("listings") or []
        scanned_at = utc_iso()
        with self._lock, self._connection() as connection:
            connection.execute("DELETE FROM renewal_catalog WHERE shop_key=?", (shop_key,))
            connection.executemany(
                "INSERT INTO renewal_catalog (shop_key, listing_id, payload_json, scanned_at) VALUES (?, ?, ?, ?)",
                [
                    (
                        shop_key,
                        str(item.get("listingId") or ""),
                        json.dumps(item, ensure_ascii=False),
                        scanned_at,
                    )
                    for item in listings
                    if str(item.get("listingId") or "").strip()
                ],
            )
            connection.commit()
        return self.catalog(shop_key)

    def catalog(self, shop_key: str) -> dict:
        shop_key = self._shop_key(shop_key)
        with self._lock, self._connection() as connection:
            rows = connection.execute(
                "SELECT payload_json, scanned_at FROM renewal_catalog WHERE shop_key=? ORDER BY scanned_at DESC",
                (shop_key,),
            ).fetchall()
        listings = [self._json(row["payload_json"], {}) for row in rows]
        return {
            "shopKey": shop_key,
            "scannedAt": rows[0]["scanned_at"] if rows else None,
            "listings": listings,
        }

    def _serialize_job(self, row: sqlite3.Row) -> dict:
        return {
            "jobId": row["job_id"],
            "shopKey": row["shop_key"],
            "listingId": row["listing_id"],
            "mode": row["mode"],
            "state": row["state"],
            "title": row["title"],
            "form": self._json(row["form_json"], {}),
            "images": self._json(row["images_json"], []),
            "outputs": self._json(row["outputs_json"], {}),
            "review": self._json(row["review_json"], {}),
            "usage": self._json(row["usage_json"], {}),
            "error": row["error"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "startedAt": row["started_at"],
            "completedAt": row["completed_at"],
        }

    def list_jobs(self, shop_key: str = "") -> dict:
        params = ()
        where = ""
        if str(shop_key or "").strip():
            where = "WHERE shop_key=?"
            params = (self._shop_key(shop_key),)
        with self._lock, self._connection() as connection:
            rows = connection.execute(
                f"SELECT * FROM renewal_jobs {where} ORDER BY updated_at DESC", params
            ).fetchall()
        jobs = [self._serialize_job(row) for row in rows]
        counts = {state: 0 for state in self.VALID_STATES}
        for job in jobs:
            counts[job["state"]] = counts.get(job["state"], 0) + 1
        return {"jobs": jobs, "counts": counts}

    def save_preparation(self, payload: dict) -> dict:
        shop_key = self._shop_key(payload.get("shopKey"))
        listing_id = str(payload.get("listingId") or "").strip()
        title = str(payload.get("title") or "").strip()
        mode = self._mode(payload.get("mode"))
        form = payload.get("form") if isinstance(payload.get("form"), dict) else {}
        images = payload.get("images") if isinstance(payload.get("images"), list) else []
        if not listing_id:
            raise ValueError("Identifiant Etsy manquant")
        if not images:
            raise ValueError("Sélectionne au moins une image")
        if not str(form.get("name") or "").strip():
            raise ValueError("Le nom validé du produit est requis")
        now = utc_iso()
        with self._lock, self._connection() as connection:
            existing = connection.execute(
                "SELECT job_id, state FROM renewal_jobs WHERE shop_key=? AND listing_id=?",
                (shop_key, listing_id),
            ).fetchone()
            if existing and existing["state"] in {"running", "publishing"}:
                raise ValueError("Cette fiche est actuellement en cours de traitement")
            job_id = existing["job_id"] if existing else uuid.uuid4().hex
            connection.execute(
                """
                INSERT INTO renewal_jobs (
                    job_id, shop_key, listing_id, mode, state, title, form_json,
                    images_json, outputs_json, review_json, usage_json, error,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'prepared', ?, ?, ?, '{}', '{}', '{}', '', ?, ?)
                ON CONFLICT(shop_key, listing_id) DO UPDATE SET
                    mode=excluded.mode, state='prepared', title=excluded.title,
                    form_json=excluded.form_json, images_json=excluded.images_json,
                    outputs_json='{}', review_json='{}', usage_json='{}', error='',
                    updated_at=excluded.updated_at, started_at=NULL, completed_at=NULL
                """,
                (
                    job_id, shop_key, listing_id, mode, title,
                    json.dumps(form, ensure_ascii=False),
                    json.dumps(images, ensure_ascii=False), now, now,
                ),
            )
            connection.commit()
            row = connection.execute("SELECT * FROM renewal_jobs WHERE job_id=?", (job_id,)).fetchone()
        return self._serialize_job(row)

    def action(self, job_id: str, action: str) -> dict:
        job_id = str(job_id or "").strip()
        action = str(action or "").strip().lower()
        transitions = {
            "queue": ({"prepared", "failed"}, "queued"),
            "retry": ({"failed"}, "queued"),
            "ready_to_publish": ({"review_ready"}, "ready_to_publish"),
            "cancel": ({"prepared", "queued", "failed", "review_ready"}, "cancelled"),
            "published": ({"ready_to_publish", "publishing"}, "published"),
        }
        if action not in transitions:
            raise ValueError("Action de renouvellement inconnue")
        allowed, target = transitions[action]
        now = utc_iso()
        with self._lock, self._connection() as connection:
            row = connection.execute("SELECT * FROM renewal_jobs WHERE job_id=?", (job_id,)).fetchone()
            if not row:
                raise ValueError("Dossier de renouvellement introuvable")
            if row["state"] not in allowed:
                raise ValueError(f"Transition impossible depuis {row['state']}")
            connection.execute(
                "UPDATE renewal_jobs SET state=?, error='', updated_at=? WHERE job_id=?",
                (target, now, job_id),
            )
            connection.commit()
            row = connection.execute("SELECT * FROM renewal_jobs WHERE job_id=?", (job_id,)).fetchone()
        return self._serialize_job(row)

    def delete(self, job_id: str) -> dict:
        """Forget one local workshop dossier without touching its Etsy listing."""
        job_id = str(job_id or "").strip()
        if not job_id:
            raise ValueError("Dossier de renouvellement manquant")
        with self._lock, self._connection() as connection:
            row = connection.execute(
                "SELECT shop_key, listing_id, state FROM renewal_jobs WHERE job_id=?",
                (job_id,),
            ).fetchone()
            if not row:
                raise ValueError("Dossier de renouvellement introuvable")
            connection.execute("DELETE FROM renewal_jobs WHERE job_id=?", (job_id,))
            connection.commit()
        return {
            "ok": True,
            "jobId": job_id,
            "shopKey": row["shop_key"],
            "listingId": row["listing_id"],
            "previousState": row["state"],
        }

    def claim_next(self) -> dict | None:
        now = utc_iso()
        with self._lock, self._connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT * FROM renewal_jobs WHERE state='queued' ORDER BY updated_at ASC LIMIT 1"
            ).fetchone()
            if not row:
                connection.commit()
                return None
            connection.execute(
                "UPDATE renewal_jobs SET state='running', started_at=?, updated_at=?, error='' WHERE job_id=?",
                (now, now, row["job_id"]),
            )
            connection.commit()
            row = connection.execute("SELECT * FROM renewal_jobs WHERE job_id=?", (row["job_id"],)).fetchone()
        return self._serialize_job(row)

    def recover_running(self) -> dict:
        """Return browser-owned jobs to the queue after an explicit resume."""
        now = utc_iso()
        with self._lock, self._connection() as connection:
            cursor = connection.execute(
                "UPDATE renewal_jobs SET state='queued', error='', updated_at=? WHERE state='running'",
                (now,),
            )
            connection.commit()
        return {"ok": True, "requeued": int(cursor.rowcount or 0)}

    def complete(self, job_id: str, payload: dict) -> dict:
        outputs = payload.get("outputs") if isinstance(payload.get("outputs"), dict) else {}
        usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else {}
        if not outputs:
            raise ValueError("Sorties candidates manquantes")
        now = utc_iso()
        with self._lock, self._connection() as connection:
            row = connection.execute("SELECT state FROM renewal_jobs WHERE job_id=?", (job_id,)).fetchone()
            if not row:
                raise ValueError("Dossier de renouvellement introuvable")
            connection.execute(
                """UPDATE renewal_jobs SET state='review_ready', outputs_json=?, usage_json=?,
                   error='', updated_at=?, completed_at=? WHERE job_id=?""",
                (json.dumps(outputs, ensure_ascii=False), json.dumps(usage, ensure_ascii=False), now, now, job_id),
            )
            connection.commit()
            row = connection.execute("SELECT * FROM renewal_jobs WHERE job_id=?", (job_id,)).fetchone()
        return self._serialize_job(row)

    def fail(self, job_id: str, error: str) -> dict:
        now = utc_iso()
        with self._lock, self._connection() as connection:
            connection.execute(
                "UPDATE renewal_jobs SET state='failed', error=?, updated_at=?, completed_at=? WHERE job_id=?",
                (str(error or "Erreur inconnue")[:4000], now, now, job_id),
            )
            connection.commit()
            row = connection.execute("SELECT * FROM renewal_jobs WHERE job_id=?", (job_id,)).fetchone()
        if not row:
            raise ValueError("Dossier de renouvellement introuvable")
        return self._serialize_job(row)

    def save_review(self, job_id: str, review: dict) -> dict:
        now = utc_iso()
        with self._lock, self._connection() as connection:
            connection.execute(
                "UPDATE renewal_jobs SET review_json=?, updated_at=? WHERE job_id=?",
                (json.dumps(review if isinstance(review, dict) else {}, ensure_ascii=False), now, job_id),
            )
            connection.commit()
            row = connection.execute("SELECT * FROM renewal_jobs WHERE job_id=?", (job_id,)).fetchone()
        if not row:
            raise ValueError("Dossier de renouvellement introuvable")
        return self._serialize_job(row)

    def save_form(self, job_id: str, form: dict) -> dict:
        """Persist editable preparation data without resetting the job or its outputs."""
        job_id = str(job_id or "").strip()
        if not job_id:
            raise ValueError("Dossier de renouvellement manquant")
        if not isinstance(form, dict):
            raise ValueError("Données de préparation invalides")
        now = utc_iso()
        with self._lock, self._connection() as connection:
            row = connection.execute("SELECT state FROM renewal_jobs WHERE job_id=?", (job_id,)).fetchone()
            if not row:
                raise ValueError("Dossier de renouvellement introuvable")
            if row["state"] in {"running", "publishing"}:
                raise ValueError("Ce dossier est actuellement en cours de traitement")
            connection.execute(
                "UPDATE renewal_jobs SET form_json=?, updated_at=? WHERE job_id=?",
                (json.dumps(form, ensure_ascii=False), now, job_id),
            )
            connection.commit()
            row = connection.execute("SELECT * FROM renewal_jobs WHERE job_id=?", (job_id,)).fetchone()
        return self._serialize_job(row)
