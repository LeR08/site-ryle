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
app.use(express.json());

app.post('/api/scrape-site', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL manquante' });

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'URL invalide' });
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: 'Protocole non autorisé' });
  }

  const outputDir = path.join(__dirname, 'scraped-sites');
  fs.mkdirSync(outputDir, { recursive: true });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const [html, title] = await Promise.all([page.content(), page.title()]);

    fs.writeFileSync(path.join(outputDir, 'index.html'), html);
    fs.writeFileSync(
      path.join(outputDir, 'metadata.json'),
      JSON.stringify({ title, url }, null, 2)
    );

    res.json({
      title,
      url,
      preview: html.substring(0, 500) + '...',
      files: ['index.html', 'metadata.json'],
    });
  } catch (err) {
    console.error('Erreur Puppeteer:', err);
    res.status(500).json({ error: err.message });
  } finally {
    await browser?.close();
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend démarré sur http://localhost:${PORT}`);
});
