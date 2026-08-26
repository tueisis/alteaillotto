/**
 * Configurazione date disponibili per le visite in cantina
 * Altea Illotto - Serdiana
 * 
 * Le date vengono lette da un file JSON nel repository GitHub
 * Per modificare le date, edita il file date-disponibili.json
 */

// URL del file JSON su GitHub Pages (stesso dominio, niente CORS!)
const DATE_JSON_URL = 'date-disponibili.json';

// Cache per le date disponibili
let cacheDateDisponibili = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti

const configurazioneDateVisite = {
    giorniAnticipoMinimo: 3,
    giorniMassimoFuturo: 180,
};

// Funzione per scaricare le date dal file JSON
async function scaricaDateDisponibili() {
    // Controlla se la cache è ancora valida
    if (cacheDateDisponibili && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        return cacheDateDisponibili;
    }

    try {
        // Aggiungi parametro per evitare cache del browser
        const url = `${DATE_JSON_URL}?t=${Date.now()}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        const dateDisponibili = new Map();
        
        // Carica le date dal JSON
        if (data && data.dateDisponibili && Array.isArray(data.dateDisponibili)) {
            data.dateDisponibili.forEach(dataStr => {
                dateDisponibili.set(dataStr, true);
                console.log('Data disponibile:', dataStr);
            });
        }
        
        console.log('Totale date caricate:', dateDisponibili.size);
        console.log('Ultimo aggiornamento:', data.ultimoAggiornamento || 'N/D');
        
        // Aggiorna cache
        cacheDateDisponibili = dateDisponibili;
        cacheTimestamp = Date.now();
        
        return dateDisponibili;
    } catch (error) {
        console.error('Errore nel caricamento delle date:', error);
        return new Map();
    }
}

// Funzione sincrona per verificare disponibilità (usa cache)
function isDataDisponibileSync(data) {
    if (!cacheDateDisponibili) {
        return false;
    }
    
    const dataStr = data.toISOString().split('T')[0];
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    
    // Controlla se la data è nel passato
    if (data < oggi) return false;
    
    // Controlla anticipo minimo
    const dataMinima = new Date(oggi);
    dataMinima.setDate(dataMinima.getDate() + configurazioneDateVisite.giorniAnticipoMinimo);
    if (data < dataMinima) return false;
    
    // Controlla massimo futuro
    const dataMassima = new Date(oggi);
    dataMassima.setDate(dataMassima.getDate() + configurazioneDateVisite.giorniMassimoFuturo);
    if (data > dataMassima) return false;
    
    return cacheDateDisponibili.has(dataStr);
}

// Funzione per ottenere le date disponibili in un mese (async)
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

// Inizializza il caricamento delle date all'avvio
document.addEventListener('DOMContentLoaded', () => {
    scaricaDateDisponibili().then(() => {
        console.log('Date disponibili caricate');
    });
});
