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
    apply_doublex_tag_policy,
    blocking_quality_warnings,
    localization_quality_warnings,
    normalize_localized_listing,
)

RUN_ID = "b4a9b06e52b64e9ebffe82eb3f8643dd"
REPAIRS = {
    "a7c29ca76dd2416c995e529a12b64c3d": (
        "figurka czarownicy do malowania",
        "figurka wiedźmy do malowania",
    ),
    "38cc2b62b12843da86c3b5f87f04dde0": (
        "Metroid figuur om te schilderen",
        "Metroid figuur om te verven",
    ),
    "80ebcb3a27ca4682b5a4ee3bf3858c93": (
        "statua Soul Calibur da dipingere",
        "Soul Calibur da dipingere",
    ),
    "a54f63875be340a19acf6d5bd50e5277": (
        "Deadpool figuur om te schilderen",
        "Deadpool figuur om te verven",
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
        ROOT
        / "data"
        / "localization_backfill"
        / "repairs"
        / "doublex-final-collection-overlong-tags.json"
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
        before = json.loads(row["output_json"] or row["raw_output"] or "{}")
        old_tag, new_tag = REPAIRS[row["job_id"]]
        tags = [str(tag or "").strip() for tag in before.get("tags") or []]
        if tags.count(old_tag) != 1:
            raise ValueError(f"Tag source introuvable ou ambigu pour {row['job_id']}")
        repaired_tags = [new_tag if tag == old_tag else tag for tag in tags]
        after = normalize_localized_listing({**before, "tags": repaired_tags}, row["language"])
        after = apply_doublex_tag_policy(source, after)
        warnings = localization_quality_warnings(
            source, after, row["language"], "doublex"
        )
        blockers = blocking_quality_warnings(warnings)
        item = {
            "jobId": row["job_id"],
            "listingId": row["listing_id"],
            "language": row["language"],
            "replacedTag": old_tag,
            "replacementTag": new_tag,
            "before": before,
            "after": after,
            "qualityWarnings": warnings,
            "status": "planned",
        }
        ledger["repairs"].append(item)
        try:
            if len(new_tag) > 30:
                raise ValueError(f"Tag de remplacement trop long : {new_tag!r}")
            if len(after["tags"]) != len({tag.casefold() for tag in after["tags"]}):
                raise ValueError("La réparation crée un doublon de tags")
            if blockers:
                raise ValueError(
                    "Contrôle qualité bloquant : "
                    + ", ".join(str(warning.get("code") or "") for warning in blockers)
                )
            result = server.publish_etsy_localization(
                "doublex", row["listing_id"], row["language"], after
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
