import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const url = 'https://example.com';
const outputDir = './mon-site-importé';

async function scrapeSite(targetUrl, outputFolder) {
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    throw new Error(`URL invalide : ${targetUrl}`);
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Protocole non autorisé');
  }

  const fullPath = path.resolve(outputFolder);
  fs.mkdirSync(fullPath, { recursive: true });
  console.log(`📁 Dossier prêt : ${fullPath}`);

  console.log(`🚀 Démarrage du scraping : ${targetUrl}`);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const [html, title] = await Promise.all([page.content(), page.title()]);

    fs.writeFileSync(path.join(fullPath, 'index.html'), html, 'utf-8');
    console.log('✅ HTML sauvegardé');

    const metadata = { title, url: targetUrl, scrapedAt: new Date().toISOString() };
    fs.writeFileSync(
      path.join(fullPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );
    console.log('✅ Métadonnées sauvegardées');

    console.log(`🎉 Scraping terminé ! Fichiers dans : ${fullPath}`);
    return metadata;
  } catch (err) {
    console.error('❌ Erreur pendant le scraping :', err.message);
    throw err;
  } finally {
    await browser?.close();
  }
}

scrapeSite(url, outputDir);
