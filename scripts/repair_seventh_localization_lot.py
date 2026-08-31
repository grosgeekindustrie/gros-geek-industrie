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

RUN_ID = "20c48c5d9f6b45f4a637452bea249643"
FAILED_REPAIRS = {
    "bb7cb94142a44017a6e467a97090c66d": (),
    "5b313cca3db74b04a216b3728366d052": (),
    "b6aadad681b54c03985f6c6d40485406": (),
    "6922ba8d723b409e88670396903b8709": (),
    "1115e4af2f924c4797623808fe8c554b": (),
    "11edbd50dfe34f0e8d44fba5dd078d9a": (),
    "93536fa903124b6fa85a56d62557a3a2": (),
    "21a95c96c98d4fa6b7af5b0e7512b917": (),
    "daeab75af150456a801c732cc2719f1c": (),
    "427c253612c64adf93eab4038f20a8dc": (),
    "7b8e15d10a0c4c9c8e21934671cbb003": (),
    "90a116db53e84e7ba62ef54d3a4f4b27": (),
    "c7068733c9224295a63326ae4609dea0": (),
    "2545183a538e423b8b6761c0d14a24b4": (),
    "82944eefdf994ada8c96c590376c1295": (),
    "377c448ea0b34652964ebd2c98ce5836": (),
    "fe403eeb8c22401f9b24edf2898d95cd": (
        ("figura fantasy post apocalittica", "figura post apocalittica"),
    ),
    "191547f8ba9240d9a81590803ca3da47": (
        ("figurka zamaskowanego wojownika", "figurka wojownika w masce"),
    ),
    "caf0dc9171fe4938983e08f0299c376a": (("figurка", "figurka"),),
    "6502e4798405424d945971a1147a6fd6": (("figurка", "figurka"),),
}
PUBLISHED_REPAIRS = {
    "4631ee64b86f48599e2b92454bfcde20": (),
    "94d09cff95e1447390ac1b0827636b4f": (),
    "b871ad0dd4704813a105d900b0342810": (),
    "573c4cf053d4464ca7c9335d0b2c8789": (),
    "a5d73d51763846f2a7201fcd092ac1b2": (),
    "b92a6f4476eb4d76aeb49d37cb820cb6": (),
    "0d027220c263462f87e08b64bb9cf7f3": (),
    "93774f71db194009a7a2264fe577f6fa": (),
    "c6ea35ba954743e5adf6714db8007a6c": (),
    "b3a689b3b3fa42b18243675a1f5acc0b": (),
}
ALL_REPAIRS = FAILED_REPAIRS | PUBLISHED_REPAIRS


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

    placeholders = ",".join("?" for _ in ALL_REPAIRS)
    rows = database.execute(
        f"SELECT * FROM localization_jobs WHERE run_id=? AND job_id IN ({placeholders})",
        (RUN_ID, *ALL_REPAIRS),
    ).fetchall()
    if len(rows) != len(ALL_REPAIRS):
        raise RuntimeError(f"Réparations attendues : {len(ALL_REPAIRS)}, trouvées : {len(rows)}")

    ledger_path = (
        ROOT / "data" / "localization_backfill" / "repairs"
        / "seventh-lot-repairs.json"
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
        repaired = replace_everywhere(before, ALL_REPAIRS[row["job_id"]])
        after = normalize_localized_listing(repaired, row["language"])
        warnings = localization_quality_warnings(source, after, row["language"])
        blockers = blocking_quality_warnings(warnings)
        long_tags = [tag for tag in after["tags"] if len(tag) > 30]
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
            if long_tags:
                raise ValueError(f"Tags encore trop longs : {long_tags}")
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
