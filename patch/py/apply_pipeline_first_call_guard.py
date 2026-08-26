#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations
import sys
from pathlib import Path
from datetime import datetime

MARKER = "/* === GGI PIPELINE FIRST CALL GUARD v1 === */"

JS_BLOCK = '''
/* === GGI PIPELINE FIRST CALL GUARD v1 === */
(() => {
  if (window.__GGI_PIPELINE_FIRST_CALL_GUARD__) return;
  window.__GGI_PIPELINE_FIRST_CALL_GUARD__ = true;

  const API_TIMEOUT_MS = 120000;

  const __origCallClaude = window.callClaude || callClaude;
  const __origStartPipeline = window.startPipeline || startPipeline;

  function __ggiModeLabel() {
    try {
      return currentMode === 'tabletop' ? 'Tabletop DnD' : 'Collection';
    } catch {
      return 'Pipeline';
    }
  }

  function __ggiResetPipelineUi(p, toastMsg) {
    try {
      const btn = document.getElementById(`runBtn-${p}`);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '▶ Relancer tout';
      }

      document.getElementById('btnStopGlobal')?.classList.remove('visible');
      document.getElementById('btnNewFiche')?.classList.add('visible');

      const ctx = document.getElementById('headerContext');
      if (ctx) {
        ctx.className = `app-context ${currentMode === 'tabletop' ? 'mode-tt' : 'mode-col'}`;
        ctx.textContent = __ggiModeLabel();
      }

      if (toastMsg && typeof showToast === 'function') {
        showToast(toastMsg, '#ff4757', 10000);
      }
    } catch (e) {
      console.warn('[GGI guard] reset UI failed:', e);
    }
  }

  function __ggiAbortAgent(agentId) {
    try {
      if (typeof abortControllers !== 'undefined' && abortControllers && abortControllers[agentId]) {
        abortControllers[agentId].abort();
        delete abortControllers[agentId];
      }
    } catch (e) {
      console.warn('[GGI guard] abort failed:', e);
    }
  }

  window.callClaude = callClaude = async function(agentId, promptData, useImages, retries = 3) {
    let timer = null;
    let settled = false;

    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        if (settled) return;
        __ggiAbortAgent(agentId);
        reject(new Error(`Timeout API (${Math.round(API_TIMEOUT_MS / 1000)}s) sur ${agentId}`));
      }, API_TIMEOUT_MS);
    });

    try {
      const result = await Promise.race([
        __origCallClaude(agentId, promptData, useImages, retries),
        timeoutPromise
      ]);
      settled = true;
      return result;
    } finally {
      settled = true;
      if (timer) clearTimeout(timer);
    }
  };

  window.startPipeline = startPipeline = async function(p) {
    window.__GGI_ACTIVE_PIPELINE__ = p;
    try {
      return await __origStartPipeline(p);
    } catch (err) {
      __ggiResetPipelineUi(p, `Pipeline interrompu : ${err?.message || err}`);
      throw err;
    } finally {
      setTimeout(() => {
        try {
          const btn = document.getElementById(`runBtn-${p}`);
          const stopVisible = document.getElementById('btnStopGlobal')?.classList.contains('visible');
          if (btn && btn.disabled && !stopVisible) {
            btn.disabled = false;
            btn.innerHTML = '▶ Relancer tout';
          }
        } catch {}
        if (window.__GGI_ACTIVE_PIPELINE__ === p) {
          window.__GGI_ACTIVE_PIPELINE__ = null;
        }
      }, 0);
    }
  };

  window.addEventListener('unhandledrejection', (event) => {
    const p = window.__GGI_ACTIVE_PIPELINE__ || (typeof pfx === 'function' ? pfx() : null);
    if (p) {
      __ggiResetPipelineUi(p, `Erreur JS non gérée : ${event.reason?.message || event.reason || 'promise rejetée'}`);
    }
  });

  window.addEventListener('error', (event) => {
    const p = window.__GGI_ACTIVE_PIPELINE__ || (typeof pfx === 'function' ? pfx() : null);
    if (p) {
      __ggiResetPipelineUi(p, `Erreur JS : ${event.message || 'exception inconnue'}`);
    }
  });

  window.__GGI_PANIC_RESET_PIPELINE__ = function() {
    const p = window.__GGI_ACTIVE_PIPELINE__ || (typeof pfx === 'function' ? pfx() : 'tt');
    __ggiResetPipelineUi(p);
  };

  console.info('[GGI guard] first-call guard active');
})();
'''

def main():
    repo = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()
    target = repo / "src" / "pipeline-api.js"

    if not target.exists():
        print(f"Fichier introuvable: {target}")
        sys.exit(1)

    text = target.read_text(encoding="utf-8")
    if MARKER in text:
        print("Patch déjà présent, rien à faire.")
        return

    backup = target.with_suffix(target.suffix + "." + datetime.now().strftime("%Y%m%d_%H%M%S") + ".bak")
    backup.write_text(text, encoding="utf-8")

    target.write_text(text.rstrip() + "\n\n" + JS_BLOCK.strip() + "\n", encoding="utf-8")

    print("Patch appliqué.")
    print(f"Backup: {backup}")
    print(f"Modifié: {target}")
    print("Vérifie ensuite avec: git diff -- src/pipeline-api.js")

if __name__ == "__main__":
    main()
