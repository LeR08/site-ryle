import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const TABS = [
  { id: 'preview', label: '👁 Aperçu'    },
  { id: 'edit',    label: '✏️ Éditer'    },
  { id: 'source',  label: '&lt;/&gt; Code'  },
  { id: 'meta',    label: '📋 Infos'     },
];

export default function ResultPanel({ result }) {
  const [tab,          setTab]          = useState('preview');
  const [htmlContent,  setHtmlContent]  = useState(result.html);
  const [previewKey,   setPreviewKey]   = useState(0);
  const [blobUrl,      setBlobUrl]      = useState(null);
  const [downloading,  setDownloading]  = useState(false);
  const [copied,       setCopied]       = useState(false);
  const editorRef = useRef(null);

  // Reset quand le résultat change
  useEffect(() => {
    setHtmlContent(result.html);
    setTab('preview');
    setPreviewKey(k => k + 1);
  }, [result]);

  // Crée/recrée le blob URL pour l'éditeur WYSIWYG
  useEffect(() => {
    if (tab !== 'edit') return;
    const injected = htmlContent
      .replace('</head>', '<style>*{outline:1px dashed rgba(99,102,241,.25)!important}*:hover{outline:2px solid rgba(99,102,241,.6)!important}</style></head>')
      .replace('</body>', `<script>document.designMode='on';document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();window.parent.postMessage({type:'save',html:document.documentElement.outerHTML},'*');}});<\/script></body>`);
    const blob = new Blob([injected], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [tab, htmlContent]);

  // Reçoit les messages Ctrl+S depuis l'éditeur
  useEffect(() => {
    function onMessage(e) {
      if (e.data?.type === 'save') {
        setHtmlContent(e.data.html);
        setPreviewKey(k => k + 1);
        setTab('preview');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  function captureEdits() {
    try {
      const doc = editorRef.current?.contentDocument;
      if (doc) {
        const newHtml = doc.documentElement.outerHTML;
        setHtmlContent(newHtml);
        setPreviewKey(k => k + 1);
        setTab('preview');
      }
    } catch {
      alert('Impossible de récupérer les modifications. Essayez Ctrl+S dans l\'éditeur.');
    }
  }

  function openInTab() {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  async function copySource() {
    await navigator.clipboard.writeText(htmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const zip = new JSZip();
      zip.file('index.html', htmlContent);
      zip.file('metadata.json', JSON.stringify(
        { title: result.title, url: result.url ?? 'import local', scrapedAt: result.scrapedAt },
        null, 2
      ));
      const blob = await zip.generateAsync({ type: 'blob' });
      const name = result.url
        ? new URL(result.url).hostname.replace(/\./g, '-') + '.zip'
        : (result.title || 'site') + '.zip';
      saveAs(blob, name);
    } finally {
      setDownloading(false);
    }
  }

  const isEdited = htmlContent !== result.html;
  const sizeKb   = (htmlContent.length / 1024).toFixed(1);
  const date     = new Date(result.scrapedAt).toLocaleString('fr-FR');

  return (
    <div className="result-panel">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="result-header">
        <div className="result-meta">
          <div className="result-title">
            {result.title || 'Sans titre'}
            {isEdited && <span className="edited-badge">modifié</span>}
          </div>
          <div className="result-url">{result.url ?? 'Import local'}</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={openInTab} title="Ouvrir dans un onglet">↗ Ouvrir</button>
          <button className="btn btn-ghost" onClick={handleDownload} disabled={downloading}>
            {downloading ? <span className="spinner" style={{ borderTopColor: 'var(--accent)' }} /> : '↓'}
            {downloading ? 'Génération…' : 'ZIP'}
          </button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
            dangerouslySetInnerHTML={{ __html: t.label }}
          />
        ))}
      </div>

      {/* ── Aperçu ─────────────────────────────────────────────────── */}
      {tab === 'preview' && (
        <iframe key={previewKey}
          className="preview-iframe"
          srcDoc={htmlContent}
          sandbox="allow-scripts allow-forms allow-popups"
          title="Aperçu"
        />
      )}

      {/* ── Éditeur WYSIWYG ────────────────────────────────────────── */}
      {tab === 'edit' && (
        <div className="source-container">
          <div className="source-toolbar">
            <span className="source-info">
              Cliquez sur n'importe quel texte pour le modifier · <kbd>Ctrl+S</kbd> pour appliquer
            </span>
            <div className="source-actions">
              <button className="tool-btn tool-btn-accent" onClick={captureEdits}>
                ✓ Appliquer
              </button>
            </div>
          </div>
          {blobUrl && (
            <iframe
              ref={editorRef}
              src={blobUrl}
              className="editor-iframe"
              title="Éditeur visuel"
            />
          )}
        </div>
      )}

      {/* ── Code source ────────────────────────────────────────────── */}
      {tab === 'source' && (
        <div className="source-container">
          <div className="source-toolbar">
            <span className="source-info">{sizeKb} Ko · {htmlContent.split('\n').length} lignes</span>
            <div className="source-actions">
              <button className="tool-btn" onClick={copySource}>
                {copied ? '✓ Copié !' : '⎘ Copier'}
              </button>
              <button className="tool-btn tool-btn-accent"
                onClick={() => { setPreviewKey(k => k + 1); setTab('preview'); }}
                disabled={!isEdited}>
                ↻ Appliquer
              </button>
            </div>
          </div>
          <textarea
            className="source-editor"
            value={htmlContent}
            onChange={e => setHtmlContent(e.target.value)}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      )}

      {/* ── Métadonnées ────────────────────────────────────────────── */}
      {tab === 'meta' && (
        <div className="meta-grid">
          <div className="meta-card">
            <div className="meta-card-label">Titre</div>
            <div className="meta-card-value">{result.title || '—'}</div>
          </div>
          <div className="meta-card">
            <div className="meta-card-label">Taille HTML</div>
            <div className="meta-card-value">{sizeKb} Ko</div>
          </div>
          <div className="meta-card">
            <div className="meta-card-label">Date</div>
            <div className="meta-card-value">{date}</div>
          </div>
          <div className="meta-card">
            <div className="meta-card-label">Fichiers ({result.files.length})</div>
            <div className="meta-card-value meta-files">
              {result.files.map((f, i) => (
                <span key={i} className="file-chip">{f.split('/').pop()}</span>
              ))}
            </div>
          </div>
          {result.url && (
            <div className="meta-card full">
              <div className="meta-card-label">URL source</div>
              <div className="meta-card-value">
                <a href={result.url} target="_blank" rel="noreferrer" className="meta-link">{result.url}</a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
