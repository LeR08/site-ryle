import { useRef } from 'react';

const TAG_LABELS = {
  h1: 'Titre H1', h2: 'Titre H2', h3: 'Titre H3',
  h4: 'Titre H4', h5: 'Titre H5', h6: 'Titre H6',
  p: 'Paragraphe', span: 'Texte inline', a: 'Lien',
  li: 'Élément liste', button: 'Bouton', label: 'Label',
  td: 'Cellule', th: 'En-tête cellule', div: 'Bloc',
};

export default function SidePanel({ selected, onTextChange, onTextBlur, onImageChange, onAltChange }) {
  const fileRef = useRef(null);

  function handleImageFile(e) {
    const file = e.target.files[0];
    if (!file || !selected) return;
    const reader = new FileReader();
    reader.onload = () => onImageChange(selected.id, reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  if (!selected) {
    return (
      <aside className="side-panel">
        <div className="side-empty">
          <div className="side-empty-icon">🖱️</div>
          <p><strong>Cliquez sur un élément</strong><br />dans l'éditeur pour le modifier</p>
          <div className="side-tips">
            <div className="tip"><span className="tip-icon">📝</span><span>Cliquez sur un texte pour modifier son contenu</span></div>
            <div className="tip"><span className="tip-icon">🖼</span><span>Cliquez sur une image pour la remplacer</span></div>
            <div className="tip"><span className="tip-icon">↩</span><span>Annuler / Rétablir via les boutons en haut</span></div>
            <div className="tip"><span className="tip-icon">↓</span><span>Exportez votre site modifié en ZIP</span></div>
          </div>
        </div>
      </aside>
    );
  }

  if (selected.isImg) {
    return (
      <aside className="side-panel">
        <div className="side-section">
          <div className="element-badge img-badge">🖼 Image</div>
        </div>
        <div className="side-section">
          <div className="side-label">Aperçu</div>
          <div className="img-preview">
            {selected.src
              ? <img src={selected.src} alt={selected.alt} className="img-thumb" />
              : <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Aucune source</span>}
          </div>
          <button className="replace-btn" onClick={() => fileRef.current?.click()}>
            🔄 Remplacer l'image
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
        </div>
        <div className="side-section">
          <label className="side-label">Texte alternatif (SEO)</label>
          <input
            className="side-input"
            type="text"
            value={selected.alt || ''}
            onChange={e => onAltChange(selected.id, e.target.value)}
            placeholder="Description de l'image…"
          />
          <div className="side-hint">Décrit l'image pour les lecteurs d'écran et le SEO.</div>
        </div>
      </aside>
    );
  }

  const tagLabel = TAG_LABELS[selected.tag] || selected.tag?.toUpperCase() || 'Élément';

  return (
    <aside className="side-panel">
      <div className="side-section">
        <div className="element-badge">📝 {tagLabel}</div>
      </div>
      <div className="side-section">
        <label className="side-label">Contenu</label>
        <textarea
          className="side-textarea"
          value={selected.html || ''}
          onChange={e => onTextChange(selected.id, e.target.value)}
          onBlur={onTextBlur}
          placeholder="Saisissez le contenu…"
          rows={7}
          autoFocus
        />
        <div className="side-hint">
          Balises HTML supportées : <code>&lt;strong&gt;</code> gras · <code>&lt;em&gt;</code> italique · <code>&lt;br&gt;</code> saut de ligne
        </div>
      </div>
    </aside>
  );
}
