/**
 * Configurazione date disponibili per le visite in cantina
 * Altea Illotto - Serdiana
 * 
 * Supporta la lettura diretta del CSV Pubblico di Google Sheets (Soluzione A senza permessi),
 * oltre al fallback via Google Apps Script e JSON locale.
 */

// File > Condividi > Pubblica sul Web > seleziona il foglio > Valori separati da virgola (.csv) > Pubblica
const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT1TUqT_Xr0E7EIaq_Mzq_l90F4-FGt1MGN1HWMYKmrcpSRtq2ojtlmAIknxaQzU6-TySYfK6xpX6iz/pub?gid=0&single=true&output=csv';

// Endpoint Google Apps Script (Soluzione B alternativa)
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

// Estrae e normalizza una data in formato "YYYY-MM-DD" da qualsiasi formato di riga CSV o cella
function estraiDataDaRigaCSV(rigaStr) {
    if (!rigaStr) return null;
    const pulita = rigaStr.trim().replace(/^["']|["']$/g, '');
    if (!pulita) return null;

    const celle = pulita.split(/[,;\t]/);
    for (let i = 0; i < celle.length; i++) {
        const val = celle[i].trim().replace(/^["']|["']$/g, '');
        if (!val) continue;

        // Formato ISO YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
            return val;
        }

        // Formato Italiano: DD/MM/YYYY o DD-MM-YYYY o D/M/YYYY (es: 15/06/2025 o 5/6/2025)
        const matchDMY = val.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
        if (matchDMY) {
            const g = matchDMY[1].padStart(2, '0');
            const m = matchDMY[2].padStart(2, '0');
            const a = matchDMY[3];
            return `${a}-${m}-${g}`;
        }

        // Formato YYYY/MM/DD
        const matchYMD = val.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
        if (matchYMD) {
            const a = matchYMD[1];
            const m = matchYMD[2].padStart(2, '0');
            const g = matchYMD[3].padStart(2, '0');
            return `${a}-${m}-${g}`;
        }
    }
    return null;
}

// Normalizza varie rappresentazioni di stringhe/date in formato "YYYY-MM-DD"
function normalizzaDataStr(dataInput) {
    if (!dataInput) return null;
    if (typeof dataInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataInput)) {
        return dataInput;
    }
    const d = new Date(dataInput);
    if (isNaN(d.getTime())) return null;
    const dLocale = new Date(d.getTime() + (12 * 60 * 60 * 1000));
    const anno = dLocale.getUTCFullYear();
    const mese = String(dLocale.getUTCMonth() + 1).padStart(2, '0');
    const giorno = String(dLocale.getUTCDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
}

// Funzione per scaricare le date (tenta CSV Pubblico Google, Apps Script, poi JSON locale)
async function scaricaDateDisponibili() {
    if (cacheDateDisponibili && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        return cacheDateDisponibili;
    }

    const dateDisponibili = new Map();
    let caricateConSuccesso = false;

    // 1. Tenta il caricamento da CSV Pubblico Google Sheets se impostato
    if (GOOGLE_SHEETS_CSV_URL && GOOGLE_SHEETS_CSV_URL.trim() !== '') {
        try {
            const response = await fetch(`${GOOGLE_SHEETS_CSV_URL}${GOOGLE_SHEETS_CSV_URL.includes('?') ? '&' : '?'}t=${Date.now()}`);
            if (response.ok) {
                const csvData = await response.text();
                const righe = csvData.split(/\r?\n/);
                righe.forEach(riga => {
                    const dataFormatted = estraiDataDaRigaCSV(riga);
                    if (dataFormatted) {
                        dateDisponibili.set(dataFormatted, true);
                    }
                });
                console.log('Date caricate con successo da CSV Pubblico Google Sheets. Totale:', dateDisponibili.size);
                caricateConSuccesso = true;
            }
        } catch (csvError) {
            console.warn('Errore lettura CSV Google Sheets:', csvError);
        }
    }

    // 2. Se il CSV non è configurato o ha fallito, tenta Apps Script
    if (!caricateConSuccesso && APPS_SCRIPT_URL) {
        try {
            const response = await fetch(APPS_SCRIPT_URL);
            if (response.ok) {
                const data = await response.json();
                if (data && data.dateDisponibili && Array.isArray(data.dateDisponibili)) {
                    data.dateDisponibili.forEach(item => {
                        const dataFormatted = normalizzaDataStr(item);
                        if (dataFormatted) {
                            dateDisponibili.set(dataFormatted, true);
                        }
                    });
                    console.log('Date caricate da Google Apps Script. Totale:', dateDisponibili.size);
                    caricateConSuccesso = true;
                }
            }
        } catch (appsError) {
            console.warn('Errore Apps Script Google Sheets:', appsError);
        }
    }

    // 3. Fallback su JSON locale
    if (!caricateConSuccesso) {
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
    
    if (data < oggi) return false;
    
    const dataMinima = new Date(oggi);
    dataMinima.setDate(dataMinima.getDate() + configurazioneDateVisite.giorniAnticipoMinimo);
    if (data < dataMinima) return false;
    
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
