import { useState } from 'react';
import UrlForm from './components/UrlForm';
import FolderImport from './components/FolderImport';
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

  function handleFolder(data) {
    setError(null);
    setResult(data);
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="header-title">Visionary Web Editor</h1>
        <p className="header-sub">Scrapez ou importez un site, visualisez-le et téléchargez-le</p>
      </header>

      <main className="main">
        <div className="panels">
          <section className="panel">
            <h2 className="panel-title">📁 Importer un dossier</h2>
            <FolderImport onResult={handleFolder} />
          </section>

          <div className="divider"><span>ou</span></div>

          <section className="panel">
            <h2 className="panel-title">🌍 Scraper un site</h2>
            <UrlForm onScrape={handleScrape} loading={loading} />
          </section>
        </div>

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
