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

RUN_ID = "4b9cfc607d1f48d198821c4d5ef76f72"
REPAIRS = {
    "0daa16ec5a664605ad7b9e53fe437f4d": (("verzamel ဖiguur", "verzamelfiguur"),),
    "b97ae9c266214745971e381c2e50aab8": (),
    "06142d84ea104dfcbcfa3b7e91ee8ac8": (),
    "648b6a76d9f34008900fea2b5da1d775": (("verzamel-fuguur", "verzamelfiguur"),),
    "2169551d11c34ce6ada6b93c5e766d4e": (("verzamel фигuur", "verzamelfiguur"),),
    "4c879b357f9044beab206ac73f330cd8": (("niepomalana", "niepomalowana"),),
    "dc7a9ea974f942d78caac8d8f5021f94": (("zywicy", "żywicy"),),
    "5203988ea3cf4736b107d8f37b8d0612": (("1 8", "1/8"),),
    "de9cbe46a1c5474998e6ad8721982cb7": (
        ("figurka kolekcjonerska Warcraft", "kolekcjonerska figurka WoW"),
    ),
    "70a2429cb6c348f4a8e316c2156e2b67": (
        ("estátua em resina Final Fantasy", "estátua em resina FFX"),
    ),
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

    ledger_path = (
        ROOT / "data" / "localization_backfill" / "repairs"
        / "sixth-lot-deterministic-repairs.json"
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
        raw = row["output_json"] or row["raw_output"]
        before = json.loads(raw)
        repaired = replace_everywhere(before, REPAIRS[row["job_id"]])
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
                    + ", ".join(str(warning.get("code") or "") for warning in blockers)
                )
            result = server.publish_etsy_localization(
                "grosgeek", row["listing_id"], row["language"], after
            )
            item["status"] = "published"
            item["operation"] = result.get("operation")
            item["publishedAt"] = utc_now()
            ledger["summary"]["published"] += 1
        except Exception as error:
            item["status"] = "failed"
            item["error"] = str(error)
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
