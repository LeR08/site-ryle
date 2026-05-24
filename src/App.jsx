import { useState, useCallback } from 'react'
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

      {/* Mobile emergency FAB */}
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
