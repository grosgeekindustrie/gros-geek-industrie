from __future__ import annotations

import argparse
import copy
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import server
from localization_backfill_service import normalize_localized_listing


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_ledger(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temporary_path.replace(path)


def validate_translation(translation: dict) -> None:
    title = str(translation.get("title") or "").strip()
    description = str(translation.get("description") or "").strip()
    tags = [str(tag or "").strip() for tag in translation.get("tags") or []]
    if not title or not description or not tags or any(not tag for tag in tags):
        raise ValueError("Localisation réparée incomplète")
    if len(tags) != len(set(tag.casefold() for tag in tags)):
        raise ValueError("La réparation contient des tags en doublon")
    if any(len(tag) > 30 for tag in tags):
        raise ValueError("La réparation contient un tag de plus de 30 caractères")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Publier un journal de réparations déterministes Etsy."
    )
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--shop", default="grosgeek")
    parser.add_argument("--source-status", default="")
    parser.add_argument("--renormalize", action="store_true")
    args = parser.parse_args()

    server.load_dotenv_file()
    if not os.getenv("ETSY_KEYSTRING") or not os.getenv("ETSY_SHARED_SECRET"):
        raise RuntimeError("Configuration Etsy absente après chargement du .env")

    source_payload = json.loads(args.source.read_text(encoding="utf-8"))
    repairs = []
    for source_repair in source_payload.get("repairs") or []:
        if args.source_status and source_repair.get("status") != args.source_status:
            continue
        repair = copy.deepcopy(source_repair)
        repair["previousAttemptStatus"] = repair.pop("status", None)
        repair["previousAttemptError"] = repair.pop("error", None)
        repair["status"] = "planned"
        if args.renormalize:
            repair["after"] = normalize_localized_listing(
                repair["after"], str(repair["language"])
            )
            repair["changedFields"] = [
                field
                for field in ("title", "description", "tags")
                if repair.get("before", {}).get(field) != repair["after"].get(field)
            ]
        repairs.append(repair)

    ledger = {
        "schemaVersion": 1,
        "createdAt": utc_now(),
        "sourceLedger": str(args.source.resolve()),
        "shop": args.shop,
        "count": len(repairs),
        "repairs": repairs,
        "summary": {
            "planned": len(repairs),
            "published": 0,
            "failed": 0,
        },
    }
    write_ledger(args.destination, ledger)

    for index, repair in enumerate(repairs, start=1):
        repair["attemptedAt"] = utc_now()
        try:
            validate_translation(repair["after"])
            result = server.publish_etsy_localization(
                args.shop,
                str(repair["listingId"]),
                str(repair["language"]),
                repair["after"],
            )
            repair["status"] = "published"
            repair["operation"] = result.get("operation")
            repair["publishedAt"] = utc_now()
            ledger["summary"]["published"] += 1
            print(
                f"[{index}/{len(repairs)}] OK "
                f"{repair['listingId']} {str(repair['language']).upper()}",
                flush=True,
            )
        except Exception as error:
            repair["status"] = "failed"
            repair["error"] = str(error)
            repair["failedAt"] = utc_now()
            ledger["summary"]["failed"] += 1
            print(
                f"[{index}/{len(repairs)}] ERREUR "
                f"{repair['listingId']} {str(repair['language']).upper()}: {error}",
                flush=True,
            )

        ledger["summary"]["planned"] = sum(
            1 for item in repairs if item["status"] == "planned"
        )
        ledger["updatedAt"] = utc_now()
        write_ledger(args.destination, ledger)

    ledger["completedAt"] = utc_now()
    write_ledger(args.destination, ledger)
    print(json.dumps(ledger["summary"], ensure_ascii=False), flush=True)
    return 0 if ledger["summary"]["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
