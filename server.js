import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

function validateUrl(raw) {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    return u.href;
  } catch {
    return null;
  }
}

// Injecte <base href> pour que toutes les URLs relatives fonctionnent dans l'iframe
function injectBaseHref(html, baseUrl) {
  const baseTag = `<base href="${baseUrl}">`;
  if (/<head\b/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, m => m + baseTag);
  }
  return baseTag + html;
}

app.post('/api/scrape-site', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL manquante' });

  const safeUrl = validateUrl(url);
  if (!safeUrl) return res.status(400).json({ error: 'URL invalide (http/https uniquement)' });

  const outputDir = path.join(__dirname, 'scraped-sites');
  fs.mkdirSync(outputDir, { recursive: true });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      'KHTML, like Gecko Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(safeUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Attend que les images soient chargées
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise(resolve => { img.onload = img.onerror = resolve; }))
      )
    );

    const [rawHtml, title] = await Promise.all([page.content(), page.title()]);
    const scrapedAt = new Date().toISOString();

    // Injecte <base href> : toutes les images/CSS/fonts chargent depuis l'origine
    const html = injectBaseHref(rawHtml, safeUrl);

    const metadata = { title, url: safeUrl, scrapedAt };
    fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf-8');
    fs.writeFileSync(
      path.join(outputDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    res.json({ title, url: safeUrl, html, scrapedAt, files: ['index.html', 'metadata.json'] });
  } catch (err) {
    console.error('Erreur scraping:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await browser?.close();
  }
});

app.listen(PORT, () => {
  console.log(`Backend démarré sur http://localhost:${PORT}`);
});
