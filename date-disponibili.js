/**
 * Configurazione date disponibili per le visite in cantina
 * Altea Illotto - Serdiana
 * 
 * Legge le date dal file JSON locale (date-disponibili.json)
 * Per aggiornare le disponibilità, modifica il file date-disponibili.json
 */

// Cache per le date disponibili (in millisecondi)
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

// Scarica le date dal file JSON locale
async function scaricaDateDisponibili() {
    if (cacheDateDisponibili && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        return cacheDateDisponibili;
    }

    const dateDisponibili = new Map();

    try {
        // Percorso del file JSON (relativo alla root del sito)
        const jsonPath = 'date-disponibili.json';
        
        const response = await fetch(jsonPath);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const jsonData = await response.json();

        if (Array.isArray(jsonData)) {
            jsonData.forEach(item => {
                if (item && item.data) {
                    const dataStr = item.data; // formato YYYY-MM-DD
                    const disponibile = item.disponibile !== false;
                    if (disponibile) {
                        dateDisponibili.set(dataStr, true);
                    }
                }
            });
        }

        console.log('Date caricate dal file JSON. Totale disponibili:', dateDisponibili.size, Array.from(dateDisponibili.keys()));
    } catch (err) {
        console.error('Errore nel caricamento del file JSON:', err);
    }

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
