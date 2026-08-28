/**
 * Configurazione date disponibili per le visite in cantina
 * Altea Illotto - Serdiana
 * 
 * Legge le date dall'API Google Apps Script (deployment web)
 * con fallback al file JSON locale (date-disponibili.json)
 * 
 * ISTRUZIONI:
 * 1. Apri il foglio Google Sheets
 * 2. Estensioni > Apps Script
 * 3. Incolla lo script fornito
 * 4. Esegui il deployment > Nuova distribuzione > App web
 *    - Esegui come: Me
 *    - Chi può accedere: Chiunque
 * 5. Copia l'URL del deployment qui sotto
 */

// ============================================================
// INCOLLA QUI L'URL DEL TUO APPS SCRIPT DEPLOYMENT:
const APPS_SCRIPT_URL = '';
// Esempio: 'https://script.google.com/macros/s/AKfycbw.../exec'
// ============================================================

// Cache
let cacheDateDisponibili = null;
let cacheTimestamp = null;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minuti

// Converte un oggetto Date locale nel formato "YYYY-MM-DD"
function formattaDataYYYYMMDD(data) {
    if (!data || !(data instanceof Date) || isNaN(data.getTime())) return null;
    const anno = data.getFullYear();
    const mese = String(data.getMonth() + 1).padStart(2, '0');
    const giorno = String(data.getDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
}

// Scarica le date dall'Apps Script o dal JSON locale
async function scaricaDateDisponibili() {
    if (cacheDateDisponibili && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        return cacheDateDisponibili;
    }

    const dateDisponibili = new Map();
    let jsonData = null;

    // 1. Prova dall'Apps Script
    if (APPS_SCRIPT_URL && APPS_SCRIPT_URL.trim() !== '') {
        try {
            const response = await fetch(APPS_SCRIPT_URL);
            if (response.ok) {
                jsonData = await response.json();
                console.log('Date caricate da Google Apps Script');
            }
        } catch (err) {
            console.warn('Apps Script non raggiungibile, provo fallback JSON locale:', err.message);
        }
    }

    // 2. Fallback: file JSON locale
    if (!jsonData) {
        try {
            const response = await fetch('date-disponibili.json');
            if (response.ok) {
                jsonData = await response.json();
                console.log('Date caricate dal file JSON locale (fallback)');
            }
        } catch (err) {
            console.error('Errore nel caricamento del JSON locale:', err);
        }
    }

    // 3. Popola la mappa
    if (jsonData && Array.isArray(jsonData)) {
        jsonData.forEach(item => {
            if (item && item.data) {
                if (item.disponibile !== false) {
                    dateDisponibili.set(item.data, true);
                }
            }
        });
    }

    console.log('Date disponibili totali:', dateDisponibili.size, Array.from(dateDisponibili.keys()));

    cacheDateDisponibili = dateDisponibili;
    cacheTimestamp = Date.now();
    return dateDisponibili;
}

// Verifica se una data è disponibile
function isDataDisponibileSync(data) {
    if (!cacheDateDisponibili) return false;

    const dataStr = formattaDataYYYYMMDD(data);
    if (!dataStr) return false;

    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    // Non permette date nel passato
    if (data < oggi) return false;

    return cacheDateDisponibili.has(dataStr);
}

// Ottiene le date disponibili in un mese
async function getDateDisponibiliMese(anno, mese) {
    const dateDisponibili = [];
    const ultimoGiorno = new Date(anno, mese + 1, 0).getDate();

    for (let giorno = 1; giorno <= ultimoGiorno; giorno++) {
        const data = new Date(anno, mese, giorno);
        if (isDataDisponibileSync(data)) {
            dateDisponibili.push(giorno);
        }
    }

    return dateDisponibili;
}

// Inizializza all'avvio
document.addEventListener('DOMContentLoaded', () => {
    scaricaDateDisponibili().then(() => {
        console.log('Date disponibili pronte');
    });
});
