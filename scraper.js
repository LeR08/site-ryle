import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔧 CONFIGURATION
const url = 'https://example.com'; // 👈 Remplace par ton URL
const outputDir = './mon-site-importé';

// 🚀 FONCTION PRINCIPALE
async function scrapeSite(targetUrl, outputFolder) {
  try {
    // 1. Crée le dossier de sortie s'il n'existe pas
    const fullPath = path.resolve(outputFolder);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Dossier créé : ${fullPath}`);
    }

    // 2. Lance le navigateur
    console.log(`🚀 Démarrage du scraping : ${targetUrl}`);
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // 3. Navigue vers l'URL
    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 4. Récupère le contenu
    const html = await page.content();
    const title = await page.title();

    // 5. Sauvegarde le HTML
    fs.writeFileSync(path.join(fullPath, 'index.html'), html, 'utf-8');
    console.log(`✅ HTML sauvegardé`);

    // 6. Sauvegarde les métadonnées
    const metadata = {
      title,
      url: targetUrl,
      scrapedAt: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(fullPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );
    console.log(`✅ Métadonnées sauvegardées`);

    await browser.close();
    console.log(`🎉 Scraping terminé ! Fichiers dans : ${fullPath}`);

    return metadata;

  } catch (err) {
    console.error(`❌ Erreur pendant le scraping :`, err.message);
    throw err;
  }
}

// Lancement
scrapeSite(url, outputDir);
