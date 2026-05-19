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
const TEXT_DATA_EXTS = new Set(['json', 'xml', 'txt', 'csv', 'tsv', 'yaml', 'yml', 'geojson', 'svg']);

function getPathPrefix(items) {
  if (!items.length) return '';
  const first = items[0].relPath.split('/')[0];
  if (first && items.every(({ relPath }) => relPath.startsWith(first + '/'))) {
    return first + '/';
  }
  return '';
}

async function buildSite(items, onLoad) {
  const htmlItems = [], cssItems = [], jsItems = [], binaryItems = [], textDataItems = [];

  for (const item of items) {
    const ext = (item.file.name.split('.').pop() || '').toLowerCase();
    if (['html', 'htm'].includes(ext))  htmlItems.push(item);
    else if (ext === 'css')             cssItems.push(item);
    else if (ext === 'js')              jsItems.push(item);
    else if (TEXT_DATA_EXTS.has(ext))   textDataItems.push(item);
    else                                binaryItems.push(item);
  }
  // Alias pour la suite (binaryItems remplace assetItems)
  const assetItems = binaryItems;

  if (!htmlItems.length) {
    alert('Aucun fichier HTML trouvé dans le dossier.');
    return;
  }

  // ── 1. Assets → data URLs base64 ──────────────────────────────────────────
  const assetMap = new Map();

  await Promise.all(assetItems.map(({ file, relPath }) =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const parts = relPath.split('/');
        for (let i = 0; i < parts.length; i++) {
          const sub = parts.slice(i).join('/');
          // Tous les préfixes courants y compris absolu '/' et relatif profond '../../'
          for (const prefix of ['', './', '../', '../../', '/']) {
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

  // ── 1b. Fichiers texte/JSON → VFS (fetch virtuel) ────────────────────────────
  const vfsMap = new Map();

  await Promise.all(textDataItems.map(async ({ file, relPath }) => {
    const content = await file.text();
    const parts = relPath.split('/');
    for (let i = 0; i < parts.length; i++) {
      const sub = parts.slice(i).join('/');
      for (const prefix of ['', './', '../', '/']) {
        if (!vfsMap.has(prefix + sub)) vfsMap.set(prefix + sub, content);
      }
    }
  }));

  // Script injecté en tête de HTML pour intercepter fetch() et XHR sur fichiers locaux
  function buildVfsScript() {
    if (!vfsMap.size) return '';
    const entries = JSON.stringify(Object.fromEntries(vfsMap));
    return `<script data-vfs="1">(function(){` +
      `var V=${entries};` +
      `function res(u){var k=String(u).split('?')[0].split('#')[0];` +
      `try{k=decodeURIComponent(k);}catch(e){}` +
      `return V[k]!==undefined?V[k]:V[k.replace(/^\\/+/,'')]!==undefined?V[k.replace(/^\\/+/,'')]:` +
      `V[k.replace(/^\\.\\/+/,'')]!==undefined?V[k.replace(/^\\.\\/+/,'')]:null;}` +
      `var _f=window.fetch.bind(window);` +
      `window.fetch=function(u,o){var d=res(u);if(d!==null){` +
      `var ct=/\\.json$/i.test(String(u))?'application/json':` +
      `/\\.xml$/i.test(String(u))?'application/xml':'text/plain';` +
      `return Promise.resolve(new Response(d,{status:200,headers:{'Content-Type':ct}}));}` +
      `return _f(u,o);};` +
      `var _op=XMLHttpRequest.prototype.open,_se=XMLHttpRequest.prototype.send;` +
      `XMLHttpRequest.prototype.open=function(m,u){this._vd=res(u);this._vu=String(u);` +
      `if(this._vd===null)return _op.apply(this,arguments);};` +
      `XMLHttpRequest.prototype.send=function(){if(this._vd===null||this._vd===undefined)` +
      `return _se.apply(this,arguments);var s=this;` +
      `setTimeout(function(){try{` +
      `Object.defineProperty(s,'readyState',{get:function(){return 4},configurable:true});` +
      `Object.defineProperty(s,'status',{get:function(){return 200},configurable:true});` +
      `Object.defineProperty(s,'responseText',{get:function(){return s._vd},configurable:true});` +
      `Object.defineProperty(s,'response',{get:function(){return s._vd},configurable:true});` +
      `if(s.onreadystatechange)s.onreadystatechange();if(s.onload)s.onload();}catch(e){}},0);};` +
      `})();<\/script>`;
  }

  // Chemins triés du plus long au plus court pour éviter les correspondances partielles
  const sortedAssets = [...assetMap.entries()].sort(([a], [b]) => b.length - a.length);

  // Remplace les url() dans du CSS/HTML de façon ciblée
  // Gère les 3 formes : url('...') url("...") url(...) — y compris chemins avec espaces
  function replaceUrlRefs(text) {
    return text.replace(
      /url\(\s*(?:(['"])([^'"]*)\1|([^'")(\s][^'")(\s]*))\s*\)/gi,
      (match, _q, quoted, unquoted) => {
        const raw = quoted !== undefined ? quoted : (unquoted || '');
        let clean;
        try { clean = decodeURIComponent(raw.trim().split('?')[0].split('#')[0]); }
        catch { clean = raw.trim().split('?')[0].split('#')[0]; }
        if (!clean || clean.startsWith('data:')) return match;
        for (const [p, dataUrl] of sortedAssets) {
          if (clean === p || clean.endsWith('/' + p)) return `url(${dataUrl})`;
        }
        if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('//')) {
          const fname = clean.split('/').pop();
          for (const [p, dataUrl] of sortedAssets) {
            if (p.split('/').pop() === fname) return `url(${dataUrl})`;
          }
        }
        return match;
      }
    );
  }

  function cleanHref(href) {
    const s = href.split('?')[0].split('#')[0].trim();
    // Décode %20 etc. pour matcher les noms de fichiers réels
    try { return decodeURIComponent(s); } catch { return s; }
  }

  function resolveAsset(raw) {
    const clean = cleanHref(raw);
    if (clean.startsWith('data:') || clean.startsWith('http://') ||
        clean.startsWith('https://') || clean.startsWith('//')) return null;
    for (const [p, dataUrl] of sortedAssets) {
      if (clean === p || clean.endsWith('/' + p)) return dataUrl;
    }
    // Dernier recours : correspondance par nom de fichier seul (pas pour URLs externes)
    const fname = clean.split('/').pop();
    for (const [p, dataUrl] of sortedAssets) {
      if (p.split('/').pop() === fname) return dataUrl;
    }
    return null;
  }

  // ── 2. CSS → inline après remplacement des assets ─────────────────────────
  const cssMap = new Map();

  await Promise.all(cssItems.map(async ({ file, relPath }) => {
    const raw = await file.text();
    const content = replaceUrlRefs(raw);
    const parts = relPath.split('/');
    for (let i = 0; i < parts.length; i++) {
      const sub = parts.slice(i).join('/');
      for (const prefix of ['', './', '../', '/']) {
        cssMap.set(prefix + sub, content);
      }
    }
  }));

  // ── 3. JS → inline ────────────────────────────────────────────────────────
  const jsMap = new Map();

  await Promise.all(jsItems.map(async ({ file, relPath }) => {
    const content = await file.text();
    const parts = relPath.split('/');
    for (let i = 0; i < parts.length; i++) {
      const sub = parts.slice(i).join('/');
      for (const prefix of ['', './', '../', '/']) {
        jsMap.set(prefix + sub, content);
      }
    }
  }));

  function findInMap(map, href) {
    const p = cleanHref(href);
    // Cherche d'abord le chemin complet, puis sans premier segment, puis nom seul
    const found = map.get(p);
    if (found != null) return found;
    const noLeadingSlash = p.startsWith('/') ? p.slice(1) : null;
    if (noLeadingSlash) { const f = map.get(noLeadingSlash); if (f != null) return f; }
    // Correspondance par nom de fichier seul (local uniquement)
    if (!p.startsWith('http://') && !p.startsWith('https://') && !p.startsWith('//')) {
      const fname = p.split('/').pop();
      for (const [k, v] of map) {
        if (k.split('/').pop() === fname) return v;
      }
    }
    return null;
  }

  // ── 4. Choisir le HTML principal (index.html en priorité) ─────────────────
  const mainHtmlItem =
    htmlItems.find(({ file }) => file.name.toLowerCase() === 'index.html') ||
    htmlItems[0];

  let html = await mainHtmlItem.file.text();
  const title = mainHtmlItem.file.name.replace(/\.html?$/i, '');

  // ── 4b. Injecter le VFS en tout premier (avant les scripts du site) ────────
  const vfsScript = buildVfsScript();
  if (vfsScript) {
    if (html.includes('<head>')) {
      html = html.replace('<head>', '<head>' + vfsScript);
    } else if (html.includes('<head ')) {
      html = html.replace(/<head\b[^>]*>/, m => m + vfsScript);
    } else {
      html = vfsScript + html;
    }
  }

  // ── 5. <link rel="stylesheet"> → <style data-src="..."> inline ───────────
  html = html.replace(/<link\b([^>]*)>/gi, (match, attrs) => {
    if (!/rel=["']stylesheet["']/i.test(attrs)) return match;
    const m = attrs.match(/href=["']([^"']+)["']/i);
    if (!m) return match;
    const css = findInMap(cssMap, m[1]);
    return css != null ? `<style data-src="${m[1].replace(/"/g, '&quot;')}">${css}</style>` : match;
  });

  // ── 6. <script src="..."> → <script data-src="..."> inline ───────────────
  html = html.replace(/<script\b([^>]*)>\s*<\/script>/gi, (match, attrs) => {
    const m = attrs.match(/src=["']([^"']+)["']/i);
    if (!m) return match;
    const js = findInMap(jsMap, m[1]);
    return js != null ? `<script data-src="${m[1].replace(/"/g, '&quot;')}">${js}<\/script>` : match;
  });

  // ── 7. @import dans les <style> inline de l'HTML ──────────────────────────
  html = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, open, body, close) => {
    const resolved = body
      .replace(/@import\s+url\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi, (imp, href) => {
        const css = findInMap(cssMap, href);
        return css ? css : imp;
      })
      .replace(/@import\s+['"]([^'"]+)['"]/gi, (imp, href) => {
        const css = findInMap(cssMap, href);
        return css ? css : imp;
      });
    return open + replaceUrlRefs(resolved) + close;
  });

  // ── 8. src="..." sur img → data URL + data-export-src tracking ────────────
  html = html.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
    const newAttrs = attrs.replace(/\bsrc=["']([^"']+)["']/i, (m2, src) => {
      const dataUrl = resolveAsset(src);
      return dataUrl ? `src="${dataUrl}" data-export-src="${src.replace(/"/g, '&quot;')}"` : m2;
    });
    return `<img${newAttrs}>`;
  });

  // Pour les autres balises (video, audio, source, etc.) — remplacer src sans tracking
  html = html.replace(/\bsrc=["']([^"']+)["']/gi, (match, src) => {
    if (match.includes('data-export-src')) return match; // déjà traité
    const dataUrl = resolveAsset(src);
    return dataUrl ? `src="${dataUrl}"` : match;
  });

  // ── 9. srcset="..." → data URLs ───────────────────────────────────────────
  html = html.replace(/\bsrcset=["']([^"']+)["']/gi, (match, srcset) => {
    const parts = srcset.split(',').map(part => {
      const [url, ...rest] = part.trim().split(/\s+/);
      const dataUrl = resolveAsset(url);
      return dataUrl ? [dataUrl, ...rest].join(' ') : part.trim();
    });
    return `srcset="${parts.join(', ')}"`;
  });

  // ── 10. data-src / data-bg / data-background (lazy loading) ───────────────
  html = html.replace(/\b(data-src|data-lazysrc|data-original|data-bg|data-background)=["']([^"']+)["']/gi,
    (match, attr, src) => {
      const dataUrl = resolveAsset(src);
      return dataUrl ? `${attr}="${dataUrl}"` : match;
    }
  );

  // ── 11. url() dans styles inline restants ─────────────────────────────────
  html = replaceUrlRefs(html);

  onLoad({
    title,
    html,
    files: items,
    pathPrefix: getPathPrefix(items),
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
