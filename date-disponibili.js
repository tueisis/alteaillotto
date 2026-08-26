/**
 * Configurazione date disponibili per le visite in cantina
 * Altea Illotto - Serdiana
 * 
 * Le date vengono lette da un foglio Google Sheets privato
 */

// URL del foglio Google Sheets (CSV pubblicato)
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT1TUqT_Xr0E7EIaq_Mzq_l90F4-FGt1MGN1HWMYKmrcpSRtq2ojtlmAIknxaQzU6-TySYfK6xpX6iz/pub?gid=0&single=true&output=csv';

// Cache per le date disponibili (evita richieste multiple)
let cacheDateDisponibili = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti

const configurazioneDateVisite = {
    // Numero minimo di giorni di anticipo per prenotare
    giorniAnticipoMinimo: 3,

    // Numero massimo di giorni nel futuro prenotabili
    giorniMassimoFuturo: 180,
};

// Funzione per scaricare le date dal foglio Google Sheets
async function scaricaDateDisponibili() {
    // Controlla se la cache è ancora valida
    if (cacheDateDisponibili && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        return cacheDateDisponibili;
    }

    try {
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();
        
        const dateDisponibili = new Map();
        const righe = csvText.trim().split('\n');
        
        // Salta la prima riga (intestazioni)
        for (let i = 1; i < righe.length; i++) {
            const colonne = righe[i].split(',');
            if (colonne.length >= 2) {
                const data = colonne[0].trim().replace(/"/g, '');
                const disponibile = colonne[1].trim().toUpperCase() === 'TRUE';
                
                if (data && disponibile) {
                    dateDisponibili.set(data, true);
                }
            }
        }
        
        // Aggiorna cache
        cacheDateDisponibili = dateDisponibili;
        cacheTimestamp = Date.now();
        
        return dateDisponibili;
    } catch (error) {
        console.error('Errore nel caricamento delle date:', error);
        return new Map();
    }
}

// Funzione per verificare se una data è disponibile
async function isDataDisponibile(data) {
    const dataStr = data.toISOString().split('T')[0]; // YYYY-MM-DD
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    
    // Controlla se la data è nel passato
    if (data < oggi) {
        return false;
    }
    
    // Controlla anticipo minimo
    const dataMinima = new Date(oggi);
    dataMinima.setDate(dataMinima.getDate() + configurazioneDateVisite.giorniAnticipoMinimo);
    if (data < dataMinima) {
        return false;
    }
    
    // Controlla massimo futuro
    const dataMassima = new Date(oggi);
    dataMassima.setDate(dataMassima.getDate() + configurazioneDateVisite.giorniMassimoFuturo);
    if (data > dataMassima) {
        return false;
    }
    
    // Scarica le date dal foglio
    const dateDisponibili = await scaricaDateDisponibili();
    
    // Controlla se la data è nella lista delle disponibili
    return dateDisponibili.has(dataStr);
}

// Funzione sincrona per compatibilità (usa la cache se disponibile)
function isDataDisponibileSync(data) {
    if (!cacheDateDisponibili) {
        return false; // Se non abbiamo ancora i dati, mostra come non disponibile
    }
    
    const dataStr = data.toISOString().split('T')[0];
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    
    // Controlla se la data è nel passato
    if (data < oggi) {
        return false;
    }
    
    // Controlla anticipo minimo
    const dataMinima = new Date(oggi);
    dataMinima.setDate(dataMinima.getDate() + configurazioneDateVisite.giorniAnticipoMinimo);
    if (data < dataMinima) {
        return false;
    }
    
    // Controlla massimo futuro
    const dataMassima = new Date(oggi);
    dataMassima.setDate(dataMassima.getDate() + configurazioneDateVisite.giorniMassimoFuturo);
    if (data > dataMassima) {
        return false;
    }
    
    return cacheDateDisponibili.has(dataStr);
}

// Funzione per ottenere le date disponibili in un mese
async function getDateDisponibiliMese(anno, mese) {
    const dateDisponibili = [];
    const ultimoGiorno = new Date(anno, mese + 1, 0).getDate();
    
    for (let giorno = 1; giorno <= ultimoGiorno; giorno++) {
        const data = new Date(anno, mese, giorno);
        if (await isDataDisponibile(data)) {
            dateDisponibili.push(giorno);
        }
    }
    
    return dateDisponibili;
}

// Inizializza il caricamento delle date all'avvio
document.addEventListener('DOMContentLoaded', () => {
    scaricaDateDisponibili().then(() => {
        console.log('Date disponibili caricate dal foglio Google Sheets');
    });
});
