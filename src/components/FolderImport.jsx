import { useRef, useState } from 'react';

export default function FolderImport({ onResult }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  async function processFiles(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;

    let html = null;
    let css = '';
    let js = '';
    let title = 'Site importé';
    const names = [];

    for (const file of files) {
      const name = file.name.toLowerCase();
      names.push(file.name);

      if (name.endsWith('.html') || name.endsWith('.htm')) {
        html = await file.text();
        title = file.name.replace(/\.html?$/i, '');
      } else if (name.endsWith('.css')) {
        css += await file.text();
      } else if (name.endsWith('.js')) {
        js += await file.text();
      }
    }

    if (!html) {
      alert('Aucun fichier HTML trouvé dans le dossier sélectionné.');
      return;
    }

    const composed = html
      .replace('</head>', `<style>${css}</style></head>`)
      .replace('</body>', `<script>${js}<\/script></body>`);

    onResult({
      title,
      url: null,
      html: composed,
      scrapedAt: new Date().toISOString(),
      files: names,
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
      className={`folder-drop${dragging ? ' dragging' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <span className="folder-icon">📁</span>
      <span className="folder-text">
        Glissez un dossier ici ou <u>cliquez pour parcourir</u>
      </span>
      <span className="folder-hint">HTML · CSS · JS acceptés</span>
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
