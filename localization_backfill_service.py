"""Backfill de localisations Etsy, persistant et isolé du workflow fiche unique.

Le service ne connaît ni le DOM ni le runtime de traduction historique. Il reçoit
trois adaptateurs depuis ``server.py`` : lecture catalogue Etsy, appel Responses
API et publication d'une traduction. Cette frontière permet de tester le moteur
sans appel payant et empêche le nouveau flux de modifier le flux fiche unique.
"""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import time
import unicodedata
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from threading import Event, Lock, Thread
from typing import Callable


SUPPORTED_LANGUAGES = (
    ("en", "Anglais"),
    ("de", "Allemand"),
    ("es", "Espagnol"),
    ("it", "Italien"),
    ("nl", "Néerlandais"),
    ("pt", "Portugais"),
    ("ja", "Japonais"),
    ("pl", "Polonais"),
    ("ru", "Russe"),
    ("sv", "Suédois"),
)
SUPPORTED_LANGUAGE_CODES = tuple(code for code, _label in SUPPORTED_LANGUAGES)
DEFAULT_EXCLUDED_SECTIONS = ("nerikson", "energixon", "rescale miniature")
SUPPORTED_SHOPS = {
    "grosgeek": "grosgeek.md",
    "doublex": "doublex.md",
}
SUPPORTED_MODELS = ("gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna")
SUPPORTED_REASONING_EFFORTS = ("none", "low", "medium", "high", "xhigh", "max")
AUTOMATION_MODEL = "gpt-5.6-luna"
AUTOMATION_REASONING_EFFORT = "low"
AUTOMATION_DEFAULT_POLL_SECONDS = 300
AUTOMATION_DEFAULT_STABILITY_SECONDS = 1200
AUTOMATION_WATCH_STATES = ("waiting_activation", "stabilizing", "verification")
AUTOMATION_ACTIVE_STATES = (*AUTOMATION_WATCH_STATES, "generating", "publishing")
STRUCTURAL_EMOJI_RE = re.compile(
    r"(?:[\u2600-\u27BF]|[\U0001F300-\U0001FAFF])(?:\uFE0F|\u200D(?:[\u2600-\u27BF]|[\U0001F300-\U0001FAFF])(?:\uFE0F)*)*"
)
FRENCH_RESIDUE_TERMS = (
    "sculpteur:",
    "gothique",
    "à peindre",
    "non peinte",
    "figurine de collection",
    "imprimée en 3d",
    "cadeau pour",
    "nombre de pièces",
)
MIN_SOURCE_DESCRIPTION_CHARS_FOR_LENGTH_CHECK = 500
MIN_LOCALIZED_DESCRIPTION_LENGTH_RATIO = 0.35
BLOCKING_QUALITY_WARNING_CODES = frozenset({
    "missing_tags",
    "too_many_tags",
    "multiple_missing_structural_emojis",
    "missing_scale_notation",
    "missing_title_technical_token",
    "suspicious_description_length",
    "unexpected_writing_system",
    "doublex_invalid_tag_count",
    "doublex_missing_mature_tag",
    "doublex_unexpected_mature_tag",
    "doublex_forbidden_adult_term",
})
LANGUAGE_TEXT_REPLACEMENTS = {
    "en": (
        ("Sculpteur:", "Sculptor:"),
        ("L’Homme au Bras d’Acier", "The Man with the Steel Arm"),
    ),
    "de": (
        ("Sculpteur:", "Bildhauer:"),
        ("Cœur de Titane", "Herz aus Titan"),
    ),
    "es": (
        ("Sculpteur:", "Escultor:"),
        ("Coração de Titanio", "Corazón de Titanio"),
    ),
    "it": (
        ("Sculpteur:", "Scultore:"),
        ("Le Fils des Ténèbres", "Il Figlio delle Tenebre"),
        ("statua Tomb Raider da dipingere", "statua Lara Croft da dipingere"),
    ),
    "nl": (
        ("Sculpteur:", "Beeldhouwer:"),
        ("Cœur de Titane", "Hart van titanium"),
        ("Astarion et Karlach", "Astarion en Karlach"),
        ("verzameliguur", "verzamelfiguur"),
        ("De asgravin", "De Askoningin"),
        ("de asgravin", "de Askoningin"),
    ),
    "pl": (
        ("Sculpteur:", "Rzeźbiarz:"),
        ("Cœur de Titane", "Tytanowe Serce"),
        ("Niezamalowany", "Niepomalowany"),
        ("niezamalowany", "niepomalowany"),
        ("niepomalana", "niepomalowana"),
        ("zywicy", "żywicy"),
        ("figurка", "figurka"),
    ),
    "pt": (
        ("Sculpteur:", "Escultor:"),
        ("La Guêpe Silencieuse", "A Vespa Silenciosa"),
        ("rendimentos 3D", "renderizações 3D"),
        ("renderizações 3D apresentados", "renderizações 3D apresentadas"),
    ),
    "ja": (
        ("Sculpteur:", "造形師:"),
        ("L’Homme au Bras d’Acier", "鋼鉄の腕を持つ男"),
    ),
    "ru": (
        ("Sculpteur:", "Скульптор:"),
        ("Ghishlaine Dedoldia под покраску", "Ghishlaine под покраску"),
    ),
    "sv": (
        ("Sculpteur:", "Skulptör:"),
        ("Cœur de Titane", "Hjärta av titan"),
        ("Målingstips", "Målningstips"),
        ("statу", "staty"),
    ),
}
LANGUAGE_WORD_REPLACEMENTS = {
    "nl": (
        (r"(?i)(?<!\w)figurines(?!\w)", "figuren"),
        (r"(?i)(?<!\w)figurine(?!\w)", "figuur"),
        (r"(?i)(?<!\w)fysieke\s+figuur(?!\w)", "fysiek figuur"),
        (r"(?i)(?<!\w)verzamelnee(?!\w)", "verzamelfiguur"),
        (r"(?i)(?<!\w)verzamelverzamelstuk(?!\w)", "verzamelstuk"),
        (r"(?i)(?<!\w)verzamel\s+figuur(?!\w)", "verzamelfiguur"),
        (r"(?i)(?<!\w)verzamel[-\s]*fuguur(?!\w)", "verzamelfiguur"),
    ),
    "pl": ((r"(?i)(?<!\w)statue(?!\w)", "statua"),),
    "sv": ((r"(?i)(?<!\w)statue(?!\w)", "staty"),),
}
PROTECTED_EXACT_LOCALIZATION_TERMS = (
    "Nerikson",
    "Rescale Miniatures",
    "Keycaps",
    "Neko Figurines",
    "Nom Nom Figurines",
)
UNIVERSE_LABELS = {
    "en": ("Universe",),
    "de": ("Universum",),
    "es": ("Universo",),
    "it": ("Universo",),
    "nl": ("Universum",),
    "pt": ("Universo",),
    "ja": ("世界観", "ユニバース"),
    "pl": ("Uniwersum",),
    "ru": ("Вселенная",),
    "sv": ("Universum",),
}
MODEL_RATES_PER_TOKEN = {
    "gpt-5.6-luna": {"input": 0.20 / 1_000_000, "output": 1.20 / 1_000_000},
    "gpt-5.6-terra": {"input": 2.00 / 1_000_000, "output": 12.00 / 1_000_000},
    "gpt-5.6-sol": {"input": 4.00 / 1_000_000, "output": 20.00 / 1_000_000},
}
RUN_STATES = ("draft", "running", "paused", "completed", "cancelled", "failed")
JOB_STATES = (
    "pending",
    "generating",
    "preview_ready",
    "publish_pending",
    "publishing",
    "published",
    "failed",
    "skipped",
    "cancelled",
)


def utc_iso(timestamp: float | None = None) -> str:
    return datetime.fromtimestamp(timestamp or time.time(), timezone.utc).isoformat()


def parse_utc_iso(value: str | None) -> float:
    try:
        return datetime.fromisoformat(str(value or "")).timestamp()
    except (TypeError, ValueError):
        return 0.0


def stable_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def source_fingerprint(listing: dict) -> str:
    source = {
        "title": str(listing.get("title") or ""),
        "description": str(listing.get("description") or ""),
        "tags": [str(tag or "") for tag in (listing.get("tags") or [])],
    }
    return hashlib.sha256(stable_json(source).encode("utf-8")).hexdigest()


def editorial_status(content: str) -> str:
    """Lire uniquement la déclaration STATUS placée en tête de ressource."""
    first_line = next((line.strip() for line in str(content or "").splitlines() if line.strip()), "")
    match = re.fullmatch(r"STATUS:\s*([A-Z_]+)", first_line)
    return match.group(1) if match else "MISSING"


def localization_quality_warnings(
    source: dict,
    output: dict,
    language: str = "",
    shop_key: str = "grosgeek",
) -> list[dict]:
    """Contrôles qualité après génération d'une localisation."""
    def canonical_emoji(value: str) -> str:
        return str(value or "").replace("\uFE0F", "").replace("\u200D", "")

    source_icons = Counter(
        canonical_emoji(icon)
        for icon in STRUCTURAL_EMOJI_RE.findall(str(source.get("description") or ""))
    )
    output_icons = Counter(
        canonical_emoji(icon)
        for icon in STRUCTURAL_EMOJI_RE.findall(str(output.get("description") or ""))
    )
    missing_icons = list((source_icons - output_icons).elements())
    warnings = []
    output_tags = [str(tag or "").strip() for tag in (output.get("tags") or []) if str(tag or "").strip()]
    if not output_tags:
        warnings.append({
            "code": "missing_tags",
            "message": "La localisation ne contient aucun tag",
            "values": {"actual": 0, "maximum": 13},
        })
    elif len(output_tags) > 13:
        warnings.append({
            "code": "too_many_tags",
            "message": "La localisation dépasse la limite de 13 tags",
            "values": {"actual": len(output_tags), "maximum": 13},
        })
    elif len(output_tags) < 13:
        warnings.append({
            "code": "incomplete_tag_count",
            "message": "La localisation contient moins de 13 tags ; une complétion SEO peut être proposée",
            "values": {"actual": len(output_tags), "target": 13, "missing": 13 - len(output_tags)},
        })
    if missing_icons:
        warnings.append({
            "code": "missing_structural_emoji",
            "message": "Emoji(s) structurant(s) absent(s) de la localisation",
            "values": missing_icons,
        })
        if len(missing_icons) > 1:
            warnings.append({
                "code": "multiple_missing_structural_emojis",
                "message": "Plusieurs marqueurs structurants ont disparu",
                "values": missing_icons,
            })
    searchable_output = "\n".join((
        str(output.get("title") or ""),
        "\n".join(str(tag or "") for tag in (output.get("tags") or [])),
        str(output.get("description") or ""),
    )).casefold()
    if str(shop_key or "").strip().lower() == "doublex":
        source_requires_mature = any(
            str(tag or "").strip().casefold() == "mature"
            for tag in (source.get("tags") or [])
        )
        distinct_tag_count = len({tag.casefold() for tag in output_tags})
        invalid_tag_count = (
            len(output_tags) > 13
            or distinct_tag_count != len(output_tags)
            or (source_requires_mature and len(output_tags) != 13)
        )
        if invalid_tag_count:
            warnings.append({
                "code": "doublex_invalid_tag_count",
                "message": (
                    "Une fiche Double X mature exige 13 tags distincts ; "
                    "une fiche non mature peut conserver moins de 13 tags"
                ),
                "values": {
                    "actual": len(output_tags),
                    "distinct": distinct_tag_count,
                    "expected": 13,
                },
            })
        mature_count = sum(1 for tag in output_tags if tag == "mature")
        if source_requires_mature and mature_count != 1:
            warnings.append({
                "code": "doublex_missing_mature_tag",
                "message": "Le tag réglementaire exact mature doit apparaître une seule fois",
                "values": {"actual": mature_count, "expected": 1},
            })
        if not source_requires_mature and mature_count:
            warnings.append({
                "code": "doublex_unexpected_mature_tag",
                "message": "Le tag mature ne doit pas être inventé lorsque la source française ne le contient pas",
                "values": {"actual": mature_count, "expected": 0},
            })
        forbidden_terms = sorted({
            match.group(0).casefold()
            for match in re.finditer(
                r"(?i)(?<!\w)(?:porn(?:o|ographic|ographique)?|hentai)(?!\w)",
                searchable_output,
            )
        })
        if forbidden_terms:
            warnings.append({
                "code": "doublex_forbidden_adult_term",
                "message": "Vocabulaire adulte interdit dans la localisation Double X",
                "values": forbidden_terms,
            })
    residues = [term for term in FRENCH_RESIDUE_TERMS if term in searchable_output]
    if residues:
        warnings.append({
            "code": "possible_french_residue",
            "message": "Résidu français manifeste possible, contrôle humain conseillé",
            "values": residues,
        })
    source_text = "\n".join((str(source.get("title") or ""), str(source.get("description") or "")))
    output_text = "\n".join((str(output.get("title") or ""), str(output.get("description") or "")))
    source_scales = Counter(re.findall(r"(?<!\d)1/\d+(?!\d)", source_text))
    output_scales = Counter(re.findall(r"(?<!\d)1/\d+(?!\d)", output_text))
    missing_scales = sorted((source_scales - output_scales).elements())
    if missing_scales:
        warnings.append({
            "code": "missing_scale_notation",
            "message": "Notation(s) d’échelle absente(s) ou altérée(s)",
            "values": missing_scales,
        })
    source_title = str(source.get("title") or "")
    output_title = str(output.get("title") or "")
    technical_title_tokens = re.findall(
        r"(?i)(?<!\w)(?:1/\d+|\d{2}K?\s*HD)(?!\w)",
        source_title,
    )
    def canonical_technical_text(value: str) -> str:
        compact = re.sub(r"\s+", "", str(value or "")).casefold()
        # Les anciennes fiches écrivent parfois « 14 HD » pour la même
        # spécification de résine que « 14K HD ». Cette variation ne doit pas
        # produire un faux blocage lorsque la sortie conserve la valeur.
        return re.sub(r"(?<!\d)(\d{2})k?hd", r"\1khd", compact)

    canonical_output_title = canonical_technical_text(output_title)
    missing_title_tokens = [
        token for token in technical_title_tokens
        if canonical_technical_text(token) not in canonical_output_title
    ]
    if missing_title_tokens:
        warnings.append({
            "code": "missing_title_technical_token",
            "message": "Notation technique du titre absente ou altérée",
            "values": missing_title_tokens,
        })
    expected_scripts = {
        "ja": {"CJK", "HIRAGANA", "KATAKANA", "LATIN"},
        "ru": {"CYRILLIC", "LATIN"},
    }.get(str(language or "").lower(), {"LATIN"})
    script_markers = (
        "MYANMAR", "CYRILLIC", "ARMENIAN", "HEBREW", "ARABIC",
        "DEVANAGARI", "HANGUL", "HIRAGANA", "KATAKANA", "CJK",
        "THAI", "GEORGIAN", "GREEK", "LATIN",
    )
    unexpected_characters = []
    title_and_tags = "\n".join((
        str(output.get("title") or ""),
        "\n".join(str(tag or "") for tag in (output.get("tags") or [])),
    ))
    for character in title_and_tags:
        if not character.isalpha():
            continue
        unicode_name = unicodedata.name(character, "")
        script = next((marker for marker in script_markers if marker in unicode_name), "")
        if script and script not in expected_scripts and character not in unexpected_characters:
            unexpected_characters.append(character)
    if unexpected_characters:
        warnings.append({
            "code": "unexpected_writing_system",
            "message": "Alphabet inattendu dans le titre ou les tags",
            "values": unexpected_characters,
        })
    source_description = str(source.get("description") or "").strip()
    output_description = str(output.get("description") or "").strip()
    if len(source_description) >= MIN_SOURCE_DESCRIPTION_CHARS_FOR_LENGTH_CHECK:
        length_ratio = len(output_description) / len(source_description)
        if length_ratio < MIN_LOCALIZED_DESCRIPTION_LENGTH_RATIO:
            warnings.append({
                "code": "suspicious_description_length",
                "message": "Description anormalement courte par rapport à la source",
                "values": {
                    "sourceChars": len(source_description),
                    "outputChars": len(output_description),
                    "ratio": round(length_ratio, 3),
                    "minimumRatio": MIN_LOCALIZED_DESCRIPTION_LENGTH_RATIO,
                },
            })
    return warnings


def blocking_quality_warnings(warnings: list[dict]) -> list[dict]:
    """Retourner les anomalies qui interdisent aperçu et publication."""
    return [
        warning for warning in warnings
        if str(warning.get("code") or "") in BLOCKING_QUALITY_WARNING_CODES
    ]


def sanitize_etsy_tag(value: str) -> str:
    """Respecter les caractères réellement acceptés par l'API Etsy pour un tag."""
    text = str(value or "").replace("’", "'")
    text = re.sub(r"(?i)D\s*&\s*D", "DnD", text)
    text = text.replace("/", "-").replace("&", " ").replace("・", " ")
    text = "".join(character for character in text if unicodedata.category(character) != "Cf")
    text = "".join(
        character
        if character.isalnum() or character in {" ", "-", "_", "'"}
        else " "
        for character in text
    )
    return re.sub(r"\s+", " ", text).strip()


def normalize_localized_listing(output: dict, language: str) -> dict:
    """Appliquer uniquement des corrections déterministes et sans ambiguïté."""
    replacements = LANGUAGE_TEXT_REPLACEMENTS.get(language, ())

    def normalize_text(value: str, *, compatibility: bool = True) -> str:
        text = unicodedata.normalize("NFKC" if compatibility else "NFC", str(value or ""))
        text = "".join(
            character
            for character in text
            if unicodedata.category(character) != "Cf" or (not compatibility and character == "\u200D")
        )
        protected_terms = {}
        for index, term in enumerate(PROTECTED_EXACT_LOCALIZATION_TERMS):
            token = f"__GGI_PROTECTED_{index}__"
            pattern = re.compile(rf"(?i)(?<!\w){re.escape(term)}(?!\w)")
            if pattern.search(text):
                text = pattern.sub(token, text)
                protected_terms[token] = term
        text = re.sub(r"(?<![A-Za-z])DYI(?![A-Za-z])", "DIY", text)
        for source, target in replacements:
            text = text.replace(source, target)
        for pattern, target in LANGUAGE_WORD_REPLACEMENTS.get(language, ()):
            text = re.sub(pattern, target, text)
        if language in {"ja", "ru"}:
            text = re.sub(r"(?<!\d)1\s+(10|12|[6-9])(?!\d)", r"1/\1", text)
        # Une donnée d'univers vide ne doit jamais laisser son libellé orphelin.
        for label in UNIVERSE_LABELS.get(language, ()):
            text = re.sub(
                rf"(?mi)^[ \t]*[•-]\s*{re.escape(label)}\s*[:：][ \t]*(?:\r?\n|$)",
                "",
                text,
            )
        for token, term in protected_terms.items():
            text = text.replace(token, term)
        return text

    normalized_tags = []
    seen_tags = set()
    for raw_tag in output.get("tags") or []:
        tag = sanitize_etsy_tag(normalize_text(raw_tag))
        key = re.sub(r"\s+", " ", tag).casefold()
        if not tag or key in seen_tags:
            continue
        seen_tags.add(key)
        normalized_tags.append(tag)
    return {
        "title": normalize_text(output.get("title")).strip(),
        "description": normalize_text(output.get("description"), compatibility=False),
        "tags": normalized_tags,
    }


def apply_doublex_tag_policy(source: dict, output: dict) -> dict:
    """Aligner les tags Double X sur le marqueur mature de la source FR.

    La source fait foi : mature est conservé une fois s'il existe, sinon il est
    supprimé. Un éventuel quatorzième tag est retiré par redondance, sans appel
    IA et sans jamais sacrifier mature lorsqu'il est requis.
    """
    requires_mature = any(
        str(tag or "").strip().casefold() == "mature"
        for tag in (source.get("tags") or [])
    )
    tags = [
        str(tag or "").strip()
        for tag in (output.get("tags") or [])
        if str(tag or "").strip() and str(tag or "").strip().casefold() != "mature"
    ]
    capacity = 12 if requires_mature else 13

    def tag_tokens(tag: str) -> set[str]:
        return {
            token.casefold()
            for token in re.findall(r"[^\W_]+", tag, flags=re.UNICODE)
            if len(token) > 1
        }

    while len(tags) > capacity:
        token_sets = [tag_tokens(tag) for tag in tags]
        scores = []
        for index, tokens in enumerate(token_sets):
            redundancy = 0.0
            for other_index, other_tokens in enumerate(token_sets):
                if index == other_index or not tokens or not other_tokens:
                    continue
                union = tokens | other_tokens
                redundancy = max(redundancy, len(tokens & other_tokens) / len(union))
            scores.append((redundancy, index))
        _, remove_index = max(scores, key=lambda item: (item[0], item[1]))
        tags.pop(remove_index)

    if requires_mature:
        tags.append("mature")
    return {**output, "tags": tags}


def extract_response_text(payload: dict) -> str:
    direct = str(payload.get("output_text") or "").strip()
    if direct:
        return direct
    parts = []
    for output in payload.get("output") or []:
        if not isinstance(output, dict):
            continue
        for content in output.get("content") or []:
            if isinstance(content, dict) and content.get("type") == "output_text":
                text = str(content.get("text") or "")
                if text:
                    parts.append(text)
    return "\n".join(parts).strip()


def parse_localized_listing(raw_text: str, language: str, *, max_tags: int = 13) -> dict:
    text = str(raw_text or "").strip()
    fenced = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        try:
            parsed = json.loads(text, strict=False)
        except json.JSONDecodeError:
            parsed = None
    if parsed is None:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            raise ValueError("La localisation ne contient pas de JSON exploitable")
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError:
            parsed = json.loads(match.group(0), strict=False)
    if not isinstance(parsed, dict):
        raise ValueError("La localisation doit être un objet JSON")

    title = str(parsed.get("title") or parsed.get(f"title_{language}") or "").strip()
    description = str(parsed.get("description") or parsed.get(f"description_{language}") or "")
    tags = parsed.get("tags")
    if tags is None:
        tags = parsed.get(f"tags_{language}")
    if isinstance(tags, str):
        tags = [part.strip() for part in tags.split(",") if part.strip()]
    if not isinstance(tags, list):
        tags = []
    tags = [str(tag or "").strip() for tag in tags if str(tag or "").strip()]
    normalized = normalize_localized_listing(
        {"title": title, "description": description, "tags": tags},
        language,
    )
    title = normalized["title"]
    description = normalized["description"]
    tags = normalized["tags"]

    problems = []
    if not title:
        problems.append("titre vide")
    if len(title) > 140:
        problems.append(f"titre supérieur à 140 caractères ({len(title)}/140)")
    if not description.strip():
        problems.append("description vide")
    if not tags:
        problems.append("tags vides")
    if len(tags) > max_tags:
        problems.append(f"plus de {max_tags} tags ({len(tags)}/{max_tags})")
    oversized_tags = [tag for tag in tags if len(tag) > 30]
    if oversized_tags:
        details = ", ".join(f"{tag!r} ({len(tag)}/30)" for tag in oversized_tags)
        problems.append(f"tag supérieur à 30 caractères : {details}")
    if problems:
        raise ValueError(f"Localisation invalide : {', '.join(problems)}")
    return normalized


class ClosingSQLiteConnection(sqlite3.Connection):
    def __exit__(self, exc_type, exc_value, traceback):
        try:
            return super().__exit__(exc_type, exc_value, traceback)
        finally:
            self.close()


class LocalizationBackfillService:
    """Files durables de localisations Collection, isolées par boutique.

    Les lots de backfill s'arrêtent en ``preview_ready`` jusqu'à validation
    humaine. Les lots liés à l'automatisation post-publication réutilisent le
    même moteur puis passent en publication après un dernier contrôle de la
    source française.
    """

    def __init__(
        self,
        root: Path,
        catalog_loader: Callable[[str], dict],
        openai_request: Callable[[dict], tuple[int, dict]],
        translation_publisher: Callable[[str, str, str, dict], dict],
        listing_loader: Callable[[str, list[str]], dict] | None = None,
        *,
        automation_poll_seconds: int = AUTOMATION_DEFAULT_POLL_SECONDS,
        automation_stability_seconds: int = AUTOMATION_DEFAULT_STABILITY_SECONDS,
    ):
        self.root = Path(root).resolve()
        self.db_path = self.root / ".localization_backfill.sqlite3"
        self.report_root = self.root / "data" / "localization_backfill" / "reports"
        self.prompt_root = self.root / "prompts" / "gpt" / "localisation_backfill"
        self.catalog_loader = catalog_loader
        self.openai_request = openai_request
        self.translation_publisher = translation_publisher
        self.listing_loader = listing_loader
        self.automation_poll_seconds = max(30, int(automation_poll_seconds))
        self.automation_stability_seconds = max(60, int(automation_stability_seconds))
        self._db_lock = Lock()
        self._wake = Event()
        self._stop = Event()
        self._worker: Thread | None = None
        self._next_automation_poll_at = 0.0
        self.report_root.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self._recover_interrupted_jobs()
        self._archive_existing_completed_runs()

    def _connect(self):
        connection = sqlite3.connect(
            self.db_path,
            timeout=30,
            factory=ClosingSQLiteConnection,
        )
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    def _init_db(self):
        with self._db_lock, self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS catalog_snapshots (
                    listing_id TEXT PRIMARY KEY,
                    shop_key TEXT NOT NULL,
                    section_id TEXT NOT NULL DEFAULT '',
                    section_name TEXT NOT NULL DEFAULT '',
                    source_hash TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    scanned_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS localization_runs (
                    run_id TEXT PRIMARY KEY,
                    shop_key TEXT NOT NULL,
                    state TEXT NOT NULL,
                    preview_only INTEGER NOT NULL DEFAULT 1,
                    test_mode INTEGER NOT NULL DEFAULT 0,
                    selection_hash TEXT NOT NULL DEFAULT '',
                    model TEXT NOT NULL,
                    reasoning_effort TEXT NOT NULL,
                    prompt_version TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    started_at TEXT,
                    completed_at TEXT,
                    error TEXT NOT NULL DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS localization_jobs (
                    job_id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL REFERENCES localization_runs(run_id) ON DELETE CASCADE,
                    listing_id TEXT NOT NULL,
                    language TEXT NOT NULL,
                    state TEXT NOT NULL,
                    source_hash TEXT NOT NULL,
                    prompt_version TEXT NOT NULL,
                    source_json TEXT NOT NULL,
                    output_json TEXT NOT NULL DEFAULT '',
                    raw_output TEXT NOT NULL DEFAULT '',
                    usage_json TEXT NOT NULL DEFAULT '',
                    quality_warnings_json TEXT NOT NULL DEFAULT '',
                    error TEXT NOT NULL DEFAULT '',
                    attempts INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    started_at TEXT,
                    completed_at TEXT,
                    UNIQUE(run_id, listing_id, language)
                );

                CREATE INDEX IF NOT EXISTS idx_localization_jobs_work
                ON localization_jobs(state, created_at);

                CREATE TABLE IF NOT EXISTS localization_automation_entries (
                    automation_id TEXT PRIMARY KEY,
                    listing_id TEXT NOT NULL,
                    shop_key TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    state TEXT NOT NULL,
                    source_hash TEXT NOT NULL DEFAULT '',
                    source_json TEXT NOT NULL DEFAULT '',
                    existing_languages_json TEXT NOT NULL DEFAULT '[]',
                    stable_since TEXT,
                    last_checked_at TEXT,
                    next_check_at TEXT,
                    run_id TEXT,
                    model TEXT NOT NULL,
                    reasoning_effort TEXT NOT NULL,
                    error TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    completed_at TEXT,
                    UNIQUE(shop_key, listing_id)
                );

                CREATE INDEX IF NOT EXISTS idx_localization_automation_work
                ON localization_automation_entries(state, next_check_at);
                """
            )
            run_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(localization_runs)").fetchall()
            }
            if "test_mode" not in run_columns:
                connection.execute(
                    "ALTER TABLE localization_runs ADD COLUMN test_mode INTEGER NOT NULL DEFAULT 0"
                )
            if "selection_hash" not in run_columns:
                connection.execute(
                    "ALTER TABLE localization_runs ADD COLUMN selection_hash TEXT NOT NULL DEFAULT ''"
                )
            job_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(localization_jobs)").fetchall()
            }
            if "started_at" not in job_columns:
                connection.execute("ALTER TABLE localization_jobs ADD COLUMN started_at TEXT")
            if "completed_at" not in job_columns:
                connection.execute("ALTER TABLE localization_jobs ADD COLUMN completed_at TEXT")
            if "quality_warnings_json" not in job_columns:
                connection.execute(
                    "ALTER TABLE localization_jobs ADD COLUMN quality_warnings_json TEXT NOT NULL DEFAULT ''"
                )
            connection.execute(
                "UPDATE localization_jobs SET completed_at=updated_at WHERE state='published' AND completed_at IS NULL"
            )
            run_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(localization_runs)").fetchall()
            }
            if "automation_id" not in run_columns:
                connection.execute(
                    "ALTER TABLE localization_runs ADD COLUMN automation_id TEXT NOT NULL DEFAULT ''"
                )

    def _recover_interrupted_jobs(self):
        now = utc_iso()
        with self._db_lock, self._connect() as connection:
            connection.execute(
                "UPDATE localization_jobs SET state='pending', updated_at=? WHERE state='generating'",
                (now,),
            )
            connection.execute(
                "UPDATE localization_jobs SET state='publish_pending', updated_at=? WHERE state='publishing'",
                (now,),
            )
            connection.execute(
                "UPDATE localization_runs SET state='paused', updated_at=? WHERE state='running'",
                (now,),
            )
            connection.execute(
                "UPDATE localization_runs SET state='running', updated_at=? WHERE automation_id!='' AND state='paused'",
                (now,),
            )

    def _archive_existing_completed_runs(self):
        """Matérialiser les rapports historiques absents sans aucun appel externe."""
        with self._db_lock, self._connect() as connection:
            run_ids = [
                row["run_id"]
                for row in connection.execute(
                    "SELECT run_id FROM localization_runs WHERE state IN ('completed','failed')"
                ).fetchall()
            ]
        for run_id in run_ids:
            target = self.report_root / f"localization-run-{run_id}.json"
            if target.exists():
                continue
            try:
                self.archive_run_report(run_id)
            except Exception:
                pass

    def start(self):
        if self._worker and self._worker.is_alive():
            return
        self._stop.clear()
        self._worker = Thread(target=self._worker_loop, name="localization-backfill", daemon=True)
        self._worker.start()

    def stop(self):
        self._stop.set()
        self._wake.set()
        if self._worker and self._worker.is_alive():
            self._worker.join(timeout=3)

    def _normalize_shop_key(self, shop_key: str = "grosgeek") -> str:
        normalized = str(shop_key or "grosgeek").strip().lower()
        if normalized not in SUPPORTED_SHOPS:
            raise ValueError(f"Boutique backfill non supportée : {normalized}")
        return normalized

    def _shop_prompt_path(self, shop_key: str) -> Path:
        normalized = self._normalize_shop_key(shop_key)
        return self.prompt_root / "shops" / SUPPORTED_SHOPS[normalized]

    def config(self, shop_key: str = "grosgeek") -> dict:
        shop_key = self._normalize_shop_key(shop_key)
        prompt_files = {
            "common": self.prompt_root / "common.md",
            "collection": self.prompt_root / "modes" / "collection.md",
            "shop": self._shop_prompt_path(shop_key),
            "fields": self.prompt_root / "fields.md",
            "glossaryShared": self.prompt_root / "glossaries" / "_shared.md",
            "frenchReference": self.prompt_root / "glossaries" / "fr.md",
        }
        glossary_status = {}
        for language, label in SUPPORTED_LANGUAGES:
            path = self.prompt_root / "glossaries" / f"{language}.md"
            content = path.read_text(encoding="utf-8") if path.exists() else ""
            fixed_path = self.prompt_root / "fixed_blocks" / f"{language}.md"
            fixed_content = fixed_path.read_text(encoding="utf-8") if fixed_path.exists() else ""
            glossary_status[language] = {
                "label": label,
                "path": str(path.relative_to(self.root)).replace("\\", "/"),
                "status": editorial_status(content),
                "ready": editorial_status(content) == "VALIDATED",
                "chars": len(content),
                "fixedBlocksPath": str(fixed_path.relative_to(self.root)).replace("\\", "/"),
                "fixedBlocksStatus": editorial_status(fixed_content),
                "fixedBlocksReady": editorial_status(fixed_content) == "VALIDATED",
            }
        return {
            "ok": True,
            "scope": {"shop": shop_key, "mode": "collection", "activeOnly": True},
            "languages": [{"code": code, "label": label} for code, label in SUPPORTED_LANGUAGES],
            "excludedSections": list(DEFAULT_EXCLUDED_SECTIONS),
            "promptFiles": {
                key: str(path.relative_to(self.root)).replace("\\", "/")
                for key, path in prompt_files.items()
            },
            "glossaries": glossary_status,
            "safety": {
                "generationStopsAtPreview": True,
                "publishRequiresExplicitApproval": True,
                "existingTranslationsAreSkipped": True,
            },
        }

    def enqueue_automation(
        self,
        shop_key: str,
        listing_id: str,
        mode: str,
        initial_source: dict | None = None,
    ) -> dict:
        """Inscrire un draft créé par le pipeline sans auditer le catalogue."""
        shop_key = self._normalize_shop_key(shop_key)
        listing_id = str(listing_id or "").strip()
        mode = str(mode or "").strip().lower()
        if not listing_id:
            raise ValueError("listing_id manquant pour l'automatisation")
        if mode != "collection":
            return {
                "ok": True,
                "eligible": False,
                "reason": "L'automatisation Tabletop reste désactivée jusqu'à validation de son backfill.",
            }
        now = utc_iso()
        automation_id = uuid.uuid4().hex
        source = initial_source if isinstance(initial_source, dict) else {}
        with self._db_lock, self._connect() as connection:
            existing = connection.execute(
                "SELECT * FROM localization_automation_entries WHERE shop_key=? AND listing_id=?",
                (shop_key, listing_id),
            ).fetchone()
            if existing:
                return {
                    "ok": True,
                    "eligible": True,
                    "reused": True,
                    "automationId": existing["automation_id"],
                    "state": existing["state"],
                }
            connection.execute(
                """
                INSERT INTO localization_automation_entries (
                    automation_id, listing_id, shop_key, mode, state,
                    source_json, next_check_at, model, reasoning_effort,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'waiting_activation', ?, ?, ?, ?, ?, ?)
                """,
                (
                    automation_id, listing_id, shop_key, mode,
                    stable_json(source), now, AUTOMATION_MODEL,
                    AUTOMATION_REASONING_EFFORT, now, now,
                ),
            )
        self._next_automation_poll_at = 0.0
        self._wake.set()
        return {
            "ok": True,
            "eligible": True,
            "automationId": automation_id,
            "state": "waiting_activation",
        }

    def automation_dashboard(self, shop_key: str = "grosgeek", limit: int = 200) -> dict:
        shop_key = self._normalize_shop_key(shop_key)
        with self._db_lock, self._connect() as connection:
            entries = connection.execute(
                """
                SELECT * FROM localization_automation_entries
                WHERE shop_key=?
                ORDER BY
                    CASE state
                        WHEN 'attention' THEN 0
                        WHEN 'error' THEN 0
                        WHEN 'publishing' THEN 1
                        WHEN 'generating' THEN 1
                        WHEN 'stabilizing' THEN 2
                        WHEN 'waiting_activation' THEN 2
                        ELSE 3
                    END,
                    updated_at DESC
                LIMIT ?
                """,
                (shop_key, max(1, min(int(limit), 500))),
            ).fetchall()
            entry_payloads = []
            for entry in entries:
                jobs = []
                if entry["run_id"]:
                    jobs = connection.execute(
                        """
                        SELECT * FROM localization_jobs
                        WHERE run_id=? ORDER BY language
                        """,
                        (entry["run_id"],),
                    ).fetchall()
                entry_payloads.append(self._serialize_automation_entry(entry, jobs))
        counts = Counter(item["state"] for item in entry_payloads)
        return {
            "ok": True,
            "shopKey": shop_key,
            "pollSeconds": self.automation_poll_seconds,
            "stabilitySeconds": self.automation_stability_seconds,
            "languages": [{"code": code, "label": label} for code, label in SUPPORTED_LANGUAGES],
            "counts": dict(counts),
            "entries": entry_payloads,
        }

    def _serialize_automation_entry(self, entry, jobs) -> dict:
        source = json.loads(entry["source_json"] or "{}")
        existing_languages = set(json.loads(entry["existing_languages_json"] or "[]"))
        job_by_language = {str(job["language"]): job for job in jobs}
        language_states = []
        errors = []
        total_usage = {
            "inputTokens": 0,
            "cachedTokens": 0,
            "outputTokens": 0,
            "reasoningTokens": 0,
        }
        processing_seconds = 0.0
        for language, label in SUPPORTED_LANGUAGES:
            job = job_by_language.get(language)
            if job:
                state = str(job["state"])
                usage = json.loads(job["usage_json"] or "{}")
                total_usage["inputTokens"] += int(usage.get("input_tokens") or 0)
                total_usage["cachedTokens"] += int(
                    (usage.get("input_tokens_details") or {}).get("cached_tokens") or 0
                )
                total_usage["outputTokens"] += int(usage.get("output_tokens") or 0)
                total_usage["reasoningTokens"] += int(
                    (usage.get("output_tokens_details") or {}).get("reasoning_tokens") or 0
                )
                if job["started_at"]:
                    job_end = parse_utc_iso(job["completed_at"] or utc_iso())
                    processing_seconds += max(0.0, job_end - parse_utc_iso(job["started_at"]))
                output = json.loads(job["output_json"] or "{}")
                warnings = json.loads(job["quality_warnings_json"] or "[]")
                error = str(job["error"] or "")
                if state == "failed" or error:
                    errors.append({
                        "language": language,
                        "label": label,
                        "state": state,
                        "error": error,
                        "qualityWarnings": warnings,
                        "output": output,
                        "attempts": int(job["attempts"] or 0),
                    })
            elif language in existing_languages:
                state = "published"
            else:
                state = "waiting"
            language_states.append({"code": language, "label": label, "state": state})
        entry_error = str(entry["error"] or "")
        if entry_error and not errors:
            errors.append({
                "language": "",
                "label": "Automatisation",
                "state": str(entry["state"]),
                "error": entry_error,
                "qualityWarnings": [],
                "output": {},
                "attempts": 0,
            })
        rates = MODEL_RATES_PER_TOKEN.get(str(entry["model"]), {"input": 0.0, "output": 0.0})
        uncached_input = max(0, total_usage["inputTokens"] - total_usage["cachedTokens"])
        estimated_cost_usd = (
            uncached_input * rates["input"]
            + total_usage["cachedTokens"] * rates["input"] * 0.1
            + total_usage["outputTokens"] * rates["output"]
        )
        return {
            "automationId": entry["automation_id"],
            "listingId": entry["listing_id"],
            "shopKey": entry["shop_key"],
            "mode": entry["mode"],
            "state": entry["state"],
            "title": str(source.get("title") or ""),
            "imageUrl": str(source.get("imageUrl") or ""),
            "url": str(source.get("url") or ""),
            "stableSince": entry["stable_since"] or "",
            "lastCheckedAt": entry["last_checked_at"] or "",
            "nextCheckAt": entry["next_check_at"] or "",
            "runId": entry["run_id"] or "",
            "model": entry["model"],
            "reasoningEffort": entry["reasoning_effort"],
            "createdAt": entry["created_at"],
            "updatedAt": entry["updated_at"],
            "completedAt": entry["completed_at"] or "",
            "languages": language_states,
            "errors": errors,
            "hasErrors": bool(errors),
            "usage": total_usage,
            "processingSeconds": round(processing_seconds, 1),
            "estimatedCostUsd": round(estimated_cost_usd, 4),
        }

    def automation_action(self, automation_id: str, action: str, language: str = "") -> dict:
        automation_id = str(automation_id or "").strip()
        action = str(action or "").strip().lower()
        language = str(language or "").strip().lower()
        now = utc_iso()
        with self._db_lock, self._connect() as connection:
            entry = connection.execute(
                "SELECT * FROM localization_automation_entries WHERE automation_id=?",
                (automation_id,),
            ).fetchone()
            if not entry:
                raise ValueError("Automatisation introuvable")
            if action == "check_now":
                connection.execute(
                    "UPDATE localization_automation_entries SET next_check_at=?, updated_at=?, error='' WHERE automation_id=?",
                    (now, now, automation_id),
                )
                self._next_automation_poll_at = 0.0
            elif action in {"retry_failed", "retry_language"}:
                if not entry["run_id"]:
                    raise ValueError("Aucun lot associé à relancer")
                parameters: list[str] = [entry["run_id"]]
                language_clause = ""
                if action == "retry_language":
                    if language not in SUPPORTED_LANGUAGE_CODES:
                        raise ValueError("Langue de relance invalide")
                    language_clause = " AND language=?"
                    parameters.append(language)
                failed_jobs = connection.execute(
                    f"SELECT * FROM localization_jobs WHERE run_id=? AND state='failed'{language_clause}",
                    tuple(parameters),
                ).fetchall()
                if not failed_jobs:
                    raise ValueError("Aucune traduction en erreur à relancer")
                requires_generation = False
                for job in failed_jobs:
                    warnings = json.loads(job["quality_warnings_json"] or "[]")
                    reusable_output = (
                        bool(str(job["output_json"] or "").strip())
                        and not blocking_quality_warnings(warnings)
                    )
                    # Une erreur de publication peut réutiliser sa sortie validée.
                    # Une sortie refusée par le validateur doit être régénérée,
                    # sinon la relance reproduirait indéfiniment le même échec.
                    next_state = "publish_pending" if reusable_output else "pending"
                    requires_generation = requires_generation or next_state == "pending"
                    connection.execute(
                        """
                        UPDATE localization_jobs
                        SET state=?, error='', updated_at=?, started_at=NULL, completed_at=NULL
                        WHERE job_id=?
                        """,
                        (next_state, now, job["job_id"]),
                    )
                connection.execute(
                    "UPDATE localization_runs SET state='running', completed_at=NULL, updated_at=?, error='' WHERE run_id=?",
                    (now, entry["run_id"]),
                )
                connection.execute(
                    """
                    UPDATE localization_automation_entries
                    SET state=?, error='', completed_at=NULL, updated_at=?
                    WHERE automation_id=?
                    """,
                    ("generating" if requires_generation else "publishing", now, automation_id),
                )
            else:
                raise ValueError(f"Action d'automatisation inconnue : {action}")
        self._wake.set()
        return self.automation_entry(automation_id)

    def automation_entry(self, automation_id: str) -> dict:
        with self._db_lock, self._connect() as connection:
            entry = connection.execute(
                "SELECT * FROM localization_automation_entries WHERE automation_id=?",
                (str(automation_id or "").strip(),),
            ).fetchone()
            if not entry:
                raise ValueError("Automatisation introuvable")
            jobs = connection.execute(
                "SELECT * FROM localization_jobs WHERE run_id=? ORDER BY language",
                (entry["run_id"] or "",),
            ).fetchall()
        return {"ok": True, "entry": self._serialize_automation_entry(entry, jobs)}

    def export_automation_entry(self, automation_id: str) -> dict:
        payload = self.automation_entry(automation_id)["entry"]
        report = {
            "schemaVersion": 1,
            "exportType": "localization_automation_entry",
            "generatedAt": utc_iso(),
            "automation": payload,
        }
        if payload["runId"]:
            report["run"] = self.export_run(payload["runId"])
        return report

    def refresh_catalog(self, shop_key: str = "grosgeek") -> dict:
        shop_key = self._normalize_shop_key(shop_key)
        catalog = self.catalog_loader(shop_key)
        listings = catalog.get("listings") or []
        scanned_at = utc_iso()
        with self._db_lock, self._connect() as connection:
            connection.execute("DELETE FROM catalog_snapshots WHERE shop_key=?", (shop_key,))
            for listing in listings:
                listing_id = str(listing.get("listingId") or "").strip()
                if not listing_id:
                    continue
                connection.execute(
                    """
                    INSERT INTO catalog_snapshots (
                        listing_id, shop_key, section_id, section_name,
                        source_hash, payload_json, scanned_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        listing_id,
                        shop_key,
                        str(listing.get("sectionId") or ""),
                        str(listing.get("sectionName") or ""),
                        source_fingerprint(listing),
                        stable_json(listing),
                        scanned_at,
                    ),
                )
        return self.catalog(shop_key)

    def catalog(self, shop_key: str = "grosgeek") -> dict:
        shop_key = self._normalize_shop_key(shop_key)
        with self._db_lock, self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM catalog_snapshots WHERE shop_key=? ORDER BY listing_id DESC",
                (shop_key,),
            ).fetchall()
        listings = []
        for row in rows:
            payload = json.loads(row["payload_json"])
            translations = sorted({str(code).lower() for code in (payload.get("translations") or [])})
            section_name = str(row["section_name"] or "")
            normalized_section = section_name.casefold().strip()
            excluded = any(name in normalized_section for name in DEFAULT_EXCLUDED_SECTIONS)
            missing = [code for code in SUPPORTED_LANGUAGE_CODES if code not in translations]
            listings.append({
                **payload,
                "sourceHash": row["source_hash"],
                "translations": translations,
                "missingLanguages": missing,
                "excluded": excluded,
                "exclusionReason": f"Section exclue : {section_name}" if excluded else "",
            })
        sections = sorted({str(item.get("sectionName") or "") for item in listings if item.get("sectionName")})
        scanned_at = rows[0]["scanned_at"] if rows else ""
        return {
            "ok": True,
            "shopKey": shop_key,
            "scannedAt": scanned_at,
            "count": len(listings),
            "eligibleCount": sum(1 for listing in listings if not listing["excluded"]),
            "sections": sections,
            "listings": listings,
        }

    def _prompt_version(self, shop_key: str = "grosgeek") -> str:
        shop_key = self._normalize_shop_key(shop_key)
        paths = [
            self.prompt_root / "common.md",
            self.prompt_root / "modes" / "collection.md",
            self._shop_prompt_path(shop_key),
            self.prompt_root / "fields.md",
            self.prompt_root / "glossaries" / "_shared.md",
            *(self.prompt_root / "glossaries" / f"{code}.md" for code in SUPPORTED_LANGUAGE_CODES),
            *(self.prompt_root / "fixed_blocks" / f"{code}.md" for code in SUPPORTED_LANGUAGE_CODES),
        ]
        digest = hashlib.sha256()
        for path in paths:
            digest.update(str(path.relative_to(self.root)).encode("utf-8"))
            digest.update(path.read_bytes() if path.exists() else b"")
        return digest.hexdigest()[:16]

    def _load_prompt(
        self,
        language: str,
        listing: dict,
        shop_key: str = "grosgeek",
    ) -> str:
        shop_key = self._normalize_shop_key(shop_key)
        language_label = dict(SUPPORTED_LANGUAGES)[language]
        paths = (
            self.prompt_root / "common.md",
            self.prompt_root / "modes" / "collection.md",
            self._shop_prompt_path(shop_key),
            self.prompt_root / "fields.md",
            self.prompt_root / "glossaries" / "_shared.md",
            self.prompt_root / "glossaries" / f"{language}.md",
            self.prompt_root / "fixed_blocks" / f"{language}.md",
        )
        chunks = []
        for path in paths:
            if not path.exists():
                raise ValueError(f"Fichier de localisation manquant : {path.relative_to(self.root)}")
            chunks.append(path.read_text(encoding="utf-8").strip())
        source = {
            "target_language": {"code": language, "label": language_label},
            "listing": {
                "listing_id": str(listing.get("listingId") or ""),
                "title_fr": str(listing.get("title") or ""),
                "tags_fr": [str(tag or "") for tag in (listing.get("tags") or [])],
                "description_fr": str(listing.get("description") or ""),
                "section": str(listing.get("sectionName") or ""),
            },
        }
        return "\n\n---\n\n".join(chunks) + "\n\nDONNÉES SOURCE JSON\n" + json.dumps(source, ensure_ascii=False, indent=2)

    def create_run(
        self,
        listing_ids: list[str],
        languages: list[str],
        *,
        shop_key: str = "grosgeek",
        model: str = "gpt-5.6-terra",
        reasoning_effort: str = "low",
        test_mode: bool = False,
    ) -> dict:
        shop_key = self._normalize_shop_key(shop_key)
        normalized_languages = list(SUPPORTED_LANGUAGE_CODES) if test_mode else []
        if not test_mode:
            for language in languages:
                code = str(language or "").strip().lower()
                if code in SUPPORTED_LANGUAGE_CODES and code not in normalized_languages:
                    normalized_languages.append(code)
        if not normalized_languages:
            raise ValueError("Sélectionne au moins une langue")
        normalized_ids = list(dict.fromkeys(str(value or "").strip() for value in listing_ids if str(value or "").strip()))
        if not normalized_ids:
            raise ValueError("Sélectionne au moins une fiche")
        if test_mode and len(normalized_ids) != 4:
            raise ValueError("Le test qualité exige exactement quatre fiches")
        if model not in SUPPORTED_MODELS:
            raise ValueError(f"Modèle backfill non supporté : {model}")
        if reasoning_effort not in SUPPORTED_REASONING_EFFORTS:
            raise ValueError(f"Niveau de réflexion non supporté : {reasoning_effort}")
        draft_glossaries = []
        for language in normalized_languages:
            glossary_path = self.prompt_root / "glossaries" / f"{language}.md"
            glossary = glossary_path.read_text(encoding="utf-8") if glossary_path.exists() else ""
            fixed_path = self.prompt_root / "fixed_blocks" / f"{language}.md"
            fixed_blocks = fixed_path.read_text(encoding="utf-8") if fixed_path.exists() else ""
            if editorial_status(glossary) != "VALIDATED" or editorial_status(fixed_blocks) != "VALIDATED":
                draft_glossaries.append(language)
        if len(normalized_ids) > 4 and draft_glossaries:
            raise ValueError(
                "Backfill massif bloqué : glossaires encore en brouillon pour "
                + ", ".join(code.upper() for code in draft_glossaries)
                + ". Le mode brouillon est limité aux quatre fiches test."
            )

        placeholders = ",".join("?" for _ in normalized_ids)
        with self._db_lock, self._connect() as connection:
            rows = connection.execute(
                f"SELECT * FROM catalog_snapshots WHERE shop_key=? AND listing_id IN ({placeholders})",
                (shop_key, *normalized_ids),
            ).fetchall()
        found = {row["listing_id"]: row for row in rows}
        missing_ids = [listing_id for listing_id in normalized_ids if listing_id not in found]
        if missing_ids:
            raise ValueError(f"Fiches absentes de l'audit : {', '.join(missing_ids[:5])}")

        run_id = uuid.uuid4().hex
        now = utc_iso()
        prompt_version = self._prompt_version(shop_key)
        selection_hash = hashlib.sha256(stable_json({
            "listingIds": sorted(normalized_ids),
            "sourceHashes": {
                listing_id: found[listing_id]["source_hash"]
                for listing_id in sorted(normalized_ids)
            },
            "languages": normalized_languages,
            "shopKey": shop_key,
            "model": model,
            "reasoningEffort": reasoning_effort,
            "promptVersion": prompt_version,
            "testMode": bool(test_mode),
        }).encode("utf-8")).hexdigest()
        if test_mode:
            with self._db_lock, self._connect() as connection:
                existing_test = connection.execute(
                    """
                    SELECT run_id FROM localization_runs
                    WHERE test_mode=1 AND selection_hash=? AND state!='cancelled'
                    ORDER BY created_at DESC LIMIT 1
                    """,
                    (selection_hash,),
                ).fetchone()
            if existing_test:
                reused = self.get_run(existing_test["run_id"])
                reused["reusedRun"] = True
                return reused
        jobs = []
        skipped_existing = 0
        skipped_excluded = 0
        skipped_duplicate = 0
        with self._db_lock, self._connect() as connection:
            reusable_rows = connection.execute(
                """
                SELECT jobs.listing_id, jobs.language, jobs.source_hash, jobs.prompt_version
                FROM localization_jobs AS jobs
                JOIN localization_runs AS runs ON runs.run_id=jobs.run_id
                WHERE runs.test_mode=0 AND runs.shop_key=?
                  AND jobs.state IN ('pending','generating','preview_ready','publish_pending','publishing','published')
                """,
                (shop_key,),
            ).fetchall()
        reusable_keys = {
            (row["listing_id"], row["language"], row["source_hash"], row["prompt_version"])
            for row in reusable_rows
        }
        for listing_id in normalized_ids:
            row = found[listing_id]
            listing = json.loads(row["payload_json"])
            section_name = str(row["section_name"] or "")
            if any(name in section_name.casefold() for name in DEFAULT_EXCLUDED_SECTIONS):
                if test_mode:
                    raise ValueError(f"La fiche {listing_id} appartient à une section exclue : {section_name}")
                skipped_excluded += len(normalized_languages)
                continue
            existing = {str(code).lower() for code in (listing.get("translations") or [])}
            for language in normalized_languages:
                if not test_mode and language in existing:
                    skipped_existing += 1
                    continue
                if not test_mode and (listing_id, language, row["source_hash"], prompt_version) in reusable_keys:
                    skipped_duplicate += 1
                    continue
                jobs.append((listing_id, language, row["source_hash"], stable_json(listing)))
        if test_mode and len(jobs) != 4 * len(SUPPORTED_LANGUAGE_CODES):
            raise ValueError("Le lot test doit contenir exactement 40 localisations")
        if not jobs:
            raise ValueError("Aucun nouveau job : localisations déjà présentes, exclues ou déjà préparées avec cette version du prompt")

        with self._db_lock, self._connect() as connection:
            connection.execute(
                """
                INSERT INTO localization_runs (
                    run_id, shop_key, state, preview_only, test_mode, selection_hash,
                    model, reasoning_effort, prompt_version, created_at, updated_at
                ) VALUES (?, ?, 'draft', 1, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id, shop_key, int(test_mode), selection_hash, model,
                    reasoning_effort, prompt_version, now, now,
                ),
            )
            for listing_id, language, fingerprint, source_json in jobs:
                connection.execute(
                    """
                    INSERT INTO localization_jobs (
                        job_id, run_id, listing_id, language, state, source_hash,
                        prompt_version, source_json, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
                    """,
                    (uuid.uuid4().hex, run_id, listing_id, language, fingerprint, prompt_version, source_json, now, now),
                )
        return {
            **self.get_run(run_id),
            "createdJobs": len(jobs),
            "skippedExisting": skipped_existing,
            "skippedExcluded": skipped_excluded,
            "skippedDuplicate": skipped_duplicate,
        }

    def create_test_run(
        self,
        listing_ids: list[str],
        *,
        shop_key: str = "grosgeek",
        model: str = "gpt-5.6-terra",
        reasoning_effort: str = "low",
    ) -> dict:
        run = self.create_run(
            listing_ids,
            list(SUPPORTED_LANGUAGE_CODES),
            shop_key=shop_key,
            model=model,
            reasoning_effort=reasoning_effort,
            test_mode=True,
        )
        if run["state"] in {"draft", "paused"}:
            return self.action(run["runId"], "start") | {
                "createdJobs": run.get("createdJobs", run.get("totalJobs", 0)),
                "reusedRun": bool(run.get("reusedRun")),
            }
        if run["state"] == "failed":
            return self.action(run["runId"], "retry") | {"reusedRun": True}
        return run

    def estimate(
        self,
        listing_ids: list[str],
        languages: list[str],
        model: str,
        *,
        shop_key: str = "grosgeek",
        force_existing: bool = False,
    ) -> dict:
        """Estimation prudente sans appel IA, avant création du lot.

        Le calcul ne promet pas la facture exacte : il suppose environ quatre
        caractères par token et ne déduit aucun cache. Le coût réel du POC sera
        ensuite disponible dans les usages du lot.
        """
        shop_key = self._normalize_shop_key(shop_key)
        normalized_ids = list(dict.fromkeys(str(value or "").strip() for value in listing_ids if str(value or "").strip()))
        normalized_languages = list(SUPPORTED_LANGUAGE_CODES) if force_existing else [
            code for code in dict.fromkeys(str(value or "").strip().lower() for value in languages)
            if code in SUPPORTED_LANGUAGE_CODES
        ]
        if model not in MODEL_RATES_PER_TOKEN:
            raise ValueError(f"Modèle backfill non supporté : {model}")
        if not normalized_ids or not normalized_languages:
            return {"ok": True, "jobs": 0, "estimatedInputTokens": 0, "estimatedOutputTokens": 0, "estimatedCostUsd": 0}
        placeholders = ",".join("?" for _ in normalized_ids)
        with self._db_lock, self._connect() as connection:
            rows = connection.execute(
                f"SELECT * FROM catalog_snapshots WHERE shop_key=? AND listing_id IN ({placeholders})",
                (shop_key, *normalized_ids),
            ).fetchall()
        estimated_input = 0
        estimated_output = 0
        jobs = 0
        for row in rows:
            listing = json.loads(row["payload_json"])
            section_name = str(row["section_name"] or "")
            if any(name in section_name.casefold() for name in DEFAULT_EXCLUDED_SECTIONS):
                continue
            existing = {str(code).lower() for code in (listing.get("translations") or [])}
            source_chars = len(str(listing.get("description") or "")) + len(str(listing.get("title") or ""))
            source_chars += sum(len(str(tag or "")) for tag in (listing.get("tags") or []))
            for language in normalized_languages:
                if not force_existing and language in existing:
                    continue
                prompt_chars = len(self._load_prompt(language, listing, shop_key))
                estimated_input += max(1, round(prompt_chars / 4))
                estimated_output += max(256, round(source_chars / 4 * 1.15))
                jobs += 1
        rates = MODEL_RATES_PER_TOKEN[model]
        estimated_cost = estimated_input * rates["input"] + estimated_output * rates["output"]
        return {
            "ok": True,
            "model": model,
            "jobs": jobs,
            "estimatedInputTokens": estimated_input,
            "estimatedOutputTokens": estimated_output,
            "estimatedCostUsd": round(estimated_cost, 4),
            "economicBatchEstimateUsd": round(estimated_cost * 0.5, 4),
            "method": "estimation prudente sans cache, 4 caractères/token ; le réel peut varier",
        }

    def list_runs(self, limit: int = 20, shop_key: str = "grosgeek") -> dict:
        shop_key = self._normalize_shop_key(shop_key)
        with self._db_lock, self._connect() as connection:
            rows = connection.execute(
                "SELECT run_id FROM localization_runs WHERE shop_key=? ORDER BY created_at DESC LIMIT ?",
                (shop_key, max(1, min(int(limit), 100))),
            ).fetchall()
        return {"ok": True, "runs": [self.get_run(row["run_id"], include_jobs=False) for row in rows]}

    def get_run(self, run_id: str, *, include_jobs: bool = True) -> dict:
        with self._db_lock, self._connect() as connection:
            run = connection.execute(
                "SELECT * FROM localization_runs WHERE run_id=?",
                (run_id,),
            ).fetchone()
            if not run:
                raise ValueError("Lot de localisation introuvable")
            counts = connection.execute(
                "SELECT state, COUNT(*) AS count FROM localization_jobs WHERE run_id=? GROUP BY state",
                (run_id,),
            ).fetchall()
            job_rows = connection.execute(
                "SELECT * FROM localization_jobs WHERE run_id=? ORDER BY created_at, language",
                (run_id,),
            ).fetchall()
        state_counts = {row["state"]: row["count"] for row in counts}
        usage = {"inputTokens": 0, "cachedTokens": 0, "outputTokens": 0, "reasoningTokens": 0}
        serialized_jobs = []
        for job in job_rows:
            job_usage = json.loads(job["usage_json"] or "{}")
            usage["inputTokens"] += int(job_usage.get("input_tokens") or 0)
            usage["cachedTokens"] += int((job_usage.get("input_tokens_details") or {}).get("cached_tokens") or 0)
            usage["outputTokens"] += int(job_usage.get("output_tokens") or 0)
            usage["reasoningTokens"] += int((job_usage.get("output_tokens_details") or {}).get("reasoning_tokens") or 0)
            if include_jobs:
                source = json.loads(job["source_json"])
                serialized_jobs.append({
                    "jobId": job["job_id"],
                    "listingId": job["listing_id"],
                    "listingTitle": str(source.get("title") or ""),
                    "language": job["language"],
                    "state": job["state"],
                    "attempts": job["attempts"],
                    "output": json.loads(job["output_json"] or "{}"),
                    "rawOutput": str(job["raw_output"] or ""),
                    "usage": job_usage,
                    "qualityWarnings": json.loads(job["quality_warnings_json"] or "[]"),
                    "error": job["error"],
                    "updatedAt": job["updated_at"],
                    "startedAt": job["started_at"] or "",
                    "completedAt": job["completed_at"] or "",
                })
        return {
            "ok": True,
            "runId": run["run_id"],
            "shopKey": run["shop_key"],
            "state": run["state"],
            "previewOnly": bool(run["preview_only"]),
            "testMode": bool(run["test_mode"]),
            "model": run["model"],
            "reasoningEffort": run["reasoning_effort"],
            "promptVersion": run["prompt_version"],
            "createdAt": run["created_at"],
            "updatedAt": run["updated_at"],
            "startedAt": run["started_at"] or "",
            "completedAt": run["completed_at"] or "",
            "error": run["error"],
            "counts": state_counts,
            "totalJobs": sum(state_counts.values()),
            "usage": usage,
            "jobs": serialized_jobs,
        }

    def action(self, run_id: str, action: str) -> dict:
        action = str(action or "").strip().lower()
        now = utc_iso()
        with self._db_lock, self._connect() as connection:
            run = connection.execute("SELECT * FROM localization_runs WHERE run_id=?", (run_id,)).fetchone()
            if not run:
                raise ValueError("Lot de localisation introuvable")
            if action in {"start", "resume"}:
                connection.execute(
                    "UPDATE localization_runs SET state='running', started_at=COALESCE(started_at, ?), updated_at=?, error='' WHERE run_id=?",
                    (now, now, run_id),
                )
                connection.execute(
                    "UPDATE localization_jobs SET state='pending', error='', updated_at=?, started_at=NULL, completed_at=NULL WHERE run_id=? AND state='failed'",
                    (now, run_id),
                )
            elif action == "pause":
                connection.execute("UPDATE localization_runs SET state='paused', updated_at=? WHERE run_id=?", (now, run_id))
            elif action == "cancel":
                connection.execute("UPDATE localization_runs SET state='cancelled', updated_at=? WHERE run_id=?", (now, run_id))
                connection.execute(
                    "UPDATE localization_jobs SET state='cancelled', updated_at=? WHERE run_id=? AND state IN ('pending','failed')",
                    (now, run_id),
                )
            elif action == "approve_publish":
                if bool(run["test_mode"]):
                    raise ValueError("Un lot test est strictement non publiable")
                connection.execute(
                    "UPDATE localization_jobs SET state='publish_pending', updated_at=? WHERE run_id=? AND state='preview_ready'",
                    (now, run_id),
                )
                connection.execute("UPDATE localization_runs SET state='running', updated_at=? WHERE run_id=?", (now, run_id))
            elif action == "retry":
                connection.execute(
                    "UPDATE localization_jobs SET state='pending', error='', updated_at=?, started_at=NULL, completed_at=NULL WHERE run_id=? AND state='failed'",
                    (now, run_id),
                )
                connection.execute("UPDATE localization_runs SET state='running', updated_at=?, error='' WHERE run_id=?", (now, run_id))
            else:
                raise ValueError(f"Action backfill inconnue : {action}")
        self._wake.set()
        return self.get_run(run_id)

    def export_run(self, run_id: str) -> dict:
        with self._db_lock, self._connect() as connection:
            run = connection.execute(
                "SELECT * FROM localization_runs WHERE run_id=?",
                (run_id,),
            ).fetchone()
            if not run:
                raise ValueError("Lot de localisation introuvable")
            jobs = connection.execute(
                "SELECT * FROM localization_jobs WHERE run_id=? ORDER BY listing_id, language",
                (run_id,),
            ).fetchall()

        listings = {}
        completed = 0
        failed = 0
        languages = set()
        for job in jobs:
            source = json.loads(job["source_json"] or "{}")
            output = json.loads(job["output_json"] or "{}")
            listing_id = str(job["listing_id"])
            item = listings.setdefault(listing_id, {
                "listingId": listing_id,
                "sectionName": str(source.get("sectionName") or ""),
                "source": {
                    "language": "fr",
                    "title": str(source.get("title") or ""),
                    "tags": [str(tag or "") for tag in (source.get("tags") or [])],
                    "description": str(source.get("description") or ""),
                },
                "translations": {},
            })
            job_state = str(job["state"])
            languages.add(str(job["language"]))
            if job_state in {"preview_ready", "published"}:
                completed += 1
            if job_state == "failed":
                failed += 1
            item["translations"][job["language"]] = {
                "state": job_state,
                "title": str(output.get("title") or ""),
                "tags": output.get("tags") or [],
                "description": str(output.get("description") or ""),
                "usage": json.loads(job["usage_json"] or "{}"),
                "qualityWarnings": json.loads(job["quality_warnings_json"] or "[]"),
                "error": str(job["error"] or ""),
            }

        run_payload = self.get_run(run_id, include_jobs=False)
        expected_translations = len(jobs)
        listing_count = len(listings)
        ordered_languages = [code for code in SUPPORTED_LANGUAGE_CODES if code in languages]
        return {
            "schemaVersion": 2,
            "exportType": "localization_backfill_run",
            "generatedAt": utc_iso(),
            "run": {
                "runId": run_payload["runId"],
                "state": run_payload["state"],
                "model": run_payload["model"],
                "reasoningEffort": run_payload["reasoningEffort"],
                "promptVersion": run_payload["promptVersion"],
                "testMode": run_payload["testMode"],
                "languages": ordered_languages,
                "counts": run_payload["counts"],
                "usage": run_payload["usage"],
            },
            "editorialResources": self.config(run_payload["shopKey"])["glossaries"],
            "summary": {
                "expectedListings": listing_count,
                "actualListings": listing_count,
                "expectedLanguages": len(ordered_languages),
                "expectedTranslations": expected_translations,
                "completedTranslations": completed,
                "failedTranslations": failed,
                "complete": completed == expected_translations and failed == 0,
            },
            "listings": list(listings.values()),
        }

    def archive_run_report(self, run_id: str) -> Path:
        """Écrire un instantané JSON durable du lot sans dépendre du navigateur."""
        report = self.export_run(run_id)
        target = (self.report_root / f"localization-run-{run_id}.json").resolve()
        if self.report_root.resolve() not in target.parents:
            raise ValueError("Chemin de rapport de localisation non autorisé")
        temporary = target.with_suffix(".json.tmp")
        temporary.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        temporary.replace(target)
        return target

    def _start_automation_run(self, entry, listing: dict) -> None:
        existing_languages = {
            str(code or "").strip().lower()
            for code in (listing.get("translations") or [])
        }
        missing_languages = [
            code for code in SUPPORTED_LANGUAGE_CODES if code not in existing_languages
        ]
        now = utc_iso()
        if not missing_languages:
            with self._db_lock, self._connect() as connection:
                connection.execute(
                    """
                    UPDATE localization_automation_entries
                    SET state='completed', existing_languages_json=?, error='',
                        updated_at=?, completed_at=?, next_check_at=NULL
                    WHERE automation_id=?
                    """,
                    (stable_json(sorted(existing_languages)), now, now, entry["automation_id"]),
                )
            return

        run_id = uuid.uuid4().hex
        prompt_version = self._prompt_version(entry["shop_key"])
        fingerprint = source_fingerprint(listing)
        selection_hash = hashlib.sha256(stable_json({
            "automationId": entry["automation_id"],
            "listingId": entry["listing_id"],
            "sourceHash": fingerprint,
            "languages": missing_languages,
            "shopKey": entry["shop_key"],
            "model": entry["model"],
            "reasoningEffort": entry["reasoning_effort"],
            "promptVersion": prompt_version,
        }).encode("utf-8")).hexdigest()
        source_json = stable_json(listing)
        with self._db_lock, self._connect() as connection:
            current = connection.execute(
                "SELECT state, run_id FROM localization_automation_entries WHERE automation_id=?",
                (entry["automation_id"],),
            ).fetchone()
            if not current or current["run_id"] or current["state"] not in AUTOMATION_WATCH_STATES:
                return
            connection.execute(
                """
                INSERT INTO localization_runs (
                    run_id, shop_key, state, preview_only, test_mode,
                    selection_hash, model, reasoning_effort, prompt_version,
                    created_at, updated_at, started_at, automation_id
                ) VALUES (?, ?, 'running', 0, 0, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id, entry["shop_key"], selection_hash, entry["model"],
                    entry["reasoning_effort"], prompt_version, now, now, now,
                    entry["automation_id"],
                ),
            )
            for language in missing_languages:
                connection.execute(
                    """
                    INSERT INTO localization_jobs (
                        job_id, run_id, listing_id, language, state, source_hash,
                        prompt_version, source_json, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
                    """,
                    (
                        uuid.uuid4().hex, run_id, entry["listing_id"], language,
                        fingerprint, prompt_version, source_json, now, now,
                    ),
                )
            connection.execute(
                """
                UPDATE localization_automation_entries
                SET state='generating', source_hash=?, source_json=?,
                    existing_languages_json=?, run_id=?, error='', updated_at=?,
                    next_check_at=NULL, completed_at=NULL
                WHERE automation_id=?
                """,
                (
                    fingerprint, source_json, stable_json(sorted(existing_languages)),
                    run_id, now, entry["automation_id"],
                ),
            )
        self._wake.set()

    def _observe_automation_entry(self, entry, listing: dict | None) -> None:
        now = utc_iso()
        next_check = utc_iso(time.time() + self.automation_poll_seconds)
        if not listing:
            with self._db_lock, self._connect() as connection:
                connection.execute(
                    """
                    UPDATE localization_automation_entries
                    SET error='Fiche Etsy introuvable pendant la surveillance',
                        last_checked_at=?, next_check_at=?, updated_at=?
                    WHERE automation_id=?
                    """,
                    (now, next_check, now, entry["automation_id"]),
                )
            return
        source_json = stable_json(listing)
        existing_languages = sorted({
            str(code or "").strip().lower()
            for code in (listing.get("translations") or [])
            if str(code or "").strip().lower() in SUPPORTED_LANGUAGE_CODES
        })
        if str(listing.get("state") or "").strip().lower() != "active":
            with self._db_lock, self._connect() as connection:
                connection.execute(
                    """
                    UPDATE localization_automation_entries
                    SET state='waiting_activation', source_json=?,
                        existing_languages_json=?, stable_since=NULL, error='',
                        last_checked_at=?, next_check_at=?, updated_at=?
                    WHERE automation_id=?
                    """,
                    (
                        source_json, stable_json(existing_languages), now,
                        next_check, now, entry["automation_id"],
                    ),
                )
            return
        if len(existing_languages) == len(SUPPORTED_LANGUAGE_CODES):
            with self._db_lock, self._connect() as connection:
                connection.execute(
                    """
                    UPDATE localization_automation_entries
                    SET state='completed', source_hash=?, source_json=?,
                        existing_languages_json=?, error='', last_checked_at=?,
                        next_check_at=NULL, updated_at=?, completed_at=?
                    WHERE automation_id=?
                    """,
                    (
                        source_fingerprint(listing), source_json,
                        stable_json(existing_languages), now, now, now,
                        entry["automation_id"],
                    ),
                )
            return
        fingerprint = source_fingerprint(listing)
        stable_since = str(entry["stable_since"] or "")
        if fingerprint != str(entry["source_hash"] or "") or not stable_since:
            with self._db_lock, self._connect() as connection:
                connection.execute(
                    """
                    UPDATE localization_automation_entries
                    SET state='stabilizing', source_hash=?, source_json=?,
                        existing_languages_json=?, stable_since=?, error='',
                        last_checked_at=?, next_check_at=?, updated_at=?
                    WHERE automation_id=?
                    """,
                    (
                        fingerprint, source_json, stable_json(existing_languages),
                        now, now, next_check, now, entry["automation_id"],
                    ),
                )
            return
        if time.time() - parse_utc_iso(stable_since) < self.automation_stability_seconds:
            with self._db_lock, self._connect() as connection:
                connection.execute(
                    """
                    UPDATE localization_automation_entries
                    SET source_json=?, existing_languages_json=?, error='',
                        last_checked_at=?, next_check_at=?, updated_at=?
                    WHERE automation_id=?
                    """,
                    (
                        source_json, stable_json(existing_languages), now,
                        next_check, now, entry["automation_id"],
                    ),
                )
            return
        self._start_automation_run(entry, listing)

    def _verify_automation_entry(self, entry, listing: dict | None) -> None:
        now = utc_iso()
        next_check = utc_iso(time.time() + self.automation_poll_seconds)
        if not listing:
            with self._db_lock, self._connect() as connection:
                connection.execute(
                    """
                    UPDATE localization_automation_entries
                    SET error='Vérification Etsy impossible avant publication',
                        next_check_at=?, last_checked_at=?, updated_at=?
                    WHERE automation_id=?
                    """,
                    (next_check, now, now, entry["automation_id"]),
                )
            return
        current_hash = source_fingerprint(listing)
        is_active = str(listing.get("state") or "").strip().lower() == "active"
        if not is_active or current_hash != str(entry["source_hash"] or ""):
            with self._db_lock, self._connect() as connection:
                connection.execute(
                    """
                    UPDATE localization_jobs
                    SET state='cancelled', updated_at=?, completed_at=?
                    WHERE run_id=? AND state IN ('preview_ready','failed')
                    """,
                    (now, now, entry["run_id"]),
                )
                connection.execute(
                    "UPDATE localization_runs SET state='cancelled', completed_at=?, updated_at=? WHERE run_id=?",
                    (now, now, entry["run_id"]),
                )
                connection.execute(
                    """
                    UPDATE localization_automation_entries
                    SET state=?, source_hash=?, source_json=?, stable_since=?,
                        run_id=NULL, error='', last_checked_at=?, next_check_at=?,
                        updated_at=?, completed_at=NULL
                    WHERE automation_id=?
                    """,
                    (
                        "stabilizing" if is_active else "waiting_activation",
                        current_hash, stable_json(listing), now if is_active else None,
                        now, next_check, now, entry["automation_id"],
                    ),
                )
            return
        with self._db_lock, self._connect() as connection:
            connection.execute(
                """
                UPDATE localization_jobs
                SET state='publish_pending', updated_at=?
                WHERE run_id=? AND state='preview_ready'
                """,
                (now, entry["run_id"]),
            )
            publish_count = connection.execute(
                "SELECT COUNT(*) FROM localization_jobs WHERE run_id=? AND state='publish_pending'",
                (entry["run_id"],),
            ).fetchone()[0]
            if publish_count:
                connection.execute(
                    """
                    UPDATE localization_automation_entries
                    SET state='publishing', error='', last_checked_at=?,
                        next_check_at=NULL, updated_at=?
                    WHERE automation_id=?
                    """,
                    (now, now, entry["automation_id"]),
                )
            else:
                connection.execute(
                    "UPDATE localization_runs SET state='failed', completed_at=?, updated_at=? WHERE run_id=?",
                    (now, now, entry["run_id"]),
                )
                connection.execute(
                    """
                    UPDATE localization_automation_entries
                    SET state='attention', error='Toutes les localisations ont échoué avant publication',
                        completed_at=?, updated_at=? WHERE automation_id=?
                    """,
                    (now, now, entry["automation_id"]),
                )
        self._wake.set()

    def _poll_automation_queue(self, *, force: bool = False) -> None:
        if not self.listing_loader:
            return
        monotonic_now = time.monotonic()
        if not force and monotonic_now < self._next_automation_poll_at:
            return
        self._next_automation_poll_at = monotonic_now + self.automation_poll_seconds
        now = utc_iso()
        with self._db_lock, self._connect() as connection:
            watched = connection.execute(
                """
                SELECT * FROM localization_automation_entries
                WHERE state IN ('waiting_activation','stabilizing')
                  AND (next_check_at IS NULL OR next_check_at<=?)
                """,
                (now,),
            ).fetchall()
            ready_to_verify = connection.execute(
                """
                SELECT entries.*
                FROM localization_automation_entries AS entries
                WHERE entries.state='generating'
                  AND (entries.next_check_at IS NULL OR entries.next_check_at<=?)
                  AND entries.run_id IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM localization_jobs AS jobs
                      WHERE jobs.run_id=entries.run_id AND jobs.state IN ('pending','generating')
                  )
                """,
                (now,),
            ).fetchall()
        candidates = list(watched) + list(ready_to_verify)
        grouped: dict[str, list] = {}
        for entry in candidates:
            grouped.setdefault(str(entry["shop_key"]), []).append(entry)
        for shop_key, entries in grouped.items():
            listing_ids = list(dict.fromkeys(str(entry["listing_id"]) for entry in entries))
            try:
                payload = self.listing_loader(shop_key, listing_ids)
                listing_by_id = {
                    str(listing.get("listingId") or ""): listing
                    for listing in (payload.get("listings") or [])
                    if isinstance(listing, dict)
                }
            except Exception as error:
                retry_at = utc_iso(time.time() + self.automation_poll_seconds)
                with self._db_lock, self._connect() as connection:
                    for entry in entries:
                        connection.execute(
                            """
                            UPDATE localization_automation_entries
                            SET error=?, last_checked_at=?, next_check_at=?, updated_at=?
                            WHERE automation_id=?
                            """,
                            (str(error), now, retry_at, now, entry["automation_id"]),
                        )
                continue
            verification_ids = {entry["automation_id"] for entry in ready_to_verify}
            for entry in entries:
                listing = listing_by_id.get(str(entry["listing_id"]))
                if entry["automation_id"] in verification_ids:
                    self._verify_automation_entry(entry, listing)
                else:
                    self._observe_automation_entry(entry, listing)

    def _sync_automation_entries(self) -> None:
        now = utc_iso()
        with self._db_lock, self._connect() as connection:
            entries = connection.execute(
                """
                SELECT entries.automation_id, entries.run_id, runs.state AS run_state
                FROM localization_automation_entries AS entries
                JOIN localization_runs AS runs ON runs.run_id=entries.run_id
                WHERE entries.state IN ('generating','publishing')
                  AND runs.state IN ('completed','failed','cancelled')
                """
            ).fetchall()
            for entry in entries:
                if entry["run_state"] == "completed":
                    state = "completed"
                    error = ""
                elif entry["run_state"] == "failed":
                    state = "attention"
                    error = "Une ou plusieurs langues nécessitent une intervention"
                else:
                    state = "attention"
                    error = "Traitement automatique annulé"
                connection.execute(
                    """
                    UPDATE localization_automation_entries
                    SET state=?, error=?, completed_at=?, updated_at=?
                    WHERE automation_id=?
                    """,
                    (state, error, now, now, entry["automation_id"]),
                )

    def _next_job(self):
        with self._db_lock, self._connect() as connection:
            row = connection.execute(
                """
                SELECT jobs.*, runs.shop_key, runs.model, runs.reasoning_effort,
                       runs.automation_id
                FROM localization_jobs AS jobs
                JOIN localization_runs AS runs ON runs.run_id = jobs.run_id
                WHERE runs.state='running' AND jobs.state IN ('pending','publish_pending')
                ORDER BY jobs.created_at, jobs.language
                LIMIT 1
                """
            ).fetchone()
            if not row:
                return None
            next_state = "generating" if row["state"] == "pending" else "publishing"
            connection.execute(
                "UPDATE localization_jobs SET state=?, attempts=attempts+1, updated_at=?, started_at=?, completed_at=NULL WHERE job_id=?",
                (next_state, utc_iso(), utc_iso(), row["job_id"]),
            )
            return dict(row) | {"work_state": next_state}

    def _complete_runs(self):
        now = utc_iso()
        completed_run_ids = []
        with self._db_lock, self._connect() as connection:
            running = connection.execute(
                "SELECT run_id, automation_id FROM localization_runs WHERE state='running'"
            ).fetchall()
            for row in running:
                if row["automation_id"]:
                    automation = connection.execute(
                        "SELECT state FROM localization_automation_entries WHERE automation_id=?",
                        (row["automation_id"],),
                    ).fetchone()
                    if automation and automation["state"] == "generating":
                        # Les aperçus automatiques doivent être revérifiés contre
                        # la source Etsy avant de devenir publiables.
                        continue
                pending = connection.execute(
                    "SELECT COUNT(*) FROM localization_jobs WHERE run_id=? AND state IN ('pending','generating','publish_pending','publishing')",
                    (row["run_id"],),
                ).fetchone()[0]
                if pending:
                    continue
                failed = connection.execute(
                    "SELECT COUNT(*) FROM localization_jobs WHERE run_id=? AND state='failed'",
                    (row["run_id"],),
                ).fetchone()[0]
                state = "failed" if failed else "completed"
                connection.execute(
                    "UPDATE localization_runs SET state=?, completed_at=?, updated_at=? WHERE run_id=?",
                    (state, now, now, row["run_id"]),
                )
                completed_run_ids.append(row["run_id"])
        for run_id in completed_run_ids:
            try:
                self.archive_run_report(run_id)
            except Exception:
                # Le rapport reste reconstructible depuis SQLite ; son écriture ne
                # doit jamais bloquer la file de génération ou de publication.
                pass

    def _generate_job(self, job: dict):
        listing = json.loads(job["source_json"])
        prompt = self._load_prompt(job["language"], listing, job["shop_key"])
        payload = {
            "model": job["model"],
            "input": [{"role": "user", "content": [{"type": "input_text", "text": prompt}]}],
            "reasoning": {"effort": job["reasoning_effort"]},
            "text": {"verbosity": "low"},
            "max_output_tokens": 12000,
            "store": False,
        }
        status, response = self.openai_request(payload)
        if status < 200 or status >= 300:
            message = ((response.get("error") or {}).get("message") if isinstance(response, dict) else "") or f"OpenAI HTTP {status}"
            raise RuntimeError(str(message))
        raw_output = extract_response_text(response)
        usage = stable_json(response.get("usage") or {})
        try:
            output = parse_localized_listing(
                raw_output,
                job["language"],
                max_tags=20 if job["shop_key"] == "doublex" else 13,
            )
            if job["shop_key"] == "doublex":
                output = apply_doublex_tag_policy(listing, output)
        except ValueError:
            with self._db_lock, self._connect() as connection:
                connection.execute(
                    "UPDATE localization_jobs SET raw_output=?, usage_json=?, updated_at=? WHERE job_id=?",
                    (raw_output, usage, utc_iso(), job["job_id"]),
                )
            raise
        quality_warnings = localization_quality_warnings(
            listing, output, job["language"], job["shop_key"]
        )
        blocking_warnings = blocking_quality_warnings(quality_warnings)
        now = utc_iso()
        if blocking_warnings:
            warning_codes = ", ".join(str(warning.get("code") or "") for warning in blocking_warnings)
            with self._db_lock, self._connect() as connection:
                connection.execute(
                    """
                    UPDATE localization_jobs
                    SET output_json=?, raw_output=?, usage_json=?, quality_warnings_json=?, updated_at=?, completed_at=?
                    WHERE job_id=?
                    """,
                    (
                        stable_json(output), raw_output, usage,
                        stable_json(quality_warnings), now, now, job["job_id"],
                    ),
                )
            raise ValueError(f"Contrôle qualité bloquant : {warning_codes}")
        with self._db_lock, self._connect() as connection:
            connection.execute(
                """
                UPDATE localization_jobs
                SET state='preview_ready', output_json=?, raw_output=?, usage_json=?, quality_warnings_json=?, error='', updated_at=?, completed_at=?
                WHERE job_id=?
                """,
                (
                    stable_json(output), raw_output, usage,
                    stable_json(quality_warnings), now, now, job["job_id"],
                ),
            )

    def _publish_job(self, job: dict):
        output = json.loads(job["output_json"] or "{}")
        if not output:
            raise ValueError("Aperçu de localisation absent")
        source = json.loads(job["source_json"] or "{}")
        if job["shop_key"] == "doublex":
            output = apply_doublex_tag_policy(source, output)
            with self._db_lock, self._connect() as connection:
                connection.execute(
                    "UPDATE localization_jobs SET output_json=?, updated_at=? WHERE job_id=?",
                    (stable_json(output), utc_iso(), job["job_id"]),
                )
        quality_warnings = localization_quality_warnings(
            source, output, job["language"], job["shop_key"]
        )
        blocking_warnings = blocking_quality_warnings(quality_warnings)
        if blocking_warnings:
            with self._db_lock, self._connect() as connection:
                connection.execute(
                    "UPDATE localization_jobs SET quality_warnings_json=?, updated_at=? WHERE job_id=?",
                    (stable_json(quality_warnings), utc_iso(), job["job_id"]),
                )
            warning_codes = ", ".join(str(warning.get("code") or "") for warning in blocking_warnings)
            raise ValueError(f"Publication bloquée par le contrôle qualité : {warning_codes}")
        self.translation_publisher(job["shop_key"], job["listing_id"], job["language"], output)
        now = utc_iso()
        with self._db_lock, self._connect() as connection:
            connection.execute(
                "UPDATE localization_jobs SET state='published', error='', updated_at=?, completed_at=? WHERE job_id=?",
                (now, now, job["job_id"]),
            )

    def _fail_job(self, job: dict, error: Exception):
        with self._db_lock, self._connect() as connection:
            connection.execute(
                "UPDATE localization_jobs SET state='failed', error=?, updated_at=?, completed_at=? WHERE job_id=?",
                (str(error), utc_iso(), utc_iso(), job["job_id"]),
            )

    def _worker_loop(self):
        while not self._stop.is_set():
            try:
                self._poll_automation_queue()
            except Exception:
                # Une défaillance de surveillance ne doit jamais tuer le worker
                # de backfill ; les erreurs externes ciblées sont stockées sur
                # chaque entrée par ``_poll_automation_queue``.
                pass
            job = self._next_job()
            if not job:
                self._complete_runs()
                self._sync_automation_entries()
                self._wake.wait(timeout=2)
                self._wake.clear()
                continue
            try:
                if job["work_state"] == "generating":
                    self._generate_job(job)
                else:
                    self._publish_job(job)
            except Exception as error:
                self._fail_job(job, error)
            finally:
                if job.get("automation_id") and job["work_state"] == "generating":
                    self._next_automation_poll_at = 0.0
                    try:
                        self._poll_automation_queue(force=True)
                    except Exception:
                        pass
                self._complete_runs()
                self._sync_automation_entries()
