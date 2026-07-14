# Playtest zero — strumenti di misura

Questa cartella è il **playtest zero** de *La Corsa Invisibile*: una serie di
prove fatte prima ancora di far giocare persone vere, per **misurare** come si
comporta il gioco e decidere le tarature (le "manopole" delle regole).

**Regola d'oro di questa cartella: qui si MISURA, non si corregge.** Gli
strumenti non modificano il gioco: lo osservano e scrivono un log. Le eventuali
correzioni al gioco si fanno altrove, nel codice vero, e solo dopo aver guardato
questi numeri.

**Questa cartella NON fa parte della batteria di test.** La batteria (i file
`test-*.mjs` nella radice del repo) verifica che il codice sia corretto e deve
restare verde. Questi sono strumenti di osservazione, non asserzioni: girano a
mano, quando servono, e non vengono lanciati con la batteria.

## I tre strumenti

### 1. `sim-a-funzionale.mjs` — una partita intera, dal vivo
Gioca una partita completa del nodo `1836-torino` con 4 giocatori simulati
(Esploratore che comanda, Incursore, Fanfara, Custode). Serve a vedere se il
motore "regge" una partita vera dall'inizio alla fine: ingressi, comando, tiro,
testo libero, chat, e il **Riconoscimento** (a metà partita il Custode "perde"
la connessione e rientra, con la conferma di un compagno).

⚠️ **La Sim A gioca in PRODUZIONE** (`https://la-corsa-invisibile.roomzero.workers.dev`):
crea davvero delle stanze di test sul server vero. I nomi cominciano con "Sim…"
proprio per riconoscerle come prove. Non serve pulirle: restano vuote e
inattive.

Come si rilancia:
```
node test/playtest-zero/sim-a-funzionale.mjs
```
Le scelte del computer sono a seme fisso, quindi il percorso è sempre lo stesso;
l'unico numero che cambia da una volta all'altra è il **dado**, perché lo tira
il server.

### 2. `sim-b-montecarlo.mjs` — tantissimi tiri, offline
Non usa il server: importa le funzioni vere del gioco (tiro, soglie, Margine) e
le fa girare centinaia di migliaia di volte, per misurare le probabilità: quanto
spesso si fa pieno/parziale/fallimento, ogni quanti tiri il Margine "trabocca",
e come cambierebbe con regole diverse.

Come si rilancia:
```
node test/playtest-zero/sim-b-montecarlo.mjs
```

⚠️ **Avvertenza sulla tabella delle fasce** (basso/medio/alto/critico) nella
Parte 2 di `log-sim-b.md`: quella tabella misura la fascia **"a riposo"** — il
valore del Margine *dopo* l'eventuale scoppio e reset, cioè quello che resta tra
una scelta e l'altra. **Non** è la fascia che vede il Cronista: il motore chiama
il Cronista *prima* del reset, quindi nel turno dello scoppio il Cronista vede il
valore pieno (fascia "critico"). La misura corretta della fascia vista dal
Cronista è nella **nota di correzione dentro `log-sim-b.md`** (a regime la fascia
"critico" arriva al Cronista circa il 52% delle volte, non lo 0%).

### 3. `sim-c-interprete.mjs` — l'interprete del testo libero, offline
Prova 20 frasi da tavolo contro le librerie vere del nodo `1836-torino` e misura
quando l'interprete decide da solo, quando chiede al comandante, quando dice che
non ha capito. Poi fa una griglia: cosa succederebbe spostando le due manopole
(`sogliaAlta`, `margineDistacco`). Non tocca le manopole nel codice: le passa
solo come numeri per misurare.

Come si rilancia:
```
node test/playtest-zero/sim-c-interprete.mjs
```

## A cosa sono servite queste misure

Le decisioni prese grazie al playtest zero sono nel log del progetto
(`DECISIONI_LA_CORSA_INVISIBILE.md`):

- **Decisione #22 — Colpo secco**: il dado 1 è sempre un fallimento. È nata dalla
  Sim B, che ha misurato come, senza questa regola, un giocatore con il bonus di
  grado (base 4 + 1d6) non potesse **mai** fallire (0,0%): il grado spegneva la
  tensione.
- **Decisione #23 — Azzeramento del Margine**: dopo la complicazione il Margine
  torna a 0, non più a 2. Anche questa dalla Sim B: col vecchio dimezzamento gli
  scoppi arrivavano ogni ~1,9 tiri (guai a raffica); con l'azzeramento ogni ~2,9.
- **Bersaglio 6-8 tiri per nodo (Decisione #24)**: viene da qui. La Sim A ha
  mostrato che `1836-torino` ha **un solo tiro reale** (quindi il Margine non si
  accende mai), e la Sim B che servono ~6-8 tiri per avere circa 2 complicazioni
  a nodo. È il criterio per il prossimo lavoro di conversione delle risposte.

La Sim C ha inoltre confermato che l'interprete **non produce falsi automatismi**
(non esegue mai un'azione sbagliata da solo): il difetto vero non sono le
manopole, ma il **vocabolario povero** delle librerie: frasi da tavolo come
"me ne frego e spingo" o "tengo la bocca chiusa" oggi non vengono riconosciute.
