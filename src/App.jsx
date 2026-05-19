import { useState, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import ImportPanel from './components/ImportPanel.jsx';
import EditorFrame from './components/EditorFrame.jsx';
import SidePanel from './components/SidePanel.jsx';

export default function App() {
  const [project, setProject] = useState(null);
  const [html, setHtml] = useState('');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);

  const editorRef = useRef(null);

  // ── History ─────────────────────────────────────────────────────────────────

  const pushHistory = useCallback((newHtml) => {
    setHistory(prev => {
      const base = prev.slice(0, histIdx + 1);
      const next = [...base, newHtml].slice(-50);
      setHistIdx(next.length - 1);
      return next;
    });
    setHtml(newHtml);
  }, [histIdx]);

  const canUndo = histIdx > 0;
  const canRedo = histIdx < history.length - 1;

  function undo() {
    if (!canUndo) return;
    const idx = histIdx - 1;
    setHistIdx(idx);
    setHtml(history[idx]);
    setSelected(null);
  }

  function redo() {
    if (!canRedo) return;
    const idx = histIdx + 1;
    setHistIdx(idx);
    setHtml(history[idx]);
    setSelected(null);
  }

  // ── Project loading ──────────────────────────────────────────────────────────

  function loadProject({ title, html: initialHtml, files, pathPrefix }) {
    setProject({ title, files, pathPrefix });
    setHtml(initialHtml);
    setHistory([initialHtml]);
    setHistIdx(0);
    setSelected(null);
  }

  // ── Selection ────────────────────────────────────────────────────────────────

  function handleSelect(data) {
    setSelected(data);
  }

  function handleDeselect() {
    setSelected(null);
  }

  // ── Text editing ─────────────────────────────────────────────────────────────

  function handleTextChange(id, value) {
    setSelected(prev => prev ? { ...prev, html: value } : prev);
    editorRef.current?.sendMessage({ type: 'update-text', id, value });
  }

  async function handleTextBlur() {
    try {
      const newHtml = await editorRef.current?.getHtml();
      if (newHtml) pushHistory(newHtml);
    } catch (e) {
      // ignore timeout
    }
  }

  // ── Image editing ─────────────────────────────────────────────────────────────

  function handleImageChange(id, dataUrl) {
    setSelected(prev => prev ? { ...prev, src: dataUrl } : prev);
    editorRef.current?.sendMessage({ type: 'update-img', id, value: dataUrl });
    setTimeout(async () => {
      try {
        const newHtml = await editorRef.current?.getHtml();
        if (newHtml) pushHistory(newHtml);
      } catch (e) {
        // ignore timeout
      }
    }, 100);
  }

  function handleAltChange(id, value) {
    setSelected(prev => prev ? { ...prev, alt: value } : prev);
    editorRef.current?.sendMessage({ type: 'update-alt', id, value });
  }

  // ── Export ───────────────────────────────────────────────────────────────────

  async function handleExport() {
    // 1. Get current HTML (with edits) from iframe
    let rawHtml = html;
    try {
      const live = await editorRef.current?.getHtml();
      if (live) rawHtml = live;
    } catch (e) {}

    // 2. Clean editor artifacts
    let finalHtml = rawHtml;

    // Remove VFS script
    finalHtml = finalHtml.replace(/<script\s+data-vfs="1"[^>]*>[\s\S]*?<\/script>/gi, '');

    // Remove editor style block (injected by SCRIPT_BODY)
    finalHtml = finalHtml.replace(/<style[^>]*>\s*\[data-eid\][\s\S]*?<\/style>/gi, '');

    // Remove eid-sel class
    finalHtml = finalHtml.replace(/\s*eid-sel/g, '');

    // Remove data-eid attributes
    finalHtml = finalHtml.replace(/\s+data-eid=["'][^"']*["']/g, '');

    // Unwrap .eid-iw spans: extract the img inside, discard .eid-ib badge
    finalHtml = finalHtml.replace(
      /<span[^>]*class="eid-iw"[^>]*>([\s\S]*?)<\/span>/gi,
      (match, inner) => {
        const imgMatch = inner.match(/<img\b[^>]*>/i);
        return imgMatch ? imgMatch[0] : '';
      }
    );

    // 3. Restore CSS: <style data-src="path"> → <link rel="stylesheet" href="path">
    finalHtml = finalHtml.replace(
      /<style\s+data-src=["']([^"']+)["'][^>]*>[\s\S]*?<\/style>/gi,
      (match, href) => `<link rel="stylesheet" href="${href}">`
    );

    // 4. Restore JS: <script data-src="path"> → <script src="path"></script>
    finalHtml = finalHtml.replace(
      /<script\s+data-src=["']([^"']+)["'][^>]*>[\s\S]*?<\/script>/gi,
      (match, src) => `<script src="${src}"><\/script>`
    );

    // 5. Restore non-replaced images: src="data:..." data-export-src="orig" → src="orig"
    finalHtml = finalHtml.replace(
      /src=["']data:[^"']*["']\s+data-export-src=["']([^"']+)["']/gi,
      (match, originalSrc) => `src="${originalSrc}"`
    );

    // 6. Remove any leftover data-export-src attrs
    finalHtml = finalHtml.replace(/\s+data-export-src=["'][^"']*["']/gi, '');

    // 7. Ensure DOCTYPE
    if (!finalHtml.trimStart().startsWith('<!')) {
      finalHtml = '<!DOCTYPE html>\n' + finalHtml;
    }

    // 8. Build ZIP with original file structure
    const zip = new JSZip();
    const { files = [], pathPrefix = '', title: projTitle } = project;

    // Add all original files (images, CSS, JS, data files, etc.)
    await Promise.all(
      files.map(async ({ file, relPath }) => {
        const zipPath = pathPrefix ? relPath.slice(pathPrefix.length) : relPath;
        if (!zipPath || zipPath.match(/\.html?$/i)) return; // skip HTML files, replaced by edited version
        try {
          const buffer = await file.arrayBuffer();
          zip.file(zipPath, buffer);
        } catch (e) {
          // If arrayBuffer fails, skip this file
        }
      })
    );

    // Add the modified index.html
    zip.file('index.html', finalHtml);

    // 9. Generate and download
    const slug = (projTitle || 'site').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    saveAs(blob, `${slug}.zip`);
  }

  // ── Layout ───────────────────────────────────────────────────────────────────

  if (!project) {
    return (
      <div className="app">
        <header className="toolbar">
          <div className="toolbar-left">
            <span className="logo">Visionary</span>
          </div>
        </header>
        <div className="import-screen">
          <ImportPanel onLoad={loadProject} />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar-left">
          <span className="logo">Visionary</span>
          <button className="tb-btn" onClick={() => { setProject(null); setSelected(null); }}>
            + Nouveau
          </button>
        </div>
        <div className="toolbar-center">
          <button className="tb-btn icon" onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)">
            ↩
          </button>
          <button className="tb-btn icon" onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Y)">
            ↪
          </button>
        </div>
        <div className="toolbar-right">
          <span className="project-name">{project.title}</span>
          <button className="tb-btn primary" onClick={handleExport}>
            ↓ Exporter ZIP
          </button>
        </div>
      </header>
      <div className="editor-layout">
        <SidePanel
          selected={selected}
          onTextChange={handleTextChange}
          onTextBlur={handleTextBlur}
          onImageChange={handleImageChange}
          onAltChange={handleAltChange}
        />
        <EditorFrame
          ref={editorRef}
          html={html}
          onSelect={handleSelect}
          onDeselect={handleDeselect}
        />
      </div>
    </div>
  );
}
