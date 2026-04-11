#!/usr/bin/env python3
from pathlib import Path
import shutil
import sys

ROOT = Path.cwd()

UI_JS = ROOT / "src" / "js" / "pipeline-ui.js"
HTML = ROOT / "src" / "etsy-pipeline-dnd-v1_2.html"
MODULE_JS = ROOT / "src" / "js" / "ui" / "prompt_biblio_ui.js"

MODULE_CONTENT = r"""'use strict';

(function initPipelineUIPromptBiblio(global) {
  global.PipelineUI = global.PipelineUI || {};

  const getState = () => global.state;
  const getCurrentMode = () => global.currentMode || 'tabletop';

  function getBiblio(key) {
    const state = getState();
    return state?.bibliosByMode?.[getCurrentMode()]?.[key] || '';
  }

  const CACHE_FIXED = {
    marche:      () => `CONTEXTE GLOBAL:\n${getBiblio('objectif')}\n\nPSYCHOLOGIE CLIENT:\n${getBiblio('psycho')}`,
    titre:       () => `BIBLIOTHÈQUE TITRES:\n${getBiblio('titres')}`,
    description: () => `CONTEXTE GLOBAL:\n${getBiblio('objectif')}\n\nPSYCHOLOGIE CLIENT:\n${getBiblio('psycho')}`,
  };

  function parseBiblioTags(raw) {
    const validated = [];
    const blacklisted = [];
    let section = null;

    for (const line of String(raw || '').split('\n')) {
      const t = line.trim();
      if (t === '## VALIDÉS') { section = 'v'; continue; }
      if (t === '## BLACKLISTÉS') { section = 'b'; continue; }
      if (section === 'v' && t.startsWith('+ ')) validated.push(t.slice(2));
      if (section === 'b' && t.startsWith('- ')) blacklisted.push(t.slice(2));
    }

    return { validated, blacklisted };
  }

  function buildBiblioTagsRaw(validated, blacklisted) {
    return `## VALIDÉS\n${validated.map((t) => `+ ${t}`).join('\n')}\n\n## BLACKLISTÉS\n${blacklisted.map((t) => `- ${t}`).join('\n')}\n`;
  }

  function parseBiblioTitres(raw) {
    const validated = [];
    const blacklisted = [];
    let section = null;

    for (const line of String(raw || '').split('\n')) {
      const t = line.trim();
      if (t === '## VALIDÉS') { section = 'v'; continue; }
      if (t === '## BLACKLISTÉS') { section = 'b'; continue; }
      if (section === 'v' && t.startsWith('+ ')) validated.push(t.slice(2));
      if (section === 'b' && t.startsWith('- ')) blacklisted.push(t.slice(2));
    }

    return { validated, blacklisted };
  }

  function buildBiblioTitresRaw(validated, blacklisted) {
    return `## VALIDÉS\n${validated.map((t) => `+ ${t}`).join('\n')}\n\n## BLACKLISTÉS\n${blacklisted.map((t) => `- ${t}`).join('\n')}\n`;
  }

  function getBiblioTagsFormatted() {
    const { validated, blacklisted } = parseBiblioTags(getBiblio('tags'));
    if (!validated.length && !blacklisted.length) return '';

    const parts = [];
    if (validated.length) {
      parts.push(`Tags validés (exemples de qualité à imiter) :\n${validated.map((t) => `+ ${t}`).join('\n')}`);
    }
    if (blacklisted.length) {
      parts.push(`Termes blacklistés (interdits sans exception) :\n${blacklisted.map((t) => `- ${t}`).join('\n')}`);
    }
    return parts.join('\n\n');
  }

  function buildPrompt(agentId, ctx) {
    const state = getState();
    const currentMode = getCurrentMode();
    const template = state?.promptsByMode?.[currentMode]?.[agentId] || '';
    const filled = template
      .replace(/\[\[NOM_COURT\]\]/g, ctx.nomCourt || ctx.nom)
      .replace(/\[\[NOM\]\]/g, ctx.nom)
      .replace(/\[\[UNIVERS\]\]/g, ctx.univers)
      .replace(/\[\[SCULPTEUR\]\]/g, ctx.sculpteur)
      .replace(/\[\[ECHELLES\]\]/g, ctx.echelles)
      .replace(/\[\[PIECES\]\]/g, ctx.pieces)
      .replace(/\[\[DIMENSIONS\]\]/g, ctx.dimensions || '')
      .replace(/\[\[POSE\]\]/g, ctx.pose)
      .replace(/\[\[VERSION\]\]/g, ctx.version || '')
      .replace(/\[\[TYPE\]\]/g, ctx.type || '')
      .replace(/\[\[BUZZ\]\]/g, ctx.buzz ? `OUI${ctx.buzzNote ? ' — ' + ctx.buzzNote : ''}` : 'NON')
      .replace(/\[\[ANALYSE\]\]/g, ctx.outputs.analyse || '')
      .replace(/\[\[MARCHE\]\]/g, ctx.outputs.marche || '')
      .replace(/\[\[TAGS\]\]/g, ctx.outputs.tags || '')
      .replace(/\[\[TITRE_VALIDE\]\]/g, ctx.outputs.titre_valide || '')
      .replace(/\[\[DESCRIPTION\]\]/g, ctx.outputs.description_assembled || ctx.outputs.description || '')
      .replace(/\[\[ARCHETYPES\]\]/g, ctx.archetypes || '')
      .replace(/\[\[OBJECTIF\]\]/g, getBiblio('objectif'))
      .replace(/\[\[PSYCHO\]\]/g, getBiblio('psycho'))
      .replace(/\[\[BIBLIO_SEMANTIQUE\]\]/g, getBiblio('bibliotheque-semantique'))
      .replace(/\[\[BIBLIO_TITRES\]\]/g, getBiblio('titres'))
      .replace(/\[\[BIBLIO_TAGS\]\]/g, getBiblioTagsFormatted() || '_(aucun retour enregistré)_')
      .replace(/\[\[MEDIUM\]\]/g, ctx.medium || '')
      .replace(/\[\[LICENSE\]\]/g, ctx.license || 'non')
      .replace(/\[\[PARTICULARITES\]\]/g, ctx.particularites || '')
      .replace(/\[\[CONTEXTE_PERSO\]\]/g, ctx.contextePerso || '')
      .replace(/\[\[LIEN_PERSO\]\]/g, ctx.lienPerso || '')
      .replace(/\[\[BUZZ_COLLECTION\]\]/g, ctx.buzzCollection ? `OUI${ctx.buzzCollectionNote ? ' — ' + ctx.buzzCollectionNote : ''}` : 'NON')
      .replace(/\[\[ACCROCHE\]\]/g, ctx.selectedAccrocheText || '')
      .replace(/\[\[CTA\]\]/g, ctx.selectedCTAText || '')
      .replace(/\[\[NOTES\]\]/g, ctx.notes || '')
      .replace(/\[\[DESC_P1\]\]/g, ctx.desc_p1 || '')
      .replace(/\[\[URL\]\]/g, ctx.url_boutique || '')
      .replace(/\[\[PROFIL_DOMINANT\]\]/g, ctx.profil_dominant || 'hobbyiste')
      .replace(/\[\[SOCIAL_FORMATS\]\]/g, ctx.social_formats || '')
      .replace(/\[\[AGENT_ID\]\]/g, ctx.agent_id || agentId)
      .replace(/\[\[TENTATIVE\]\]/g, String(ctx.tentative || 1))
      .replace(/\[\[OUTPUT\]\]/g, (ctx.output_to_validate || '').substring(0, 3000))
      + (ctx.rules ? `\nRègles permanentes:\n${ctx.rules}` : '')
      + (ctx.correction ? `\nInstruction ponctuelle: ${ctx.correction}` : '');

    const fixedContent = CACHE_FIXED[agentId] ? CACHE_FIXED[agentId]() : null;
    return { filled, fixedContent };
  }

  global.PipelineUIPromptBiblio = {
    getBiblio,
    parseBiblioTags,
    buildBiblioTagsRaw,
    parseBiblioTitres,
    buildBiblioTitresRaw,
    getBiblioTagsFormatted,
    buildPrompt,
  };

  global.PipelineUI.promptBiblio = global.PipelineUI.promptBiblio || {};
  Object.assign(global.PipelineUI.promptBiblio, global.PipelineUIPromptBiblio);
})(window);
"""

ALIAS_BLOCK = """const {
  getBiblio,
  parseBiblioTags,
  buildBiblioTagsRaw,
  parseBiblioTitres,
  buildBiblioTitresRaw,
  getBiblioTagsFormatted,
  buildPrompt,
} = window.PipelineUIPromptBiblio;

"""

PROMPT_REPLACEMENT = """// ═══════════════════════════════════════════════════════════
// PROMPT BUILDER
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/prompt_biblio_ui.js

"""

BIBLIO_REPLACEMENT = """// ═══════════════════════════════════════════════════════════
// BIBLIOTHÈQUES
// ═══════════════════════════════════════════════════════════
// Extracted to src/js/ui/prompt_biblio_ui.js

"""


def backup(path: Path, suffix: str) -> None:
    backup_path = path.with_name(path.name + suffix)
    if not backup_path.exists():
        shutil.copy2(path, backup_path)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Bloc introuvable pour {label}")
    return text.replace(old, new, 1)


def patch_pipeline_ui(text: str) -> str:
    if "window.PipelineUIPromptBiblio" not in text:
        anchor = "} = window.PipelineUIBatch;\n\n"
        text = replace_once(
            text,
            anchor,
            anchor + ALIAS_BLOCK,
            "injection alias prompt_biblio_ui",
        )

    cache_start = text.find("const CACHE_FIXED = {")
    run_tags_start = text.find("async function runTagsThreeAgents")
    if cache_start == -1 or run_tags_start == -1 or run_tags_start <= cache_start:
        raise RuntimeError("Impossible de localiser le bloc PROMPT BUILDER dans src/js/pipeline-ui.js")
    text = text[:cache_start] + PROMPT_REPLACEMENT + text[run_tags_start:]

    biblio_start = text.find("// ═══════════════════════════════════════════════════════════\n// BIBLIOTHÈQUES\n// ═══════════════════════════════════════════════════════════\n")
    prompt_lightbox = text.find("// ═══════════════════════════════════════════════════════════\n// PROMPT LIGHTBOX\n// ═══════════════════════════════════════════════════════════\n")
    if biblio_start == -1 or prompt_lightbox == -1 or prompt_lightbox <= biblio_start:
        raise RuntimeError("Impossible de localiser le bloc BIBLIOTHÈQUES dans src/js/pipeline-ui.js")
    text = text[:biblio_start] + BIBLIO_REPLACEMENT + text[prompt_lightbox:]

    return text


def patch_html(text: str) -> str:
    script_tag = '<script src="js/ui/prompt_biblio_ui.js"></script>\n'
    if script_tag in text:
        return text

    anchor = '<script src="js/pipeline-ui.js"></script>\n'
    if anchor not in text:
        raise RuntimeError("Ancre pipeline-ui.js introuvable dans le HTML")

    return text.replace(anchor, script_tag + anchor, 1)


def main() -> None:
    if not UI_JS.exists():
        raise SystemExit(f"Fichier introuvable: {UI_JS}")
    if not HTML.exists():
        raise SystemExit(f"Fichier introuvable: {HTML}")

    ui_text = UI_JS.read_text(encoding="utf-8")
    html_text = HTML.read_text(encoding="utf-8")

    backup(UI_JS, ".bak_extract_prompt_biblio_ui")
    backup(HTML, ".bak_extract_prompt_biblio_ui")

    MODULE_JS.parent.mkdir(parents=True, exist_ok=True)
    if MODULE_JS.exists():
        backup(MODULE_JS, ".bak_extract_prompt_biblio_ui")
    MODULE_JS.write_text(MODULE_CONTENT, encoding="utf-8")

    UI_JS.write_text(patch_pipeline_ui(ui_text), encoding="utf-8")
    HTML.write_text(patch_html(html_text), encoding="utf-8")

    print("OK: extraction prompt + biblios vers src/js/ui/prompt_biblio_ui.js")
    print("Backups créés avec suffixe .bak_extract_prompt_biblio_ui")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERREUR: {exc}", file=sys.stderr)
        sys.exit(1)
