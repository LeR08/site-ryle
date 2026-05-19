import { useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const TABS = [
  { id: 'preview', label: 'Aperçu' },
  { id: 'source',  label: 'Source HTML' },
  { id: 'meta',    label: 'Métadonnées' },
];

export default function ResultPanel({ result }) {
  const [tab, setTab] = useState('preview');
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const zip = new JSZip();
      zip.file('index.html', result.html);
      zip.file(
        'metadata.json',
        JSON.stringify(
          { title: result.title, url: result.url, scrapedAt: result.scrapedAt },
          null,
          2
        )
      );
      const blob = await zip.generateAsync({ type: 'blob' });
      const name = new URL(result.url).hostname.replace(/\./g, '-') + '.zip';
      saveAs(blob, name);
    } finally {
      setDownloading(false);
    }
  }

  const sizeKb = (result.html.length / 1024).toFixed(1);
  const date = new Date(result.scrapedAt).toLocaleString('fr-FR');

  return (
    <div className="result-panel">
      <div className="result-header">
        <div className="result-meta">
          <div className="result-title">{result.title || 'Sans titre'}</div>
          <div className="result-url">{result.url}</div>
        </div>
        <button className="btn btn-ghost" onClick={handleDownload} disabled={downloading}>
          {downloading ? <span className="spinner" style={{ borderTopColor: 'var(--accent)' }} /> : '↓'}
          {downloading ? 'Génération…' : 'Télécharger ZIP'}
        </button>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'preview' && (
        <iframe
          className="preview-iframe"
          srcDoc={result.html}
          sandbox="allow-same-origin allow-scripts"
          title="Aperçu du site"
        />
      )}

      {tab === 'source' && (
        <pre className="source-view">{result.html}</pre>
      )}

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
            <div className="meta-card-label">Scraped le</div>
            <div className="meta-card-value">{date}</div>
          </div>
          <div className="meta-card">
            <div className="meta-card-label">Fichiers</div>
            <div className="meta-card-value">{result.files.join(', ')}</div>
          </div>
          <div className="meta-card full">
            <div className="meta-card-label">URL</div>
            <div className="meta-card-value">{result.url}</div>
          </div>
        </div>
      )}
    </div>
  );
}
