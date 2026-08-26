/**
 * Configurazione date disponibili per le visite in cantina
 * Altea Illotto - Serdiana
 */

const configurazioneDateVisite = {
    // Date specifiche bloccate (formato: 'YYYY-MM-DD')
    dateBloccate: [
        '2026-12-25', // Natale
        '2026-12-26', // Santo Stefano
        '2027-01-01', // Capodanno
    ],

    // Giorni della settimana sempre chiusi (0=Domenica, 1=Lunedì, ..., 6=Sabato)
    giorniChiusi: [
        0, // Domenica
    ],

    // Periodo di chiusura invernale
    chiusuraInvernale: {
        attiva: false,
        dalMese: 11, // Novembre (0=Gennaio, 11=Novembre)
        alMese: 2,   // Febbraio
    },

    // Numero minimo di giorni di anticipo per prenotare
    giorniAnticipoMinimo: 3,

    // Numero massimo di giorni nel futuro prenotabili
    giorniMassimoFuturo: 180,
};

// Funzione per verificare se una data è disponibile
function isDataDisponibile(data) {
    const dataStr = data.toISOString().split('T')[0];
    const giorno = data.getDay();
    const mese = data.getMonth();
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
    
    // Controlla se è in una data bloccata specifica
    if (configurazioneDateVisite.dateBloccate.includes(dataStr)) {
        return false;
    }
    
    // Controlla se è un giorno della settimana chiuso
    if (configurazioneDateVisite.giorniChiusi.includes(giorno)) {
        return false;
    }
    
    // Controlla chiusura invernale
    if (configurazioneDateVisite.chiusuraInvernale.attiva) {
        const dalMese = configurazioneDateVisite.chiusuraInvernale.dalMese;
        const alMese = configurazioneDateVisite.chiusuraInvernale.alMese;
        
        if (dalMese > alMese) {
            // Periodo a cavallo dell'anno (es. Nov-Feb)
            if (mese >= dalMese || mese <= alMese) {
                return false;
            }
        } else {
            // Periodo nello stesso anno
            if (mese >= dalMese && mese <= alMese) {
                return false;
            }
        }
    }
    
    return true;
}

// Funzione per ottenere le date disponibili in un mese
function getDateDisponibiliMese(anno, mese) {
    const dateDisponibili = [];
    const ultimoGiorno = new Date(anno, mese + 1, 0).getDate();
    
    for (let giorno = 1; giorno <= ultimoGiorno; giorno++) {
        const data = new Date(anno, mese, giorno);
        if (isDataDisponibile(data)) {
            dateDisponibili.push(giorno);
        }
    }
    
    return dateDisponibili;
}
