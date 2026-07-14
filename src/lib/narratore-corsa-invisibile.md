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
| apertura-ruolo-fanfara | fanfara | {ruolo} scandisce il ritmo a fiato, prima ancora che gli altri si muovano. |
| apertura-ruolo-custode | custode | {ruolo} controlla la fila con un'occhiata, contando teste prima di contare metri. |
| apertura-ruolo-incursore | incursore | {ruolo} non aspetta il segnale: è già dentro il primo fossato. |

### Per momento (Prompt 14)

Aperture specifiche dei quattro momenti a tiro nuovi: condizionate su
`richiestaId` per non mescolarsi con le scene degli altri momenti né con la
corsa iniziale. Nessun vincolo di esito (è flavor della scena).

| id | richiestaId | testo |
|---|---|---|
| apertura-ordine-1 | ordine-che-non-arriva | Il campo si muove prima che qualcuno lo dica. |
| apertura-ordine-2 | ordine-che-non-arriva | Non c'è un segnale. C'è solo gente che ha smesso di aspettarlo. |
| apertura-ordine-3 | ordine-che-non-arriva | Il grigio di Torino non si alza. Gli uomini sì. |
| apertura-decisione-1 | decisione-presa-prima | I bersagli di legno stanno in fondo al campo e non si muovono. È l'unica cosa ferma qui. |
| apertura-decisione-2 | decisione-presa-prima | Gli spari arrivano a raffica irregolare, come passi. |
| apertura-decisione-3 | decisione-presa-prima | L'aria sa di polvere e di carbone. |
| apertura-quando-1 | quando-nessuno-guarda | La Marmora è dall'altra parte del campo. Di spalle. |
| apertura-quando-2 | quando-nessuno-guarda | Per un momento, il campo è solo vostro. |
| apertura-quando-3 | quando-nessuno-guarda | Nessuno vi sta guardando. È questa la prova. |
| apertura-fiato-1 | fiato-corto | Un corpo piegato sulle ginocchia, in mezzo a un campo che corre. |
| apertura-fiato-2 | fiato-corto | Il respiro di uno solo, e si sente sopra tutto il resto. |
| apertura-fiato-3 | fiato-corto | Fermarsi non è previsto. Non è vietato: è che non è previsto. |

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

### Per momento (Prompt 14)

Sviluppi specifici dei quattro momenti a tiro nuovi, condizionati su
`richiestaId`. Nessun vincolo di esito (il "come è andata" resta nel
frammento baseline dello stesso slot).

| id | richiestaId | testo |
|---|---|---|
| sviluppo-ordine-1 | ordine-che-non-arriva | La Marmora cammina lungo una fila che non esiste più, le mani dietro la schiena. |
| sviluppo-ordine-2 | ordine-che-non-arriva | Nessuno spiega niente a nessuno. Nessuno sembra averne bisogno. |
| sviluppo-ordine-3 | ordine-che-non-arriva | Il fiato degli uomini si disperde nel freddo, sottile come fumo. |
| sviluppo-decisione-1 | decisione-presa-prima | Nessuno si ferma per tirare. Nessuno. |
| sviluppo-decisione-2 | decisione-presa-prima | Le mani lavorano da sole: caricano, alzano, tirano, riprendono il passo. |
| sviluppo-decisione-3 | decisione-presa-prima | La Marmora guarda i bersagli, non gli uomini. I bersagli dicono tutto. |
| sviluppo-quando-1 | quando-nessuno-guarda | Gli uomini attorno a voi corrono con la stessa andatura di prima. Non c'è nessuno da impressionare. |
| sviluppo-quando-2 | quando-nessuno-guarda | Correre quando nessuno guarda non è più difficile. È solo più facile smettere. |
| sviluppo-quando-3 | quando-nessuno-guarda | Il vapore dei respiri sale uguale, dappertutto. |
| sviluppo-fiato-1 | fiato-corto | Il campo scorre attorno come acqua attorno a un sasso. |
| sviluppo-fiato-2 | fiato-corto | Nessuno rallenta. Non per cattiveria. Semplicemente nessuno rallenta. |
| sviluppo-fiato-3 | fiato-corto | La Marmora ha smesso di camminare. Adesso guarda. |

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
| eco-margine-critico-2 | critico | La Marmora alza una mano: basta. Qualcosa nel piano si è rotto, e tocca alla squadra rimetterlo in piedi. |
| eco-margine-critico-3 | critico | Il Decalogo non lascia scampo: il margine è esaurito, e il conto arriva tutto insieme. |

### Per momento e fascia (Prompt 14)

Ecò specifiche dei quattro momenti a tiro nuovi: condizionate su `richiestaId`
E su `fasciaMargine`, una per fascia (basso / medio / alto / critico). Le
baseline per esito e le ecò per fascia qui sopra restano incondizionate su
`richiestaId`, così ogni momento ha comunque almeno un candidato.

| id | richiestaId | fasciaMargine | testo |
|---|---|---|---|
| eco-ordine-basso | ordine-che-non-arriva | basso | Il campo vi ha preso dentro. Per adesso. |
| eco-ordine-medio | ordine-che-non-arriva | medio | Qualcosa non gira nel verso giusto, e non sapete ancora dire cosa. |
| eco-ordine-alto | ordine-che-non-arriva | alto | Il margine si assottiglia: un altro passo falso, e sarà complicazione. |
| eco-ordine-critico | ordine-che-non-arriva | critico | Il margine è esaurito. Il conto arriva tutto insieme, come arriva sempre. |
| eco-decisione-basso | decisione-presa-prima | basso | Il legno scheggiato è la sola risposta che il campo dà. |
| eco-decisione-medio | decisione-presa-prima | medio | Il ritmo tiene, ma comincia a costare. |
| eco-decisione-alto | decisione-presa-prima | alto | Il margine si assottiglia: ogni colpo rubato al passo si paga più avanti. |
| eco-decisione-critico | decisione-presa-prima | critico | Il margine è esaurito. Non c'è più tempo da rubare a niente. |
| eco-quando-basso | quando-nessuno-guarda | basso | Il passo è quello di prima. Nessuno lo sa. Va bene così. |
| eco-quando-medio | quando-nessuno-guarda | medio | Il fiato comincia a dire cose che le gambe non ammettono. |
| eco-quando-alto | quando-nessuno-guarda | alto | Il margine si assottiglia: quello che vi tiene su non è più il fiato. |
| eco-quando-critico | quando-nessuno-guarda | critico | Il margine è esaurito. E stavolta qualcuno guarda. |
| eco-fiato-basso | fiato-corto | basso | Siete ancora una squadra. Lo si vede da poco, ma si vede. |
| eco-fiato-medio | fiato-corto | medio | Qualcosa si è incrinato, e non è il fiato. |
| eco-fiato-alto | fiato-corto | alto | Il margine si assottiglia: quello che state per decidere pesa più della corsa. |
| eco-fiato-critico | fiato-corto | critico | Il margine è esaurito. Adesso La Marmora sa chi siete. |
