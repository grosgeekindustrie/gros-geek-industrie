from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import server
from localization_backfill_service import (
    apply_doublex_tag_policy,
    blocking_quality_warnings,
    localization_quality_warnings,
    parse_localized_listing,
)

DATABASE_PATH = ROOT / ".localization_backfill.sqlite3"
LEDGER_PATH = ROOT / "data" / "localization_backfill" / "repairs" / "doublex-mature-policy-ledger.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_ledger(payload: dict) -> None:
    LEDGER_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = LEDGER_PATH.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(LEDGER_PATH)


def source_requires_mature(source: dict) -> bool:
    return any(
        str(tag or "").strip().casefold() == "mature"
        for tag in (source.get("tags") or [])
    )


def load_latest_repair_outputs() -> dict[tuple[str, str], dict]:
    latest = {}
    repair_root = ROOT / "data" / "localization_backfill" / "repairs"
    for path in repair_root.glob("retry-*.json"):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if payload.get("shop") != "doublex" or payload.get("status") != "published":
            continue
        key = (str(payload.get("listingId") or ""), str(payload.get("language") or ""))
        if not all(key) or not isinstance(payload.get("after"), dict):
            continue
        previous = latest.get(key)
        if previous is None or path.stat().st_mtime > previous[0]:
            latest[key] = (path.stat().st_mtime, payload["after"])
    return {key: value[1] for key, value in latest.items()}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Réparer la politique mature Double X sans régénération IA."
    )
    parser.add_argument("--apply", action="store_true", help="Publier les corrections sur Etsy")
    args = parser.parse_args()

    server.load_dotenv_file()
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row
        active = connection.execute(
            "SELECT run_id FROM localization_runs WHERE state IN ('running','paused') LIMIT 1"
        ).fetchone()
        if active:
            raise RuntimeError(f"Un lot est encore actif ({active['run_id']})")
        rows = connection.execute(
            """
            SELECT jobs.*, runs.shop_key
            FROM localization_jobs AS jobs
            JOIN localization_runs AS runs ON runs.run_id=jobs.run_id
            WHERE runs.shop_key='doublex' AND jobs.state IN ('published','failed')
            ORDER BY jobs.created_at, jobs.listing_id, jobs.language
            """
        ).fetchall()

    latest_repairs = load_latest_repair_outputs()
    candidates = []
    for row in rows:
        job = dict(row)
        source = json.loads(job["source_json"] or "{}")
        output = latest_repairs.get((str(job["listing_id"]), str(job["language"])))
        if output is None:
            output = json.loads(job["output_json"] or "{}")

        if job["state"] == "published":
            mature_count = sum(
                str(tag or "").strip() == "mature"
                for tag in (output.get("tags") or [])
            )
            expected = 1 if source_requires_mature(source) else 0
            if mature_count == expected:
                continue
        elif job["state"] == "failed":
            error = str(job.get("error") or "")
            mechanical = "doublex_missing_mature_tag" in error or "plus de 13 tags" in error
            if not mechanical:
                continue
            if not output:
                output = parse_localized_listing(
                    str(job.get("raw_output") or ""),
                    str(job["language"]),
                    max_tags=20,
                )

        corrected = apply_doublex_tag_policy(source, output)
        warnings = localization_quality_warnings(
            source, corrected, str(job["language"]), "doublex"
        )
        blockers = blocking_quality_warnings(warnings)
        if blockers:
            raise ValueError(
                f"Correction bloquée pour {job['listing_id']}/{job['language']} : "
                + ", ".join(str(warning.get("code") or "") for warning in blockers)
            )
        candidates.append((job, source, output, corrected, warnings))

    ledger = {
        "schemaVersion": 1,
        "repairType": "doublex_mature_source_alignment",
        "updatedAt": utc_now(),
        "apply": bool(args.apply),
        "candidateCount": len(candidates),
        "completed": [],
    }
    if LEDGER_PATH.exists():
        try:
            previous = json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
            ledger["completed"] = previous.get("completed") or []
        except Exception:
            pass
    completed_keys = {
        (str(item.get("listingId")), str(item.get("language")))
        for item in ledger["completed"]
        if item.get("status") == "published"
    }

    print(json.dumps({"candidates": len(candidates), "alreadyCompleted": len(completed_keys)}, ensure_ascii=False))
    if not args.apply:
        return 0

    for index, (job, source, before, corrected, warnings) in enumerate(candidates, start=1):
        key = (str(job["listing_id"]), str(job["language"]))
        if key in completed_keys:
            continue
        result = server.publish_etsy_localization(
            "doublex", job["listing_id"], job["language"], corrected
        )
        entry = {
            "listingId": job["listing_id"],
            "language": job["language"],
            "sourceJobId": job["job_id"],
            "sourceState": job["state"],
            "sourceMature": source_requires_mature(source),
            "beforeTags": before.get("tags") or [],
            "afterTags": corrected.get("tags") or [],
            "qualityWarnings": warnings,
            "operation": result.get("operation"),
            "status": "published",
            "publishedAt": utc_now(),
        }
        ledger["completed"].append(entry)
        ledger["updatedAt"] = utc_now()
        write_ledger(ledger)
        print(json.dumps({"progress": f"{index}/{len(candidates)}", **entry}, ensure_ascii=False))

    ledger["status"] = "completed"
    ledger["updatedAt"] = utc_now()
    write_ledger(ledger)
    print(json.dumps({"ok": True, "published": len(ledger["completed"]), "ledger": str(LEDGER_PATH)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
