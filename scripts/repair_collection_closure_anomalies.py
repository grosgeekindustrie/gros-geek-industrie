from __future__ import annotations

import json
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

REPORT_ROOT = ROOT / "data" / "localization_backfill" / "reports"
REPAIR_ROOT = ROOT / "data" / "localization_backfill" / "repairs"

TEXT_REPAIRS = {
    ("4358535972", "pl"): (("figurка", "figurka"),),
    ("4360963413", "pl"): (("figurка", "figurka"),),
    ("4377142693", "pl"): (("figurка", "figurka"),),
    ("4389622713", "pl"): (("figurка", "figurka"),),
    ("4398213455", "pl"): (("figurка", "figurka"),),
    ("4424202241", "pl"): (("figurка", "figurka"),),
    ("4428347370", "pl"): (("figurка", "figurka"),),
    ("4490105105", "pl"): (("figurка", "figurka"),),
    ("4390992702", "pl"): (("niepomalana", "niepomalowana"),),
    ("4438771147", "pl"): (("niepomalana", "niepomalowana"),),
    ("4443830239", "pl"): (("niepomalana", "niepomalowana"),),
    ("4451485492", "pl"): (
        ("figur ka", "figurka"),
        ("n niepomalana", "niepomalowana"),
    ),
    ("4511197118", "pl"): (("niepomalana", "niepomalowana"),),
}

TITLE_REPAIRS = {
    ("4463433044", "ja"): "Scarlet Spider Marvel 1/6 1/8 14K HD レジンフィギュア 未塗装ガレージキット CA3D Studio",
    ("4483396543", "ja"): "Leon Kennedy Resident Evil Requiem 1/7 1/8 14K HD レジンフィギュア 未塗装ガレージキット",
    ("4484080020", "ja"): "Kliff Macduff Crimson Desert レジンスタチュー 未塗装ガレージキット 14K HD H3ll Creator",
    ("4484242458", "it"): "Kitana Mortal Kombat figura in resina da dipingere garage kit 14K HD 1/4 per collezionisti",
    ("4484242458", "nl"): "Kitana Mortal Kombat ongeverfde harsfiguur garagekit 14K HD 1/4 voor verzamelaars",
    ("4484242458", "pl"): "Kitana Mortal Kombat niepomalowany zestaw żywiczny 14K HD 1/4 do malowania",
    ("4484242458", "ru"): "Kitana Mortal Kombat коллекционная фигурка из смолы под покраску гараж-кит 14K HD 1/8",
    ("4484242458", "sv"): "Kitana Mortal Kombat omålad resinfigur garage kit 14K HD 1/4 för samlare",
    ("4550879121", "ja"): "Earth Warrior アニメ 14K HD レジンガレージキット 1/10から1/6 3Dプリント製 未塗装フィギュア",
    ("4550879121", "sv"): "Earth Warrior samlarfigur 3D-utskriven i 14K HD-resin omålad garage kit anime shonen",
    ("4551039289", "es"): "Dung Defender Hollow Knight garage kit de resina 14K HD impreso en 3D sin pintar",
    ("4551039289", "it"): "Dung Defender Hollow Knight garage kit in resina 14K HD stampato in 3D da dipingere",
    ("4551039289", "nl"): "Dung Defender Hollow Knight garagekit van 14K HD-hars 3D-geprint en ongeverfd",
    ("4551039289", "sv"): "Dung Defender Hollow Knight garage kit i 14K HD-resin omålad och 3D-utskriven",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_ledger(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    temporary.replace(path)


def reconstruct_final_outputs() -> tuple[dict, dict]:
    outputs = {}
    sources = {}
    for path in REPORT_ROOT.glob("localization-run-*.json"):
        report = read_json(path)
        translations = [
            translation
            for listing in report.get("listings") or []
            for translation in (listing.get("translations") or {}).values()
        ]
        if report.get("run", {}).get("testMode") or not any(
            translation.get("state") in {"published", "failed"}
            for translation in translations
        ):
            continue
        for listing in report.get("listings") or []:
            listing_id = str(listing.get("listingId") or "")
            for language, translation in (listing.get("translations") or {}).items():
                key = (listing_id, str(language))
                sources[key] = listing.get("source") or {}
                if translation.get("state") == "published":
                    outputs[key] = {
                        "title": translation.get("title"),
                        "tags": translation.get("tags"),
                        "description": translation.get("description"),
                    }

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
            if repair.get("status") == "published" and isinstance(repair.get("after"), dict):
                key = (str(repair.get("listingId")), str(repair.get("language")))
                outputs[key] = repair["after"]
    return outputs, sources


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
    outputs, sources = reconstruct_final_outputs()
    targets = set(TEXT_REPAIRS) | set(TITLE_REPAIRS)
    missing = sorted(targets - set(outputs))
    if missing:
        raise RuntimeError(f"Sorties finales introuvables : {missing}")

    destination = REPAIR_ROOT / "collection-closure-audit-repairs.json"
    if destination.exists():
        raise RuntimeError(f"Journal déjà existant : {destination}")
    ledger = {
        "schemaVersion": 1,
        "createdAt": utc_now(),
        "source": "double contrôle de clôture Collection Gros Geek",
        "repairs": [],
        "summary": {"planned": len(targets), "published": 0, "failed": 0},
    }
    write_ledger(destination, ledger)

    for listing_id, language in sorted(targets):
        key = (listing_id, language)
        before = outputs[key]
        after = replace_everywhere(before, TEXT_REPAIRS.get(key, ()))
        if key in TITLE_REPAIRS:
            after["title"] = TITLE_REPAIRS[key]
        after = normalize_localized_listing(after, language)
        warnings = localization_quality_warnings(sources[key], after, language)
        blockers = blocking_quality_warnings(warnings)
        item = {
            "listingId": listing_id,
            "language": language,
            "before": before,
            "after": after,
            "qualityWarnings": warnings,
            "status": "planned",
        }
        ledger["repairs"].append(item)
        try:
            if before == after:
                raise ValueError("La réparation ne modifie pas la localisation")
            if blockers:
                raise ValueError(
                    "Contrôle qualité bloquant : "
                    + ", ".join(str(warning.get("code") or "") for warning in blockers)
                )
            result = server.publish_etsy_localization(
                "grosgeek", listing_id, language, after
            )
            item.update({
                "status": "published",
                "operation": result.get("operation"),
                "publishedAt": utc_now(),
            })
            ledger["summary"]["published"] += 1
        except Exception as error:
            item.update({"status": "failed", "error": str(error)})
            ledger["summary"]["failed"] += 1
        ledger["summary"]["planned"] -= 1
        ledger["updatedAt"] = utc_now()
        write_ledger(destination, ledger)
        print(f"{listing_id} {language.upper()}: {item['status']}", flush=True)

    ledger["completedAt"] = utc_now()
    write_ledger(destination, ledger)
    print(json.dumps(ledger["summary"], ensure_ascii=False))
    return 0 if ledger["summary"]["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
