import { useState, useCallback, useEffect } from 'react'
import ChatInterface from './components/Chat/ChatInterface'
import Dashboard from './components/Dashboard/Dashboard'
import EmotionalJournal from './components/Journal/EmotionalJournal'
import Settings from './components/Settings/Settings'
import MemoryPanel from './components/Memory/MemoryPanel'
import EmergencyModal from './components/Emergency/EmergencyModal'

const NAV_ITEMS = [
  { id: 'chat', label: 'Discussion', icon: '💬' },
  { id: 'journal', label: 'Journal', icon: '📓' },
  { id: 'dashboard', label: 'Évolution', icon: '📊' },
  { id: 'memory', label: 'Mémoire', icon: '🧠' },
  { id: 'settings', label: 'Paramètres', icon: '⚙️' },
]

export default function App() {
  const [page, setPage] = useState('chat')
  const [showEmergency, setShowEmergency] = useState(false)
  const [toasts, setToasts] = useState([])
  const [isDiscrete, setIsDiscrete] = useState(false)

  // Raccourci clavier : Ctrl+Shift+D → mode discret | Échap → quitter
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setIsDiscrete(d => !d)
      }
      if (e.key === 'Escape') setIsDiscrete(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const pageComponents = {
    chat: <ChatInterface onEmergency={() => setShowEmergency(true)} showToast={showToast} />,
    journal: <EmotionalJournal showToast={showToast} />,
    dashboard: <Dashboard />,
    memory: <MemoryPanel showToast={showToast} />,
    settings: <Settings showToast={showToast} />,
  }

  // Mode discret : remplace l'app par une fausse interface "Notes"
  if (isDiscrete) {
    return <DiscreteMode onExit={() => setIsDiscrete(false)} />
  }

  return (
    <div className="app-layout">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🌿</div>
          <div className="sidebar-logo-text"><span>Aria</span></div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-emergency">
          <button
            className="btn-discrete-sidebar"
            onClick={() => setIsDiscrete(true)}
            title="Mode discret (Ctrl+Shift+D)"
          >
            🫥 Mode discret
          </button>
          <button className="btn-emergency-sidebar" onClick={() => setShowEmergency(true)}>
            🆘 Urgence
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {pageComponents[page]}
      </main>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <div className="mobile-nav-inner">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`mobile-nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Mobile discrete + emergency FABs */}
      <button
        className="discrete-fab"
        onClick={() => setIsDiscrete(true)}
        title="Mode discret (Ctrl+Shift+D)"
      >
        🫥
      </button>
      <button className="emergency-fab" onClick={() => setShowEmergency(true)} title="Urgence">
        🆘
      </button>

      {/* Emergency modal */}
      {showEmergency && (
        <EmergencyModal onClose={() => setShowEmergency(false)} showToast={showToast} />
      )}

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
        ))}
      </div>
    </div>
  )
}

// ── Mode discret — fausse interface "Notes" ───────────────────────────────────
function DiscreteMode({ onExit }) {
  const [note, setNote] = useState('')
  const lines = [
    'Réunion lundi 9h — préparer les slides',
    'Rappeler dentiste pour RDV',
    'Acheter : lait, pain, tomates, pâtes',
    'Lire chapitre 3 avant jeudi',
  ]

  return (
    <div className="discrete-overlay" onClick={e => e.stopPropagation()}>
      <div className="discrete-app">
        <div className="discrete-toolbar">
          <div className="discrete-title">📝 Notes</div>
          <div className="discrete-toolbar-actions">
            <button className="discrete-btn">Nouveau</button>
            <button className="discrete-btn">Partager</button>
            <button className="discrete-btn discrete-btn-back" onClick={onExit} title="Appuyer sur Échap pour revenir">
              Retour
            </button>
          </div>
        </div>
        <div className="discrete-body">
          <div className="discrete-sidebar">
            <div className="discrete-note-item active">
              <div className="discrete-note-title">Ma liste</div>
              <div className="discrete-note-preview">Réunion lundi 9h…</div>
            </div>
            <div className="discrete-note-item">
              <div className="discrete-note-title">Idées projet</div>
              <div className="discrete-note-preview">Améliorer le site…</div>
            </div>
            <div className="discrete-note-item">
              <div className="discrete-note-title">Recettes</div>
              <div className="discrete-note-preview">Quiche lorraine…</div>
            </div>
          </div>
          <div className="discrete-editor">
            <div className="discrete-editor-header">Ma liste</div>
            <textarea
              className="discrete-textarea"
              value={note || lines.join('\n')}
              onChange={e => setNote(e.target.value)}
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
