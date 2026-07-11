# Pool di contenuto del Cronista — Nodo missione-moderna

Frammenti narrativi veri per il Nodo Temporale "missione-moderna" (La
Stabilità, Libano/Balcani/Iraq/Afghanistan), usati dal Cronista
(`src/lib/narratore-simulato.js`) tramite il caricatore
`narratore-corsa-invisibile-loader.js`.

Questo pool copre la risposta a tiro reale "Ignorate la provocazione e
restate calmi" (richiesta moderna-provocazione, competenzaRichiesta:
ancoraggio): mantenere il controllo sotto una sfida pubblica, senza
reagire, davanti a tutto il villaggio.

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
| apertura-pieno-1 | pieno | Non un muscolo si tende, non uno sguardo si abbassa: la provocazione scivola via senza trovare presa. |
| apertura-pieno-2 | pieno | Il silenzio che segue la provocazione dice più di qualsiasi risposta. |
| apertura-parziale-1 | parziale | Si resta fermi, ma il silenzio costa più di quanto sembri da fuori. |
| apertura-parziale-2 | parziale | Nessuno si muove, nessuno risponde — ma la tensione resta lì, sospesa. |
| apertura-fallimento-1 | fallimento | La calma tiene, ma solo per un soffio: qualcosa nello sguardo tradisce lo sforzo. |
| apertura-fallimento-2 | fallimento | Restare fermi costa più del previsto, con tutto il villaggio a guardare. |

### Per ruolo

Flavor del personaggio in azione — restano neutri sull'esito (che si scopre
nello sviluppo), quindi non hanno una colonna `esito`.

| id | ruoloId | testo |
|---|---|---|
| apertura-ruolo-esploratore | esploratore | {ruolo} tiene d'occhio la folla, non il giovane che provoca. |
| apertura-ruolo-fanfara | fanfara | {ruolo} non dà alcun segnale: il silenzio, stavolta, è l'ordine giusto. |
| apertura-ruolo-custode | custode | {ruolo} si mette leggermente davanti, senza un gesto che sembri una minaccia. |
| apertura-ruolo-incursore | incursore | {ruolo} trattiene ogni istinto che spingerebbe a rispondere subito. |

## Slot: sviluppo

### Baseline per esito

| id | esito | testo |
|---|---|---|
| sviluppo-pieno-1 | pieno | La provocazione si spegne da sola, senza che nessuno le dia peso. |
| sviluppo-pieno-2 | pieno | Il capo villaggio osserva ogni istante di quella calma, e la registra. |
| sviluppo-parziale-1 | parziale | La pattuglia regge, ma il giovane insiste ancora un poco prima di lasciar perdere. |
| sviluppo-parziale-2 | parziale | La calma tiene, anche se qualcuno nella pattuglia stringe i denti per mantenerla. |
| sviluppo-fallimento-1 | fallimento | La calma tiene per un pelo: un passo in più, e sarebbe stata un'altra scena. |
| sviluppo-fallimento-2 | fallimento | Nessuno risponde, ma il silenzio pesa più di quanto dovrebbe su tutta la pattuglia. |

### Per competenza

Come si è manifestata l'azione, indipendentemente da quanto sia andata bene
(quello resta nel frammento baseline scelto per lo stesso slot) — quindi non
hanno una colonna `esito`.

| id | competenzaId | testo |
|---|---|---|
| sviluppo-competenza-cadenza | cadenza | È la Cadenza a scandire il silenzio: nessun secondo di troppo, nessuno di meno. |
| sviluppo-competenza-precisione | precisione | È la Precisione a leggere la folla, capendo quando il silenzio ha fatto il suo lavoro. |
| sviluppo-competenza-spiritoDiCorpo | spiritoDiCorpo | È lo Spirito di Corpo a tenere la pattuglia compatta, senza che nessuno reagisca da solo. |
| sviluppo-competenza-passoAvanti | passoAvanti | È il Passo Avanti a restare fermo, quando muoversi sarebbe stato più facile. |
| sviluppo-competenza-ancoraggio | ancoraggio | È l'Ancoraggio a tenere la mente ferma, mentre la provocazione cerca una reazione. |

## Slot: eco

### Baseline per esito

| id | esito | testo |
|---|---|---|
| eco-pieno-1 | pieno | Il capo villaggio osserva la vostra pazienza. Forse è proprio questo che stava aspettando di vedere. |
| eco-parziale-1 | parziale | La tensione si scioglie, lenta. Resta il ricordo di quanto sia costato restare fermi. |
| eco-fallimento-1 | fallimento | La provocazione è passata, ma la pattuglia sa quanto poco sarebbe bastato per farla degenerare. |

### Per fascia di margine

Lega l'esito a quanto sta salendo la tensione accumulata nella partita
(`fasciaMargine` è calcolata automaticamente dal motore, non va passata a
mano).

| id | fasciaMargine | testo |
|---|---|---|
| eco-margine-basso | basso | Il villaggio resta tranquillo, per ora, e la pattuglia con lui. |
| eco-margine-medio | medio | Ogni provocazione lasciata cadere si accumula, silenziosa, sotto la superficie. |
| eco-margine-alto | alto | Il margine si assottiglia: la pazienza, prima o poi, avrà un costo da pagare. |
| eco-margine-critico | critico | Non resta più margine per restare calmi: la prossima provocazione andrà affrontata diversamente. |
| eco-margine-critico-2 | critico | La tensione nel villaggio si accumula tutta insieme, come acqua dietro una diga troppo a lungo tenuta. |
