from __future__ import annotations

import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import server
from localization_backfill_service import (
    blocking_quality_warnings,
    localization_quality_warnings,
    normalize_localized_listing,
)

RUN_ID = "c2199c09d1c24055a86e349a0a7ff557"
TITLE_REPAIRS = {
    "39cede6237da4c8f91efd348cba4c13c": (
        "Il Figlio delle Tenebre",
        "L'Erede dell'Ombra",
    ),
    "ff6f8fb326e441d78110d8d883987f7e": (
        "L’Héritier de l’Ombre",
        "影の継承者",
    ),
    "8c9bd769ef81405e99a92dc60012d278": (
        "L'Héritier de l'Ombre",
        "Skuggans arvtagare",
    ),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_ledger(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    temporary.replace(path)


def main() -> int:
    server.load_dotenv_file()
    database = sqlite3.connect(ROOT / ".localization_backfill.sqlite3")
    database.row_factory = sqlite3.Row
    active = database.execute(
        "SELECT run_id FROM localization_runs "
        "WHERE state IN ('running','paused') LIMIT 1"
    ).fetchone()
    if active:
        raise RuntimeError(f"Un lot est encore actif ({active['run_id']})")

    placeholders = ",".join("?" for _ in TITLE_REPAIRS)
    rows = database.execute(
        f"SELECT * FROM localization_jobs "
        f"WHERE run_id=? AND job_id IN ({placeholders})",
        (RUN_ID, *TITLE_REPAIRS),
    ).fetchall()
    if len(rows) != len(TITLE_REPAIRS):
        raise RuntimeError(
            f"Réparations attendues : {len(TITLE_REPAIRS)}, trouvées : {len(rows)}"
        )

    ledger_path = (
        ROOT
        / "data"
        / "localization_backfill"
        / "repairs"
        / "final-collection-lot-deterministic-repairs.json"
    )
    if ledger_path.exists():
        raise RuntimeError(f"Journal déjà existant : {ledger_path}")

    ledger = {
        "schemaVersion": 1,
        "createdAt": utc_now(),
        "sourceRunId": RUN_ID,
        "repairs": [],
        "summary": {"planned": len(rows), "published": 0, "failed": 0},
    }
    write_ledger(ledger_path, ledger)

    for row in rows:
        source = json.loads(row["source_json"])
        before = json.loads(row["output_json"] or row["raw_output"])
        old_title, localized_title = TITLE_REPAIRS[row["job_id"]]
        current_title = str(before.get("title") or "")
        if old_title not in current_title:
            raise ValueError(
                f"Titre attendu introuvable pour {row['job_id']} : {old_title}"
            )
        repaired = {
            "title": current_title.replace(old_title, localized_title, 1),
            "description": str(before.get("description") or ""),
            "tags": [str(tag or "") for tag in before.get("tags") or []],
        }
        after = normalize_localized_listing(repaired, row["language"])
        warnings = localization_quality_warnings(source, after, row["language"])
        blockers = blocking_quality_warnings(warnings)
        item = {
            "jobId": row["job_id"],
            "listingId": row["listing_id"],
            "language": row["language"],
            "before": before,
            "after": after,
            "qualityWarnings": warnings,
            "status": "planned",
        }
        ledger["repairs"].append(item)
        try:
            if blockers:
                raise ValueError(
                    "Contrôle qualité bloquant : "
                    + ", ".join(
                        str(warning.get("code") or "") for warning in blockers
                    )
                )
            result = server.publish_etsy_localization(
                "grosgeek", row["listing_id"], row["language"], after
            )
            item.update(
                {
                    "status": "published",
                    "operation": result.get("operation"),
                    "publishedAt": utc_now(),
                }
            )
            ledger["summary"]["published"] += 1
        except Exception as error:
            item.update({"status": "failed", "error": str(error)})
            ledger["summary"]["failed"] += 1
        ledger["summary"]["planned"] -= 1
        ledger["updatedAt"] = utc_now()
        write_ledger(ledger_path, ledger)
        print(
            f"{row['listing_id']} {row['language'].upper()}: {item['status']}",
            flush=True,
        )

    ledger["completedAt"] = utc_now()
    write_ledger(ledger_path, ledger)
    print(json.dumps(ledger["summary"], ensure_ascii=False))
    return 0 if ledger["summary"]["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
