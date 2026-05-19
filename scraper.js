import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Usage: node scraper.js <url> [dossier-sortie]
const TARGET_URL = process.argv[2] || 'https://example.com';
const OUTPUT_DIR = process.argv[3] || './scraped-output';

async function scrapeSite(targetUrl, outputFolder) {
  try {
    new URL(targetUrl);
  } catch {
    throw new Error(`URL invalide : ${targetUrl}`);
  }

  const fullPath = path.resolve(outputFolder);
  fs.mkdirSync(fullPath, { recursive: true });

  console.log(`Scraping : ${targetUrl}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
    );
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const [html, title] = await Promise.all([page.content(), page.title()]);
    const scrapedAt = new Date().toISOString();

    fs.writeFileSync(path.join(fullPath, 'index.html'), html, 'utf-8');
    fs.writeFileSync(
      path.join(fullPath, 'metadata.json'),
      JSON.stringify({ title, url: targetUrl, scrapedAt }, null, 2),
      'utf-8'
    );

    console.log(`Titre   : ${title}`);
    console.log(`Taille  : ${(html.length / 1024).toFixed(1)} Ko`);
    console.log(`Sortie  : ${fullPath}`);

    return { title, url: targetUrl, scrapedAt };
  } finally {
    await browser?.close();
  }
}

scrapeSite(TARGET_URL, OUTPUT_DIR).catch(err => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
