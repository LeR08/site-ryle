import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Route pour scraper un site
app.post('/api/scrape-site', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL manquante" });

  try {
    const outputDir = path.join(__dirname, 'scraped-sites');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    // ✅ Puppeteer utilise son propre Chromium intégré
    const browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const html = await page.content();
    const title = await page.title();
    await browser.close();

    // Sauvegarde les fichiers
    fs.writeFileSync(path.join(outputDir, 'index.html'), html);
    fs.writeFileSync(
      path.join(outputDir, 'metadata.json'),
      JSON.stringify({ title, url })
    );

    res.json({
      title,
      url,
      preview: html.substring(0, 500) + '...',
      files: ['index.html', 'metadata.json']
    });

  } catch (err) {
    console.error("Erreur Puppeteer:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend démarré sur http://localhost:${PORT}`);
});
