#!/usr/bin/env node
/**
 * Script per generare automaticamente slides.json
 * Esegui con: node generate-slides-json.js
 * Puoi aggiungerlo come "predeploy" nel package.json o eseguirlo manualmente
 */

const fs = require('fs');
const path = require('path');

const SLIDES_DIR = path.join(__dirname, 'slides');
const OUTPUT_FILE = path.join(SLIDES_DIR, 'slides.json');

// Estensioni immagini supportate
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

function generateSlidesJson() {
  try {
    // Leggi tutti i file nella cartella slides
    const files = fs.readdirSync(SLIDES_DIR);
    
    // Filtra solo i file immagine
    const images = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return IMAGE_EXTENSIONS.includes(ext);
      })
      .sort((a, b) => a.localeCompare(b)); // Ordine alfabetico
    
    if (images.length === 0) {
      console.log('⚠️  Nessuna immagine trovata in slides/');
      return;
    }
    
    // Scrivi il file JSON
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(images, null, 2));
    
    console.log(`✅ Generato ${OUTPUT_FILE} con ${images.length} immagini:`);
    images.forEach(img => console.log(`   - ${img}`));
    
  } catch (error) {
    console.error('❌ Errore durante la generazione:', error.message);
    process.exit(1);
  }
}

generateSlidesJson();