from __future__ import annotations
import sys, re, hashlib, shutil
from pathlib import Path
from datetime import datetime

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
JS = ROOT / 'src' / 'pipeline-ui.js'
CSS = ROOT / 'src' / 'pipeline.css'
HTML = ROOT / 'src' / 'etsy-pipeline-dnd-v1_2.html'

for p in (JS, CSS, HTML):
    if not p.exists():
        raise SystemExit(f"Fichier introuvable: {p}")

stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
backup_dir = ROOT / '.patch_backups' / f'image_freeze_fix_{stamp}'
backup_dir.mkdir(parents=True, exist_ok=True)
for p in (JS, CSS, HTML):
    shutil.copy2(p, backup_dir / p.name)


def sha1(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()

before = {str(p): sha1(p) for p in (JS, CSS, HTML)}

html = HTML.read_text(encoding='utf-8')
html = html.replace(
    '<div class="drop-zone" id="dropZone-tt" onclick="document.getElementById(\'imgInput-tt\').click()">',
    '<div class="drop-zone" id="dropZone-tt">'
)
html = html.replace(
    '<div class="drop-zone" id="dropZone-col" onclick="document.getElementById(\'imgInput-col\').click()">',
    '<div class="drop-zone" id="dropZone-col">'
)
HTML.write_text(html, encoding='utf-8')

js = JS.read_text(encoding='utf-8')
setup_pat = re.compile(r'''function setupImageHandlers\(p\) \{.*?\n\}
async function processImages\(files, p\) \{.*?\n\}
function renderThumbs\(p\) \{.*?\n\}''', re.S)
setup_repl = '''function setupImageHandlers(p) {
  const dz = document.getElementById(`dropZone-${p}`);
  const inp = document.getElementById(`imgInput-${p}`);
  if (!dz || !inp || dz.dataset.bound === '1') return;

  dz.dataset.bound = '1';
  dz.dataset.busy = dz.dataset.busy || '0';

  const clearDrag = () => dz.classList.remove('dragover');

  dz.addEventListener('click', e => {
    const t = e.target;
    if (!t) return;
    if (dz.dataset.busy === '1') return;
    if (t.closest('.img-remove-btn')) return;
    if (t.closest('.thumb-strip')) return;
    inp.click();
  });

  dz.addEventListener('dragover', e => {
    e.preventDefault();
    if (dz.dataset.busy === '1') return;
    dz.classList.add('dragover');
  });

  dz.addEventListener('dragleave', e => {
    if (!dz.contains(e.relatedTarget)) clearDrag();
  });

  dz.addEventListener('drop', async e => {
    e.preventDefault();
    clearDrag();
    if (dz.dataset.busy === '1') return;
    const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type?.startsWith('image/'));
    await processImages(files, p);
  });

  inp.addEventListener('change', async e => {
    const files = Array.from(e.target.files || []).filter(f => f.type?.startsWith('image/'));
    await processImages(files, p);
    inp.value = '';
  });

  if (!window.__ggiDropCleanupBound) {
    window.__ggiDropCleanupBound = true;
    ['dragend', 'drop', 'blur'].forEach(evt => {
      window.addEventListener(evt, () => {
        document.querySelectorAll('.drop-zone.dragover').forEach(el => el.classList.remove('dragover'));
      });
    });
  }
}

async function processImages(files, p) {
  const dz = document.getElementById(`dropZone-${p}`);
  const inp = document.getElementById(`imgInput-${p}`);
  if (!dz || !files?.length) return;
  if (dz.dataset.busy === '1') return;

  dz.dataset.busy = '1';
  dz.classList.add('is-processing');

  try {
    for (const f of files) {
      if (!f?.type?.startsWith('image/')) continue;
      if (state.images[p].find(i => i.name === f.name)) continue;
      const b64 = await resizeImage(f, 512);
      state.images[p].push({ name: f.name, base64: b64, mediaType: 'image/jpeg' });
      await new Promise(r => setTimeout(r, 0));
    }
    renderThumbs(p);
  } finally {
    dz.dataset.busy = '0';
    dz.classList.remove('is-processing');
    if (inp) inp.value = '';
  }
}

function renderThumbs(p) {
  const dz = document.getElementById(`dropZone-${p}`);
  const strip = document.getElementById(`thumbStrip-${p}`);
  const placeholder = document.getElementById(`dzPlaceholder-${p}`);
  if (!strip) return;

  strip.innerHTML = '';

  const hasImages = state.images[p].length > 0;
  if (dz) dz.classList.toggle('has-images', hasImages);
  if (placeholder) placeholder.style.display = hasImages ? 'none' : '';

  state.images[p].forEach(img => {
    const wrap = document.createElement('div');
    wrap.className = 'thumb-wrap';

    const el = document.createElement('img');
    el.className = 'img-thumb';
    el.src = `data:image/jpeg;base64,${img.base64}`;
    el.title = img.name || '';
    el.alt = img.name || 'Image importée';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'img-remove-btn';
    btn.textContent = '✕';
    btn.title = 'Retirer';
    btn.setAttribute('aria-label', `Retirer ${img.name || 'image'}`);
    btn.onclick = e => {
      e.stopPropagation();
      removeImage(img.base64, p);
    };

    wrap.appendChild(el);
    wrap.appendChild(btn);
    strip.appendChild(wrap);
  });
}'''
js, count = setup_pat.subn(setup_repl, js, count=1)
if count != 1:
    raise SystemExit('Impossible de remplacer setupImageHandlers/processImages/renderThumbs. Le fichier a peut-être trop changé.')
if 'window.__ggiDropCleanupBound' not in js:
    raise SystemExit('Injection JS incomplète.')
JS.write_text(js, encoding='utf-8')

css = CSS.read_text(encoding='utf-8')
marker = '/* === GGI IMAGE FREEZE FIX === */'
if marker not in css:
    css += "\n\n" + marker + "\n" + '''
.drop-zone.has-images{cursor:default;}
.drop-zone.has-images:hover{border-color:var(--border2);background:var(--bg);}
.drop-zone.has-images .thumb-strip{cursor:default;}
.drop-zone.is-processing{opacity:.76;cursor:progress;}
.thumb-wrap{position:relative;display:inline-block;}
.img-remove-btn{
  position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;
  background:var(--error);border:none;color:#fff;font-size:10px;font-weight:700;
  cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;z-index:2;
}
'''
    CSS.write_text(css, encoding='utf-8')

after = {str(p): sha1(p) for p in (JS, CSS, HTML)}
print('Backup:', backup_dir)
for p in (HTML, JS, CSS):
    key = str(p)
    changed = before[key] != after[key]
    print(f"{'MOD' if changed else 'OK '} {p}")
    if changed:
        print('  before:', before[key])
        print('  after :', after[key])

print('\nContrôle conseillé :')
print('  git diff -- src/etsy-pipeline-dnd-v1_2.html src/pipeline-ui.js src/pipeline.css')
