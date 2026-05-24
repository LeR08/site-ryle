import { useState, useEffect } from 'react'
import './Dashboard.css'

const EMOTION_COLORS = {
  danger: '#C9585B', severedepression: '#7B3FA6', depression: '#3D5CA8',
  anxiety: '#D98C5A', stress: '#B08A20', sadness: '#4A6FA8',
  anger: '#C04040', isolation: '#6B4A9A', positive: '#5BAD97', neutre: '#9AAFC4'
}

const EMOTION_LABELS = {
  danger: 'Danger', severedepression: 'Dépression sévère', depression: 'Dépression',
  anxiety: 'Anxiété', stress: 'Stress', sadness: 'Tristesse',
  anger: 'Colère', isolation: 'Isolement', positive: 'Positif', neutre: 'Neutre'
}

const RISK_EMOJIS = { 1: '🟢', 2: '🟡', 3: '🔴' }

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(7)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="dashboard-layout">
        <div className="page-header">
          <div>
            <div className="page-title">Évolution émotionnelle</div>
            <div className="page-subtitle">Suivez votre parcours</div>
          </div>
        </div>
        <div className="dashboard-loading">
          <div className="loading-spinner" />
          <p>Chargement des données…</p>
        </div>
      </div>
    )
  }

  if (!stats || stats.totalConversations === 0) {
    return (
      <div className="dashboard-layout">
        <div className="page-header">
          <div>
            <div className="page-title">Évolution émotionnelle</div>
            <div className="page-subtitle">Vos données apparaîtront ici</div>
          </div>
        </div>
        <div className="dashboard-empty">
          <div className="empty-icon">📊</div>
          <h3>Aucune donnée pour l'instant</h3>
          <p>Commencez à discuter avec Aria pour voir votre évolution émotionnelle apparaître ici.</p>
        </div>
      </div>
    )
  }

  const emotionEntries = Object.entries(stats.emotionCounts || {})
    .sort((a, b) => b[1] - a[1])
  const totalEmotions = emotionEntries.reduce((s, [, v]) => s + v, 0)

  const filteredDaily = (stats.dailyAverages || []).slice(-period)

  const avgRisk = filteredDaily.length > 0
    ? filteredDaily.reduce((s, d) => s + d.avgRisk, 0) / filteredDaily.length
    : 1

  const maxRiskInPeriod = filteredDaily.reduce((m, d) => Math.max(m, d.avgRisk), 1)

  return (
    <div className="dashboard-layout">
      <div className="page-header">
        <div>
          <div className="page-title">Évolution émotionnelle</div>
          <div className="page-subtitle">
            {stats.totalConversations} conversations analysées
          </div>
        </div>
        <div className="period-selector">
          {[7, 14, 30].map(p => (
            <button
              key={p}
              className={`period-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p}j
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-content">
        {/* KPI cards */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon">💬</div>
            <div className="kpi-value">{stats.totalConversations}</div>
            <div className="kpi-label">Conversations</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">{RISK_EMOJIS[Math.round(avgRisk)] || '🟢'}</div>
            <div className="kpi-value" style={{
              color: avgRisk >= 3 ? 'var(--danger)' : avgRisk >= 2 ? 'var(--warning)' : 'var(--success)'
            }}>
              {avgRisk.toFixed(1)}<small>/3</small>
            </div>
            <div className="kpi-label">Risque moyen ({period}j)</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">📓</div>
            <div className="kpi-value">{stats.recentMoods?.length || 0}</div>
            <div className="kpi-label">Entrées journal (30j)</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">
              {emotionEntries[0] ? (EMOTION_COLORS[emotionEntries[0][0]] ? '📌' : '📌') : '📌'}
            </div>
            <div className="kpi-value" style={{ fontSize: 14 }}>
              {emotionEntries[0] ? EMOTION_LABELS[emotionEntries[0][0]] || emotionEntries[0][0] : '—'}
            </div>
            <div className="kpi-label">Émotion dominante</div>
          </div>
        </div>

        <div className="dashboard-grid">
          {/* Risk timeline */}
          <div className="card dash-card">
            <h3 className="dash-card-title">Niveau de risque ({period} derniers jours)</h3>
            {filteredDaily.length === 0 ? (
              <p className="dash-empty-msg">Pas encore de données sur cette période</p>
            ) : (
              <div className="risk-chart">
                {filteredDaily.map((d, i) => {
                  const heightPct = (d.avgRisk / 3) * 100
                  const color = d.avgRisk >= 2.5 ? 'var(--danger)' :
                    d.avgRisk >= 1.5 ? 'var(--warning)' : 'var(--success)'
                  return (
                    <div key={i} className="risk-bar-wrap" title={`${d.date}\nRisque: ${d.avgRisk.toFixed(1)}`}>
                      <div className="risk-bar-col">
                        <div
                          className="risk-bar"
                          style={{ height: `${Math.max(heightPct, 8)}%`, background: color }}
                        />
                      </div>
                      <div className="risk-bar-label">
                        {d.date.split('-').slice(1).join('/')}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="risk-chart-legend">
              <span style={{ color: 'var(--success)' }}>● Faible</span>
              <span style={{ color: 'var(--warning)' }}>● Modéré</span>
              <span style={{ color: 'var(--danger)' }}>● Élevé</span>
            </div>
          </div>

          {/* Emotion distribution */}
          <div className="card dash-card">
            <h3 className="dash-card-title">Répartition des émotions</h3>
            {emotionEntries.length === 0 ? (
              <p className="dash-empty-msg">Pas encore de données</p>
            ) : (
              <div className="emotion-bars">
                {emotionEntries.slice(0, 6).map(([emotion, count]) => {
                  const pct = totalEmotions > 0 ? Math.round((count / totalEmotions) * 100) : 0
                  const color = EMOTION_COLORS[emotion] || '#9AAFC4'
                  return (
                    <div key={emotion} className="emotion-bar-row">
                      <div className="emotion-bar-label">
                        {EMOTION_LABELS[emotion] || emotion}
                      </div>
                      <div className="emotion-bar-track">
                        <div
                          className="emotion-bar-fill"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                      <div className="emotion-bar-pct" style={{ color }}>
                        {pct}%
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Journal moods */}
        {stats.recentMoods && stats.recentMoods.length > 0 && (
          <div className="card dash-card">
            <h3 className="dash-card-title">Humeur (journal, 30 derniers jours)</h3>
            <div className="mood-chart">
              {stats.recentMoods.slice(-20).map((m, i) => {
                const color = m.mood >= 7 ? 'var(--success)' :
                  m.mood >= 4 ? 'var(--warning)' : 'var(--danger)'
                return (
                  <div key={i} className="mood-dot-wrap" title={`${m.date} — Humeur: ${m.mood}/10`}>
                    <div
                      className="mood-dot"
                      style={{
                        background: color,
                        transform: `scale(${0.6 + (m.mood / 10) * 0.8})`
                      }}
                    />
                    <div className="mood-dot-label">{m.mood}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Insights */}
        <div className="card dash-card">
          <h3 className="dash-card-title">Insights</h3>
          <div className="insights-list">
            {avgRisk < 1.5 && (
              <div className="insight insight-positive">
                ✨ Votre niveau de risque est faible sur cette période. Continuez à prendre soin de vous.
              </div>
            )}
            {avgRisk >= 1.5 && avgRisk < 2.5 && (
              <div className="insight insight-warning">
                💛 Des émotions difficiles ont été détectées. Penser à consulter un professionnel peut être utile.
              </div>
            )}
            {avgRisk >= 2.5 && (
              <div className="insight insight-danger">
                🔴 Des signaux préoccupants ont été détectés. Parlez à un professionnel de santé. <strong>3114</strong> si besoin urgent.
              </div>
            )}
            {stats.totalConversations > 10 && (
              <div className="insight insight-info">
                📈 Vous avez eu {stats.totalConversations} conversations avec Aria. La régularité du suivi est bénéfique.
              </div>
            )}
            {emotionEntries[0]?.[0] === 'positive' && (
              <div className="insight insight-positive">
                😊 L'émotion dominante de vos échanges est positive. Belle progression !
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
