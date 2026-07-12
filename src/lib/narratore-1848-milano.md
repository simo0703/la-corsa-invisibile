# Pool di contenuto del Cronista — Nodo 1848-milano

Frammenti narrativi veri per il Nodo Temporale "1848-milano" (L'Identità,
Milano 1848), usati dal Cronista (`src/lib/narratore-simulato.js`) tramite
il caricatore `narratore-corsa-invisibile-loader.js`.

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
| apertura-pieno-1 | pieno | Il varco si apre prima ancora che la polvere si depositi: la carica ha trovato il punto debole. |
| apertura-pieno-2 | pieno | Non c'è esitazione nel passo: la barricata è già un ostacolo alle spalle. |
| apertura-parziale-1 | parziale | La barricata cede, ma non senza far sentire il suo peso. |
| apertura-parziale-2 | parziale | Il varco si apre, storto, tra il legno spezzato e il fumo. |
| apertura-fallimento-1 | fallimento | Milano non si lascia attraversare così facilmente, oggi. |
| apertura-fallimento-2 | fallimento | La barricata regge più del previsto, e il piano vacilla con essa. |

### Per ruolo

Flavor del personaggio in azione — restano neutri sull'esito (che si scopre
nello sviluppo), quindi non hanno una colonna `esito`.

| id | ruoloId | testo |
|---|---|---|
| apertura-ruolo-esploratore | esploratore | {ruolo} ha già letto la breccia nel legno, un attimo prima degli altri. |
| apertura-ruolo-fanfara | fanfara | {ruolo} lancia il segnale di carica, e il ritmo si propaga lungo la fila. |
| apertura-ruolo-custode | custode | {ruolo} tiene d'occhio chi è più indietro, anche mentre la squadra si lancia avanti. |
| apertura-ruolo-incursore | incursore | {ruolo} è già sul legno spezzato, senza aspettare che il varco sia sicuro. |

### Per competenza ed esito (disarmo — Precisione)

Frammenti specifici per l'azione di disarmo a tiro reale (richiesta
"milano-ferito", risposta "Lo disarmate con un gesto solo"): condizionati
sia su `esito` sia su `competenzaId: precisione`, così restano candidati
aggiuntivi accanto al baseline generico sopra (scritto pensando alla
barricata) invece di sostituirlo — vedi la nota sul rischio di
mescolamento nel log delle decisioni.

| id | esito | competenzaId | testo |
|---|---|---|---|
| apertura-precisione-pieno-1 | pieno | precisione | La mano si chiude sull'arma prima che lui capisca cosa sta succedendo. |
| apertura-precisione-pieno-2 | pieno | precisione | Non c'è esitazione. Il gesto è già deciso prima di cominciare. |
| apertura-precisione-parziale-1 | parziale | precisione | La mano esita un istante, poi si muove comunque. |
| apertura-precisione-parziale-2 | parziale | precisione | Il primo tentativo non basta. Bisogna insistere. |
| apertura-precisione-fallimento-1 | fallimento | precisione | La presa è sbagliata fin dall'inizio. |
| apertura-precisione-fallimento-2 | fallimento | precisione | Il fango, o la fretta, rendono tutto più difficile del previsto. |

## Slot: sviluppo

### Baseline per esito

| id | esito | testo |
|---|---|---|
| sviluppo-pieno-1 | pieno | Il corpo intero si muove come uno solo: la barricata cede in un punto solo, ed è quello giusto. |
| sviluppo-pieno-2 | pieno | Nessuno spreca un passo: la carica è pulita, quasi silenziosa nella sua efficacia. |
| sviluppo-parziale-1 | parziale | Il varco si apre, ma qualcuno resta indietro un istante di troppo. |
| sviluppo-parziale-2 | parziale | La barricata cede sotto la spinta, portandosi via un po' di fiato con sé. |
| sviluppo-fallimento-1 | fallimento | Il legno non cede dove doveva: qualcuno inciampa nel varco sbagliato. |
| sviluppo-fallimento-2 | fallimento | La carica si spezza a metà: il ritmo si perde proprio quando serviva di più. |

### Per competenza

Come si è manifestata l'azione, indipendentemente da quanto sia andata bene
(quello resta nel frammento baseline scelto per lo stesso slot) — quindi non
hanno una colonna `esito`.

| id | competenzaId | testo |
|---|---|---|
| sviluppo-competenza-cadenza | cadenza | È la Cadenza a decidere tutto: la velocità della carica non lascia tempo alla barricata di reagire. |
| sviluppo-competenza-precisione | precisione | È la Precisione a trovare il punto debole: non forza, calcolo. |
| sviluppo-competenza-spiritoDiCorpo | spiritoDiCorpo | È lo Spirito di Corpo a tenere la fila compatta, anche sotto il fuoco incrociato. |
| sviluppo-competenza-passoAvanti | passoAvanti | È il Passo Avanti a spingere oltre la barricata, quando ogni istinto direbbe di fermarsi. |
| sviluppo-competenza-ancoraggio | ancoraggio | È l'Ancoraggio a tenere la mente lucida, mentre tutto intorno è fumo e rumore. |

### Per competenza ed esito (disarmo — Precisione)

Stessa logica della tabella equivalente nello slot `apertura`: righe
condizionate sia su `esito` sia su `competenzaId: precisione`, specifiche
per la scena di disarmo. La riga `sviluppo-competenza-precisione` sopra
(senza colonna `esito`) resta valida e continua a comparire per qualunque
esito: le due tabelle convivono senza conflitto, ampliando solo la
varietà dei candidati.

| id | esito | competenzaId | testo |
|---|---|---|---|
| sviluppo-precisione-pieno-1 | pieno | precisione | Un movimento secco. Non ha nemmeno il tempo di reagire. |
| sviluppo-precisione-parziale-1 | parziale | precisione | Il gesto riesce. Il ferito geme più forte. Qualcuno, poco lontano, potrebbe averlo sentito. |
| sviluppo-precisione-fallimento-1 | fallimento | precisione | Il ferito si dimena. L'arma resta a metà tra le mani. Bisogna strapparla. |

## Slot: eco

### Baseline per esito

| id | esito | testo |
|---|---|---|
| eco-pieno-1 | pieno | La barricata è alle spalle, e la città sembra un poco più vicina. |
| eco-parziale-1 | parziale | Il varco è aperto, ma il prezzo pagato resta addosso a tutti. |
| eco-fallimento-1 | fallimento | Milano prende nota di questo momento. La squadra, forse, anche. |

### Per competenza ed esito (disarmo — Precisione)

Stessa logica delle tabelle equivalenti in `apertura` e `sviluppo`: righe
condizionate sia su `esito` sia su `competenzaId: precisione`, specifiche
per la scena di disarmo.

| id | esito | competenzaId | testo |
|---|---|---|---|
| eco-precisione-pieno-1 | pieno | precisione | La colonna riprende il passo. Nessuno si volta indietro. |
| eco-precisione-pieno-2 | pieno | precisione | Il fumo si richiude sulla scena come se non fosse successo niente. |
| eco-precisione-parziale-1 | parziale | precisione | Il gemito resta indietro, ma qualcuno potrebbe averlo sentito. |
| eco-precisione-parziale-2 | parziale | precisione | Si riparte, ma il fiato è un po' più corto di prima. |
| eco-precisione-fallimento-1 | fallimento | precisione | Il rumore dell'arma a terra resta sospeso nell'aria, troppo a lungo. |
| eco-precisione-fallimento-2 | fallimento | precisione | Bisogna guardarsi alle spalle, ora, un po' più spesso. |

### Per fascia di margine

Lega l'esito a quanto sta salendo la tensione accumulata nella partita
(`fasciaMargine` è calcolata automaticamente dal motore, non va passata a
mano).

| id | fasciaMargine | testo |
|---|---|---|
| eco-margine-basso | basso | La città è ancora leggibile, per ora. |
| eco-margine-medio | medio | Qualcosa nel piano comincia a scricchiolare tra i vicoli. |
| eco-margine-alto | alto | Il margine si assottiglia: un altro passo falso, e la barricata non sarà l'unica a cedere. |
| eco-margine-critico | critico | Il piano cede tutto insieme, come il legno della barricata: non c'è più tempo per calcolare. |
| eco-margine-critico-2 | critico | Milano si richiude attorno alla squadra: il conto di ogni scelta arriva tutto insieme, ora. |
