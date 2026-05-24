import { useState, useRef, useEffect, useCallback } from 'react'
import './ChatInterface.css'

const EMOTION_ICONS = {
  danger: '🆘', severedepression: '🌑', depression: '😔',
  anxiety: '😰', stress: '😤', sadness: '😢',
  anger: '😠', isolation: '🫥', positive: '😊', neutre: '😐'
}

const RISK_CONFIG = {
  1: { label: 'Bien', color: 'var(--success)', bg: 'var(--success-bg)' },
  2: { label: 'Attention', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  3: { label: 'Urgent', color: 'var(--danger)', bg: 'var(--danger-bg)' }
}

const WELCOME_MSG = {
  id: 0,
  role: 'assistant',
  content: `Bonjour, je suis **Aria**, votre assistant d'accompagnement bienveillant. 🌿

Je suis là pour vous écouter, sans jugement, à n'importe quelle heure du jour ou de la nuit.

Comment vous sentez-vous aujourd'hui ?`,
  timestamp: new Date().toISOString()
}

export default function ChatInterface({ onEmergency, showToast }) {
  const [messages, setMessages] = useState([WELCOME_MSG])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentEmotion, setCurrentEmotion] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [apiError, setApiError] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const buildConversationHistory = useCallback(() => {
    return messages
      .filter(m => m.id !== 0)
      .map(m => ({ role: m.role, content: m.content }))
  }, [messages])

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    setApiError(null)
    setSuggestions([])
    setShowSuggestions(false)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          conversationHistory: buildConversationHistory()
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur serveur')
      }

      const aiMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        emotion: data.emotion
      }

      setMessages(prev => [...prev, aiMsg])
      setCurrentEmotion(data.emotion)

      if (data.suggestions?.length > 0) {
        setSuggestions(data.suggestions)
        setShowSuggestions(true)
      }

      if (data.requiresEmergency) {
        setTimeout(() => onEmergency(), 500)
      }
    } catch (err) {
      setApiError(err.message)
      const errMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: err.message.includes('API_KEY')
          ? '⚠️ Le service n\'est pas encore configuré. Veuillez définir votre clé API Anthropic dans les variables d\'environnement.'
          : '⚠️ Je rencontre une difficulté technique. Veuillez réessayer dans quelques instants.',
        timestamp: new Date().toISOString(),
        isError: true
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }, [isLoading, buildConversationHistory, onEmergency])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearConversation = () => {
    setMessages([WELCOME_MSG])
    setCurrentEmotion(null)
    setSuggestions([])
    setShowSuggestions(false)
    setApiError(null)
  }

  const formatContent = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />')
  }

  const emotionKey = currentEmotion?.dominantEmotion?.toLowerCase() || 'neutre'
  const riskLevel = currentEmotion?.riskLevel || 1

  return (
    <div className="chat-layout">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="aria-avatar">🌿</div>
          <div>
            <div className="chat-header-name">Aria</div>
            <div className="chat-header-status">
              <span className="status-dot" />
              Disponible · Confidentiel
            </div>
          </div>
        </div>

        <div className="chat-header-actions">
          {currentEmotion && (
            <div className="current-emotion-badge" style={{
              background: RISK_CONFIG[riskLevel].bg,
              color: RISK_CONFIG[riskLevel].color
            }}>
              {EMOTION_ICONS[emotionKey] || '😐'} {currentEmotion.dominantLabel}
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={clearConversation} title="Nouvelle conversation">
            🔄
          </button>
        </div>
      </div>

      {/* Risk banner level 2 */}
      {riskLevel === 2 && (
        <div className="risk-banner risk-banner-2">
          💛 Je suis là pour vous. Si vous avez besoin d'aide immédiate, n'hésitez pas à appeler le <strong>3114</strong> (numéro prévention suicide, gratuit 24h/24).
        </div>
      )}

      {/* Risk banner level 3 */}
      {riskLevel === 3 && (
        <div className="risk-banner risk-banner-3">
          🆘 <strong>Situation d'urgence détectée.</strong> Appelez le <strong>15 (SAMU)</strong> ou le <strong>3114</strong> maintenant.
          <button className="btn btn-danger btn-sm" style={{ marginLeft: 12 }} onClick={onEmergency}>
            Contacts d'urgence
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="messages-list">
        {messages.map(msg => (
          <div key={msg.id} className={`message-row ${msg.role === 'user' ? 'user' : 'assistant'}`}>
            {msg.role === 'assistant' && (
              <div className="msg-avatar">🌿</div>
            )}
            <div className={`message-bubble ${msg.role} ${msg.isError ? 'error' : ''}`}>
              {msg.role === 'assistant' ? (
                <div
                  className="msg-content"
                  dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                />
              ) : (
                <div className="msg-content">{msg.content}</div>
              )}
              <div className="msg-meta">
                <span className="msg-time">
                  {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.emotion && msg.emotion.dominantEmotion !== 'neutre' && (
                  <span className="msg-emotion">
                    {EMOTION_ICONS[msg.emotion.dominantEmotion?.toLowerCase()] || ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message-row assistant">
            <div className="msg-avatar">🌿</div>
            <div className="message-bubble assistant">
              <div className="typing-indicator">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="suggestions-panel">
          <div className="suggestions-header">
            <span>Suggestions pour vous</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowSuggestions(false)}>✕</button>
          </div>
          <div className="suggestions-list">
            {suggestions.map((s, i) => (
              <div key={i} className={`suggestion-item suggestion-${s.type}`}>
                <span className="suggestion-icon">{s.icon}</span>
                <span>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-inner">
          <textarea
            ref={inputRef}
            className="chat-textarea"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrivez ce que vous ressentez… (Entrée pour envoyer)"
            rows={1}
            disabled={isLoading}
          />
          <button
            className="send-btn"
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            title="Envoyer"
          >
            {isLoading ? '…' : '➤'}
          </button>
        </div>
        <div className="chat-input-hint">
          Confidentiel · Aria n'est pas un médecin · En cas d'urgence : <strong>15</strong> ou <strong>3114</strong>
        </div>
      </div>
    </div>
  )
}
