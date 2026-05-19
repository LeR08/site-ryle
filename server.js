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
app.use(express.json({ limit: '100mb' }));

function validateUrl(raw) {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    return u.href;
  } catch {
    return null;
  }
}

function guessMime(url) {
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  const map = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
    ico: 'image/x-icon', avif: 'image/avif',
    woff: 'font/woff', woff2: 'font/woff2',
    ttf: 'font/ttf', eot: 'application/vnd.ms-fontobject',
  };
  return map[ext] || 'application/octet-stream';
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
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 KHTML, like Gecko Chrome/120.0.0.0 Safari/537.36'
    );

    // ── Capture toutes les réponses images/fonts avant goto ──────────────────
    const resourcePromises = [];

    page.on('response', response => {
      const resUrl = response.url();
      const ct = (response.headers()['content-type'] || '').split(';')[0].trim();
      const isImage = ct.startsWith('image/') || /\.(png|jpe?g|gif|svg|webp|ico|avif)(\?|$)/i.test(resUrl);
      const isFont  = ct.startsWith('font/')  || ct.includes('font') ||
                      /\.(woff2?|ttf|eot|otf)(\?|$)/i.test(resUrl);

      if (!isImage && !isFont) return;

      resourcePromises.push(
        response.buffer()
          .then(buf => {
            if (buf.length > 4 * 1024 * 1024) return null; // skip >4 Mo
            const mime = ct || guessMime(resUrl);
            return { url: resUrl, dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
          })
          .catch(() => null)
      );
    });

    await page.goto(safeUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Attend le chargement des images
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise(r => { img.onload = img.onerror = r; }))
      )
    );

    // ── Récupère le HTML et résout les captures de ressources ────────────────
    const [rawHtml, title, settled] = await Promise.all([
      page.content(),
      page.title(),
      Promise.allSettled(resourcePromises),
    ]);

    // Construit le cache url → dataUrl
    const cache = new Map();
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) {
        cache.set(r.value.url, r.value.dataUrl);
      }
    }

    // ── Injecte base href + remplace les URLs par les data URLs ──────────────
    const baseTag = `<base href="${safeUrl}">`;
    let html = rawHtml.replace(/<head\b[^>]*>/i, m => m + baseTag);

    // Remplace chaque URL capturée dans le HTML (src, href, url(...))
    for (const [origUrl, dataUrl] of cache) {
      const esc = origUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(esc, 'g'), dataUrl);
    }

    const scrapedAt = new Date().toISOString();
    const metadata = { title, url: safeUrl, scrapedAt, inlinedAssets: cache.size };

    fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf-8');
    fs.writeFileSync(path.join(outputDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

    console.log(`Scraped: ${title} — ${cache.size} assets inlinés — ${(html.length / 1024).toFixed(0)} Ko`);
    res.json({ title, url: safeUrl, html, scrapedAt, files: ['index.html', 'metadata.json'] });

  } catch (err) {
    console.error('Erreur scraping:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await browser?.close();
  }
});

app.listen(PORT, () => console.log(`Backend démarré sur http://localhost:${PORT}`));
