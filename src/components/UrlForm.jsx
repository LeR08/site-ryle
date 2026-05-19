import { useState } from 'react';

export default function UrlForm({ onScrape, loading }) {
  const [url, setUrl] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) onScrape(trimmed);
  }

  return (
    <form className="url-form" onSubmit={handleSubmit}>
      <input
        className="url-input"
        type="url"
        placeholder="https://example.com"
        value={url}
        onChange={e => setUrl(e.target.value)}
        disabled={loading}
        required
        autoFocus
      />
      <button className="btn" type="submit" disabled={loading || !url.trim()}>
        {loading ? <span className="spinner" /> : null}
        {loading ? 'Scraping…' : 'Scraper'}
      </button>
    </form>
  );
}
