/**
 * Configurazione date disponibili per le visite in cantina
 * Altea Illotto - Serdiana
 * 
 * Le date vengono lette direttamente da Google Sheets tramite Google Apps Script (Soluzione B).
 * Se la connessione fallisce, viene usato date-disponibili.json come fallback.
 */

// Endpoint Google Apps Script
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbza_LiiQj6B8aik9KQzqLTCCUfrjDqSqhQcUOEaWb4Rs6cMAMS6hUgfg5s0UdSyW1LN/exec';
// Fallback JSON locale
const FALLBACK_JSON_URL = 'date-disponibili.json';

// Cache per le date disponibili
let cacheDateDisponibili = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti

const configurazioneDateVisite = {
    giorniAnticipoMinimo: 3,
    giorniMassimoFuturo: 180,
};

// Converte un oggetto Date locale nel formato "YYYY-MM-DD"
function formattaDataYYYYMMDD(data) {
    if (!data || !(data instanceof Date) || isNaN(data.getTime())) return null;
    const anno = data.getFullYear();
    const mese = String(data.getMonth() + 1).padStart(2, '0');
    const giorno = String(data.getDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
}

// Normalizza varie rappresentazioni di stringhe/date (es. ISO UTC da Apps Script) in formato "YYYY-MM-DD"
function normalizzaDataStr(dataInput) {
    if (!dataInput) return null;
    if (typeof dataInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataInput)) {
        return dataInput;
    }
    const d = new Date(dataInput);
    if (isNaN(d.getTime())) return null;
    // Aggiungi 12 ore per bilanciare l'offset UTC -> ora locale italiana (CEST/CET)
    const dLocale = new Date(d.getTime() + (12 * 60 * 60 * 1000));
    const anno = dLocale.getUTCFullYear();
    const mese = String(dLocale.getUTCMonth() + 1).padStart(2, '0');
    const giorno = String(dLocale.getUTCDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
}

// Funzione per scaricare le date da Google Apps Script (con fallback JSON)
async function scaricaDateDisponibili() {
    // Controlla se la cache è ancora valida
    if (cacheDateDisponibili && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        return cacheDateDisponibili;
    }

    const dateDisponibili = new Map();

    try {
        const response = await fetch(APPS_SCRIPT_URL);
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.dateDisponibili && Array.isArray(data.dateDisponibili)) {
            data.dateDisponibili.forEach(item => {
                const dataFormatted = normalizzaDataStr(item);
                if (dataFormatted) {
                    dateDisponibili.set(dataFormatted, true);
                }
            });
        }
        console.log('Date caricate da Google Apps Script. Totale:', dateDisponibili.size);
    } catch (error) {
        console.warn('Errore Apps Script Google Sheets, avvio fallback su JSON locale:', error);
        try {
            const fallbackRes = await fetch(`${FALLBACK_JSON_URL}?t=${Date.now()}`);
            if (fallbackRes.ok) {
                const fallbackData = await fallbackRes.json();
                if (fallbackData && fallbackData.dateDisponibili && Array.isArray(fallbackData.dateDisponibili)) {
                    fallbackData.dateDisponibili.forEach(item => {
                        const dataFormatted = normalizzaDataStr(item);
                        if (dataFormatted) {
                            dateDisponibili.set(dataFormatted, true);
                        }
                    });
                }
                console.log('Date caricate da fallback JSON locale. Totale:', dateDisponibili.size);
            }
        } catch (fallbackErr) {
            console.error('Errore anche nel caricamento del JSON fallback:', fallbackErr);
        }
    }

    // Aggiorna cache
    cacheDateDisponibili = dateDisponibili;
    cacheTimestamp = Date.now();
    
    return dateDisponibili;
}

// Funzione sincrona per verificare disponibilità (usa cache)
function isDataDisponibileSync(data) {
    if (!cacheDateDisponibili) {
        return false;
    }
    
    const dataStr = formattaDataYYYYMMDD(data);
    if (!dataStr) return false;

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
        console.log('Date disponibili pronte');
    });
});
