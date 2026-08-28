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
 * 3. Incolla il tuo script
 * 4. Esegui il deployment > Nuova distribuzione > App web
 *    - Esegui come: Me
 *    - Chi può accedere: Chiunque
 * 5. Copia l'URL del deployment qui sotto
 */

// ============================================================
// INCOLLA QUI L'URL DEL TUO APPS SCRIPT DEPLOYMENT:
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwhfeVnpaoa4dwNqUXazpU0fpnsnkkX6rLG3AgERU_j3uOcHaKy-D5bkonn_6AnXPnd/exec';
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

// Parsa la data da vari formati restituiti da Google Sheets/Apps Script
function parseDataDaSheets(val) {
    if (!val) return null;
    
    // Se è già un oggetto Date (da getValues + JSON serialization)
    if (val instanceof Date) {
        if (isNaN(val.getTime())) return null;
        return formattaDataYYYYMMDD(val);
    }
    
    // Se è una stringa ISO da serializzazione JSON di Date
    if (typeof val === 'string') {
        const s = val.trim();
        
        // Formato ISO: "2026-08-26T00:00:00.000Z" o "2026-08-26"
        const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
        }
        
        // Formato europeo: "26-08-2026" o "26/08/2026"
        const euMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
        if (euMatch) {
            const d = String(euMatch[1]).padStart(2, '0');
            const m = String(euMatch[2]).padStart(2, '0');
            const y = euMatch[3];
            return `${y}-${m}-${d}`;
        }
        
        // Formato US: "08-26-2026" o "08/26/2026"
        const usMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
        if (usMatch && parseInt(usMatch[1]) > 12) {
            // Se il primo numero > 12, è DD-MM-YYYY
            const d = String(usMatch[1]).padStart(2, '0');
            const m = String(usMatch[2]).padStart(2, '0');
            const y = usMatch[3];
            return `${y}-${m}-${d}`;
        }
    }
    
    // Se è un numero (serial date Excel/Sheets)
    if (typeof val === 'number') {
        // Google Sheets epoch: 30 Dec 1899
        const epoch = new Date(1899, 11, 30);
        const msPerDay = 24 * 60 * 60 * 1000;
        const date = new Date(epoch.getTime() + val * msPerDay);
        if (!isNaN(date.getTime())) {
            return formattaDataYYYYMMDD(date);
        }
    }
    
    return null;
}

// Valuta disponibilità dal valore della colonna "disponibilità"
function valutaDisponibilita(val) {
    if (val === undefined || val === null) return true;
    
    const v = String(val).trim().toLowerCase();
    if (v === '') return true; // vuoto = disponibile
    
    // Valori che significano "NON disponibile"
    const nonDisponibili = ['0', 'false', 'no', 'occupato', 'non disponibile', 'pieno', 'chiuso', 'full'];
    return !nonDisponibili.includes(v);
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
                console.log('Date caricate da Google Apps Script:', jsonData);
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

    // 3. Popola la mappa gestendo il formato del tuo script
    if (jsonData && Array.isArray(jsonData)) {
        jsonData.forEach(item => {
            // Il tuo script restituisce oggetti con chiavi dagli header: data, disponibilità, note
            const dataRaw = item['data'] ?? item['Data'] ?? item['date'] ?? item['Date'];
            const dispRaw = item['disponibilità'] ?? item['disponibilita'] ?? item['disponibilità'] ?? item['availability'] ?? item['Disponibilità'];
            
            const dataStr = parseDataDaSheets(dataRaw);
            if (!dataStr) return;
            
            const disponibile = valutaDisponibilita(dispRaw);
            if (disponibile) {
                dateDisponibili.set(dataStr, true);
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