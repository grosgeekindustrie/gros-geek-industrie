from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from localization_backfill_service import (
    blocking_quality_warnings,
    localization_quality_warnings,
)

REPORT_ROOT = ROOT / "data" / "localization_backfill" / "reports"
REPAIR_ROOT = ROOT / "data" / "localization_backfill" / "repairs"
AUDIT_ROOT = ROOT / "data" / "localization_backfill" / "audits"

KNOWN_INVALID_FRAGMENTS = (
    "Sculpteur:",
    "rendimentos 3D",
    "Målingstips",
    "renderizações 3D apresentados",
    "verzameliguur",
    "Niezamalowany",
    "verzamelnee",
    "verzamelverzamelstuk",
    "verzamel figuur",
    "verzamel-fuguur",
    "niepomalana",
    "zywicy",
    "DYI",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def listing_output(translation: dict) -> dict:
    return {
        "title": translation.get("title"),
        "tags": translation.get("tags"),
        "description": translation.get("description"),
    }


def main() -> int:
    production_reports = []
    expected_pairs: set[tuple[str, str]] = set()
    final_outputs: dict[tuple[str, str], dict] = {}
    sources: dict[tuple[str, str], dict] = {}
    historical_states: dict[tuple[str, str], str] = {}

    for path in sorted(REPORT_ROOT.glob("localization-run-*.json")):
        report = read_json(path)
        translations = [
            translation
            for listing in report.get("listings") or []
            for translation in (listing.get("translations") or {}).values()
        ]
        is_production = (
            not report.get("run", {}).get("testMode")
            and any(
                translation.get("state") in {"published", "failed"}
                for translation in translations
            )
        )
        if not is_production:
            continue

        production_reports.append({
            "file": path.name,
            "run": report.get("run") or {},
            "summary": report.get("summary") or {},
        })
        for listing in report.get("listings") or []:
            listing_id = str(listing.get("listingId") or "")
            source = listing.get("source") or {}
            for language, translation in (listing.get("translations") or {}).items():
                key = (listing_id, str(language))
                expected_pairs.add(key)
                sources[key] = source
                historical_states[key] = str(translation.get("state") or "")
                if translation.get("state") == "published":
                    final_outputs[key] = listing_output(translation)

    repair_events = []
    for path in sorted(REPAIR_ROOT.glob("*.json"), key=lambda item: item.stat().st_mtime):
        try:
            ledger = read_json(path)
        except (OSError, ValueError):
            continue
        repairs = ledger.get("repairs") if isinstance(ledger, dict) else None
        if isinstance(repairs, list):
            candidates = repairs
        elif ledger.get("status") == "published" and isinstance(ledger.get("after"), dict):
            candidates = [ledger]
        else:
            candidates = []
        for repair in candidates:
            if repair.get("status") != "published" or not isinstance(repair.get("after"), dict):
                continue
            key = (str(repair.get("listingId") or ""), str(repair.get("language") or ""))
            final_outputs[key] = repair["after"]
            repair_events.append({
                "listingId": key[0],
                "language": key[1],
                "ledger": path.name,
            })

    missing_outputs = sorted(expected_pairs - set(final_outputs))
    warning_counts: Counter[str] = Counter()
    warning_items = []
    blockers = []
    known_fragment_hits = []
    for key in sorted(expected_pairs & set(final_outputs)):
        output = final_outputs[key]
        warnings = localization_quality_warnings(sources[key], output, key[1])
        for warning in warnings:
            warning_counts[str(warning.get("code") or "unknown")] += 1
        if warnings:
            warning_items.append({
                "listingId": key[0],
                "language": key[1],
                "warnings": warnings,
            })
        blocking = blocking_quality_warnings(warnings)
        if blocking:
            blockers.append({
                "listingId": key[0],
                "language": key[1],
                "sourceTitle": sources[key].get("title"),
                "title": output.get("title"),
                "tags": output.get("tags"),
                "warnings": blocking,
            })

        searchable = "\n".join((
            str(output.get("title") or ""),
            "\n".join(str(tag or "") for tag in output.get("tags") or []),
            str(output.get("description") or ""),
        ))
        for fragment in KNOWN_INVALID_FRAGMENTS:
            if fragment in searchable:
                known_fragment_hits.append({
                    "listingId": key[0],
                    "language": key[1],
                    "fragment": fragment,
                    "sourceTitle": sources[key].get("title"),
                    "title": output.get("title"),
                    "tags": output.get("tags"),
                })

    unique_repaired_pairs = {
        (event["listingId"], event["language"]) for event in repair_events
    }
    result = {
        "schemaVersion": 1,
        "generatedAt": utc_now(),
        "scope": {
            "shop": "grosgeek",
            "mode": "collection",
            "productionRuns": len(production_reports),
        },
        "summary": {
            "expectedGeneratedLocalizations": len(expected_pairs),
            "finalOutputsReconstructed": len(expected_pairs & set(final_outputs)),
            "missingOutputs": len(missing_outputs),
            "repairEvents": len(repair_events),
            "uniqueRepairedLocalizations": len(unique_repaired_pairs),
            "currentBlockingWarnings": len(blockers),
            "knownInvalidFragments": len(known_fragment_hits),
            "currentWarningCounts": dict(sorted(warning_counts.items())),
        },
        "productionReports": production_reports,
        "missingOutputs": [
            {"listingId": listing_id, "language": language}
            for listing_id, language in missing_outputs
        ],
        "blockingWarnings": blockers,
        "knownInvalidFragmentHits": known_fragment_hits,
        "nonBlockingWarnings": warning_items,
        "repairEvents": repair_events,
    }

    AUDIT_ROOT.mkdir(parents=True, exist_ok=True)
    destination = AUDIT_ROOT / "collection-grosgeek-closure-20260829.json"
    temporary = destination.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(destination)
    print(json.dumps(result["summary"], ensure_ascii=False, indent=2))
    print(destination)
    return 1 if missing_outputs or blockers or known_fragment_hits else 0


if __name__ == "__main__":
    raise SystemExit(main())
