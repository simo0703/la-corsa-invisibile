# Playtest zero — Log SIM C (taratura dell'interprete)

Data run: 2026-07-14T10:22:26.053Z
Interprete e librerie VERI (simulatore-interprete + src/lib/interprete-libero/1836-torino).
Manopole attuali: sogliaAlta = 0.6, margineDistacco = 0.15.

## Le 20 frasi coi valori attuali (0.6 / 0.15)
| id | richiesta | frase | migliore | secondo | distacco | esito | idx | atteso | coincide | errore |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | ginnastica | vado a tutta velocità, chi se ne frega dei rischi | 0.500 | 0.100 | 0.400 | manuale | — | automatica,0 | ✗ | falso-rifiuto |
| A2 | ginnastica | corro con calma e mi tengo il fiato per dopo | 0.400 | 0.200 | 0.200 | manuale | — | automatica,1 | ✗ | falso-rifiuto |
| A3 | ginnastica | do una mano a chi resta indietro | 0.714 | 0.143 | 0.571 | automatica | 2 | automatica,2 | ✓ |  |
| B6 | ginnastica | me ne frego e spingo | 0.000 | 0.000 | 0.000 | nessuna_corrispondenza | — | automatica,0 | ✗ | falso-rifiuto |
| B7 | ginnastica | non strafaccio, tengo il passo giusto | 0.167 | 0.167 | 0.000 | manuale | — | automatica,1 | ✗ | falso-rifiuto |
| B8 | ginnastica | nessuno resta indietro | 1.000 | 0.333 | 0.667 | automatica | 2 | automatica,2 | ✓ |  |
| C11 | ginnastica | corro veloce ma senza strafare | 0.600 | 0.600 | 0.000 | manuale | — | manuale | ✓ |  |
| C12 | ginnastica | corro | 1.000 | 1.000 | 0.000 | manuale | — | manuale | ✓ |  |
| C13 | ginnastica | vado forte però attento a non cadere | 0.429 | 0.286 | 0.143 | manuale | — | manuale | ✓ |  |
| C14 | ginnastica | corro con gli altri | 0.250 | 0.250 | 0.000 | manuale | — | manuale | ✓ |  |
| D15 | ginnastica | mangio un panino | 0.000 | 0.000 | 0.000 | nessuna_corrispondenza | — | nessuna_corrispondenza | ✓ |  |
| D16 | ginnastica | chiamo mia madre | 0.000 | 0.000 | 0.000 | nessuna_corrispondenza | — | nessuna_corrispondenza | ✓ |  |
| D17 | ginnastica | asdfgh | 0.000 | 0.000 | 0.000 | nessuna_corrispondenza | — | nessuna_corrispondenza | ✓ |  |
| D18 | ginnastica | buongiorno a tutti | 0.333 | 0.000 | 0.333 | manuale | — | nessuna_corrispondenza | ✗ | falso-aggancio |
| D19 | ginnastica | «»(vuota) | 0.000 | 0.000 | 0.000 | nessuna_corrispondenza | — | nessuna_corrispondenza | ✓ |  |
| D20 | ginnastica | non lo so | 0.333 | 0.333 | 0.000 | manuale | — | nessuna_corrispondenza | ✗ | falso-aggancio |
| A5 | vaira | scherzo e cambio discorso | 0.750 | 0.000 | 0.750 | automatica | 1 | automatica,1 | ✓ |  |
| B10 | vaira | lo dico chiaro: ho paura | 0.600 | 0.000 | 0.600 | automatica | 0 | automatica,0 | ✓ |  |
| A4 | vaira-severo | ammetto che ho paura di sembrare debole | 0.714 | 0.143 | 0.571 | automatica | 0 | automatica,0 | ✓ |  |
| B9 | vaira-severo | tengo la bocca chiusa | 0.000 | 0.000 | 0.000 | nessuna_corrispondenza | — | automatica,1 | ✗ | falso-rifiuto |

## Conteggio errori coi valori attuali (0.6 / 0.15)
- **FALSI AUTOMATISMI** (il peggiore: azione non richiesta eseguita da sola): **0**
- **FALSI RIFIUTI** (frase A/B centrata ma non decisa): **5**
- **FALSI AGGANCI** (spazzatura D finita in manuale invece di nessuna_corrispondenza): **2**
- Corrette: 13/20

Dettaglio degli errori:
- [A1] «vado a tutta velocità, chi se ne frega dei rischi» → manuale (atteso automatica,0) = **falso-rifiuto**
- [A2] «corro con calma e mi tengo il fiato per dopo» → manuale (atteso automatica,1) = **falso-rifiuto**
- [B6] «me ne frego e spingo» → nessuna_corrispondenza (atteso automatica,0) = **falso-rifiuto**
- [B7] «non strafaccio, tengo il passo giusto» → manuale (atteso automatica,1) = **falso-rifiuto**
- [D18] «buongiorno a tutti» → manuale (atteso nessuna_corrispondenza) = **falso-aggancio**
- [D20] «non lo so» → manuale (atteso nessuna_corrispondenza) = **falso-aggancio**
- [B9] «tengo la bocca chiusa» → nessuna_corrispondenza (atteso automatica,1) = **falso-rifiuto**

## Griglia: come cambiano gli errori variando le manopole
sogliaAlta 0.40→0.80 (passo 0.05), margineDistacco 0.05→0.35 (passo 0.05). Le 20 frasi per ogni combinazione.

Legenda celle: `automatismi / rifiuti / agganci`.

| sogliaAlta ↓ / margineDistacco → | 0.05 | 0.10 | 0.15 | 0.20 | 0.25 | 0.30 | 0.35 |
|---|---|---|---|---|---|---|---|
| **0.40** | 1/3/2 | 1/3/2 | 0/3/2 | 0/3/2 | 0/4/2 | 0/4/2 | 0/4/2 |
| **0.45** | 0/4/2 | 0/4/2 | 0/4/2 | 0/4/2 | 0/4/2 | 0/4/2 | 0/4/2 |
| **0.50** | 0/4/2 | 0/4/2 | 0/4/2 | 0/4/2 | 0/4/2 | 0/4/2 | 0/4/2 |
| **0.55** | 0/5/2 | 0/5/2 | 0/5/2 | 0/5/2 | 0/5/2 | 0/5/2 | 0/5/2 |
| **0.60** | 0/5/2 | 0/5/2 | 0/5/2 | 0/5/2 | 0/5/2 | 0/5/2 | 0/5/2 |
| **0.65** | 0/6/2 | 0/6/2 | 0/6/2 | 0/6/2 | 0/6/2 | 0/6/2 | 0/6/2 |
| **0.70** | 0/6/2 | 0/6/2 | 0/6/2 | 0/6/2 | 0/6/2 | 0/6/2 | 0/6/2 |
| **0.75** | 0/8/2 | 0/8/2 | 0/8/2 | 0/8/2 | 0/8/2 | 0/8/2 | 0/8/2 |
| **0.80** | 0/9/2 | 0/9/2 | 0/9/2 | 0/9/2 | 0/9/2 | 0/9/2 | 0/9/2 |

## Raccomandazione dalla griglia (solo misura, nessuna modifica al codice)
- Combinazioni che **azzerano i FALSI AUTOMATISMI**: 61 su 63.
- Tra quelle, **minimo FALSI RIFIUTI = 3**; tra queste, minimo FALSI AGGANCI = 2.
- **Combinazione/i raccomandata/e** (automatismi 0, rifiuti minimi, agganci minimi):
  - **sogliaAlta = 0.40, margineDistacco = 0.15** → automatismi 0, rifiuti 3, agganci 2, corrette 15/20
  - **sogliaAlta = 0.40, margineDistacco = 0.20** → automatismi 0, rifiuti 3, agganci 2, corrette 15/20
- Confronto coi valori attuali (0.60 / 0.15): automatismi 0, rifiuti 5, agganci 2, corrette 13/20.
