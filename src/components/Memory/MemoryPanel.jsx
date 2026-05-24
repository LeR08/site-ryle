import { useState, useEffect } from 'react'
import './MemoryPanel.css'

const EMOTION_LABELS = {
  danger: 'Danger', severedepression: 'Dépression sévère', depression: 'Dépression',
  anxiety: 'Anxiété', stress: 'Stress', sadness: 'Tristesse',
  anger: 'Colère', isolation: 'Isolement', positive: 'Positif', neutre: 'Neutre'
}

export default function MemoryPanel({ showToast }) {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showConfirmClear, setShowConfirmClear] = useState(false)

  const load = () => {
    fetch('/api/memory')
      .then(r => r.json())
      .then(d => { setMemories(d.reverse()); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const addMemory = async () => {
    if (!newContent.trim()) return showToast('Écrivez quelque chose', 'error')
    setSubmitting(true)
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent })
      })
      if (!res.ok) throw new Error()
      showToast('Souvenir ajouté', 'success')
      setNewContent('')
      setShowAdd(false)
      load()
    } catch {
      showToast('Erreur lors de l\'ajout', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteMemory = async (id) => {
    await fetch(`/api/memory/${id}`, { method: 'DELETE' })
    showToast('Souvenir supprimé', 'info')
    load()
  }

  const clearAll = async () => {
    await fetch('/api/memory', { method: 'DELETE' })
    showToast('Mémoire effacée', 'success')
    setShowConfirmClear(false)
    load()
  }

  const autoMemories = memories.filter(m => m.auto)
  const manualMemories = memories.filter(m => m.manual)

  return (
    <div className="memory-layout">
      <div className="page-header">
        <div>
          <div className="page-title">Mémoire d'Aria</div>
          <div className="page-subtitle">
            {memories.length} souvenir{memories.length !== 1 ? 's' : ''} — Ce qu'Aria retient de vous
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(f => !f)}>
            + Ajouter
          </button>
          {memories.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={() => setShowConfirmClear(true)}>
              🗑️ Tout effacer
            </button>
          )}
        </div>
      </div>

      <div className="memory-content">
        {/* Info banner */}
        <div className="memory-info-banner">
          <span>🧠</span>
          <div>
            <strong>Comment fonctionne la mémoire ?</strong>
            <p>Aria mémorise automatiquement des éléments importants de vos échanges pour personnaliser son accompagnement. Vous pouvez supprimer n'importe quel souvenir à tout moment.</p>
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="card slide-up">
            <div className="form-group">
              <label className="form-label">Ajouter un souvenir manuellement</label>
              <textarea
                className="form-textarea"
                placeholder="Ex: Je travaille comme infirmier, j'ai un chien nommé Max, je fais du yoga le soir…"
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                rows={3}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={addMemory} disabled={submitting}>
                {submitting ? 'Ajout…' : 'Ajouter'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="memory-loading">
            <div className="loading-spinner" />
          </div>
        ) : memories.length === 0 ? (
          <div className="memory-empty">
            <div className="empty-icon">🧠</div>
            <h3>Aria ne se souvient de rien pour l'instant</h3>
            <p>Au fil de vos conversations, Aria mémorisera des éléments importants pour mieux vous accompagner. Vous pouvez aussi ajouter des souvenirs manuellement.</p>
          </div>
        ) : (
          <>
            {manualMemories.length > 0 && (
              <div className="memory-section">
                <h3 className="memory-section-title">
                  ✏️ Ajoutés manuellement
                  <span className="memory-count">{manualMemories.length}</span>
                </h3>
                <div className="memories-grid">
                  {manualMemories.map(m => (
                    <MemoryCard key={m.id} memory={m} onDelete={deleteMemory} />
                  ))}
                </div>
              </div>
            )}

            {autoMemories.length > 0 && (
              <div className="memory-section">
                <h3 className="memory-section-title">
                  🤖 Mémorisés automatiquement
                  <span className="memory-count">{autoMemories.length}</span>
                </h3>
                <div className="memories-grid">
                  {autoMemories.map(m => (
                    <MemoryCard key={m.id} memory={m} onDelete={deleteMemory} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showConfirmClear && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span style={{ fontSize: 28 }}>🧠</span>
              <div className="modal-title">Effacer toute la mémoire ?</div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
              Aria oubliera tout ce qu'elle sait sur vous. Vos futures conversations repartiront de zéro. Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setShowConfirmClear(false)}>Annuler</button>
              <button className="btn btn-danger" onClick={clearAll}>Effacer la mémoire</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MemoryCard({ memory, onDelete }) {
  const emotionLabel = EMOTION_LABELS[memory.emotion] || memory.emotion
  const riskColors = {
    1: 'var(--success)', 2: 'var(--warning)', 3: 'var(--danger)'
  }

  return (
    <div className="memory-card card fade-in">
      <div className="memory-card-header">
        <div className="memory-card-meta">
          {memory.emotion && memory.emotion !== 'neutre' && (
            <span className="memory-emotion-tag">{emotionLabel}</span>
          )}
          {memory.riskLevel && memory.riskLevel > 1 && (
            <span
              className="memory-risk-tag"
              style={{ color: riskColors[memory.riskLevel], background: `${riskColors[memory.riskLevel]}18` }}
            >
              Risque {memory.riskLevel}
            </span>
          )}
        </div>
        <button
          className="btn btn-ghost btn-sm memory-delete"
          onClick={() => onDelete(memory.id)}
          title="Supprimer ce souvenir"
        >
          ✕
        </button>
      </div>
      <p className="memory-content">{memory.content}</p>
      <div className="memory-date">
        {new Date(memory.timestamp).toLocaleDateString('fr-FR', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })}
      </div>
    </div>
  )
}
