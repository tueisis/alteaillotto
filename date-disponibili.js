/**
 * Configurazione date disponibili per le visite in cantina
 * Altea Illotto - Serdiana
 * 
 * Le date vengono lette da un foglio Google Sheets privato
 */

// URL del foglio Google Sheets - usiamo l'endpoint JSON che funziona senza proxy
// Formato: https://docs.google.com/spreadsheets/d/e/{ID}/pub?output=json
const SHEET_JSON_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT1TUqT_Xr0E7EIaq_Mzq_l90F4-FGt1MGN1HWMYKmrcpSRtq2ojtlmAIknxaQzU6-TySYfK6xpX6iz/pub?gid=0&output=json';

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
        const response = await fetch(SHEET_JSON_URL);
        const jsonText = await response.text();
        
        // Google Sheets restituisce JSON con struttura speciale
        const data = JSON.parse(jsonText);
        const dateDisponibili = new Map();
        
        // I dati sono in data.table.rows
        if (data && data.table && data.table.rows) {
            const rows = data.table.rows;
            
            // Salta la prima riga (intestazioni)
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.c && row.c.length >= 2) {
                    const dataRaw = row.c[0] ? (row.c[0].v || '') : '';
                    const valore = row.c[1] ? (row.c[1].v || '') : '';
                    const disponibile = valore === 1 || valore === '1' || valore === true;
                    
                    // Converti data dal formato DD-MM-YYYY a YYYY-MM-DD
                    let dataFormattata = '';
                    if (dataRaw && typeof dataRaw === 'string' && dataRaw.includes('-')) {
                        const parti = dataRaw.split('-');
                        if (parti.length === 3 && parti[0].length === 2) {
                            dataFormattata = parti[2] + '-' + parti[1] + '-' + parti[0];
                        }
                    }
                    
                    if (dataFormattata && disponibile) {
                        dateDisponibili.set(dataFormattata, true);
                        console.log('Data disponibile:', dataFormattata);
                    }
                }
            }
        }
        
        console.log('Totale date caricate:', dateDisponibili.size);
        
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
