import { useRef, useState } from 'react';

export default function FolderImport({ onResult }) {
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
    // ── 1. Catégoriser les fichiers ──────────────────────────────────────────
    const htmlFiles = [], cssFiles = [], jsFiles = [], assetFiles = [];

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (['html', 'htm'].includes(ext))       htmlFiles.push(file);
      else if (ext === 'css')                   cssFiles.push(file);
      else if (ext === 'js')                    jsFiles.push(file);
      else                                      assetFiles.push(file);
    }

    if (!htmlFiles.length) {
      alert('Aucun fichier HTML trouvé dans le dossier.');
      return;
    }

    // ── 2. Créer des blob URLs pour images/fonts/autres binaires ────────────
    const assetMap = new Map(); // path -> blob URL

    for (const file of assetFiles) {
      const blobUrl = URL.createObjectURL(file);
      const fullPath = file.webkitRelativePath || file.name;
      const parts = fullPath.split('/');

      // Enregistre toutes les variantes du chemin
      for (let i = 0; i < parts.length; i++) {
        const sub = parts.slice(i).join('/');
        if (!assetMap.has(sub))    assetMap.set(sub, blobUrl);
        if (!assetMap.has('./' + sub)) assetMap.set('./' + sub, blobUrl);
        if (!assetMap.has('../' + sub)) assetMap.set('../' + sub, blobUrl);
      }
    }

    // Remplace les références d'assets dans un texte
    function replaceAssets(text) {
      let out = text;
      for (const [p, url] of assetMap) {
        // Échappe les caractères spéciaux regex
        const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(esc, 'g'), url);
      }
      return out;
    }

    // ── 3. Lire et indexer CSS (avec remplacement d'assets) ─────────────────
    const cssMap = new Map();
    for (const file of cssFiles) {
      const content = replaceAssets(await file.text());
      const fullPath = file.webkitRelativePath || file.name;
      const parts = fullPath.split('/');
      for (let i = 0; i < parts.length; i++) {
        const sub = parts.slice(i).join('/');
        cssMap.set(sub, content);
        cssMap.set('./' + sub, content);
      }
      cssMap.set(file.name, content);
    }

    // ── 4. Lire et indexer JS ────────────────────────────────────────────────
    const jsMap = new Map();
    for (const file of jsFiles) {
      const content = await file.text();
      const fullPath = file.webkitRelativePath || file.name;
      const parts = fullPath.split('/');
      for (let i = 0; i < parts.length; i++) {
        const sub = parts.slice(i).join('/');
        jsMap.set(sub, content);
        jsMap.set('./' + sub, content);
      }
      jsMap.set(file.name, content);
    }

    function resolvePath(href) {
      return href.split('?')[0].split('#')[0].trim();
    }

    function findCss(href) {
      const p = resolvePath(href);
      return cssMap.get(p) ?? cssMap.get(p.split('/').pop()) ?? null;
    }

    function findJs(src) {
      const p = resolvePath(src);
      return jsMap.get(p) ?? jsMap.get(p.split('/').pop()) ?? null;
    }

    // ── 5. Traiter le HTML principal ─────────────────────────────────────────
    let html = await htmlFiles[0].text();
    const title = htmlFiles[0].name.replace(/\.html?$/i, '');

    // Remplace <link rel="stylesheet" href="..."> par <style> inline
    html = html.replace(
      /<link\b([^>]*)>/gi,
      (match, attrs) => {
        if (!/rel=["']stylesheet["']/i.test(attrs)) return match;
        const m = attrs.match(/href=["']([^"']+)["']/i);
        if (!m) return match;
        const css = findCss(m[1]);
        return css != null ? `<style>${css}</style>` : match;
      }
    );

    // Remplace <script src="..."></script> par <script> inline
    html = html.replace(
      /<script\b([^>]*)><\/script>/gi,
      (match, attrs) => {
        const m = attrs.match(/src=["']([^"']+)["']/i);
        if (!m) return match;
        const js = findJs(m[1]);
        return js != null ? `<script>${js}<\/script>` : match;
      }
    );

    // Remplace tous les chemins d'assets (src, href, url(...))
    html = replaceAssets(html);

    // ── 6. Retourner le résultat ─────────────────────────────────────────────
    onResult({
      title,
      url: null,
      html,
      scrapedAt: new Date().toISOString(),
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
    <div
      className={`folder-drop${dragging ? ' dragging' : ''}${processing ? ' processing' : ''}`}
      onClick={() => !processing && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); if (!processing) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {processing ? (
        <>
          <span className="spinner" style={{ width: 28, height: 28, borderTopColor: 'var(--accent)' }} />
          <span className="folder-text">Traitement des fichiers…</span>
        </>
      ) : (
        <>
          <span className="folder-icon">📁</span>
          <span className="folder-text">
            Glissez un dossier ici ou <u>cliquez pour parcourir</u>
          </span>
          <span className="folder-hint">HTML · CSS · JS · Images · Fonts</span>
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
  );
}
