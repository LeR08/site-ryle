import { useState, useEffect } from 'react'
import './Settings.css'

const RELATIONS = ['Famille', 'Ami(e)', 'Psychologue', 'Psychiatre', 'Médecin traitant', 'Urgences', 'Autre']

export default function Settings({ showToast }) {
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState({ name: '', phone: '', relation: 'Famille', isEmergency: false })
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showDeleteAll, setShowDeleteAll] = useState(false)

  const load = () => {
    fetch('/api/contacts').then(r => r.json()).then(setContacts).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const addContact = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      return showToast('Nom et téléphone requis', 'error')
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (!res.ok) throw new Error()
      showToast('Contact ajouté', 'success')
      setForm({ name: '', phone: '', relation: 'Famille', isEmergency: false })
      setShowForm(false)
      load()
    } catch {
      showToast('Erreur lors de l\'ajout', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteContact = async (id) => {
    if (!confirm('Supprimer ce contact ?')) return
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
    showToast('Contact supprimé', 'info')
    load()
  }

  const exportData = () => {
    window.open('/api/export', '_blank')
    showToast('Export en cours de téléchargement…', 'info')
  }

  const clearAllData = async () => {
    try {
      await fetch('/api/history', { method: 'DELETE' })
      await fetch('/api/memory', { method: 'DELETE' })
      showToast('Données effacées', 'success')
      setShowDeleteAll(false)
    } catch {
      showToast('Erreur lors de la suppression', 'error')
    }
  }

  return (
    <div className="settings-layout">
      <div className="page-header">
        <div>
          <div className="page-title">Paramètres</div>
          <div className="page-subtitle">Contacts, confidentialité et données</div>
        </div>
      </div>

      <div className="settings-content">
        {/* Emergency contacts */}
        <section className="settings-section">
          <div className="section-header">
            <div>
              <h2 className="section-title">📞 Contacts de confiance</h2>
              <p className="section-desc">Ces contacts peuvent être alertés en cas de situation critique.</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(f => !f)}>
              {showForm ? 'Annuler' : '+ Ajouter'}
            </button>
          </div>

          {showForm && (
            <div className="card contact-form slide-up">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Prénom / Nom *</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Marie Dupont"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone *</label>
                  <input
                    className="form-input"
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+33 6 00 00 00 00"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Relation</label>
                  <select
                    className="form-select"
                    value={form.relation}
                    onChange={e => setForm(f => ({ ...f, relation: e.target.value }))}
                  >
                    {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Alerte d'urgence</label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={form.isEmergency}
                      onChange={e => setForm(f => ({ ...f, isEmergency: e.target.checked }))}
                    />
                    <span className="toggle-track">
                      <span className="toggle-thumb" />
                    </span>
                    <span className="toggle-text">Notifier en cas de crise</span>
                  </label>
                </div>
              </div>
              <div className="form-actions">
                <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
                <button className="btn btn-primary" onClick={addContact} disabled={submitting}>
                  {submitting ? 'Ajout…' : 'Ajouter le contact'}
                </button>
              </div>
            </div>
          )}

          {contacts.length === 0 ? (
            <div className="contacts-empty">
              <span>📭</span>
              <span>Aucun contact enregistré. Ajoutez des proches pour les alertes d'urgence.</span>
            </div>
          ) : (
            <div className="contacts-list">
              {contacts.map(c => (
                <div key={c.id} className="contact-card card card-sm">
                  <div className="contact-info">
                    <div className="contact-avatar">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="contact-name">{c.name}</div>
                      <div className="contact-meta">
                        <span>{c.phone}</span>
                        <span className="meta-sep">·</span>
                        <span>{c.relation}</span>
                        {c.isEmergency && (
                          <span className="contact-emergency-badge">🆘 Urgence</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => deleteContact(c.id)}
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Numéros d'urgence */}
        <section className="settings-section">
          <h2 className="section-title">🆘 Numéros d'urgence nationaux</h2>
          <div className="emergency-numbers">
            {[
              { num: '15', label: 'SAMU — Urgences médicales', color: 'var(--danger)' },
              { num: '17', label: 'Police', color: '#3D5CA8' },
              { num: '18', label: 'Pompiers', color: '#C04040' },
              { num: '3114', label: 'Prévention suicide — 24h/24, gratuit', color: 'var(--secondary)' },
              { num: '3119', label: 'Violences femmes', color: '#8E4A8E' },
              { num: '119', label: 'Enfance en danger', color: 'var(--success)' },
            ].map(n => (
              <div key={n.num} className="emergency-number-card">
                <div className="emergency-num" style={{ color: n.color, borderColor: `${n.color}33` }}>
                  {n.num}
                </div>
                <div className="emergency-label">{n.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Confidentialité */}
        <section className="settings-section">
          <div
            className="section-header clickable"
            onClick={() => setShowPrivacy(f => !f)}
          >
            <div>
              <h2 className="section-title">🔒 Confidentialité & données</h2>
              <p className="section-desc">Comment vos données sont gérées</p>
            </div>
            <span className="chevron">{showPrivacy ? '▲' : '▼'}</span>
          </div>

          {showPrivacy && (
            <div className="privacy-info slide-up">
              {[
                { icon: '✅', title: 'Consentement explicite', desc: 'Vos données ne sont collectées qu\'avec votre accord.' },
                { icon: '🔐', title: 'Données locales', desc: 'Toutes vos données restent sur ce serveur. Rien n\'est partagé avec des tiers.' },
                { icon: '🚫', title: 'Aucune publicité', desc: 'Vos échanges psychologiques ne sont jamais exploités commercialement.' },
                { icon: '📥', title: 'Export possible', desc: 'Téléchargez toutes vos données à tout moment au format JSON.' },
                { icon: '🗑️', title: 'Suppression', desc: 'Effacez toutes vos données définitivement en un clic.' },
              ].map((item, i) => (
                <div key={i} className="privacy-item">
                  <span className="privacy-icon">{item.icon}</span>
                  <div>
                    <div className="privacy-title">{item.title}</div>
                    <div className="privacy-desc">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Data actions */}
        <section className="settings-section">
          <h2 className="section-title">📂 Gestion des données</h2>
          <div className="data-actions">
            <div className="data-action-card">
              <div>
                <div className="data-action-title">Exporter mes données</div>
                <div className="data-action-desc">Télécharger tout l'historique, journal et mémoire en JSON</div>
              </div>
              <button className="btn btn-secondary" onClick={exportData}>
                📥 Exporter
              </button>
            </div>
            <div className="data-action-card danger">
              <div>
                <div className="data-action-title">Effacer l'historique et la mémoire</div>
                <div className="data-action-desc">Supprime définitivement les conversations et mémoires. Irréversible.</div>
              </div>
              <button className="btn btn-danger" onClick={() => setShowDeleteAll(true)}>
                🗑️ Effacer
              </button>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="settings-section">
          <h2 className="section-title">ℹ️ À propos d'Aria</h2>
          <div className="card about-card">
            <div className="about-logo">🌿</div>
            <div className="about-text">
              <div className="about-title">Aria v1.0</div>
              <p>Aria est un assistant d'accompagnement psychologique. Il n'est pas un médecin, un psychologue ou un psychiatre. Il ne remplace pas une prise en charge professionnelle.</p>
              <p>En cas de détresse sérieuse, consultez un professionnel de santé mentale ou appelez le <strong>3114</strong>.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Confirm delete modal */}
      {showDeleteAll && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span style={{ fontSize: 28 }}>⚠️</span>
              <div className="modal-title">Confirmer la suppression</div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
              Cette action effacera définitivement tout votre historique de conversations et vos mémoires.
              Le journal émotionnel et les contacts ne sont pas affectés. Cette action est <strong>irréversible</strong>.
            </p>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setShowDeleteAll(false)}>Annuler</button>
              <button className="btn btn-danger" onClick={clearAllData}>
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
