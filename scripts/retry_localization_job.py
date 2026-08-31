from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import server
from localization_backfill_service import (
    LocalizationBackfillService,
    apply_doublex_tag_policy,
    blocking_quality_warnings,
    extract_response_text,
    localization_quality_warnings,
    parse_localized_listing,
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary_path.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Régénérer une seule localisation issue du backfill.")
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()

    server.load_dotenv_file()
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY absente après chargement du .env")

    database_path = ROOT / ".localization_backfill.sqlite3"
    with sqlite3.connect(database_path) as connection:
        connection.row_factory = sqlite3.Row
        active_run = connection.execute(
            "SELECT run_id FROM localization_runs WHERE state IN ('running','paused') LIMIT 1"
        ).fetchone()
        if active_run:
            raise RuntimeError(f"Un lot est encore actif ({active_run['run_id']})")
        row = connection.execute(
            """
            SELECT jobs.*, runs.shop_key, runs.model, runs.reasoning_effort
            FROM localization_jobs AS jobs
            JOIN localization_runs AS runs ON runs.run_id=jobs.run_id
            WHERE jobs.job_id=?
            """,
            (args.job_id,),
        ).fetchone()
    if not row:
        raise ValueError("Job de localisation introuvable")

    job = dict(row)
    source = json.loads(job["source_json"])
    previous_output = json.loads(job["output_json"] or "{}")
    service = LocalizationBackfillService(
        ROOT,
        server.load_etsy_localization_catalog,
        server.request_openai_localization,
        server.publish_etsy_localization,
    )
    prompt = service._load_prompt(job["language"], source, job["shop_key"])
    payload = {
        "model": job["model"],
        "input": [{"role": "user", "content": [{"type": "input_text", "text": prompt}]}],
        "reasoning": {"effort": job["reasoning_effort"]},
        "text": {"verbosity": "low"},
        "max_output_tokens": 12000,
        "store": False,
    }
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    ledger_path = (
        ROOT / "data" / "localization_backfill" / "repairs"
        / f"retry-{job['listing_id']}-{job['language']}-{timestamp}.json"
    )
    ledger = {
        "schemaVersion": 1,
        "createdAt": utc_now(),
        "sourceJobId": job["job_id"],
        "sourceRunId": job["run_id"],
        "shop": job["shop_key"],
        "listingId": job["listing_id"],
        "language": job["language"],
        "model": job["model"],
        "reasoningEffort": job["reasoning_effort"],
        "before": previous_output,
        "status": "requesting",
    }
    write_json(ledger_path, ledger)

    status, response = server.request_openai_localization(payload)
    ledger["responseStatus"] = status
    ledger["usage"] = response.get("usage") or {} if isinstance(response, dict) else {}
    if status < 200 or status >= 300:
        ledger["status"] = "generation_failed"
        ledger["error"] = ((response.get("error") or {}).get("message") if isinstance(response, dict) else "") or f"OpenAI HTTP {status}"
        write_json(ledger_path, ledger)
        raise RuntimeError(ledger["error"])

    raw_output = extract_response_text(response)
    output = parse_localized_listing(
        raw_output,
        job["language"],
        max_tags=20 if job["shop_key"] == "doublex" else 13,
    )
    if job["shop_key"] == "doublex":
        output = apply_doublex_tag_policy(source, output)
    warnings = localization_quality_warnings(source, output, job["language"], job["shop_key"])
    blockers = blocking_quality_warnings(warnings)
    ledger.update({"after": output, "qualityWarnings": warnings, "status": "validated"})
    if blockers:
        ledger["status"] = "blocked"
        ledger["blockingWarnings"] = blockers
        write_json(ledger_path, ledger)
        raise ValueError(
            "Nouvelle sortie bloquée : "
            + ", ".join(str(warning.get("code") or "") for warning in blockers)
        )

    if args.publish:
        result = server.publish_etsy_localization(
            job["shop_key"], job["listing_id"], job["language"], output
        )
        ledger["operation"] = result.get("operation")
        ledger["status"] = "published"
        ledger["publishedAt"] = utc_now()
    write_json(ledger_path, ledger)
    print(json.dumps({
        "ok": True,
        "status": ledger["status"],
        "listingId": job["listing_id"],
        "language": job["language"],
        "warnings": warnings,
        "ledger": str(ledger_path),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
