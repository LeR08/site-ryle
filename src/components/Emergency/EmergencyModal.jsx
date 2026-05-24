import { useState, useEffect } from 'react'
import './EmergencyModal.css'

const HOTLINES = [
  { num: '15', label: 'SAMU', desc: 'Urgences médicales', color: '#C9585B' },
  { num: '17', label: 'Police', desc: 'Violence, danger immédiat', color: '#3D5CA8' },
  { num: '18', label: 'Pompiers', desc: 'Urgences physiques', color: '#C04040' },
  { num: '3114', label: 'Prévention suicide', desc: '24h/24 — Gratuit — Confidentiel', color: '#7B3FA6' },
  { num: '3119', label: 'Violences femmes info', desc: '24h/24', color: '#8E4A8E' },
]

export default function EmergencyModal({ onClose, showToast }) {
  const [contacts, setContacts] = useState([])
  const [alertSent, setAlertSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [step, setStep] = useState('main') // main | breathing | contacts

  useEffect(() => {
    fetch('/api/contacts')
      .then(r => r.json())
      .then(d => setContacts(d.filter(c => c.isEmergency)))
      .catch(() => {})
  }, [])

  const triggerAlert = async () => {
    setSending(true)
    try {
      await fetch('/api/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'user_triggered',
          contacts,
          message: 'Alerte d\'urgence déclenchée manuellement par l\'utilisateur.'
        })
      })
      setAlertSent(true)
      showToast('Alerte enregistrée', 'success')
    } catch {
      showToast('Erreur lors de l\'alerte', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal emergency-modal">
        <div className="emergency-modal-header">
          <div className="emergency-modal-icon">🆘</div>
          <div>
            <div className="modal-title">Situation d'urgence</div>
            <p className="emergency-modal-sub">Vous n'êtes pas seul(e). De l'aide existe.</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ marginLeft: 'auto' }}>✕</button>
        </div>

        {step === 'main' && (
          <>
            {/* Breathing exercise prompt */}
            <div className="breathing-prompt" onClick={() => setStep('breathing')}>
              <span>🌬️</span>
              <div>
                <strong>Exercice de respiration guidée</strong>
                <p>Cliquez pour vous calmer en 2 minutes</p>
              </div>
              <span className="prompt-arrow">→</span>
            </div>

            {/* Hotlines */}
            <div className="emergency-section">
              <div className="emergency-section-title">Appeler maintenant</div>
              <div className="hotlines-grid">
                {HOTLINES.map(h => (
                  <a key={h.num} href={`tel:${h.num}`} className="hotline-card">
                    <div className="hotline-num" style={{ color: h.color }}>
                      {h.num}
                    </div>
                    <div className="hotline-info">
                      <div className="hotline-label">{h.label}</div>
                      <div className="hotline-desc">{h.desc}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Personal contacts */}
            {contacts.length > 0 && (
              <div className="emergency-section">
                <div className="emergency-section-title">Vos contacts de confiance</div>
                <div className="emergency-contacts-list">
                  {contacts.map(c => (
                    <a key={c.id} href={`tel:${c.phone}`} className="emergency-contact-item">
                      <div className="contact-avatar-em">{c.name.charAt(0)}</div>
                      <div>
                        <div className="ec-name">{c.name}</div>
                        <div className="ec-phone">{c.phone} · {c.relation}</div>
                      </div>
                      <span className="ec-call">📞 Appeler</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Alert button */}
            {contacts.length > 0 && !alertSent && (
              <button
                className="btn btn-danger w-full alert-all-btn"
                onClick={triggerAlert}
                disabled={sending}
              >
                {sending ? 'Envoi en cours…' : '🔔 Alerter tous mes contacts d\'urgence'}
              </button>
            )}

            {alertSent && (
              <div className="alert-sent-banner">
                ✅ Alerte envoyée à vos contacts de confiance.
              </div>
            )}

            <p className="emergency-legal">
              Aria n'est pas un service d'urgence. En cas de danger immédiat, appelez le <strong>15</strong>, <strong>17</strong> ou <strong>18</strong>.
            </p>
          </>
        )}

        {step === 'breathing' && (
          <BreathingExercise onBack={() => setStep('main')} />
        )}
      </div>
    </div>
  )
}

function BreathingExercise({ onBack }) {
  const [phase, setPhase] = useState(0)
  const [count, setCount] = useState(4)
  const [cycles, setCycles] = useState(0)
  const [running, setRunning] = useState(false)

  const PHASES = [
    { label: 'Inspirez', duration: 4, color: 'var(--primary)', scale: 1.3 },
    { label: 'Retenez', duration: 4, color: 'var(--secondary)', scale: 1.3 },
    { label: 'Expirez', duration: 4, color: 'var(--success)', scale: 0.7 },
    { label: 'Retenez', duration: 4, color: 'var(--text-muted)', scale: 0.7 },
  ]

  useEffect(() => {
    if (!running) return
    const p = PHASES[phase]
    setCount(p.duration)

    const interval = setInterval(() => {
      setCount(c => {
        if (c <= 1) {
          clearInterval(interval)
          const nextPhase = (phase + 1) % 4
          setPhase(nextPhase)
          if (nextPhase === 0) setCycles(c => c + 1)
          return p.duration
        }
        return c - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [running, phase])

  const current = PHASES[phase]

  return (
    <div className="breathing-exercise">
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        ← Retour
      </button>

      <div className="breathing-title">Respiration carrée (4-4-4-4)</div>
      <p className="breathing-desc">Inspirez, retenez, expirez, retenez — 4 secondes chacun. Répétez 4 fois.</p>

      <div className="breathing-circle-wrap">
        <div
          className="breathing-circle"
          style={{
            borderColor: current.color,
            transform: running ? `scale(${current.scale})` : 'scale(1)',
            transition: `transform ${current.duration}s ease, border-color 0.5s`
          }}
        >
          <div className="breathing-phase" style={{ color: current.color }}>{current.label}</div>
          <div className="breathing-count">{count}</div>
        </div>
      </div>

      <div className="breathing-cycles">
        Cycles : {cycles} / 4
        <div className="cycles-dots">
          {[0,1,2,3].map(i => (
            <div key={i} className={`cycle-dot ${i < cycles ? 'done' : ''}`} />
          ))}
        </div>
      </div>

      {!running ? (
        <button className="btn btn-primary" onClick={() => setRunning(true)}>
          ▶ Commencer l'exercice
        </button>
      ) : cycles >= 4 ? (
        <div className="breathing-done">
          ✨ Excellent ! Vous avez complété 4 cycles. Comment vous sentez-vous ?
        </div>
      ) : (
        <button className="btn btn-secondary" onClick={() => { setRunning(false); setPhase(0); setCount(4); setCycles(0) }}>
          ⏹ Arrêter
        </button>
      )}
    </div>
  )
}
