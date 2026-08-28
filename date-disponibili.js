/**
 * Configurazione date disponibili per le visite in cantina
 * Altea Illotto - Serdiana
 * 
 * Legge direttamente dal CSV Pubblico di Google Sheets.
 */

// Incolla qui il tuo link del foglio Google pubblicato sul Web in formato CSV:
// File > Condividi > Pubblica sul Web > seleziona il foglio > Valori separati da virgola (.csv) > Pubblica
const GOOGLE_SHEETS_CSV_URL = '';

// Cache per le date disponibili (in millisecondi)
let cacheDateDisponibili = null;
let cacheTimestamp = null;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minuti

const configurazioneDateVisite = {
    giorniAnticipoMinimo: 0, // Nessun blocco arbitrario: le date valide le decidi tu sul foglio Google Sheets
    giorniMassimoFuturo: 365,
};

// Converte un oggetto Date locale nel formato "YYYY-MM-DD"
function formattaDataYYYYMMDD(data) {
    if (!data || !(data instanceof Date) || isNaN(data.getTime())) return null;
    const anno = data.getFullYear();
    const mese = String(data.getMonth() + 1).padStart(2, '0');
    const giorno = String(data.getDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
}

// Estrae una data pulita YYYY-MM-DD da una cella
function estraiDataDaCella(val) {
    if (!val) return null;
    val = String(val).trim().replace(/^["']|["']$/g, '');
    if (!val) return null;

    // Se la stringa include orario o T (es: "01/09/2026 00:00:00" oppure "2026-09-01T00:00:00.000Z")
    val = val.split(/[\sT]/)[0];

    // Formato ISO YYYY-MM-DD o YYYY/MM/DD
    let m = val.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) {
        const y = m[1];
        const month = m[2].padStart(2, '0');
        const d = m[3].padStart(2, '0');
        return `${y}-${month}-${d}`;
    }

    // Formato Italiano: DD/MM/YYYY o DD-MM-YYYY o D/M/YYYY (es: 15/06/2026 o 5/6/2026)
    m = val.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) {
        const d = m[1].padStart(2, '0');
        const month = m[2].padStart(2, '0');
        const y = m[3];
        return `${y}-${month}-${d}`;
    }

    // Formato anno a 2 cifre: DD/MM/YY (es: 15/06/26)
    m = val.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
    if (m) {
        const d = m[1].padStart(2, '0');
        const month = m[2].padStart(2, '0');
        const y = '20' + m[3];
        return `${y}-${month}-${d}`;
    }

    return null;
}

// Estrae Data (Colonna 1) e Disponibilità (Colonna 2) da una riga del CSV
function estraiDataEDisponibilitaDaRigaCSV(rigaStr) {
    if (!rigaStr) return null;
    const pulita = rigaStr.trim();
    if (!pulita) return null;

    // Separa le colonne (virgola, punto e virgola o tabulazione)
    const celle = pulita.split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (celle.length === 0 || !celle[0]) return null;

    // Salta righe di intestazione es: "Data", "Date", "Giorno", "Timestamp"
    if (/^(data|date|day|giorno|timestamp|giorni)$/i.test(celle[0])) return null;

    const dataStr = estraiDataDaCella(celle[0]);
    if (!dataStr) return null;

    // Se nel foglio c'è 1 sola colonna con le date o la seconda colonna è vuota:
    if (celle.length === 1 || celle[1] === undefined || celle[1] === '') {
        return { dataStr, eDisponibile: true };
    }

    // Se esiste la SECONDA COLONNA:
    const valCol2 = celle[1].trim().toLowerCase();

    // Valori espliciti per NON DISPONIBILE
    if (['0', 'false', 'no', 'occupato', 'non disponibile', 'disattivato', 'full', 'pieno', 'chiuso', '0.0'].includes(valCol2)) {
        return { dataStr, eDisponibile: false };
    }

    // Per qualsiasi altro valore (1, true, si, disponibile, ok, libero):
    return { dataStr, eDisponibile: true };
}

// Scarica le date dal CSV Pubblico di Google Sheets
async function scaricaDateDisponibili() {
    if (cacheDateDisponibili && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        return cacheDateDisponibili;
    }

    const dateDisponibili = new Map();

    if (!GOOGLE_SHEETS_CSV_URL || GOOGLE_SHEETS_CSV_URL.trim() === '') {
        console.warn('GOOGLE_SHEETS_CSV_URL non configurato in date-disponibili.js');
        cacheDateDisponibili = dateDisponibili;
        cacheTimestamp = Date.now();
        return dateDisponibili;
    }

    try {
        const cacheBuster = `t=${Date.now()}`;
        const fetchUrl = GOOGLE_SHEETS_CSV_URL.includes('?') 
            ? `${GOOGLE_SHEETS_CSV_URL}&${cacheBuster}` 
            : `${GOOGLE_SHEETS_CSV_URL}?${cacheBuster}`;

        const response = await fetch(fetchUrl);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const csvText = await response.text();
        const righe = csvText.split(/\r?\n/);

        righe.forEach(riga => {
            const esito = estraiDataEDisponibilitaDaRigaCSV(riga);
            if (esito && esito.dataStr) {
                if (esito.eDisponibile) {
                    dateDisponibili.set(esito.dataStr, true);
                } else {
                    dateDisponibili.delete(esito.dataStr);
                }
            }
        });

        console.log('Date caricate con successo dal CSV Pubblico Google Sheets. Totale disponibili:', dateDisponibili.size, Array.from(dateDisponibili.keys()));
    } catch (err) {
        console.error('Errore nel caricamento del CSV Google Sheets:', err);
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
