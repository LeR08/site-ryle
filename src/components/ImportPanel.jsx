import { useRef, useState } from 'react';

// ── Traverse récursif via FileSystem API ─────────────────────────────────────
async function readEntry(entry, relBase, out) {
  if (entry.isFile) {
    await new Promise(resolve => {
      entry.file(file => {
        const relPath = relBase ? `${relBase}/${file.name}` : file.name;
        out.push({ file, relPath });
        resolve();
      }, resolve);
    });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    const newBase = relBase ? `${relBase}/${entry.name}` : entry.name;
    // readEntries renvoie max 100 items par appel — boucler jusqu'à retour vide
    while (true) {
      const batch = await new Promise(resolve =>
        reader.readEntries(resolve, () => resolve([]))
      );
      if (!batch.length) break;
      await Promise.all(batch.map(e => readEntry(e, newBase, out)));
    }
  }
}

async function getDroppedItems(dataTransfer) {
  const out = [];
  const items = Array.from(dataTransfer.items);
  await Promise.all(
    items.map(item => {
      const entry = item.webkitGetAsEntry?.();
      return entry ? readEntry(entry, '', out) : Promise.resolve();
    })
  );
  // Fallback si webkitGetAsEntry indisponible
  if (!out.length) {
    Array.from(dataTransfer.files).forEach(f =>
      out.push({ file: f, relPath: f.webkitRelativePath || f.name })
    );
  }
  return out;
}

// ── Traitement des fichiers ──────────────────────────────────────────────────
async function buildSite(items, onLoad) {
  // items = [{ file, relPath }]
  const htmlItems = [], cssItems = [], jsItems = [], assetItems = [];

  for (const item of items) {
    const ext = (item.file.name.split('.').pop() || '').toLowerCase();
    if (['html', 'htm'].includes(ext))  htmlItems.push(item);
    else if (ext === 'css')             cssItems.push(item);
    else if (ext === 'js')              jsItems.push(item);
    else                                assetItems.push(item);
  }

  if (!htmlItems.length) {
    alert('Aucun fichier HTML trouvé dans le dossier.');
    return;
  }

  // ── 1. Assets → data URLs base64 ──────────────────────────────────────────
  const assetMap = new Map(); // chemin → dataUrl

  await Promise.all(assetItems.map(({ file, relPath }) =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const parts = relPath.split('/');
        // Indexe toutes les variantes du chemin (du complet au simple nom)
        for (let i = 0; i < parts.length; i++) {
          const sub = parts.slice(i).join('/');
          for (const prefix of ['', './', '../']) {
            const key = prefix + sub;
            if (!assetMap.has(key)) assetMap.set(key, dataUrl);
          }
        }
        resolve();
      };
      reader.onerror = resolve;
      reader.readAsDataURL(file);
    })
  ));

  // Remplace les chemins d'assets dans un texte (chemins les plus longs d'abord)
  const sortedAssets = [...assetMap.entries()].sort(([a], [b]) => b.length - a.length);

  function replaceAssets(text) {
    let out = text;
    for (const [p, dataUrl] of sortedAssets) {
      const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(esc, 'g'), dataUrl);
    }
    return out;
  }

  // ── 2. CSS → inline après remplacement des assets ─────────────────────────
  const cssMap = new Map();

  await Promise.all(cssItems.map(async ({ file, relPath }) => {
    const content = replaceAssets(await file.text());
    const parts = relPath.split('/');
    for (let i = 0; i < parts.length; i++) {
      const sub = parts.slice(i).join('/');
      cssMap.set(sub, content);
      cssMap.set('./' + sub, content);
      cssMap.set('../' + sub, content);
    }
  }));

  // ── 3. JS → inline ────────────────────────────────────────────────────────
  const jsMap = new Map();

  await Promise.all(jsItems.map(async ({ file, relPath }) => {
    const content = await file.text();
    const parts = relPath.split('/');
    for (let i = 0; i < parts.length; i++) {
      const sub = parts.slice(i).join('/');
      jsMap.set(sub, content);
      jsMap.set('./' + sub, content);
      jsMap.set('../' + sub, content);
    }
  }));

  function cleanHref(href) { return href.split('?')[0].split('#')[0].trim(); }

  function findInMap(map, href) {
    const p = cleanHref(href);
    return map.get(p) ?? map.get(p.split('/').pop()) ?? null;
  }

  // ── 4. Choisir le HTML principal (index.html en priorité) ─────────────────
  const mainHtmlItem =
    htmlItems.find(({ file }) => file.name.toLowerCase() === 'index.html') ||
    htmlItems[0];

  let html = await mainHtmlItem.file.text();
  const title = mainHtmlItem.file.name.replace(/\.html?$/i, '');

  // <link rel="stylesheet"> → <style> inline
  html = html.replace(/<link\b([^>]*)>/gi, (match, attrs) => {
    if (!/rel=["']stylesheet["']/i.test(attrs)) return match;
    const m = attrs.match(/href=["']([^"']+)["']/i);
    if (!m) return match;
    const css = findInMap(cssMap, m[1]);
    return css != null ? `<style>${css}</style>` : match;
  });

  // <script src="..."></script> → <script> inline
  html = html.replace(/<script\b([^>]*)>\s*<\/script>/gi, (match, attrs) => {
    const m = attrs.match(/src=["']([^"']+)["']/i);
    if (!m) return match;
    const js = findInMap(jsMap, m[1]);
    return js != null ? `<script>${js}<\/script>` : match;
  });

  // src="..." → data URL
  html = html.replace(/\bsrc=["']([^"'#][^"']*?)["']/gi, (match, src) => {
    const clean = cleanHref(src);
    for (const [p, dataUrl] of sortedAssets) {
      if (clean === p || clean.endsWith('/' + p) || clean.endsWith('/' + p.split('/').pop())) {
        return `src="${dataUrl}"`;
      }
    }
    return match;
  });

  // url(...) dans les styles inline → data URL
  html = html.replace(/url\(['"]?([^'")\s]+)['"]?\)/gi, (match, u) => {
    const clean = cleanHref(u);
    for (const [p, dataUrl] of sortedAssets) {
      if (clean === p || clean.endsWith('/' + p) || clean.endsWith('/' + p.split('/').pop())) {
        return `url(${dataUrl})`;
      }
    }
    return match;
  });

  onLoad({
    title,
    html,
    files: items.map(({ relPath }) => relPath),
  });
}

// ── Composant ────────────────────────────────────────────────────────────────
export default function ImportPanel({ onLoad }) {
  const [dragging, setDragging]     = useState(false);
  const [processing, setProcessing] = useState(false);
  const [fileCount, setFileCount]   = useState(null);
  const inputRef = useRef(null);

  async function process(items) {
    if (!items.length) return;
    setFileCount(items.length);
    setProcessing(true);
    try {
      await buildSite(items, onLoad);
    } catch (err) {
      alert(`Erreur lors du traitement : ${err.message}`);
    } finally {
      setProcessing(false);
      setFileCount(null);
    }
  }

  function handleChange(e) {
    const items = Array.from(e.target.files).map(file => ({
      file,
      relPath: file.webkitRelativePath || file.name,
    }));
    e.target.value = '';
    process(items);
  }

  async function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (processing) return;
    const items = await getDroppedItems(e.dataTransfer);
    process(items);
  }

  return (
    <div className="import-card">
      <div>
        <p className="import-title">Importer un site local</p>
        <p className="import-sub">
          Glissez votre dossier complet (sous-dossiers inclus) ou cliquez pour parcourir
        </p>
      </div>

      <div
        className={`drop-zone${dragging ? ' dragging' : ''}${processing ? ' processing' : ''}`}
        onClick={() => !processing && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); if (!processing) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {processing ? (
          <>
            <div className="spinner" />
            <span className="drop-text">
              Traitement{fileCount ? ` de ${fileCount} fichiers` : ''}…
            </span>
            <span className="drop-hint">CSS, JS et images en cours d'intégration</span>
          </>
        ) : (
          <>
            <span className="drop-icon">📁</span>
            <span className="drop-text">
              Glissez votre dossier ici ou <u>cliquez pour parcourir</u>
            </span>
            <span className="drop-hint">
              Tous les sous-dossiers sont inclus automatiquement<br />
              HTML · CSS · JS · Images · Fonts · SVG
            </span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          style={{ display: 'none' }}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
