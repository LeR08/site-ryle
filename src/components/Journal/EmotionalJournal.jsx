import { useState, useEffect } from 'react'
import './EmotionalJournal.css'

const EMOTIONS = [
  { key: 'positive', label: 'Positif', icon: '😊', color: 'var(--success)' },
  { key: 'neutre', label: 'Neutre', icon: '😐', color: 'var(--text-muted)' },
  { key: 'stress', label: 'Stress', icon: '😤', color: '#B08A20' },
  { key: 'sadness', label: 'Tristesse', icon: '😢', color: '#4A6FA8' },
  { key: 'anxiety', label: 'Anxiété', icon: '😰', color: 'var(--warning)' },
  { key: 'anger', label: 'Colère', icon: '😠', color: '#C04040' },
  { key: 'isolation', label: 'Isolement', icon: '🫥', color: '#6B4A9A' },
  { key: 'depression', label: 'Dépression', icon: '😔', color: '#3D5CA8' },
]

const MOOD_LABELS = {
  1: 'Très mal', 2: 'Mal', 3: 'Difficile', 4: 'Pas super',
  5: 'Moyen', 6: 'Correct', 7: 'Bien', 8: 'Très bien',
  9: 'Excellent', 10: 'Fantastique'
}

function groupByDate(entries) {
  const groups = {}
  entries.forEach(e => {
    const date = e.timestamp.split('T')[0]
    if (!groups[date]) groups[date] = []
    groups[date].push(e)
  })
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
}

function formatDate(isoDate) {
  const d = new Date(isoDate + 'T00:00:00')
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (isoDate === today) return "Aujourd'hui"
  if (isoDate === yesterday) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function EmotionalJournal({ showToast }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ content: '', emotion: 'neutre', mood: 5 })
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    fetch('/api/journal')
      .then(r => r.json())
      .then(d => { setEntries(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const submit = async () => {
    if (!form.content.trim()) return showToast('Écrivez quelque chose avant de sauvegarder', 'error')
    setSubmitting(true)
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (!res.ok) throw new Error()
      showToast('Entrée ajoutée', 'success')
      setForm({ content: '', emotion: 'neutre', mood: 5 })
      setShowForm(false)
      load()
    } catch {
      showToast('Erreur lors de la sauvegarde', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteEntry = async (id) => {
    if (!confirm('Supprimer cette entrée ?')) return
    await fetch(`/api/journal/${id}`, { method: 'DELETE' })
    showToast('Entrée supprimée', 'info')
    load()
  }

  const grouped = groupByDate(entries)
  const emotion = EMOTIONS.find(e => e.key === form.emotion) || EMOTIONS[0]

  return (
    <div className="journal-layout">
      <div className="page-header">
        <div>
          <div className="page-title">Journal émotionnel</div>
          <div className="page-subtitle">{entries.length} entrée{entries.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(f => !f)}>
          {showForm ? '✕ Fermer' : '+ Nouvelle entrée'}
        </button>
      </div>

      <div className="journal-content">
        {/* New entry form */}
        {showForm && (
          <div className="card new-entry-card slide-up">
            <h3 className="form-section-title">Comment vous sentez-vous ?</h3>

            {/* Mood slider */}
            <div className="form-group">
              <label className="form-label">Humeur générale</label>
              <div className="mood-slider-wrap">
                <input
                  type="range" min={1} max={10}
                  value={form.mood}
                  onChange={e => setForm(f => ({ ...f, mood: parseInt(e.target.value) }))}
                  className="mood-slider"
                />
                <div className="mood-display">
                  <span className="mood-value">{form.mood}/10</span>
                  <span className="mood-text">{MOOD_LABELS[form.mood]}</span>
                </div>
              </div>
            </div>

            {/* Emotion picker */}
            <div className="form-group">
              <label className="form-label">Émotion principale</label>
              <div className="emotion-picker">
                {EMOTIONS.map(e => (
                  <button
                    key={e.key}
                    className={`emotion-pick-btn ${form.emotion === e.key ? 'selected' : ''}`}
                    style={form.emotion === e.key ? { borderColor: e.color, color: e.color, background: `${e.color}18` } : {}}
                    onClick={() => setForm(f => ({ ...f, emotion: e.key }))}
                  >
                    <span>{e.icon}</span>
                    <span>{e.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="form-group">
              <label className="form-label">Ce que je vis / ressens</label>
              <textarea
                className="form-textarea journal-textarea"
                placeholder="Écrivez librement, sans filtre. Cet espace vous appartient…"
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={5}
              />
            </div>

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={submit} disabled={submitting}>
                {submitting ? 'Sauvegarde…' : '💾 Sauvegarder'}
              </button>
            </div>
          </div>
        )}

        {/* Entries list */}
        {loading ? (
          <div className="journal-loading">
            <div className="loading-spinner" />
          </div>
        ) : entries.length === 0 ? (
          <div className="journal-empty">
            <div className="empty-icon">📓</div>
            <h3>Votre journal est vide</h3>
            <p>Commencez à écrire pour garder une trace de votre évolution émotionnelle. Vos entrées sont privées et chiffrées.</p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              Première entrée
            </button>
          </div>
        ) : (
          <div className="entries-timeline">
            {grouped.map(([date, dayEntries]) => (
              <div key={date} className="day-group">
                <div className="day-label">{formatDate(date)}</div>
                <div className="day-entries">
                  {dayEntries.map(entry => {
                    const emo = EMOTIONS.find(e => e.key === entry.emotion) || EMOTIONS[1]
                    return (
                      <div key={entry.id} className="entry-card card fade-in">
                        <div className="entry-header">
                          <div className="entry-meta">
                            <span
                              className="entry-emotion-badge"
                              style={{ background: `${emo.color}18`, color: emo.color }}
                            >
                              {emo.icon} {emo.label}
                            </span>
                            <div className="entry-mood-bar">
                              <div
                                className="entry-mood-fill"
                                style={{
                                  width: `${entry.mood * 10}%`,
                                  background: entry.mood >= 7 ? 'var(--success)' :
                                    entry.mood >= 4 ? 'var(--warning)' : 'var(--danger)'
                                }}
                              />
                            </div>
                            <span className="entry-mood-val">{entry.mood}/10</span>
                          </div>
                          <div className="entry-actions">
                            <span className="entry-time">
                              {new Date(entry.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => deleteEntry(entry.id)}
                              title="Supprimer"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <p className="entry-content">{entry.content}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
