# Pool di contenuto del Cronista — Nodo emergenza-civile

Frammenti narrativi veri per il Nodo Temporale "emergenza-civile"
(L'Emergenza, Firenze 1966 / Friuli 1976 / L'Aquila 2009), usati dal
Cronista (`src/lib/narratore-simulato.js`) tramite il caricatore
`narratore-corsa-invisibile-loader.js`.

Questo pool copre la risposta a tiro reale "Restate a parlare, guadagnando
la loro fiducia" (richiesta emergenza-famiglia, competenzaRichiesta:
spiritoDiCorpo): convincere una famiglia spaventata a lasciare la propria
casa, sotto pressione di tempo, senza forzarla.

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
| apertura-pieno-1 | pieno | Non si alza la voce, non serve: bastano le parole giuste, dette con calma. |
| apertura-pieno-2 | pieno | Lo sguardo della famiglia si posa su chi parla, e per un attimo la paura lascia spazio all'ascolto. |
| apertura-parziale-1 | parziale | Le parole arrivano, ma il tempo che passa pesa quanto quelle non ancora dette. |
| apertura-parziale-2 | parziale | Si resta a parlare, mentre fuori l'orologio corre più veloce della pazienza. |
| apertura-fallimento-1 | fallimento | Le prime parole cadono nel vuoto: la paura, per ora, vince sull'ascolto. |
| apertura-fallimento-2 | fallimento | La famiglia resta ferma sulla soglia, e ogni frase sembra scivolare via. |

### Per ruolo

Flavor del personaggio in azione — restano neutri sull'esito (che si scopre
nello sviluppo), quindi non hanno una colonna `esito`.

| id | ruoloId | testo |
|---|---|---|
| apertura-ruolo-esploratore | esploratore | {ruolo} ha già letto la paura sul viso di chi ascolta, prima ancora di parlare. |
| apertura-ruolo-fanfara | fanfara | {ruolo} abbassa il tono, sapendo che qui non serve un segnale ma una voce sola. |
| apertura-ruolo-custode | custode | {ruolo} si mette all'altezza dei più piccoli, prima di dire una sola parola agli adulti. |
| apertura-ruolo-incursore | incursore | {ruolo} resta fermo sulla soglia, contro ogni istinto che spingerebbe ad agire subito. |

## Slot: sviluppo

### Baseline per esito

| id | esito | testo |
|---|---|---|
| sviluppo-pieno-1 | pieno | La diffidenza si scioglie una parola alla volta, finché sono loro a decidere di uscire. |
| sviluppo-pieno-2 | pieno | Non serve toccarli nemmeno una volta: la fiducia guadagnata basta a muoverli. |
| sviluppo-parziale-1 | parziale | La famiglia cede, ma solo dopo aver visto che nessuno se ne sarebbe andato senza di loro. |
| sviluppo-parziale-2 | parziale | Ogni minuto guadagnato in fiducia è un minuto perso altrove, e lo sanno tutti. |
| sviluppo-fallimento-1 | fallimento | Le parole faticano a trovare presa, e il tempo che resta si assottiglia. |
| sviluppo-fallimento-2 | fallimento | Serve più tempo del previsto perché la paura lasci il posto, anche solo un poco, alla fiducia. |

### Per competenza

Come si è manifestata l'azione, indipendentemente da quanto sia andata bene
(quello resta nel frammento baseline scelto per lo stesso slot) — quindi non
hanno una colonna `esito`.

| id | competenzaId | testo |
|---|---|---|
| sviluppo-competenza-cadenza | cadenza | È la Cadenza a misurare ogni pausa, senza mai lasciare che il silenzio diventi ansia. |
| sviluppo-competenza-precisione | precisione | È la Precisione a scegliere le parole giuste, una alla volta, senza sprecarne nessuna. |
| sviluppo-competenza-spiritoDiCorpo | spiritoDiCorpo | È lo Spirito di Corpo a rendere quella voce credibile: non promette, sta lì. |
| sviluppo-competenza-passoAvanti | passoAvanti | È il Passo Avanti a restare, anche quando ogni istinto direbbe di forzare la mano. |
| sviluppo-competenza-ancoraggio | ancoraggio | È l'Ancoraggio a tenere la voce ferma, mentre il tempo che stringe spingerebbe a tremare. |

## Slot: eco

### Baseline per esito

| id | esito | testo |
|---|---|---|
| eco-pieno-1 | pieno | Escono con le proprie gambe, e quella fiducia resta un peso leggero da portare. |
| eco-parziale-1 | parziale | Sono al sicuro. Il tempo perso a convincerli resta comunque un conto da pagare. |
| eco-fallimento-1 | fallimento | Sono al sicuro, alla fine — ma la squadra porta con sé quanto ci sia mancato poco. |

### Per fascia di margine

Lega l'esito a quanto sta salendo la tensione accumulata nella partita
(`fasciaMargine` è calcolata automaticamente dal motore, non va passata a
mano).

| id | fasciaMargine | testo |
|---|---|---|
| eco-margine-basso | basso | Il tempo perduto qui non pesa ancora sul resto della giornata. |
| eco-margine-medio | medio | Ogni minuto speso a convincere si accumula, lentamente, altrove. |
| eco-margine-alto | alto | Il margine si assottiglia: ogni casa che resiste costa più di quella prima. |
| eco-margine-critico | critico | Non resta più tempo per convincere nessuno: la prossima porta si forza, non si apre. |
| eco-margine-critico-2 | critico | La città intera sembra resistere ora, una porta chiusa dopo l'altra. |
