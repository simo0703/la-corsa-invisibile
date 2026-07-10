# Pool di contenuto del Cronista — Nodo 1836-torino

Frammenti narrativi veri per il Nodo Temporale "1836-torino" (La Scuola del
Decalogo, Torino 1836), usati dal Cronista (`src/lib/narratore-simulato.js`)
tramite il caricatore `narratore-corsa-invisibile-loader.js`.

**Come modificare questo file**: ogni tabella produce un frammento per riga.
La colonna `id` deve essere unica all'interno del suo slot. La colonna
`testo` è il testo del frammento (può contenere il placeholder `{ruolo}`,
sostituito a runtime con il nome del ruolo del personaggio). Le colonne in
mezzo (`esito`, `ruoloId`, `competenzaId`, `fasciaMargine`) sono condizioni:
il frammento entra tra i candidati solo se il valore nel contesto di gioco
coincide con quello scritto qui. Una cella vuota su una di queste colonne
significa "nessun vincolo su quell'asse" (il frammento si applica sempre,
per quell'asse). Non rimuovere l'intestazione `## Slot: ...`: è quello che
dice al caricatore a quale slot appartiene la tabella sottostante.

Slot validi (in quest'ordine, vedi `SLOT` in `narratore-simulato.js`):
`apertura` (aggancia l'azione al tono del momento), `sviluppo` (il cuore del
testo, cosa succede davvero), `eco` (lega l'esito a ciò che si accumula
nella partita).

---

## Slot: apertura

### Baseline per esito

| id | esito | testo |
|---|---|---|
| apertura-pieno-1 | pieno | Il fiato riprende dopo lo sforzo, e per un istante il Decalogo sembra reggersi da solo. |
| apertura-pieno-2 | pieno | La Marmora osserva senza dire nulla — ma chi conosce il generale sa che il silenzio, qui, è approvazione. |
| apertura-parziale-1 | parziale | Non tutto fila liscio, ma nemmeno crolla: il Decalogo lascia comunque il segno. |
| apertura-parziale-2 | parziale | Qualcosa si incrina nell'ordine previsto, ma la squadra tiene. |
| apertura-fallimento-1 | fallimento | Il percorso vince questa mano: la nebbia di Torino inghiotte ogni piano fatto a tavolino. |
| apertura-fallimento-2 | fallimento | Il Decalogo non perdona: quello che doveva essere semplice, oggi non lo è stato. |

### Per ruolo

Flavor del personaggio in azione — restano neutri sull'esito (che si scopre
nello sviluppo), quindi non hanno una colonna `esito`.

| id | ruoloId | testo |
|---|---|---|
| apertura-ruolo-esploratore | esploratore | {ruolo} è già avanti di due falcate, gli occhi fissi sul percorso nella nebbia. |
| apertura-ruolo-fanfarista | fanfarista | {ruolo} scandisce il ritmo a fiato, prima ancora che gli altri si muovano. |
| apertura-ruolo-custode | custode | {ruolo} controlla la fila con un'occhiata, contando teste prima di contare metri. |
| apertura-ruolo-incursore | incursore | {ruolo} non aspetta il segnale: è già dentro il primo fossato. |

## Slot: sviluppo

### Baseline per esito

| id | esito | testo |
|---|---|---|
| sviluppo-pieno-1 | pieno | Il gesto è preciso, il tempo giusto: il tratto si supera senza sbavature. |
| sviluppo-pieno-2 | pieno | La squadra passa il tratto più duro come se lo avesse già corso cento volte. |
| sviluppo-parziale-1 | parziale | Il tratto si supera, ma con un prezzo: qualcosa resta indietro, un fiato, un attimo di esitazione. |
| sviluppo-parziale-2 | parziale | Non è la prova migliore vista da La Marmora, ma è comunque una prova superata. |
| sviluppo-fallimento-1 | fallimento | Il piede scivola, l'ordine si rompe: il Decalogo si prende il suo tributo, oggi. |
| sviluppo-fallimento-2 | fallimento | Quello che doveva essere metodo diventa improvvisazione, e si vede. |

### Per competenza

Come si è manifestata l'azione, indipendentemente da quanto sia andata bene
(quello resta nel frammento baseline scelto per lo stesso slot) — quindi non
hanno una colonna `esito`.

| id | competenzaId | testo |
|---|---|---|
| sviluppo-competenza-cadenza | cadenza | È la Cadenza a decidere: le gambe rispondono prima che la testa finisca di pensare. |
| sviluppo-competenza-precisione | precisione | È la Precisione a fare la differenza: ogni appoggio calcolato, nessun passo sprecato. |
| sviluppo-competenza-spiritoDiCorpo | spiritoDiCorpo | È lo Spirito di Corpo a reggere il tratto: nessuno molla, perché nessuno vuole essere quello che molla. |
| sviluppo-competenza-passoAvanti | passoAvanti | È il Passo Avanti a spingere oltre la fatica: la paura di fermarsi pesa più di quella di cadere. |
| sviluppo-competenza-ancoraggio | ancoraggio | È l'Ancoraggio a tenere in piedi tutto il resto: la testa resta ferma anche quando le gambe tremano. |

## Slot: eco

### Baseline per esito

| id | esito | testo |
|---|---|---|
| eco-pieno-1 | pieno | Un altro passo del Decalogo segnato, e nessuno lo dimentica. |
| eco-parziale-1 | parziale | Resta il segno di quello che è costato, anche se il tratto è alle spalle. |
| eco-fallimento-1 | fallimento | Il Decalogo prende nota. La Marmora, forse, anche. |

### Per fascia di margine

Lega l'esito a quanto sta salendo la tensione accumulata nella partita
(`fasciaMargine` è calcolata automaticamente dal motore, non va passata a
mano).

| id | fasciaMargine | testo |
|---|---|---|
| eco-margine-basso | basso | Il piano regge ancora, per ora. |
| eco-margine-medio | medio | Qualcosa comincia a scricchiolare sotto la superficie del piano. |
| eco-margine-alto | alto | Il margine si assottiglia: un altro passo falso, e sarà complicazione. |
| eco-margine-critico | critico | Il piano ha ceduto: il peso accumulato si fa sentire tutto insieme, ora. |
