import { useState } from 'react';
import UrlForm from './components/UrlForm';
import ResultPanel from './components/ResultPanel';

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleScrape(url) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/scrape-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="header-title">Visionary Web Editor</h1>
        <p className="header-sub">Scrapez, visualisez et téléchargez n'importe quel site web</p>
      </header>
      <main className="main">
        <UrlForm onScrape={handleScrape} loading={loading} />
        {error && (
          <div className="error-banner">
            <span>⚠</span> {error}
          </div>
        )}
        {result && <ResultPanel result={result} />}
      </main>
    </div>
  );
}
