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

RUN_ID = "d0738ed3a7ba4180bfca31c35b40fa23"
REPAIRS = {
    "c09625f4c6a0455195cbb3070ed8f319": (("figurка", "figurka"),),
    "ea5f0c5616f04580a035fb375ad85ed6": (("figurка", "figurka"),),
    "9d98929e1dd44c808dde85a2afde0ed6": (("figurка", "figurka"),),
    "222840f0a10d48d1ad7bf332ec7de96d": (("figurка", "figurka"),),
    "192e17a8706444b49181125c8ff9af85": (),
    "6f527aa799624a79b506a43ab713c28a": (),
    "b1d6ba7ad9f54ea78876aed897cb7f2e": (),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_ledger(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def replace_everywhere(output: dict, replacements: tuple[tuple[str, str], ...]) -> dict:
    repaired = {
        "title": str(output.get("title") or ""),
        "description": str(output.get("description") or ""),
        "tags": [str(tag or "") for tag in output.get("tags") or []],
    }
    for before, after in replacements:
        repaired["title"] = repaired["title"].replace(before, after)
        repaired["description"] = repaired["description"].replace(before, after)
        repaired["tags"] = [tag.replace(before, after) for tag in repaired["tags"]]
    return repaired


def main() -> int:
    server.load_dotenv_file()
    database = sqlite3.connect(ROOT / ".localization_backfill.sqlite3")
    database.row_factory = sqlite3.Row
    active = database.execute(
        "SELECT run_id FROM localization_runs WHERE state IN ('running','paused') LIMIT 1"
    ).fetchone()
    if active:
        raise RuntimeError(f"Un lot est encore actif ({active['run_id']})")
    placeholders = ",".join("?" for _ in REPAIRS)
    rows = database.execute(
        f"SELECT * FROM localization_jobs WHERE run_id=? AND job_id IN ({placeholders})",
        (RUN_ID, *REPAIRS),
    ).fetchall()
    if len(rows) != len(REPAIRS):
        raise RuntimeError(f"Réparations attendues : {len(REPAIRS)}, trouvées : {len(rows)}")

    ledger_path = ROOT / "data" / "localization_backfill" / "repairs" / "eighth-lot-deterministic-repairs.json"
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
        repaired = replace_everywhere(before, REPAIRS[row["job_id"]])
        after = normalize_localized_listing(repaired, row["language"])
        warnings = localization_quality_warnings(source, after, row["language"])
        blockers = blocking_quality_warnings(warnings)
        item = {
            "jobId": row["job_id"],
            "listingId": row["listing_id"],
            "language": row["language"],
            "originalState": row["state"],
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
                    + ", ".join(str(warning.get("code") or "") for warning in blockers)
                )
            result = server.publish_etsy_localization("grosgeek", row["listing_id"], row["language"], after)
            item.update({"status": "published", "operation": result.get("operation"), "publishedAt": utc_now()})
            ledger["summary"]["published"] += 1
        except Exception as error:
            item.update({"status": "failed", "error": str(error)})
            ledger["summary"]["failed"] += 1
        ledger["summary"]["planned"] -= 1
        ledger["updatedAt"] = utc_now()
        write_ledger(ledger_path, ledger)
        print(f"{row['listing_id']} {row['language'].upper()}: {item['status']}", flush=True)

    ledger["completedAt"] = utc_now()
    write_ledger(ledger_path, ledger)
    print(json.dumps(ledger["summary"], ensure_ascii=False))
    return 0 if ledger["summary"]["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
