from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import server
from localization_backfill_service import (
    blocking_quality_warnings,
    extract_response_text,
    localization_quality_warnings,
    normalize_localized_listing,
)

RUN_ID = "300bae5d4dfb4f9d966627f7d29ec571"
TITLE_REPLACEMENTS = {
    "70eda99c820744eaa9c15b4924e43218": (("P Popeye", "Popeye"),),
    "f3ca930eb14d4cbda8b4a98bade3a3bf": (("Diablo Diablo", "Diablo"),),
    "41c9034d1af24aa0b66703c3e9cff0a7": (("Habillée de Rage", "In Zorn gekleidet"),),
    "c5baf5372e2b496db24f6882c4bc8325": (
        ("Habillée de rage Garage Kit Résine HD 14K Figurine à peindre", "Vestida de ira Garage Kit de Resina HD 14K Figura para pintar"),
        ("Collection dark fantasy", "Colección dark fantasy"),
    ),
    "4f651ab3b49147c2858c3ff5502cffaf": (("Habillé de rage", "Облачённая в ярость"),),
    "09b065e6c0634d6c9e175b9b5abac7d5": (("Habillée de Rage", "Klädd i raseri"),),
}
TAG_OVERRIDES = {
    "41f0726a0d9e4a3abebaceb909849005": [
        "Jayce hars modelbouw",
        "Jayce miniatuur",
        "Arcane harssculptuur",
    ],
    "0ba60fb2cb854d108facd8430e0dedf4": ["фигурка царя обезьян"],
    "6128be3ec5c24401af28668f8da50c67": ["figura fantasy para montar"],
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_ledger(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def parse_json_object(raw_text: str) -> dict:
    text = str(raw_text or "").strip()
    fenced = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            raise ValueError("La réponse de réparation ne contient pas de JSON")
        payload = json.loads(match.group(0))
    if not isinstance(payload, dict):
        raise ValueError("La réponse de réparation doit être un objet JSON")
    return payload


def apply_title_replacements(output: dict, replacements: tuple[tuple[str, str], ...]) -> dict:
    repaired = {
        "title": str(output.get("title") or ""),
        "description": str(output.get("description") or ""),
        "tags": [str(tag or "") for tag in output.get("tags") or []],
    }
    for before, after in replacements:
        repaired["title"] = repaired["title"].replace(before, after)
    return repaired


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reuse-latest", action="store_true")
    parser.add_argument("--finalize-spanish-title", action="store_true")
    args = parser.parse_args()
    server.load_dotenv_file()
    database = sqlite3.connect(ROOT / ".localization_backfill.sqlite3")
    database.row_factory = sqlite3.Row
    active = database.execute(
        "SELECT run_id FROM localization_runs WHERE state IN ('running','paused') LIMIT 1"
    ).fetchone()
    if active:
        raise RuntimeError(f"Un lot est encore actif ({active['run_id']})")
    if args.finalize_spanish_title:
        ledger_path = ROOT / "data" / "localization_backfill" / "repairs" / "ninth-lot-repairs.json"
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        item = next(repair for repair in ledger["repairs"] if repair["jobId"] == "c5baf5372e2b496db24f6882c4bc8325")
        row = database.execute(
            "SELECT * FROM localization_jobs WHERE job_id=?",
            (item["jobId"],),
        ).fetchone()
        source = json.loads(row["source_json"])
        before_title = item["after"]["title"]
        after = normalize_localized_listing(
            apply_title_replacements(item["after"], (("Collection dark fantasy", "Colección dark fantasy"),)),
            row["language"],
        )
        blockers = blocking_quality_warnings(localization_quality_warnings(source, after, row["language"]))
        if blockers:
            raise ValueError(f"Contrôle qualité bloquant : {blockers}")
        result = server.publish_etsy_localization("grosgeek", row["listing_id"], row["language"], after)
        item.setdefault("postPublicationAdjustments", []).append({
            "at": utc_now(),
            "beforeTitle": before_title,
            "afterTitle": after["title"],
            "operation": result.get("operation"),
        })
        item["after"] = after
        ledger["updatedAt"] = utc_now()
        write_ledger(ledger_path, ledger)
        print(json.dumps({"status": "published", "title": after["title"]}, ensure_ascii=False))
        return 0
    rows = database.execute(
        "SELECT * FROM localization_jobs WHERE run_id=? ORDER BY listing_id, language",
        (RUN_ID,),
    ).fetchall()

    deficits = []
    rows_by_job = {row["job_id"]: row for row in rows}
    for row in rows:
        source = json.loads(row["source_json"])
        output = json.loads(row["output_json"] or "{}")
        missing_count = len(source.get("tags") or []) - len(output.get("tags") or [])
        if missing_count <= 0:
            continue
        deficits.append({
            "jobId": row["job_id"],
            "language": row["language"],
            "missingCount": missing_count,
            "sourceTitleFr": source.get("title") or "",
            "sourceTagsFr": source.get("tags") or [],
            "localizedTitle": output.get("title") or "",
            "currentLocalizedTags": output.get("tags") or [],
        })

    prompt = """Tu répares ponctuellement les tags d'un lot Etsy legacy déjà localisé.
Pour chaque objet, propose exactement `missingCount` tags SUPPLÉMENTAIRES dans la langue `language`.
Contraintes absolues :
- 30 caractères maximum par tag, espaces compris ;
- aucun doublon avec `currentLocalizedTags`, même après casse et espaces normalisés ;
- rester strictement dans le même champ sémantique que le titre et les tags français ;
- ne supprimer, réécrire ou retourner aucun tag existant ;
- formulation naturelle et utile au référencement local, sans invention de licence, personnage, matériau ou usage ;
- respecter strictement l'alphabet de la langue cible : japonais ou latin pour `ja`, cyrillique ou latin pour `ru`, alphabet latin pour toutes les autres langues ; ne jamais employer de lettres cyrilliques dans un tag japonais, polonais ou occidental ;
- répondre uniquement en JSON sous la forme {"repairs":[{"jobId":"...","additionalTags":["..."]}]}.

CAS À COMPLÉTER :
""" + json.dumps(deficits, ensure_ascii=False, indent=2)
    request = {
        "model": "gpt-5.6-luna",
        "input": [{"role": "user", "content": [{"type": "input_text", "text": prompt}]}],
        "reasoning": {"effort": "low"},
        "text": {"verbosity": "low"},
        "max_output_tokens": 6000,
        "store": False,
    }
    generation_debug_path = (
        ROOT / "data" / "localization_backfill" / "repairs"
        / "ninth-lot-tag-generation-latest.json"
    )
    if args.reuse_latest:
        generation_debug = json.loads(generation_debug_path.read_text(encoding="utf-8"))
        raw_response = generation_debug["rawResponse"]
        response = {"usage": generation_debug.get("usage") or {}}
    else:
        status, response = server.request_openai_localization(request)
        if status < 200 or status >= 300:
            message = ((response.get("error") or {}).get("message") if isinstance(response, dict) else "") or f"OpenAI HTTP {status}"
            raise RuntimeError(message)
        raw_response = extract_response_text(response)
        write_ledger(generation_debug_path, {
            "createdAt": utc_now(),
            "sourceRunId": RUN_ID,
            "usage": response.get("usage") or {},
            "rawResponse": raw_response,
        })
    generated = parse_json_object(raw_response)
    generated_by_job = {
        str(item.get("jobId") or ""): item.get("additionalTags")
        for item in generated.get("repairs") or []
        if isinstance(item, dict)
    }
    generated_by_job.update(TAG_OVERRIDES)
    expected_jobs = {item["jobId"] for item in deficits}
    if set(generated_by_job) != expected_jobs:
        missing = sorted(expected_jobs - set(generated_by_job))
        extra = sorted(set(generated_by_job) - expected_jobs)
        raise ValueError(f"Réponse tags incomplète (absents={missing}, inattendus={extra})")

    planned = []
    for deficit in deficits:
        row = rows_by_job[deficit["jobId"]]
        source = json.loads(row["source_json"])
        before = json.loads(row["output_json"])
        additions = generated_by_job[row["job_id"]]
        if not isinstance(additions, list) or len(additions) != deficit["missingCount"]:
            raise ValueError(f"Nombre de tags incorrect pour {row['job_id']}")
        additions = [str(tag or "").strip() for tag in additions]
        repaired = dict(before)
        repaired["tags"] = [*(before.get("tags") or []), *additions]
        repaired = apply_title_replacements(repaired, TITLE_REPLACEMENTS.get(row["job_id"], ()))
        after = normalize_localized_listing(repaired, row["language"])
        if len(after["tags"]) != len(source.get("tags") or []):
            raise ValueError(f"Total de tags incorrect après normalisation pour {row['job_id']}")
        if any(len(tag) > 30 for tag in after["tags"]):
            raise ValueError(f"Tag supérieur à 30 caractères pour {row['job_id']}")
        if len({tag.casefold() for tag in after["tags"]}) != len(after["tags"]):
            raise ValueError(f"Tags en doublon pour {row['job_id']}")
        warnings = localization_quality_warnings(source, after, row["language"])
        blockers = blocking_quality_warnings(warnings)
        if blockers:
            raise ValueError(f"Contrôle qualité bloquant pour {row['job_id']}: {blockers}")
        planned.append((row, source, before, after, additions, warnings))

    repaired_jobs = {row["job_id"] for row, *_rest in planned}
    for job_id, replacements in TITLE_REPLACEMENTS.items():
        if job_id in repaired_jobs:
            continue
        row = rows_by_job[job_id]
        source = json.loads(row["source_json"])
        before = json.loads(row["output_json"])
        after = normalize_localized_listing(apply_title_replacements(before, replacements), row["language"])
        warnings = localization_quality_warnings(source, after, row["language"])
        blockers = blocking_quality_warnings(warnings)
        if blockers:
            raise ValueError(f"Contrôle qualité bloquant pour {job_id}: {blockers}")
        planned.append((row, source, before, after, [], warnings))

    ledger_path = ROOT / "data" / "localization_backfill" / "repairs" / "ninth-lot-repairs.json"
    if ledger_path.exists():
        raise RuntimeError(f"Journal déjà existant : {ledger_path}")
    ledger = {
        "schemaVersion": 1,
        "createdAt": utc_now(),
        "sourceRunId": RUN_ID,
        "tagRepairMethod": "one-off agentic completion; no permanent tag-generation rule",
        "openaiUsage": response.get("usage") or {},
        "repairs": [],
        "summary": {"planned": len(planned), "published": 0, "failed": 0},
    }
    write_ledger(ledger_path, ledger)
    for row, _source, before, after, additions, warnings in planned:
        item = {
            "jobId": row["job_id"],
            "listingId": row["listing_id"],
            "language": row["language"],
            "before": before,
            "after": after,
            "additionalTags": additions,
            "qualityWarnings": warnings,
            "status": "planned",
        }
        ledger["repairs"].append(item)
        try:
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
