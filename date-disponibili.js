/**
 * Configurazione date disponibili per le visite in cantina
 * Altea Illotto - Serdiana
 * 
 * Le date vengono lette da un foglio Google Sheets privato
 * Il foglio può essere condiviso con altre persone per modifiche autonome
 */

// ID del foglio Google Sheets pubblicato
const SHEET_ID = '2PACX-1vT1TUqT_Xr0E7EIaq_Mzq_l90F4-FGt1MGN1HWMYKmrcpSRtq2ojtlmAIknxaQzU6-TySYfK6xpX6iz';

// Cache per le date disponibili
let cacheDateDisponibili = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti

const configurazioneDateVisite = {
    giorniAnticipoMinimo: 3,
    giorniMassimoFuturo: 180,
};

// Funzione per scaricare le date usando un'immagine come workaround CORS
async function scaricaDateDisponibili() {
    if (cacheDateDisponibili && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        return cacheDateDisponibili;
    }

    const dateDisponibili = new Map();
    
    // Usiamo un proxy gratuito che funziona
    const url = `https://api.codetabs.com/v1/proxy?quest=https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=0&single=true&output=tsv`;
    
    try {
        const response = await fetch(url);
        const tsvText = await response.text();
        const righe = tsvText.trim().split('\n');
        
        console.log('Righe lette dal foglio:', righe.length);
        
        // Salta la prima riga (intestazioni)
        for (let i = 1; i < righe.length; i++) {
            const colonne = righe[i].split('\t');
            if (colonne.length >= 2) {
                const dataRaw = colonne[0].trim();
                const valore = colonne[1].trim();
                const disponibile = valore === '1' || valore.toUpperCase() === 'TRUE';
                
                // Converti data dal formato DD-MM-YYYY a YYYY-MM-DD
                let dataFormattata = '';
                if (dataRaw && dataRaw.includes('-')) {
                    const parti = dataRaw.split('-');
                    if (parti.length === 3 && parti[0].length === 2) {
                        dataFormattata = `${parti[2]}-${parti[1]}-${parti[0]}`;
                    }
                }
                
                if (dataFormattata && disponibile) {
                    dateDisponibili.set(dataFormattata, true);
                    console.log('Data disponibile:', dataFormattata);
                }
            }
        }
        
        console.log('Totale date caricate:', dateDisponibili.size);
        
        cacheDateDisponibili = dateDisponibili;
        cacheTimestamp = Date.now();
        
        return dateDisponibili;
    } catch (error) {
        console.error('Errore caricamento date:', error);
        
        // Se c'è un errore, prova con un altro proxy
        try {
            const url2 = `https://corsproxy.io/?https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=0&single=true&output=tsv`;
            const response2 = await fetch(url2);
            const tsvText2 = await response2.text();
            const righe2 = tsvText2.trim().split('\n');
            
            for (let i = 1; i < righe2.length; i++) {
                const colonne = righe2[i].split('\t');
                if (colonne.length >= 2) {
                    const dataRaw = colonne[0].trim();
                    const valore = colonne[1].trim();
                    const disponibile = valore === '1' || valore.toUpperCase() === 'TRUE';
                    
                    let dataFormattata = '';
                    if (dataRaw && dataRaw.includes('-')) {
                        const parti = dataRaw.split('-');
                        if (parti.length === 3 && parti[0].length === 2) {
                            dataFormattata = `${parti[2]}-${parti[1]}-${parti[0]}`;
                        }
                    }
                    
                    if (dataFormattata && disponibile) {
                        dateDisponibili.set(dataFormattata, true);
                    }
                }
            }
            
            console.log('Date caricate (backup):', dateDisponibili.size);
            cacheDateDisponibili = dateDisponibili;
            cacheTimestamp = Date.now();
            
            return dateDisponibili;
        } catch (error2) {
            console.error('Errore anche con backup:', error2);
            return new Map();
        }
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
    
    if (data < oggi) return false;
    
    const dataMinima = new Date(oggi);
    dataMinima.setDate(dataMinima.getDate() + configurazioneDateVisite.giorniAnticipoMinimo);
    if (data < dataMinima) return false;
    
    const dataMassima = new Date(oggi);
    dataMassima.setDate(dataMassima.getDate() + configurazioneDateVisite.giorniMassimoFuturo);
    if (data > dataMassima) return false;
    
    return cacheDateDisponibili.has(dataStr);
}

// Inizializza all'avvio
document.addEventListener('DOMContentLoaded', () => {
    scaricaDateDisponibili().then(() => {
        console.log('Date disponibili caricate dal foglio Google Sheets');
    });
});
