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

  function loadProject({ title, html: initialHtml, files }) {
    setProject({ title, files });
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
    let exportHtml = html;
    try {
      const live = await editorRef.current?.getHtml();
      if (live) exportHtml = live;
    } catch (e) {
      // use current html state
    }

    const zip = new JSZip();
    const slug = (project?.title || 'site').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    zip.file('index.html', exportHtml);
    const blob = await zip.generateAsync({ type: 'blob' });
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
