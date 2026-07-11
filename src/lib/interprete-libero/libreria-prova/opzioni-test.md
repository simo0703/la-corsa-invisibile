# Libreria di prova (opzioni inventate)

Questa libreria serve solo a validare il comportamento del modulo. Le opzioni
non sono legate a nessun gioco reale. Sono pensate per testare tre casi:
una scelta automatica netta, un punteggio basso (nessuna opzione adatta) e
un'ambiguità tra due opzioni vicine ("forzare_porta" e "scassinare_porta"
condividono la parola chiave "porta").

## Opzione: forzare_porta

### Frasi di esempio
- "sfondo la porta a calci"
- "provo a sfondare la porta con una spallata"
- "abbatto il portone con la forza"

### Sinonimi pesati
- forza: sfondare, sfondo, abbattere, abbatto, spallata, spallate, calcio, calci, forzare (peso: 2)
- porta: porta, portone, cancello (peso: 1)

### Peso parole chiave
- forza: 3
- porta: 1

### Effetto
tipo: azione_fisica
esito_probabile: rumore_forte
riferimento_interno: prova_01

## Opzione: scassinare_porta

### Frasi di esempio
- "scasso la serratura in silenzio"
- "provo a scassinare la porta senza far rumore"
- "apro la serratura con un fermaglio, piano piano"

### Sinonimi pesati
- scasso: scassinare, scasso, scassino, grimaldello, fermaglio, scardinare (peso: 2)
- porta: porta, serratura, portone (peso: 1)
- silenzio: silenzio, silenzioso, piano, discreto (peso: 1)

### Peso parole chiave
- scasso: 3
- silenzio: 2
- porta: 1

### Effetto
tipo: azione_furtiva
esito_probabile: nessun_rumore
riferimento_interno: prova_02

## Opzione: chiedere_aiuto_a_gran_voce

### Frasi di esempio
- "grido aiuto più forte che posso"
- "chiamo a gran voce chiunque possa sentirmi"
- "urlo per attirare attenzione"

### Sinonimi pesati
- grido: grido, gridare, urlo, urlare, chiamo, chiamare, strillo, strillare (peso: 2)
- aiuto: aiuto, soccorso, attenzione (peso: 1)

### Peso parole chiave
- grido: 3
- aiuto: 1

### Effetto
tipo: azione_sociale
esito_probabile: attira_attenzione
riferimento_interno: prova_03
