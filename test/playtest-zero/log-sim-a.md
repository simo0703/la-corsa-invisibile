# Playtest zero — Log SIM A (partita funzionale completa)

Data run: 2026-07-14T10:11:05.723Z
Ambiente: https://la-corsa-invisibile.roomzero.workers.dev (PRODUZIONE)
Seme RNG client: 20260714 — Nodo: 1836-torino

margineSoglia (da /api/config): 5

## Stanza di test
roomId: `1a4745c1-336d-41f2-97a9-be020396f9b6`

## Ingressi (/join)
- SimEsploratore (esploratore) → id e59bf020…, comandante=true
- SimIncursore (incursore) → id cbafb852…, comandante=false
- SimFanfara (fanfara) → id 7b4d68a8…, comandante=false
- SimCustode (custode) → id 60767b3b…, comandante=false

## Partita — passo per passo
- **avvio nodo** 1836-torino da SimEsploratore (comandante). Prima richiesta: `decalogo-ginnastica`
- **[1] tiro** — SimEsploratore sceglie «A tutta velocità, senza calcolare i rischi» su `decalogo-ginnastica` → esito parziale (dado 2, tot 5)

### Evento scriptato — Riconoscimento del Custode (rientro ospite)
- Il Custode scarta token+id (simulando perdita localStorage). Vecchio id: 60767b3b…
- /richiedi-rientro su 60767b3b… → biglietto ricevuto
- /conferma-riconoscimento da SimIncursore → status 200
- /reclama-rientro → **approvato**. Nuovo token ricevuto, id ripristinato: STESSO id
- Verifica "stesso personaggio, stesso stato": ruolo custode (era custode), competenze INVARIATE → OK

### Resto del nodo (bottoni + testo libero alternati)
- **[2] testo libero (ambiguo→comandante)** — SimFanfara: «Ammettete che è la paura di» → risolto su risposta #0

- **Nodo concluso**: SÌ. Esito finale: "L'addestramento è finito. Non tutti sono pronti allo stesso modo, ma si corre insieme."

## Coerenza finale (i 4 giocatori vedono la stessa stanza)
- Le 4 fotografie della stanza (margine/orologio/giocatori/nodo/chat) sono IDENTICHE ✓
- Snapshot: `{"margine":1,"orologio":2,"nGiocatori":4,"nodo":"1836-torino","chat":8}`
- Messaggi in chat per giocatore: {"esploratore":2,"incursore":2,"fanfara":2,"custode":2} (ognuno deve avere ≥2)

## Misure (PASSO 3)

### a) Passi
- [1] SimEsploratore · `decalogo-ginnastica` · «A tutta velocità, senza calcolare i rischi» · esito: parziale
- [2] SimFanfara · `decalogo-vaira-severo` · «Ammettete che è la paura di sembrare deboli» · esito: (nessun tiro)

### b) Tiri
- [1] SimEsploratore · cadenza: base 3 + dado 2 = **5** → parziale

### c) Margine, tiro per tiro
| passo | prima | +delta | dopo | soglia | fascia | traboccato |
|---|---|---|---|---|---|---|
| 1 | 0 | +2 | 2 | 5 | medio | no |
| 2 | 2 | -1 | 1 | 5 | basso | no |

**Traboccamenti totali nel nodo: 0.**
- Il Margine non ha mai raggiunto la soglia 5 in questo nodo (con 1 tiro/i e 2 scelte). Dato utile alla taratura: la soglia potrebbe essere alta per un nodo breve.

### d) Frammenti del Cronista (finestra anti-ripetizione = 12)
- storicoFrammenti finale (3 id): `apertura-ruolo-esploratore, sviluppo-parziale-2, eco-parziale-1`
- Ripetizioni entro la finestra di 12: NESSUNA ✓
- Nota: 1836-torino ha una sola risposta a tiro, quindi il Cronista scatta una sola volta (≈3 id, uno per slot): la finestra di 12 non può essere realmente stressata in un singolo nodo — servirebbero più tiri o repliche.

## Smoke test contenuti degli altri 4 nodi (offline, PASSO 4)
- **1848-milano** (narratore-1848-milano.md): slot [apertura,eco,sviluppo] ✓; composizione OK
- **1915-carso-piave** (narratore-1915-carso-piave.md): slot [apertura,eco,sviluppo] ✓; composizione OK
- **emergenza-civile** (narratore-emergenza-civile.md): slot [apertura,eco,sviluppo] ✓; composizione OK
- **missione-moderna** (narratore-missione-moderna.md): slot [apertura,eco,sviluppo] ✓; composizione OK

## ANOMALIE
- (nessuna)
