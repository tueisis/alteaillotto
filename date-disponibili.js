/**
 * Configurazione date disponibili per le visite in cantina
 * Altea Illotto - Serdiana
 * 
 * Legge sia la Colonna 1 (Data) che la Colonna 2 (Stato disponibilità: 1/0, TRUE/FALSE, SI/NO, disponibile/occupato).
 * Supporta CSV Pubblico Google Sheets, Google Apps Script e JSON locale.
 */

// 1. Incolla qui il tuo link del foglio Google pubblicato sul Web in formato CSV:
// File > Condividi > Pubblica sul Web > seleziona il foglio > Valori separati da virgola (.csv) > Pubblica
const GOOGLE_SHEETS_CSV_URL = '';

// 2. Endpoint Google Apps Script (Soluzione B alternativa)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbza_LiiQj6B8aik9KQzqLTCCUfrjDqSqhQcUOEaWb4Rs6cMAMS6hUgfg5s0UdSyW1LN/exec';

// 3. Fallback JSON locale
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

// Estrae una data pulita YYYY-MM-DD da una singola cella o stringa
function estraiDataDaCella(val) {
    if (!val) return null;
    val = String(val).trim().replace(/^["']|["']$/g, '');
    if (!val) return null;

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

    return null;
}

// Estrae Data (Colonna 1) e Disponibilità (Colonna 2) da una riga CSV
function estraiDataEDisponibilitaDaRigaCSV(rigaStr) {
    if (!rigaStr) return null;
    const pulita = rigaStr.trim();
    if (!pulita) return null;

    const celle = pulita.split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (celle.length === 0) return null;

    // Salta intestazioni es: "Data", "Disponibilità"
    if (/^(data|date|day|giorno|timestamp)$/i.test(celle[0])) return null;

    const dataStr = estraiDataDaCella(celle[0]);
    if (!dataStr) return null;

    let eDisponibile = true;

    // Se esiste la SECONDA COLONNA, la analizziamo per determinare la disponibilità
    if (celle.length >= 2) {
        const valCol2 = celle[1].trim().toLowerCase();

        // Valori espliciti per DISPONIBILE (1, true, si, disponibile, ok, libero, etc.)
        if (['1', 'true', 'si', 'sì', 'yes', 'disponibile', 'ok', 'libero'].includes(valCol2)) {
            eDisponibile = true;
        } 
        // Valori espliciti per NON DISPONIBILE (0, false, no, occupato, non disponibile, pieno, chiuso, etc.)
        else if (['0', 'false', 'no', 'occupato', 'non disponibile', 'disattivato', 'full', 'pieno', 'chiuso', ''].includes(valCol2)) {
            eDisponibile = false;
        } 
        else {
            // Se nella colonna 2 c'è un valore sconosciuto o diverso da quelli attesi per "disponibile", consideriamo non disponibile
            eDisponibile = false;
        }
    }

    return { dataStr, eDisponibile };
}

// Analizza item da risposta JSON (Apps Script o fallback)
function analizzaItemDisponibilita(item) {
    if (!item) return null;

    if (typeof item === 'string') {
        const dataStr = estraiDataDaCella(item) || normalizzaDataStr(item);
        return dataStr ? { dataStr, eDisponibile: true } : null;
    }

    if (typeof item === 'object') {
        const rawData = item.data || item.date || item.giorno || item[0];
        const dataStr = estraiDataDaCella(rawData) || normalizzaDataStr(rawData);
        if (!dataStr) return null;

        let dispVal = item.disponibile !== undefined ? item.disponibile :
                      item.available !== undefined ? item.available :
                      item.stato !== undefined ? item.stato :
                      item.status !== undefined ? item.status :
                      item[1];

        let eDisponibile = true;
        if (dispVal !== undefined && dispVal !== null) {
            const strVal = String(dispVal).trim().toLowerCase();
            if (['0', 'false', 'no', 'occupato', 'non disponibile', 'full', 'pieno', 'chiuso', ''].includes(strVal)) {
                eDisponibile = false;
            } else if (['1', 'true', 'si', 'sì', 'yes', 'disponibile', 'ok', 'libero'].includes(strVal)) {
                eDisponibile = true;
            } else {
                eDisponibile = Boolean(dispVal);
            }
        }

        return { dataStr, eDisponibile };
    }

    return null;
}

// Normalizza stringhe/date generiche in YYYY-MM-DD
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

// Funzione per scaricare le date disponibili
async function scaricaDateDisponibili() {
    if (cacheDateDisponibili && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        return cacheDateDisponibili;
    }

    const dateDisponibili = new Map();
    let caricateConSuccesso = false;

    // 1. Caricamento da CSV Pubblico Google Sheets
    if (GOOGLE_SHEETS_CSV_URL && GOOGLE_SHEETS_CSV_URL.trim() !== '') {
        try {
            const response = await fetch(`${GOOGLE_SHEETS_CSV_URL}${GOOGLE_SHEETS_CSV_URL.includes('?') ? '&' : '?'}t=${Date.now()}`);
            if (response.ok) {
                const csvData = await response.text();
                const righe = csvData.split(/\r?\n/);
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
                console.log('Date caricate da CSV Pubblico Google Sheets. Disponibili:', dateDisponibili.size);
                caricateConSuccesso = true;
            }
        } catch (csvError) {
            console.warn('Errore lettura CSV Google Sheets:', csvError);
        }
    }

    // 2. Fallback su Apps Script
    if (!caricateConSuccesso && APPS_SCRIPT_URL) {
        try {
            const response = await fetch(APPS_SCRIPT_URL);
            if (response.ok) {
                const data = await response.json();
                if (data && data.dateDisponibili && Array.isArray(data.dateDisponibili)) {
                    data.dateDisponibili.forEach(item => {
                        const esito = analizzaItemDisponibilita(item);
                        if (esito && esito.dataStr) {
                            if (esito.eDisponibile) {
                                dateDisponibili.set(esito.dataStr, true);
                            } else {
                                dateDisponibili.delete(esito.dataStr);
                            }
                        }
                    });
                    console.log('Date caricate da Google Apps Script. Disponibili:', dateDisponibili.size);
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
                        const esito = analizzaItemDisponibilita(item);
                        if (esito && esito.dataStr) {
                            if (esito.eDisponibile) {
                                dateDisponibili.set(esito.dataStr, true);
                            } else {
                                dateDisponibili.delete(esito.dataStr);
                            }
                        }
                    });
                }
                console.log('Date caricate da fallback JSON locale. Disponibili:', dateDisponibili.size);
            }
        } catch (fallbackErr) {
            console.error('Errore nel caricamento del JSON fallback:', fallbackErr);
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
