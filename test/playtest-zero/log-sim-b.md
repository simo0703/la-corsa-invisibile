# Playtest zero — Log SIM B (Monte Carlo offline)

Data run: 2026-07-14T09:40:06.437Z
Regole prese dal codice vero: risolviAzione(), creaCompetenzeIniziali(), fasciaMargine(), GAME_CONFIG.
Soglia Margine: 5. Passo per esito: pieno +1, parziale +2, fallimento +3.

## PARTE 1 — Distribuzione del tiro (200.000 tiri per riga, dado 1d6 reale)

### Senza bonus di grado
| punteggio base | fallimento | parziale | pieno | totale medio |
|---|---|---|---|---|
| 3 (principale) | 16.6% | 49.9% | 33.4% | 6.50 |
| 2 (non principale) | 33.2% | 50.2% | 16.6% | 5.50 |

*Cosa significa: con la tua competenza forte (base 3) sbagli 1 volta su 6 e riesci in pieno 1 su 3; con una competenza debole (base 2) sbagli 1 volta su 3 e il pieno è raro.*

### Con bonus di grado +1 attivo
| punteggio base | fallimento | parziale | pieno | totale medio |
|---|---|---|---|---|
| 3+1 = 4 (principale) | 0.0% | 49.9% | 50.1% | 7.50 |
| 2+1 = 3 (non principale) | 16.6% | 50.1% | 33.3% | 6.50 |

*Cosa significa: un grado militare (+1) dimezza circa i fallimenti e alza molto i pieni — un veterano "tiene" dove una recluta cede.*

## PARTE 2 — Il Margine: ogni quanto trabocca
Soglia reale: 5. Dopo lo scoppio torna a 2 (dimezzamento, regola attuale). 100.000 nodi per riga.
Assunzione: tiri con la **competenza principale (base 3)** — il caso più favorevole ("mandi lo specialista"). Con base 2 traboccherebbe prima (vedi nota).

| N tiri | scoppi medi/nodo | % nodi con ≥1 scoppio | primo scoppio (tiro medio) | distanza media tra scoppi | basso | medio | alto | critico |
|---|---|---|---|---|---|---|---|---|
| 3 | 0.83 | 79.7% | 2.76 | 1.00 | 11% | 68% | 21% | 0.0% |
| 5 | 1.83 | 100.0% | 3.02 | 1.77 | 7% | 68% | 25% | 0.0% |
| 8 | 3.35 | 100.0% | 3.02 | 1.88 | 4% | 68% | 28% | 0.0% |
| 12 | 5.41 | 100.0% | 3.02 | 1.91 | 3% | 68% | 29% | 0.0% |
| 20 | 9.53 | 100.0% | 3.02 | 1.93 | 2% | 68% | 30% | 0.0% |

*Cosa significa: "scoppi medi/nodo" = quante complicazioni da Margine ti aspetti in un nodo di quella lunghezza; "primo scoppio" = a che tiro arriva la prima; "distanza" = ogni quanti tiri arrivano le successive.*

> **⚠️ CORREZIONE (verifica del 14/07/2026, Prompt 5)**: le colonne
> basso/medio/alto/critico qui sopra misurano la **fascia "a riposo"** —
> il valore del Margine DOPO l'eventuale scoppio e reset, cioè quello che
> resta tra una scelta e l'altra. NON è la fascia che arriva al Cronista:
> il motore (`GameSession.applicaRisposta`) chiama il Cronista PRIMA del
> reset, quindi nel turno dello scoppio il Cronista vede il valore pieno.
> Misura corretta della **fascia vista dal Cronista** (20.000 tiri
> consecutivi, ordine reale del motore, regola di allora "torna a 2"):
> base 3 → basso 0% / medio 17% / alto 31% / **critico ~52%**;
> base 2 → critico ~59%. Il "critico 0,0%" della tabella NON significa
> che i frammenti eco-margine-critico siano invisibili: sono anzi i più
> frequenti nei nodi ricchi di tiri. Nota inoltre che queste tabelle sono
> state misurate con la regola di ALLORA (scoppio → dimezzamento a 2):
> dal 14/07/2026 vale l'azzeramento a 0 (Decisione #23), che corrisponde
> alla variante (b) della Parte 3.

**Distribuzione del PRIMO scoppio (nodi da 8 tiri):**
| al tiro n. | 2 | 3 | 4 | 5 |
|---|---|---|---|---|
| % dei nodi | 19% | 60% | 19% | 1% |

**Verifica dell'ipotesi** (primo scoppio ~3° tiro, successivi ogni ~2 tiri):
- Primo scoppio medio (N=8): **3.02 tiri** → ipotesi "~3": CONFERMATA.
- Distanza media tra scoppi (N=8): **1.88 tiri** → ipotesi "~2": CONFERMATA.
*Il dimezzamento riporta a 2, non a 0: per questo dopo il primo scoppio ne bastano molti meno per il successivo.*

*Nota (competenza debole, base 2, N=8): primo scoppio a 2.60 tiri, 4.02 scoppi/nodo — chi tira "fuori ruolo" fa traboccare il Margine più in fretta.*

## PARTE 3 — Varianti del dimezzamento (N = 8 e 12, base 3)

### Nodo da 8 tiri
| variante | scoppi medi/nodo | distanza media tra scoppi |
|---|---|---|
| (a) torna a 2 — oggi | 3.35 | 1.88 |
| (b) torna a 0 — azzeramento | 2.31 | 2.91 |
| (c) torna a 0 + soglia +1 ogni scoppio | 2.00 | 3.52 |

### Nodo da 12 tiri
| variante | scoppi medi/nodo | distanza media tra scoppi |
|---|---|---|
| (a) torna a 2 — oggi | 5.41 | 1.91 |
| (b) torna a 0 — azzeramento | 3.67 | 2.96 |
| (c) torna a 0 + soglia +1 ogni scoppio | 2.95 | 3.80 |

*Cosa significa: "torna a 0" rende la complicazione un vero respiro (gli scoppi si diradano); "soglia +1" li dirada sempre di più, così un nodo lungo non diventa una sequenza di guai a raffica.*

## PARTE 4 — I puntiExtra (3 punti mai assegnati)
Regole di creazione reali: principale 3, altre 2, punti extra 3, tetto 5. Punteggi costruiti con creaCompetenzeIniziali() reale (Esploratore).

| regola | punt. principale | fall/parz/pieno (principale) | punt. non princ. | fall/parz/pieno (non princ.) |
|---|---|---|---|---|
| (a) zero extra (oggi) | 3 | 16.6% / 50.0% / 33.4% | 2 | 33.1% / 50.3% / 16.6% |
| (b) +1 a 3 non principali | 3 | 16.6% / 49.9% / 33.5% | 3 | 16.7% / 49.8% / 33.6% |
| (c) 3 sulla principale (cap 5) | 5 | 0.0% / 33.2% / 66.8% | 2 | 33.3% / 50.1% / 16.7% |

*Cosa significa: (b) tocca poco la specialità ma toglie fragilità alle competenze deboli (meno fallimenti fuori ruolo); (c) su un solo punto forte porta la principale al tetto 5 — pieni frequentissimi, ma il resto resta fragile. È la scelta "specialista vs. equilibrato".*

## Risposta secca
- **Quanti tiri servono perché il Margine si accenda almeno una volta?** Con la competenza principale (base 3): un nodo da 3 tiri trabocca nel 80% dei casi; il primo scoppio arriva in media al 3.02° tiro. In pratica: **sotto i ~3 tiri il Margine quasi non si accende; serve un nodo da almeno 3-4 tiri perché la complicazione diventi probabile.**
- **Il dimezzamento a 2 è troppo generoso?** No verso il basso, sì verso l'alto: dopo il primo scoppio i successivi arrivano ogni ~1.9 tiri (contro i ~3.0 del primo), perché ripartire da 2 lascia solo 3 punti al prossimo scoppio. In un nodo lungo questo produce guai "a raffica". Le varianti (b)/(c) della Parte 3 li diradano.
