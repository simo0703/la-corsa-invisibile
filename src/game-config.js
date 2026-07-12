// Contenuto narrativo di "La Corsa Invisibile".
// Il motore (index.js, durable-objects/) non deve MAI contenere
// direttamente questi testi: li legge sempre da qui.

export const GAME_CONFIG = {
  gameId: "la_corsa_invisibile",
  titolo: "La Corsa Invisibile",
  romanzoDiRiferimento: "Il ragazzo che correva nel tempo / I passi tornano",

  // Soglia del Margine: valore segnaposto, DA CONFERMARE insieme alla
  // definizione stessa del Margine (vedi commento in GameSession.js).
  // Al raggiungimento, scatta una complicazione e il margine si dimezza.
  margineSoglia: 5,
  margineComplicazioneTesto:
    "Il margine è esaurito: qualcosa si è rotto nel piano, e la squadra deve reagire.",

  // Numero massimo di giocatori per stanza: gli 8 posti fissi al tavolo
  // (vedi lo sfondo tavolo-sfondo.jpg in public/img/ e i POSTI_TAVOLO in
  // public/index.html). Oltre questo limite, /join rifiuta il nuovo
  // giocatore invece di aggiungerlo senza un posto dove metterlo.
  maxGiocatori: 8,

  // Risorse di squadra (party-level, non per singolo personaggio)
  risorseDiSquadra: {
    cadenza: {
      nome: "Cadenza",
      descrizione: "Il ritmo della squadra. Si alimenta agendo, si svuota esitando.",
    },
    spiritoDiCorpo: {
      nome: "Spirito di Corpo",
      descrizione: "Riserva condivisa di salute e stabilità mentale del gruppo.",
    },
    passoAvanti: {
      nome: "Passo Avanti",
      descrizione: "Punti che rappresentano la decisione conscia di superare la paura.",
    },
  },

  // Le 5 competenze personali (diverse dalle risorse di squadra, anche se
  // tre condividono il nome: una competenza alta aiuta il personaggio a
  // contribuire meglio alla risorsa di squadra omonima). Ogni ruolo ha UNA
  // competenza principale che pesa di più; le altre restano secondarie e
  // possono sovrapporsi tra ruoli diversi. "ancoraggio" non è principale per
  // nessun ruolo: è trasversale, la stabilità personale contro la paura.
  // NUMERI DA CONFERMARE (segnati anche nel log delle decisioni).
  competenze: {
    cadenza: { nome: "Cadenza", descrizione: "Velocità di reazione e movimento." },
    precisione: { nome: "Precisione", descrizione: "Controllo tecnico, mira, esecuzione esatta." },
    spiritoDiCorpo: { nome: "Spirito di Corpo", descrizione: "Cura, coesione, capacità di reggere il gruppo." },
    passoAvanti: { nome: "Passo Avanti", descrizione: "Decisione conscia di superare la paura." },
    ancoraggio: { nome: "Ancoraggio", descrizione: "Stabilità personale, resistenza al cedimento." },
  },

  // Parametri di creazione personaggio: principale parte più alta, le altre
  // più basse, con un piccolo pool di punti extra da distribuire liberamente.
  creazionePersonaggio: {
    valorePrincipale: 3,
    valoreAltre: 1,
    puntiExtra: 3,
    valoreMassimo: 5,
  },

  // Formula di risoluzione: punteggio competenza + un dado piccolo che
  // corregge senza mai dominare (max 4 punti su un punteggio che arriva a 5).
  // `dadoFacce` qui è il valore di DEFAULT per qualunque ruolo/competenza.
  // Un ruolo può sovrascriverlo per la propria competenza principale con un
  // campo `dadoFacce` sull'oggetto ruolo stesso (vedi "esploratore" sotto):
  // si applica SOLO quando la risposta richiede quella competenza
  // principale, altrimenti resta questo dado di default.
  risoluzione: {
    dadoFacce: 4,
    sogliaSuccessoPieno: 8,
    sogliaSuccessoParziale: 5,
  },

  // `nomeConArticolo`: forma con articolo, pensata per essere inserita a
  // inizio frase nei frammenti del Cronista (es. "{ruolo} scandisce il
  // ritmo..." -> "La Fanfara scandisce il ritmo..."). Per "Custode /
  // Soccorritore" si usa solo "Il Custode": il doppio nome/slash è
  // un'etichetta di classe, non qualcosa che si legge bene a metà frase.
  ruoli: [
    {
      id: "esploratore",
      nome: "Esploratore",
      nomeConArticolo: "L'Esploratore",
      ispirazione: "7° Reggimento — Celeritate ac virtute",
      focus: "Muoversi rapidamente, scoprire pericoli nascosti, vedere prima.",
      competenzaPrincipale: "cadenza",
      // Override del dado di risoluzione, solo quando il tiro usa la
      // propria competenza principale (Cadenza): 1d6 invece del default
      // 1d4 (vedi `risoluzione.dadoFacce` sopra). Cadenza base resta 3,
      // invariata: il range di un tiro normale passa da 4-7 a 4-9.
      dadoFacce: 6,
    },
    {
      id: "fanfara",
      nome: "Fanfara",
      nomeConArticolo: "La Fanfara",
      focus: "Rigenera la Cadenza della squadra, scaccia la paura col Suono della Corsa.",
      competenzaPrincipale: "passoAvanti",
    },
    {
      id: "custode",
      nome: "Custode / Soccorritore",
      nomeConArticolo: "Il Custode",
      focus: "Gestisce crisi ambientali, protegge i civili, cura corpo e spirito.",
      competenzaPrincipale: "spiritoDiCorpo",
    },
    {
      id: "incursore",
      nome: "Incursore",
      nomeConArticolo: "L'Incursore",
      ispirazione: "3° Reggimento — Maiora viribus audere",
      focus: "Affronta minacce dirette, apre le brecce, osa imprese superiori alle proprie forze.",
      competenzaPrincipale: "precisione",
    },
  ],

  // Libreria di scene pronte, una per Nodo Temporale.
  // Ogni nodo è una SEQUENZA di richieste: situazioni con un bivio, dove i
  // giocatori scelgono tra risposte già scritte invece di narrare liberamente.
  // Questa è la differenza meccanica voluta rispetto a La Soglia: qui il ritmo
  // conta più dell'ambiguità, quindi ogni bivio ha esiti e costi immediati.
  //
  // Ogni risposta modifica le risorse di squadra (vedi risorseDiSquadra sopra).
  // Un valore negativo è un costo, uno positivo un guadagno. Un campo vuoto {}
  // significa "nessun effetto meccanico, solo narrativo".
  //
  // Bonus condizionali: una risposta con `competenzaRichiesta` può anche
  // dichiarare `bonusContesto: { competenza: "<id>", valore: <n> }` per
  // aggiungere `valore` al punteggio di quella competenza SOLO per questo
  // tiro, quando `competenza` coincide con la `competenzaRichiesta` della
  // stessa risposta (altrimenti viene ignorato). Applicato MANUALMENTE da
  // chi scrive il nodo -- non c'è rilevamento automatico del contesto di
  // scena -- quindi va aggiunto a mano sulle risposte che rappresentano
  // narrativamente un inseguimento, una fuga, o l'attraversamento/
  // esplorazione di un terreno non ancora rivelato nella scena (pensato
  // per il bonus Cadenza dell'Esploratore, ma il campo è generico: funziona
  // per qualunque competenza).
  nodiTemporali: [
    {
      id: "1836-torino",
      titolo: "La Scuola del Decalogo",
      luogo: "Torino, 1836",
      tono: "Addestramento / investigativo",
      richieste: [
        {
          id: "decalogo-ginnastica",
          situazione:
            "Il generale La Marmora indica il percorso a ostacoli nella nebbia: tronchi, fossati, nessuna pausa concessa.",
          prompt: "Come affrontate la corsa?",
          risposte: [
            {
              // Prima risposta con tiro reale del gioco (Passo 9): la
              // Cadenza del personaggio decide come va la corsa a tutta
              // velocità. "parziale" mantiene gli stessi numeri ed esito
              // che questa risposta aveva come effetto fisso prima di
              // questo passaggio, per continuità con quanto già giocato.
              testo: "A tutta velocità, senza calcolare i rischi",
              competenzaRichiesta: "cadenza",
              effettiPerEsito: {
                pieno: { cadenza: 3, margine: 1 },
                parziale: { cadenza: 2, spiritoDiCorpo: -1, margine: 2 },
                fallimento: { cadenza: 1, spiritoDiCorpo: -2, margine: 3 },
              },
              esito: {
                pieno: "Il ritmo è perfetto, il corpo risponde a ogni comando: arrivate per primi senza sprecare un solo passo.",
                parziale: "Arrivate per primi, sfiniti ma con il ritmo già nel sangue.",
                fallimento:
                  "La fretta vi tradisce: un piede sbaglia l'appoggio, il corpo si spezza per un istante prima di ritrovare l'equilibrio. Arrivate comunque per primi, ma il prezzo pagato si vede.",
              },
              // Ramificazione: la fretta attira l'attenzione severa di La Marmora,
              // qualunque sia l'esito del tiro — è la scelta stessa a costare cara,
              // non il tiro.
              prossima: "decalogo-vaira-severo",
            },
            {
              testo: "Con metodo, risparmiando le forze per dopo",
              effetti: { cadenza: 1 },
              esito: "Meno brillanti, ma nessuno resta indietro.",
              prossima: "decalogo-vaira",
            },
            {
              testo: "Aiutando chi fatica di più nel gruppo",
              effetti: { spiritoDiCorpo: 1 },
              esito: "Il tempo è peggiore, ma la squadra arriva unita.",
              prossima: "decalogo-vaira",
            },
          ],
        },
        {
          id: "decalogo-vaira",
          situazione:
            "La Marmora guarda ognuno negli occhi: «Qual è il peso che vi bloccava?»",
          prompt: "Cosa rispondete?",
          risposte: [
            {
              testo: "Dichiarate apertamente la vostra paura",
              effetti: { passoAvanti: 2 },
              esito: "Il Vaira pesa di più sul cappello, ma pesa meno dentro.",
              prossima: null, // fine ramo, il nodo si chiude qui
            },
            {
              testo: "Rispondete con una battuta, evitando la domanda",
              effetti: {},
              esito: "Il gruppo ride. Il vero peso resta lì, per ora.",
              prossima: null,
            },
          ],
        },
        {
          // Ramo alternativo raggiunto SOLO da chi ha scelto la fretta sopra:
          // La Marmora è più duro con chi ha corso senza calcolare i rischi.
          id: "decalogo-vaira-severo",
          situazione:
            "La Marmora vi ferma bruscamente: «La fretta senza controllo vi ha quasi fatto cadere. Qual è il peso che vi spinge a correre così?»",
          prompt: "Cosa rispondete?",
          risposte: [
            {
              testo: "Ammettete che è la paura di sembrare deboli",
              effetti: { passoAvanti: 1, margine: -1 },
              esito: "La Marmora annuisce appena: «Anche questo si corregge.»",
              prossima: null,
            },
            {
              testo: "Vi irrigidite e non rispondete",
              effetti: { spiritoDiCorpo: -1 },
              esito: "Il silenzio pesa più di qualunque risposta.",
              prossima: null,
            },
          ],
        },
      ],
      // Esito finale: valutato quando le richieste del nodo si esauriscono.
      // Prima variante la cui condizione è soddisfatta vince; altrimenti il default.
      // Questo è il MODELLO da replicare identico su ogni nuovo nodo, presente o futuro.
      esitoFinale: {
        varianti: [
          {
            condizione: { spiritoDiCorpo: { min: 1 } },
            testo: "Il gruppo esce dall'addestramento come una vera squadra, non come singoli.",
          },
          {
            condizione: { passoAvanti: { min: 2 } },
            testo: "Ognuno ha fatto pace col proprio peso: la paura non comanda più.",
          },
        ],
        default: "L'addestramento è finito. Non tutti sono pronti allo stesso modo, ma si corre insieme.",
      },
    },
    {
      id: "1848-milano",
      titolo: "L'Identità",
      luogo: "Milano, 1848",
      tono: "Combattimento urbano, guerriglia",
      richieste: [
        {
          id: "milano-barricata",
          situazione: "Una barricata blocca la via. Dietro, spari sporadici.",
          prompt: "Come procedete?",
          risposte: [
            {
              testo: "Carica diretta, sfruttando la Cadenza accumulata",
              costoMinimo: { cadenza: 2 },
              competenzaRichiesta: "cadenza",
              effettiPerEsito: {
                pieno: { cadenza: -1, passoAvanti: 2, margine: 1 },
                parziale: { cadenza: -2, passoAvanti: 1, margine: 2 },
                fallimento: { cadenza: -2, spiritoDiCorpo: -1, margine: 3 },
              },
              esito: {
                pieno: "Sfondate come un solo corpo: nessuno spreca un movimento, la barricata cede tutta insieme.",
                parziale: "Sfondate, ma il fiato è corto per il prossimo bivio.",
                fallimento: "Sfondate comunque, ma qualcuno inciampa nel varco: il prezzo si paga subito, non dopo.",
              },
            },
            {
              testo: "Aggirate il fianco nella nebbia dei vicoli",
              effetti: { spiritoDiCorpo: -1 },
              esito: "Più lento, ma nessuno si espone al fuoco diretto.",
            },
            {
              testo: "Provate a parlare con chi presidia la barricata",
              effetti: { spiritoDiCorpo: 1 },
              esito: "Non tutti dietro quella barricata sono nemici.",
            },
          ],
        },
        {
          id: "milano-ferito",
          situazione: "Tra il fumo, un uomo con una divisa che non è la vostra è a terra, ferito. Geme, non si muove.",
          prompt: "Cosa fate?",
          risposte: [
            {
              testo: "Lo soccorrete, nonostante tutto",
              effetti: { spiritoDiCorpo: 1 },
              esito: "Non è più un nemico o un alleato: è solo un uomo che ha bisogno di aiuto.",
            },
            {
              testo: "Lo disarmate con un gesto solo. Pulito. Poi proseguite, lasciandolo dove sta.",
              competenzaRichiesta: "precisione",
              effettiPerEsito: {
                pieno: { cadenza: 2, margine: 1 },
                parziale: { cadenza: 1, spiritoDiCorpo: -1, margine: 2 },
                fallimento: { cadenza: -1, spiritoDiCorpo: -1, margine: 3 },
              },
              esito: {
                pieno: "L'arma cambia mano senza un suono. Lui fissa le mani vuote.",
                parziale: "L'arma cede, ma resiste un attimo prima di arrendersi.",
                fallimento: "L'arma scivola, sbatte a terra. Il rumore è secco, nel fumo.",
              },
            },
            {
              testo: "Vi fermate a interrogarlo prima di decidere",
              effetti: { passoAvanti: 1 },
              esito: "Le sue parole confuse rivelano qualcosa di più sulla città che state attraversando.",
            },
          ],
        },
      ],
      esitoFinale: {
        varianti: [
          {
            condizione: { spiritoDiCorpo: { min: 1 } },
            testo:
              "La barricata cade senza altro sangue versato. Milano non è fatta solo di nemici: la squadra lo ha capito prima ancora di sparare.",
          },
          {
            condizione: { passoAvanti: { min: 1 } },
            testo:
              "Sfondano con la forza, e il nome della squadra comincia a correre per la città prima di loro. Ma qualcuno, dietro, si ricorda ancora del fiato perso per sfondare.",
          },
        ],
        default:
          "La barricata è alle spalle. Milano resta un mosaico di volti che nessuno ha avuto il tempo di guardare bene.",
      },
    },
    {
      id: "1915-carso-piave",
      titolo: "La Resistenza",
      luogo: "Carso e Piave, 1915-1918",
      tono: "Survival, psicologico, logoramento",
      richieste: [
        {
          id: "carso-attesa",
          situazione: "Il gelo morde. Un compagno vuole muoversi subito, un altro aspettare l'alba.",
          prompt: "Cosa decidete come squadra?",
          risposte: [
            {
              testo: "Muovervi ora, rischiando l'esposizione",
              effetti: { cadenza: 1, spiritoDiCorpo: -2 },
              esito: "Guadagnate terreno, ma il freddo si fa sentire.",
            },
            {
              testo: "Aspettare, mantenendo il gruppo unito e al caldo",
              effetti: { spiritoDiCorpo: 1, cadenza: -1 },
              esito: "Il fronte non si muove, ma nemmeno voi vi spezzate.",
            },
          ],
        },
        {
          id: "carso-bombardamento",
          situazione: "Un bombardamento si avvicina. Un commilitone ferito chiama aiuto a pochi metri, ma restare scoperti è un rischio.",
          prompt: "Come rispondete?",
          risposte: [
            {
              testo: "Uscite a recuperarlo sotto il fuoco",
              competenzaRichiesta: "passoAvanti",
              effettiPerEsito: {
                pieno: { passoAvanti: 3, spiritoDiCorpo: 1, margine: 1 },
                parziale: { passoAvanti: 2, spiritoDiCorpo: -1, margine: 2 },
                fallimento: { passoAvanti: 1, spiritoDiCorpo: -2, margine: 3 },
              },
              esito: {
                pieno: "Lo riportate dentro senza che il fuoco vi sfiori: il coraggio, stavolta, non ha avuto prezzo.",
                parziale: "Lo riportate dentro. Il prezzo pagato in paura superata resta inciso in ognuno di voi.",
                fallimento: "Lo riportate dentro, ma per un soffio: le schegge hanno sfiorato più di uno di voi, e il fiato è ancora corto.",
              },
            },
            {
              testo: "Aspettate una pausa nel fuoco per muovervi",
              effetti: { cadenza: -1, spiritoDiCorpo: 1 },
              esito: "La pausa arriva, tardi ma arriva — e nessun altro si espone inutilmente.",
            },
          ],
        },
      ],
      esitoFinale: {
        varianti: [
          {
            condizione: { passoAvanti: { min: 2 } },
            testo:
              "Il coraggio dimostrato sotto il fuoco diventa leggenda di reparto: la squadra ha superato la paura più grande, insieme.",
          },
          {
            condizione: { spiritoDiCorpo: { min: 1 } },
            testo:
              "Il gelo non ha vinto: la squadra ha resistito unita, e in trincea questo pesa più di ogni terreno guadagnato.",
          },
          {
            condizione: { spiritoDiCorpo: { max: -1 } },
            testo:
              "Avanzano, sì. Ma qualcosa nel gruppo si è incrinato nel freddo — una crepa che il fronte non registra, ma la squadra sì.",
          },
        ],
        default:
          "Il fronte non si muove. Nemmeno la squadra, per ora — ma quanto durerà, nessuno lo sa.",
      },
    },
    {
      id: "emergenza-civile",
      titolo: "L'Emergenza",
      luogo: "Firenze 1966 / Friuli 1976 / L'Aquila 2009",
      tono: "Cooperativo, soccorso, nessun nemico da combattere",
      richieste: [
        {
          id: "emergenza-scelta",
          situazione: "Due punti della città chiedono aiuto nello stesso momento. Non potete coprirli entrambi.",
          prompt: "Dove intervenite?",
          risposte: [
            {
              testo: "Dove ci sono più persone, anche se è più lontano",
              effetti: { spiritoDiCorpo: -1, passoAvanti: 1 },
              esito: "Arrivate stremati, ma in tempo per molti.",
            },
            {
              testo: "Dove potete arrivare subito, anche se sono in meno",
              effetti: { cadenza: 1 },
              esito: "Salvate chi potevate salvare. Il resto resta un peso.",
            },
          ],
        },
        {
          id: "emergenza-famiglia",
          situazione: "Una famiglia si rifiuta di lasciare la propria casa, mentre il tempo stringe.",
          prompt: "Come li convincete?",
          risposte: [
            {
              testo: "Insistete con fermezza, portandoli via se serve",
              effetti: { cadenza: 1, spiritoDiCorpo: -1 },
              esito: "Sono al sicuro, ma il modo in cui ci siete arrivati pesa su tutti.",
            },
            {
              testo: "Restate a parlare, guadagnando la loro fiducia",
              competenzaRichiesta: "spiritoDiCorpo",
              effettiPerEsito: {
                pieno: { spiritoDiCorpo: 2, cadenza: -1, margine: 1 },
                parziale: { spiritoDiCorpo: 1, cadenza: -1, margine: 2 },
                fallimento: { spiritoDiCorpo: -1, cadenza: -2, margine: 3 },
              },
              esito: {
                pieno: "Escono con le proprie gambe, convinti fino in fondo: le parole hanno pesato più della paura.",
                parziale: "Escono con le proprie gambe, ma il tempo perso a convincerli si fa sentire su tutta la squadra.",
                fallimento: "Escono, alla fine — ma solo quando il tempo è quasi scaduto, e la fiducia guadagnata resta fragile.",
              },
            },
          ],
        },
      ],
      esitoFinale: {
        varianti: [
          {
            condizione: { passoAvanti: { min: 1 } },
            testo:
              "La squadra ha scelto il bene più grande, anche quando costava di più. Chi non hanno raggiunto resterà un peso portato insieme, non da soli.",
          },
          {
            condizione: { cadenza: { min: 1 } },
            testo:
              "Sono arrivati subito, dove potevano. Hanno salvato chi si poteva salvare — e imparato, sulla pelle, che non si può essere ovunque.",
          },
        ],
        default:
          "L'emergenza è finita, per questa volta. Le città ricorderanno chi non è arrivato in tempo, ovunque abbiate scelto di andare.",
      },
    },
    {
      id: "missione-moderna",
      titolo: "La Stabilità",
      luogo: "Libano, Balcani, Iraq, Afghanistan",
      tono: "Peacekeeping tattico moderno",
      richieste: [
        {
          id: "moderna-fiducia",
          situazione: "Un capo villaggio non si fida delle vostre intenzioni.",
          prompt: "Come guadagnate la sua fiducia?",
          risposte: [
            {
              testo: "Mostrando la forza, per dimostrare che potete proteggerli",
              effetti: { cadenza: 1, spiritoDiCorpo: -1 },
              esito: "Rispetto sì, fiducia non ancora.",
            },
            {
              testo: "Sedendovi a parlare, senza fretta, senza armi in vista",
              effetti: { spiritoDiCorpo: 1, cadenza: -1 },
              esito: "Ci vuole più tempo, ma la porta resta aperta.",
            },
          ],
        },
        {
          id: "moderna-provocazione",
          situazione: "Un giovane del villaggio lancia una provocazione contro la vostra pattuglia, davanti a tutti.",
          prompt: "Come reagite?",
          risposte: [
            {
              testo: "Rispondete con fermezza, mostrando autorità",
              effetti: { cadenza: 1, spiritoDiCorpo: -1 },
              esito: "La tensione si allenta, ma la fiducia guadagnata prima vacilla un poco.",
            },
            {
              testo: "Ignorate la provocazione e restate calmi",
              competenzaRichiesta: "ancoraggio",
              effettiPerEsito: {
                pieno: { spiritoDiCorpo: 2, margine: 1 },
                parziale: { spiritoDiCorpo: 1, margine: 2 },
                fallimento: { spiritoDiCorpo: -1, cadenza: 1, margine: 3 },
              },
              esito: {
                pieno: "Il capo villaggio osserva la pazienza fino in fondo, senza che un muscolo tradisca tensione: è proprio questo che serve per convincerlo.",
                parziale: "Il capo villaggio osserva la vostra pazienza. Forse è proprio questo che stava aspettando di vedere.",
                fallimento: "La calma tiene, ma a fatica: il capo villaggio nota l'esitazione, anche se nessuno degli uomini si è mosso.",
              },
            },
          ],
        },
      ],
      esitoFinale: {
        varianti: [
          {
            condizione: { spiritoDiCorpo: { min: 1 } },
            testo:
              "La fiducia vera si costruisce un giorno alla volta, e oggi è stato il primo passo vero. La porta, questa volta, resta aperta per davvero.",
          },
          {
            condizione: { cadenza: { min: 1 } },
            testo:
              "Ottengono rispetto, non fiducia. La missione può continuare, ma ogni passo dovrà essere guadagnato di nuovo, uno alla volta.",
          },
        ],
        default:
          "La missione continua. La fiducia, quella vera, resta un lavoro lento — e oggi è stato solo l'inizio.",
      },
    },
  ],

  // Le "Prove del Decalogo" usate in creazione personaggio (Nodo 1836)
  proveDelDecalogo: [
    { id: "ginnastica", titolo: "Ginnastica di ogni specie fino alla frenesia", definisce: "cadenza" },
    { id: "carabina", titolo: "Conoscenza assoluta della carabina e molto tiro", definisce: "precisione" },
    { id: "cameratismo", titolo: "Cameratismo (Fratellanza)", definisce: "spiritoDiCorpo" },
    { id: "obbedienza", titolo: "Obbedienza e sentimento del dovere", definisce: "passoAvanti" },
    { id: "vaira", titolo: "Amore al cappello piumato e onore alla specialità", definisce: "ancoraggio" },
  ],
};
