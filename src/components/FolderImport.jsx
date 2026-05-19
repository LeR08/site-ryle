import { useRef, useState } from 'react';

export default function FolderImport({ onResult }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  async function processFiles(files) {
    if (!files.length) return;

    let html = null;
    let css = '';
    let js = '';
    let title = 'Site importé';
    const fileNames = [];

    for (const file of files) {
      const name = file.name.toLowerCase();
      fileNames.push(file.name);

      if (name.endsWith('.html') || name.endsWith('.htm')) {
        html = await file.text();
        title = file.name.replace(/\.html?$/, '');
      } else if (name.endsWith('.css')) {
        css += await file.text();
      } else if (name.endsWith('.js')) {
        js += await file.text();
      }
    }

    if (!html) {
      alert('Aucun fichier HTML trouvé dans le dossier.');
      return;
    }

    const composed = html
      .replace('</head>', `<style>${css}</style></head>`)
      .replace('</body>', `<script>${js}</script></body>`);

    onResult({
      title,
      url: null,
      html: composed,
      scrapedAt: new Date().toISOString(),
      files: fileNames,
    });
  }

  function handleChange(e) {
    processFiles(Array.from(e.target.files));
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const items = Array.from(e.dataTransfer.files);
    processFiles(items);
  }

  return (
    <div
      className={`folder-drop${isDragging ? ' dragging' : ''}`}
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <span className="folder-icon">📁</span>
      <span className="folder-text">
        Glissez un dossier ici ou <u>cliquez pour parcourir</u>
      </span>
      <span className="folder-hint">HTML · CSS · JS acceptés</span>
      <input
        ref={inputRef}
        type="file"
        webkitdirectory="true"
        directory="true"
        multiple
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </div>
  );
}
