(function initPipelineUIImages(global) {

// Gestion locale des images.
// Upload, drop, resize navigateur et rendu des miniatures pour les vues unitaires.
// Périmètre volontairement limité au cycle de vie des images côté UI.
  global.PipelineUI = global.PipelineUI || {};

  const getState = () => global.state;

  function setupImageHandlers(p) {
    const dz = document.getElementById(`dropZone-${p}`);
    const inp = document.getElementById(`imgInput-${p}`);
    if (!dz || !inp) return;

    dz.addEventListener('dragover', (e) => {
      e.preventDefault();
      dz.classList.add('dragover');
    });

    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));

    dz.addEventListener('drop', async (e) => {
      e.preventDefault();
      dz.classList.remove('dragover');
      await processImages(
        Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/')),
        p
      );
    });

    inp.addEventListener('change', async (e) => {
      await processImages(Array.from(e.target.files), p);
    });
  }

  async function processImages(files, p) {
 const state = getState();
if (!state?.images?.[p]) return;

const existingNames = new Set(state.images[p].map((image) => image.name));

for (const [index, file] of files.entries()) {
  if (existingNames.has(file.name)) continue;

  const targetWidth = index === 0 ? 1024 : 512;
  const base64 = await resizeImage(file, targetWidth);

  state.images[p].push({
    name: file.name,
    base64,
    mediaType: 'image/jpeg',
  });
}

renderThumbs(p);
  }

  function renderThumbs(p) {
    const state = getState();
    if (!state?.images?.[p]) return;

    const strip = document.getElementById(`thumbStrip-${p}`);
    const placeholder = document.getElementById(`dzPlaceholder-${p}`);
    if (!strip) return;

    strip.innerHTML = '';
    const hasImages = state.images[p].length > 0;

    if (placeholder) placeholder.style.display = hasImages ? 'none' : '';

    state.images[p].forEach((img) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;display:inline-block;';

      const el = document.createElement('img');
      el.className = 'img-thumb';
      el.src = `data:image/jpeg;base64,${img.base64}`;
      el.title = img.name || '';

      const btn = document.createElement('button');
      btn.textContent = '✕';
      btn.style.cssText = 'position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--error);border:none;color:#fff;font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;z-index:2;';
      btn.title = 'Retirer';
      btn.onclick = (e) => {
        e.stopPropagation();
        removeImage(img.base64, p);
      };

      wrap.appendChild(el);
      wrap.appendChild(btn);
      strip.appendChild(wrap);
    });
  }

  function resizeImage(file, maxPx) {
    return new Promise((res, rej) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          res(canvas.toDataURL('image/jpeg', 0.88).split(',')[1]);
        };

        img.onerror = rej;
        img.src = e.target.result;
      };

      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
  }

  function removeImage(b64, p) {
    const state = getState();
    if (!state?.images?.[p]) return;

    state.images[p] = state.images[p].filter((i) => i.base64 !== b64);
    renderThumbs(p);
  }

  global.PipelineUIImages = {
    setupImageHandlers,
    processImages,
    renderThumbs,
    resizeImage,
    removeImage,
  };

  global.PipelineUI.images = global.PipelineUI.images || {};
  Object.assign(global.PipelineUI.images, global.PipelineUIImages);
})(window);
