# Pool di contenuto del Cronista — Nodo 1915-carso-piave

Frammenti narrativi veri per il Nodo Temporale "1915-carso-piave" (La
Resistenza, Carso e Piave 1915-1918), usati dal Cronista
(`src/lib/narratore-simulato.js`) tramite il caricatore
`narratore-corsa-invisibile-loader.js`.

Questo pool copre la risposta a tiro reale "Uscite a recuperarlo sotto il
fuoco" (richiesta carso-bombardamento, competenzaRichiesta: passoAvanti):
recuperare un commilitone ferito sotto il bombardamento.

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
| apertura-pieno-1 | pieno | Non c'è un attimo di esitazione: il corpo si muove prima che la testa finisca di decidere. |
| apertura-pieno-2 | pieno | Il fango non trattiene nessuno, stavolta: si esce come se il fuoco non ci fosse. |
| apertura-parziale-1 | parziale | Si esce comunque, anche se le gambe pesano più del solito. |
| apertura-parziale-2 | parziale | Il gelo morde le mani anche mentre corrono verso il fuoco. |
| apertura-fallimento-1 | fallimento | Il corpo esita un istante di troppo, prima di lanciarsi allo scoperto. |
| apertura-fallimento-2 | fallimento | Il fango trattiene ogni passo, e il fuoco non aspetta. |

### Per ruolo

Flavor del personaggio in azione — restano neutri sull'esito (che si scopre
nello sviluppo), quindi non hanno una colonna `esito`.

| id | ruoloId | testo |
|---|---|---|
| apertura-ruolo-esploratore | esploratore | {ruolo} ha già calcolato il percorso più corto tra le schegge, prima di muoversi. |
| apertura-ruolo-fanfara | fanfara | {ruolo} grida di tenere la formazione, anche mentre uno di loro esce dalla trincea. |
| apertura-ruolo-custode | custode | {ruolo} resta sul bordo, pronto a tirare dentro chiunque torni. |
| apertura-ruolo-incursore | incursore | {ruolo} è già fuori, sul fango, prima che gli altri finiscano di capire cosa sta succedendo. |

## Slot: sviluppo

### Baseline per esito

| id | esito | testo |
|---|---|---|
| sviluppo-pieno-1 | pieno | Lo raggiungono, lo sollevano, tornano dentro: tre gesti, nessuno sprecato. |
| sviluppo-pieno-2 | pieno | Le schegge cadono intorno, ma sembrano non trovare mai il bersaglio giusto. |
| sviluppo-parziale-1 | parziale | Lo raggiungono, ma il peso del ferito si fa sentire su ogni passo del ritorno. |
| sviluppo-parziale-2 | parziale | Il fango rallenta la corsa proprio quando servirebbe volare. |
| sviluppo-fallimento-1 | fallimento | Una scheggia sfiora chi porta il ferito, e il ritorno diventa più lungo del previsto. |
| sviluppo-fallimento-2 | fallimento | Il bombardamento si stringe attorno a loro, e ogni passo verso la trincea costa doppio. |

### Per competenza

Come si è manifestata l'azione, indipendentemente da quanto sia andata bene
(quello resta nel frammento baseline scelto per lo stesso slot) — quindi non
hanno una colonna `esito`.

| id | competenzaId | testo |
|---|---|---|
| sviluppo-competenza-cadenza | cadenza | È la Cadenza a scandire la corsa: nessun passo fuori tempo, nemmeno sotto il fuoco. |
| sviluppo-competenza-precisione | precisione | È la Precisione a scegliere dove mettere i piedi tra le buche e il filo spinato. |
| sviluppo-competenza-spiritoDiCorpo | spiritoDiCorpo | È lo Spirito di Corpo a portare avanti chi non ce la farebbe da solo. |
| sviluppo-competenza-passoAvanti | passoAvanti | È il Passo Avanti a spingere oltre il bordo della trincea, quando restare sarebbe più facile. |
| sviluppo-competenza-ancoraggio | ancoraggio | È l'Ancoraggio a tenere la mente ferma, mentre il bombardamento prova a spezzarla. |

## Slot: eco

### Baseline per esito

| id | esito | testo |
|---|---|---|
| eco-pieno-1 | pieno | Il ferito è dentro, vivo, e per un istante il gelo sembra meno feroce. |
| eco-parziale-1 | parziale | Il ferito è dentro. Il prezzo pagato in fiato e paura resta lì, tra loro. |
| eco-fallimento-1 | fallimento | Il ferito è dentro, ma la trincea trattiene anche il ricordo di quanto ci è mancato poco. |

### Per fascia di margine

Lega l'esito a quanto sta salendo la tensione accumulata nella partita
(`fasciaMargine` è calcolata automaticamente dal motore, non va passata a
mano).

| id | fasciaMargine | testo |
|---|---|---|
| eco-margine-basso | basso | Il fronte resta immobile, per ora, e la squadra con lui. |
| eco-margine-medio | medio | Qualcosa comincia a logorarsi, sotto il gelo e il fango, un millimetro alla volta. |
| eco-margine-alto | alto | Il margine si assottiglia come la trincea sotto il bombardamento continuo. |
| eco-margine-critico | critico | Tutto cede insieme, come il fango sotto il peso di troppi passi: non resta tempo per calcolare. |
| eco-margine-critico-2 | critico | Il Carso si richiude attorno alla squadra: ogni ora passata qui pesa quanto un giorno. |
