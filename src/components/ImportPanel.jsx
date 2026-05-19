import { useRef, useState } from 'react';

export default function ImportPanel({ onLoad }) {
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef(null);

  async function processFiles(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    setProcessing(true);
    try {
      await buildSite(files);
    } finally {
      setProcessing(false);
    }
  }

  async function buildSite(files) {
    // ── 1. Catégoriser ───────────────────────────────────────────────────────
    const htmlFiles = [], cssFiles = [], jsFiles = [], assetFiles = [];
    for (const f of files) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (['html', 'htm'].includes(ext)) htmlFiles.push(f);
      else if (ext === 'css')            cssFiles.push(f);
      else if (ext === 'js')             jsFiles.push(f);
      else                               assetFiles.push(f);
    }

    if (!htmlFiles.length) {
      alert('Aucun fichier HTML trouvé dans le dossier.');
      return;
    }

    // ── 2. Lire les assets binaires → data URLs ──────────────────────────────
    const assetMap = new Map();

    await Promise.all(assetFiles.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const fullPath = file.webkitRelativePath || file.name;
        const parts = fullPath.split('/');

        for (let i = 0; i < parts.length; i++) {
          const sub = parts.slice(i).join('/');
          const filename = parts[parts.length - 1];
          [sub, `./${sub}`, `../${sub}`, filename, `./${filename}`].forEach(p => {
            if (!assetMap.has(p)) assetMap.set(p, dataUrl);
          });
        }
        resolve();
      };
      reader.onerror = resolve;
      reader.readAsDataURL(file);
    })));

    // Remplace les chemins dans un texte (du plus long au plus court)
    function replaceAssets(text) {
      const sorted = [...assetMap.entries()].sort(([a], [b]) => b.length - a.length);
      let out = text;
      for (const [p, dataUrl] of sorted) {
        const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(esc, 'g'), dataUrl);
      }
      return out;
    }

    // ── 3. Lire et indexer CSS ───────────────────────────────────────────────
    const cssMap = new Map();
    await Promise.all(cssFiles.map(async f => {
      const content = replaceAssets(await f.text());
      const fullPath = f.webkitRelativePath || f.name;
      const parts = fullPath.split('/');
      for (let i = 0; i < parts.length; i++) {
        const sub = parts.slice(i).join('/');
        cssMap.set(sub, content);
        cssMap.set(`./${sub}`, content);
      }
    }));

    // ── 4. Lire et indexer JS ────────────────────────────────────────────────
    const jsMap = new Map();
    await Promise.all(jsFiles.map(async f => {
      const content = await f.text();
      const fullPath = f.webkitRelativePath || f.name;
      const parts = fullPath.split('/');
      for (let i = 0; i < parts.length; i++) {
        const sub = parts.slice(i).join('/');
        jsMap.set(sub, content);
        jsMap.set(`./${sub}`, content);
      }
    }));

    function cleanPath(href) { return href.split('?')[0].split('#')[0].trim(); }

    function findInMap(map, href) {
      const p = cleanPath(href);
      return map.get(p) ?? map.get(p.split('/').pop()) ?? null;
    }

    // ── 5. Traiter le HTML ───────────────────────────────────────────────────
    let html = await htmlFiles[0].text();
    const title = htmlFiles[0].name.replace(/\.html?$/i, '');

    // <link rel="stylesheet"> → <style> inline
    html = html.replace(/<link\b([^>]*)>/gi, (match, attrs) => {
      if (!/rel=["']stylesheet["']/i.test(attrs)) return match;
      const m = attrs.match(/href=["']([^"']+)["']/i);
      if (!m) return match;
      const css = findInMap(cssMap, m[1]);
      return css != null ? `<style>${css}</style>` : match;
    });

    // <script src="..."></script> → <script> inline
    html = html.replace(/<script\b([^>]*)><\/script>/gi, (match, attrs) => {
      const m = attrs.match(/src=["']([^"']+)["']/i);
      if (!m) return match;
      const js = findInMap(jsMap, m[1]);
      return js != null ? `<script>${js}<\/script>` : match;
    });

    // Remplace src="", url() avec data URLs
    html = html
      .replace(/\bsrc=["']([^"'#?][^"']*?)["']/gi, (match, src) => {
        const sorted = [...assetMap.entries()].sort(([a], [b]) => b.length - a.length);
        for (const [p, dataUrl] of sorted) {
          if (src === p || src.endsWith('/' + p) || src.endsWith('/' + p.split('/').pop())) {
            return `src="${dataUrl}"`;
          }
        }
        return match;
      })
      .replace(/url\(['"]?([^'")\s]+)['"]?\)/gi, (match, u) => {
        const sorted = [...assetMap.entries()].sort(([a], [b]) => b.length - a.length);
        for (const [p, dataUrl] of sorted) {
          if (u === p || u.endsWith('/' + p) || u.endsWith('/' + p.split('/').pop())) {
            return `url(${dataUrl})`;
          }
        }
        return match;
      });

    onLoad({
      title,
      html,
      files: files.map(f => f.webkitRelativePath || f.name),
    });
  }

  function handleChange(e) {
    processFiles(e.target.files);
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  }

  return (
    <div className="import-card">
      <div>
        <p className="import-title">Importer un site local</p>
        <p className="import-sub">Glissez un dossier HTML+CSS+JS ou cliquez pour parcourir</p>
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
            <span className="drop-text">Traitement des fichiers…</span>
          </>
        ) : (
          <>
            <span className="drop-icon">📁</span>
            <span className="drop-text">Glissez un dossier ici ou <u>cliquez pour parcourir</u></span>
            <span className="drop-hint">HTML · CSS · JS · Images · Fonts</span>
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
