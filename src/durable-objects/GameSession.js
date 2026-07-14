import { GAME_CONFIG } from "../game-config.js";
import { creaCompetenzeIniziali, risolviAzione } from "../lib/risoluzione.js";
import { componiNarrazione } from "../lib/narratore-simulato.js";
import { trovaPoolPerNodo } from "../lib/narratore-registro-pool.js";
import { interpreta } from "simulatore-interprete/src/interprete.js";
import { trovaLibreriaPerRichiesta } from "../lib/interprete-registro-librerie.js";
import { assegnaXpCompletamentoNodo, otteniCompetenzeBonificate, verificaTokenSessione } from "../lib/profili-giocatore.js";

// Un Durable Object per stanza/sessione: isolamento totale tra sessioni diverse.
// Le risorse sono a livello di SQUADRA (party-level), non per singolo personaggio:
// questa è la differenza architetturale rispetto a La Soglia / The Ledger Game,
// e va tenuta a mente in ogni estensione futura dello stato.
//
// Tracce introdotte in questo passaggio, oltre alle risorse di squadra:
// - orologio: avanza di scelta in scelta, misura il tempo/tensione che passa.
// - margine: cresce o scende in base agli effetti delle risposte scelte;
//   superata la soglia (GAME_CONFIG.margineSoglia) scatta una complicazione.
//   ASSUNZIONE DA VERIFICARE: la definizione di "Margine" qui implementata
//   (distanza dal fallimento) e' un'ipotesi di lavoro, non ancora confermata
//   nei dettagli -- funziona come traccia generica pronta a essere corretta.
// - ramificazione dei nodi: ogni risposta puo' indicare `prossima` (id della
//   richiesta successiva). Se manca, si procede in sequenza come prima
//   (compatibile con i nodi gia' scritti in game-config.js).
//
// Risposte con tiro (risoluzione.js collegato qui): una risposta puo'
// dichiarare `competenzaRichiesta: "<id competenza>"` invece di (o oltre) un
// effetto fisso. Quando presente:
// - il punteggio si legge da giocatore.competenze[competenzaRichiesta]
//   (assegnate a /join, vedi sotto), con l'eventuale bonusContesto della
//   risposta sommato sopra (vedi commento su `bonusContesto` in
//   game-config.js), e si risolve con risolviAzione();
// - il ruolo del giocatore puo' sovrascrivere il numero di facce del dado
//   (campo `dadoFacce` sull'oggetto ruolo) SOLO quando competenzaRichiesta
//   coincide con la competenzaPrincipale di quel ruolo -- altrimenti resta
//   il dado di default (GAME_CONFIG.risoluzione.dadoFacce);
// - gli effetti applicati vengono da `risposta.effettiPerEsito[esitoDelTiro]`
//   invece che da `risposta.effetti` (che resta il campo usato dalle
//   risposte SENZA tiro: le due forme convivono nello stesso nodo);
// - il testo mostrato viene da `risposta.esito[esitoDelTiro]` (un oggetto
//   per le risposte con tiro) invece che da `risposta.esito` come stringa
//   fissa (usato dalle risposte senza tiro).
// Una risposta senza `competenzaRichiesta` si comporta esattamente come
// prima di questo passaggio: effetto fisso, testo fisso, nessun tiro.
//
// Il Cronista (narratore-simulato.js) entra in gioco SOLO per le risposte
// con tiro: solo lì esiste un vero esito a tre tier da cui comporre un
// testo variato: una risposta a effetto fisso ha un solo esito, non un
// tier. Il pool di contenuto da usare si cerca in narratore-registro-pool.js
// (mappa nodoId -> pool, mai una stringa di nodo scritta qui): se il nodo
// attivo non ha un pool registrato (o il pool non si carica in questo
// ambiente, vedi quel file), si ricade sul testo statico per tier già
// scritto in game-config.js -- fallback silenzioso, stesso trattamento di
// un nodo che semplicemente non ha ancora il suo pool. Quando il Cronista
// compone un testo, SOSTITUISCE quello statico (non lo affianca).
// contesto.storicoFrammenti è alimentato da session.storicoFrammenti (finestra
// scorrevole degli ultimi 12 id): abilita l'anti-ripetizione del motore (vedi
// scegliFrammento in narratore-simulato.js). Dopo ogni composizione i
// frammentiUsati vengono accodati e lo storico troncato a 12; viene azzerato
// al cambio nodo (/avvia-nodo), perché gli id sono univoci solo per slot/pool
// e potrebbero collidere tra pool di nodi diversi.
//
// Interprete di testo libero (interprete-libero/): il testo libero SI
// AFFIANCA ai bottoni delle risposte, non li sostituisce. Il matching gira
// qui nel Worker (non nel browser). La logica di "applicare una risposta"
// (effetti, Cronista, storicoScelte, complicazione, prossimaRichiesta) è
// estratta in applicaRisposta(), riusata sia da /scegli (bottone cliccato)
// sia da /interpreta e /risolvi-interpretazione (testo libero) — nessuna
// duplicazione tra i tre flussi. Quando l'interprete è ambiguo o incerto,
// la richiesta resta PENDENTE in session.interpretazionePendente finché il
// comandante non la risolve con /risolvi-interpretazione: deve funzionare
// tra dispositivi diversi (chi scrive il testo e il comandante possono
// essere su browser separati), quindi vive nello stato della stanza, non
// nella sola risposta immediata. Se una richiesta non ha una libreria
// registrata in interprete-registro-librerie.js (tutti i nodi tranne
// 1836-torino, per ora), /interpreta risponde con un errore chiaro e il
// client resta a soli bottoni per quella richiesta — stesso fallback
// silenzioso già usato per i nodi senza pool del Cronista.

export class GameSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Set();
  }

  async initState() {
    let stored = await this.state.storage.get("session");
    if (!stored) {
      stored = {
        gameId: GAME_CONFIG.gameId,
        creata_il: new Date().toISOString(),
        giocatori: [], // { id, nome, ruolo, competenze, comandante, token, profiloId } -- assegnati a /join.
        // profiloId: riferimento OPZIONALE a un profilo persistente
        // (tabella giocatori_persistenti su D1, vedi
        // src/lib/profili-giocatore.js) creato con login/registrazione
        // PRIMA di arrivare a /join -- login rimane facoltativo, un
        // giocatore puo' ancora entrare senza. Dal Passo 2 del sistema di
        // token di sessione: MAI dichiarato direttamente dal client, si
        // ricava SOLO verificando un profiloToken contro sessioni_profilo
        // (vedi verificaProfiloDaToken) -- un token assente/scaduto/non
        // valido non blocca il join, il giocatore entra come ospite.
        // token e' un segreto lato server: mai incluso nelle risposte che
        // espongono l'elenco giocatori (vedi sessionPubblica()), restituito
        // al proprietario una sola volta, nella risposta di /join.
        risorseDiSquadra: {
          cadenza: 0,
          spiritoDiCorpo: 0,
          passoAvanti: 0,
        },
        orologio: 0, // avanza a ogni scelta risolta
        margine: 0, // sale/scende con gli effetti delle risposte
        nodoAttivo: null, // id di uno dei nodiTemporali in game-config.js
        richiestaIndice: 0, // fallback per compatibilita': posizione in sequenza
        richiestaAttivaId: null, // id della richiesta corrente (supporta ramificazioni)
        esitoCorrente: null, // "vista corrente" dell'esito appena prodotto, nello
        // STATO CONDIVISO cosi' che anche chi NON ha agito possa ridisegnare la
        // schermata dell'esito (oggi lo stesso dato torna anche nella risposta
        // HTTP dell'attore; il rendering condiviso arriva in un passo futuro).
        // Forma quando presente (vedi applicaRisposta): { richiestaId, esito,
        // tiro, competenzaId, complicazione, esitoNodo, prossimaRichiestaId }.
        // NON contiene token ne' segreti ne' dati privati di un giocatore.
        // Azzerato al cambio nodo (vedi /avvia-nodo).
        storicoScelte: [], // { richiestaId, risposteTesto, esito, giocatoreId, tiro, timestamp }
        storicoNodo: [], // { nodoId, iniziato_il, concluso_il, esitoFinale }
        storicoFrammenti: [], // id dei frammenti del Cronista usati di recente
        // (finestra scorrevole, ultimi 12): passato a componiNarrazione come
        // contesto.storicoFrammenti per l'anti-ripetizione. Azzerato al cambio
        // nodo (vedi /avvia-nodo). Vedi anche il commento di testa del file.
        aiUsageStanza: 0, // contatore generazioni AI usate in questa stanza
        interpretazionePendente: null, // { giocatoreId, richiestaId, testoLibero, candidati } o null
        chat: [], // canale di squadra puramente umano ed effimero (vedi endpoint
        // /chat sotto): array di { id, nome, giocatoreId, ruolo, testo, timestamp },
        // cap agli ultimi 200, testo troncato a 500 lato server. Vive SOLO qui
        // nello stato della sessione (mai su D1): muore con la stanza, e' voluto.
        // Viaggia al client dentro sessionPubblica() col polling gia' esistente.
        tokenCreazione: null, // segreto impostato da POST /crea (vedi sotto): prova
        // "sei tu il creatore della stanza", consumato al primo /join che lo usa
        // con successo. Mai esposto al client (vedi sessionPubblica()).
        cessioneComandantePendente: null, // { versoGiocatoreId } o null -- proposta
        // del comandante attuale di cedere il ruolo a un altro giocatore gia' in
        // stanza (vedi /proponi-cessione). A differenza dei token, NON e' un
        // segreto: sessionPubblica() lo lascia visibile, serve al client del
        // destinatario per sapere che deve mostrare il prompt di conferma.
        riconoscimentoPendente: null, // Riconoscimento (vedi endpoint sotto): una
        // richiesta alla volta di rientrare in partita dopo aver perso il token
        // (tipo "rientro") o di prendere il comando quando il comandante e'
        // sparito (tipo "comando"). Forma quando attivo:
        //   { tipo, versoGiocatoreId, stato: "in_attesa"|"approvato"|"rifiutato",
        //     biglietto, nuovoToken }
        // biglietto e nuovoToken sono SEGRETI (solo per "rientro"): sessionPubblica()
        // li spoglia, come fa per i token. tipo/versoGiocatoreId/stato restano
        // visibili, servono al client per mostrare l'avviso di sistema (nome e
        // ruolo li ricava dal roster via versoGiocatoreId, nessuna duplicazione).
        // Migrazione automatica: ogni nuovo campo va aggiunto qui E
        // nella funzione migrateState() sotto, altrimenti le sessioni
        // create prima dell'aggiornamento falliscono in silenzio.
      };
      await this.state.storage.put("session", stored);
    }
    return this.migrateState(stored);
  }

  // Applica ai record vecchi eventuali campi nuovi introdotti dopo la loro creazione.
  migrateState(session) {
    let changed = false;
    if (session.nodoAttivo === undefined) {
      session.nodoAttivo = null;
      changed = true;
    }
    if (session.richiestaIndice === undefined) {
      session.richiestaIndice = 0;
      changed = true;
    }
    if (session.richiestaAttivaId === undefined) {
      session.richiestaAttivaId = null;
      changed = true;
    }
    if (session.storicoScelte === undefined) {
      session.storicoScelte = [];
      changed = true;
    }
    if (session.storicoNodo === undefined) {
      session.storicoNodo = [];
      changed = true;
    }
    if (session.orologio === undefined) {
      session.orologio = 0;
      changed = true;
    }
    if (session.margine === undefined) {
      session.margine = 0;
      changed = true;
    }
    if (session.aiUsageStanza === undefined) {
      session.aiUsageStanza = 0;
      changed = true;
    }
    if (session.interpretazionePendente === undefined) {
      session.interpretazionePendente = null;
      changed = true;
    }
    if (session.tokenCreazione === undefined) {
      session.tokenCreazione = null;
      changed = true;
    }
    if (session.cessioneComandantePendente === undefined) {
      session.cessioneComandantePendente = null;
      changed = true;
    }
    if (session.chat === undefined) {
      session.chat = [];
      changed = true;
    }
    if (session.riconoscimentoPendente === undefined) {
      session.riconoscimentoPendente = null;
      changed = true;
    }
    if (session.storicoFrammenti === undefined) {
      session.storicoFrammenti = [];
      changed = true;
    }
    if (session.esitoCorrente === undefined) {
      session.esitoCorrente = null;
      changed = true;
    }
    // profiloId e' un campo per-giocatore (dentro session.giocatori), non a
    // livello di sessione come gli altri qui sopra -- backfill esplicito a
    // null per i giocatori uniti PRIMA di questa modifica, cosi' il campo e'
    // sempre presente (mai semplicemente assente) su ogni record.
    for (const giocatore of session.giocatori) {
      if (giocatore.profiloId === undefined) {
        giocatore.profiloId = null;
        changed = true;
      }
    }
    if (changed) this.state.storage.put("session", session);
    return session;
  }

  // Versione della sessione sicura da esporre al client: toglie il token
  // segreto di ogni giocatore E il tokenCreazione a livello di sessione.
  // Usata da OGNI risposta che include la sessione (o il suo elenco
  // giocatori), senza eccezioni -- nessuno dei due token deve mai comparire
  // in una risposta HTTP dopo il momento in cui viene generato (/join per
  // il primo, /crea per il secondo). cessioneComandantePendente NON viene
  // tolto (non e' nella lista di esclusione): a differenza dei token non e'
  // un segreto, il client del destinatario deve poterlo leggere da GET
  // /state per sapere che deve mostrare il prompt di conferma.
  sessionPubblica(session) {
    const { tokenCreazione, ...sessioneSenzaTokenCreazione } = session;
    const pubblica = {
      ...sessioneSenzaTokenCreazione,
      giocatori: session.giocatori.map(({ token, ...giocatorePubblico }) => giocatorePubblico),
    };
    // riconoscimentoPendente e' visibile (serve al client per l'avviso di
    // sistema), ma i suoi campi SEGRETI vanno tolti: `biglietto` (prova che sei
    // tu il richiedente del rientro) e `nuovoToken` (il token da consegnare a
    // rientro approvato). Stesso principio di token/tokenCreazione: mai in /state.
    if (pubblica.riconoscimentoPendente) {
      const { biglietto, nuovoToken, ...riconoscimentoPubblico } = pubblica.riconoscimentoPendente;
      pubblica.riconoscimentoPendente = riconoscimentoPubblico;
    }
    return pubblica;
  }

  // Verifica che (giocatoreId, token) corrispondano a un giocatore reale
  // della stanza -- prova di identita' vera, non solo "questo id esiste".
  // Restituisce { giocatore } se la verifica passa, altrimenti { errore:
  // <Response> } gia' pronta da ritornare cosi' com'e' dal chiamante.
  autenticaGiocatore(session, giocatoreId, token) {
    if (!giocatoreId || !token) {
      return {
        errore: new Response("giocatoreId o token mancante: serve sapere chi sta chiamando", { status: 400 }),
      };
    }
    const giocatore = session.giocatori.find((g) => g.id === giocatoreId);
    if (!giocatore) {
      return {
        errore: new Response("giocatoreId sconosciuto: nessun giocatore con questo id nella stanza", {
          status: 400,
        }),
      };
    }
    if (giocatore.token !== token) {
      return { errore: new Response("token non valido per questo giocatoreId", { status: 401 }) };
    }
    return { giocatore };
  }

  // Come autenticaGiocatore(), con in piu' il vincolo che il giocatore
  // verificato sia il comandante della stanza -- usata dagli endpoint
  // riservati (/risorse, /avvia-nodo, /risolvi-interpretazione).
  autenticaComandante(session, giocatoreId, token) {
    const auth = this.autenticaGiocatore(session, giocatoreId, token);
    if (auth.errore) return auth;
    if (!auth.giocatore.comandante) {
      return { errore: new Response("solo il comandante puo' compiere questa azione", { status: 403 }) };
    }
    return auth;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/state") && request.method === "GET") {
      const session = await this.initState();
      return Response.json(this.sessionPubblica(session));
    }

    // Chiamato una sola volta da POST /api/crea-stanza (src/index.js),
    // subito dopo aver istanziato questa Durable Object -- PRIMA che il
    // link della stanza esista o venga condiviso. Salva il tokenCreazione
    // generato da index.js: sara' la prova che il successivo /join con
    // quel token e' proprio il creatore, non semplicemente "il primo ad
    // arrivare" (vecchia logica, vulnerabile). Non assegna nessun
    // giocatore: la stanza resta vuota finche' il creatore stesso non fa
    // /join con questo token in mano.
    if (url.pathname.endsWith("/crea") && request.method === "POST") {
      const { tokenCreazione } = await request.json();
      const session = await this.initState();
      session.tokenCreazione = tokenCreazione ?? null;
      await this.state.storage.put("session", session);
      return Response.json(this.sessionPubblica(session));
    }

    // Il comandante/narratore e' chi ha creato la stanza (POST
    // /api/crea-stanza), provato dal possesso di tokenCreazione -- non
    // piu' "il PRIMO giocatore che si unisce a una stanza appena creata"
    // (vecchia logica: session.giocatori.length === 0, rimossa perche'
    // vulnerabile -- se il link veniva condiviso prima che il creatore
    // stesso facesse /join, chiunque altro poteva rubare il ruolo).
    // Gioca comunque con uno dei 4 ruoli come chiunque altro.
    //
    // comandante = true SOLO SE: tokenCreazione ricevuto corrisponde a
    // quello salvato per la sessione, E nessuno ha gia' comandante===true.
    // La seconda condizione e' il caso limite esplicito: il token prova
    // "sei tu il creatore", non "sei sempre comandante ogni volta che lo
    // mandi" -- viene consumato (azzerato) al primo uso valido, cosi' un
    // secondo /join con lo stesso token corretto (es. doppia tab aperta
    // per errore dal creatore, o un retry di rete) non ruba il ruolo a chi
    // lo ha gia' preso. Una stanza il cui /api/crea-stanza non e' mai
    // stato chiamato (tokenCreazione resta null) non avra' mai un
    // comandante -- coerente col fatto che nessuno ha "creato" quella
    // stanza nel senso qui inteso.
    //
    // token (diverso da tokenCreazione): segreto generato qui, salvato nel
    // giocatore lato server e restituito UNA SOLA VOLTA in questa
    // risposta (mai da /state o da qualunque altra rotta, vedi
    // sessionPubblica()). E' la prova di identita' richiesta dagli
    // endpoint riservati al comandante e da /scegli e /interpreta -- da
    // sola giocatoreId (pubblico, visibile a chiunque nella stanza via
    // /state) non basta piu'.
    if (url.pathname.endsWith("/join") && request.method === "POST") {
      const { nome, ruolo, tokenCreazione, profiloToken } = await request.json();
      const session = await this.initState();
      // Limite fisso ai posti disponibili (vedi GAME_CONFIG.maxGiocatori):
      // controllato PRIMA di validare il ruolo, cosi' una stanza piena
      // risponde sempre allo stesso modo indipendentemente dal ruolo scelto.
      if (session.giocatori.length >= GAME_CONFIG.maxGiocatori) {
        return Response.json({ errore: "Stanza piena" }, { status: 409 });
      }
      // Competenze base per il ruolo (principale + secondarie, nessun punto
      // extra: la loro distribuzione libera resta un passo a parte).
      let competenze;
      try {
        competenze = creaCompetenzeIniziali(ruolo, {});
      } catch {
        return new Response("Ruolo sconosciuto", { status: 400 });
      }
      const comandanteGiaAssegnato = session.giocatori.some((g) => g.comandante);
      const comandante =
        !comandanteGiaAssegnato &&
        tokenCreazione != null &&
        session.tokenCreazione != null &&
        tokenCreazione === session.tokenCreazione;
      if (comandante) {
        session.tokenCreazione = null; // consumato: un solo uso, vedi commento sopra
      }
      const token = crypto.randomUUID();
      // profiloId MAI dichiarato direttamente dal client (Passo 2 del
      // sistema di token, vedi verificaProfiloDaToken sotto): si ricava
      // SOLO da un profiloToken valido, verificato contro sessioni_profilo.
      // Nessun token o token non valido -> ospite, senza bloccare il join.
      const profiloId = await this.verificaProfiloDaToken(profiloToken);
      session.giocatori.push({
        id: crypto.randomUUID(),
        nome,
        ruolo,
        competenze,
        comandante,
        token,
        profiloId,
      });
      await this.state.storage.put("session", session);
      return Response.json({ ...this.sessionPubblica(session), token });
    }

    // Il comandante attuale propone di cedere il ruolo a un altro giocatore
    // gia' in stanza: la cessione resta PENDENTE finche' il destinatario non
    // la accetta o non viene rifiutata/annullata -- stesso stile di
    // session.interpretazionePendente (stato che vive nella sessione, non
    // nella singola risposta HTTP, per funzionare tra dispositivi diversi),
    // ma qui la conferma serve dal destinatario specifico, non da "il
    // comandante" genericamente. Riservato al comandante attuale (vedi
    // autenticaComandante()).
    if (url.pathname.endsWith("/proponi-cessione") && request.method === "POST") {
      const { versoGiocatoreId, giocatoreId, token } = await request.json();
      const session = await this.initState();
      const auth = this.autenticaComandante(session, giocatoreId, token);
      if (auth.errore) return auth.errore;

      const destinatario = session.giocatori.find((g) => g.id === versoGiocatoreId);
      if (!destinatario) {
        return new Response("versoGiocatoreId sconosciuto: nessun giocatore con questo id nella stanza", {
          status: 400,
        });
      }
      if (versoGiocatoreId === giocatoreId) {
        return new Response("Non puoi cedere il ruolo di comandante a te stesso", { status: 400 });
      }
      if (session.cessioneComandantePendente) {
        return new Response("C'e' gia' una cessione del ruolo in attesa di risposta", { status: 409 });
      }

      session.cessioneComandantePendente = { versoGiocatoreId };
      await this.state.storage.put("session", session);
      return Response.json(this.sessionPubblica(session));
    }

    // Il destinatario accetta la cessione: il ruolo passa a lui, il
    // comandante attuale torna un giocatore normale. Autenticato con
    // identita' semplice (non serve essere comandante per accettare -- anzi,
    // di norma NON lo si e' ancora). Verifica che il chiamante sia proprio
    // il destinatario della proposta (non un terzo giocatore), e che il
    // comandante che ha proposto la cessione sia ancora effettivamente
    // comandante ora (evita stati incoerenti se qualcosa e' cambiato nel
    // frattempo -- caso limite esplicito richiesto dal design).
    if (url.pathname.endsWith("/accetta-cessione") && request.method === "POST") {
      const { giocatoreId, token } = await request.json();
      const session = await this.initState();
      const auth = this.autenticaGiocatore(session, giocatoreId, token);
      if (auth.errore) return auth.errore;

      const pendente = session.cessioneComandantePendente;
      if (!pendente) {
        return new Response("Nessuna cessione del ruolo in attesa di risposta", { status: 400 });
      }
      if (pendente.versoGiocatoreId !== giocatoreId) {
        return new Response("Questa cessione non e' stata proposta a te", { status: 403 });
      }
      const comandanteAttuale = session.giocatori.find((g) => g.comandante);
      if (!comandanteAttuale) {
        // Stato incoerente (nessun comandante attuale): scarta la cessione
        // pendente invece di applicarla a una situazione che non torna.
        session.cessioneComandantePendente = null;
        await this.state.storage.put("session", session);
        return new Response(
          "Il comandante che ha proposto la cessione non e' piu' comandante: cessione annullata",
          { status: 409 }
        );
      }

      comandanteAttuale.comandante = false;
      auth.giocatore.comandante = true;
      session.cessioneComandantePendente = null;
      await this.state.storage.put("session", session);
      return Response.json(this.sessionPubblica(session));
    }

    // Rifiuta (dal destinatario) o annulla (dal comandante che ha proposto)
    // una cessione pendente, senza cambiare nessun ruolo. Il comandante
    // attuale E' sempre chi ha proposto (nessun altro puo' diventare
    // comandante finche' una cessione resta pendente, vedi /join e
    // /accetta-cessione sopra): "sei comandante ora" equivale quindi a "sei
    // tu che hai proposto", senza dover salvare separatamente chi ha
    // proposto. Chiunque altro (un terzo giocatore) viene rifiutato.
    if (url.pathname.endsWith("/rifiuta-cessione") && request.method === "POST") {
      const { giocatoreId, token } = await request.json();
      const session = await this.initState();
      const auth = this.autenticaGiocatore(session, giocatoreId, token);
      if (auth.errore) return auth.errore;

      const pendente = session.cessioneComandantePendente;
      if (!pendente) {
        return new Response("Nessuna cessione del ruolo in attesa di risposta", { status: 400 });
      }
      const seiDestinatario = giocatoreId === pendente.versoGiocatoreId;
      const seiIlProponente = auth.giocatore.comandante === true;
      if (!seiDestinatario && !seiIlProponente) {
        return new Response("Non puoi rifiutare una cessione che non ti riguarda", { status: 403 });
      }

      session.cessioneComandantePendente = null;
      await this.state.storage.put("session", session);
      return Response.json(this.sessionPubblica(session));
    }

    // ===== RICONOSCIMENTO =====
    // Tre casi per rimettere in gioco chi ha perso la prova d'identita' (il
    // token di sessione) o per riprendere una partita bloccata da un comandante
    // sparito. Regola comune: chi CHIEDE non puo' confermarsi da solo, e con
    // una sola persona in stanza non c'e' auto-approvazione (l'unico ingannabile
    // sarebbe proprio il legittimo proprietario, e il link della stanza gira).
    // Riusa la struttura del pattern proponi/accetta della cessione: uno stato
    // pendente in sessione + conferma di un terzo. La differenza forzata: il
    // richiedente del CASO 1 non ha un token, quindi il token nuovo gli va
    // consegnato tramite un "biglietto" segreto (vedi /richiedi- e /reclama-).

    // CASO 2 -- registrato che rientra: prova crittografica, nessuna conferma.
    // Va tentato PER PRIMO dal client, prima di offrire il caso 1. Se il
    // profiloToken e' valido e in stanza c'e' gia' un record con quel profiloId,
    // riemette subito un token nuovo (invalidando il vecchio) e lo restituisce
    // nella risposta -- e' una richiesta gia' autenticata dalla prova crypto.
    if (url.pathname.endsWith("/rientro-registrato") && request.method === "POST") {
      const { profiloToken } = await request.json();
      const session = await this.initState();
      const profiloId = await this.verificaProfiloDaToken(profiloToken);
      if (!profiloId) return Response.json({ esito: "nessun_match" });
      const record = session.giocatori.find((g) => g.profiloId === profiloId);
      if (!record) return Response.json({ esito: "nessun_match" });
      const nuovoToken = crypto.randomUUID();
      record.token = nuovoToken; // invalida il vecchio: la vecchia scheda non agisce piu'
      await this.state.storage.put("session", session);
      return Response.json({
        esito: "riagganciato",
        token: nuovoToken,
        giocatoreId: record.id,
        ...this.sessionPubblica(session),
      });
    }

    // CASO 1 -- ospite che rientra: apre una richiesta di riconoscimento su un
    // record esistente (versoGiocatoreId). Non e' autenticato (e' proprio il
    // token che ha perso): riceve un `biglietto` segreto UNA SOLA VOLTA, con
    // cui piu' tardi reclamera' il token nuovo (vedi /reclama-rientro). NIENTE
    // auto-approvazione: serve sempre la conferma di un altro.
    if (url.pathname.endsWith("/richiedi-rientro") && request.method === "POST") {
      const { versoGiocatoreId } = await request.json();
      const session = await this.initState();
      const record = session.giocatori.find((g) => g.id === versoGiocatoreId);
      if (!record) {
        return new Response("Nessun giocatore con questo id nella stanza", { status: 400 });
      }
      if (session.riconoscimentoPendente && session.riconoscimentoPendente.stato === "in_attesa") {
        return new Response("C'e' gia' una richiesta di riconoscimento in attesa", { status: 409 });
      }
      const biglietto = crypto.randomUUID();
      session.riconoscimentoPendente = {
        tipo: "rientro",
        versoGiocatoreId,
        stato: "in_attesa",
        biglietto,
      };
      await this.state.storage.put("session", session);
      return Response.json({ biglietto });
    }

    // CASO 1 -- il richiedente reclama, in polling, l'esito della sua richiesta,
    // provando di essere lui con il `biglietto`. "in_attesa" -> aspetta ancora;
    // "approvato" -> riceve il token nuovo e la richiesta si chiude; qualunque
    // altra situazione (rifiutata, scaduta, biglietto che non combacia piu')
    // -> "chiusa", senza distinguere i motivi (non si perde nulla a non farlo).
    if (url.pathname.endsWith("/reclama-rientro") && request.method === "POST") {
      const { versoGiocatoreId, biglietto } = await request.json();
      const session = await this.initState();
      const p = session.riconoscimentoPendente;
      const combacia =
        p && p.tipo === "rientro" && p.versoGiocatoreId === versoGiocatoreId && p.biglietto === biglietto;
      if (!combacia) return Response.json({ stato: "chiusa" });
      if (p.stato === "in_attesa") return Response.json({ stato: "in_attesa" });
      if (p.stato === "rifiutato") {
        // Il diretto interessato ha vetato: dillo esplicitamente al richiedente
        // (distinto dal generico "chiusa"), poi chiudi la richiesta.
        session.riconoscimentoPendente = null;
        await this.state.storage.put("session", session);
        return Response.json({ stato: "rifiutato" });
      }
      // approvato: consegna il token nuovo e chiude la richiesta.
      const token = p.nuovoToken;
      session.riconoscimentoPendente = null;
      await this.state.storage.put("session", session);
      return Response.json({
        stato: "approvato",
        token,
        giocatoreId: versoGiocatoreId,
        ...this.sessionPubblica(session),
      });
    }

    // CASO 3 -- prendere il comando quando il comandante e' sparito. Il
    // richiedente E' autenticato (e' seduto, ha solo il comandante irraggiungibile):
    // apre la richiesta col proprio giocatoreId. NIENTE auto-approvazione.
    if (url.pathname.endsWith("/richiedi-comando") && request.method === "POST") {
      const { giocatoreId, token } = await request.json();
      const session = await this.initState();
      const auth = this.autenticaGiocatore(session, giocatoreId, token);
      if (auth.errore) return auth.errore;
      if (session.riconoscimentoPendente && session.riconoscimentoPendente.stato === "in_attesa") {
        return new Response("C'e' gia' una richiesta di riconoscimento in attesa", { status: 409 });
      }
      if (auth.giocatore.comandante) {
        return new Response("Sei gia' il comandante", { status: 400 });
      }
      session.riconoscimentoPendente = { tipo: "comando", versoGiocatoreId: giocatoreId, stato: "in_attesa" };
      await this.state.storage.put("session", session);
      return Response.json(this.sessionPubblica(session));
    }

    // CONFERMA (il "Si") -- valida sia per rientro sia per comando. Puo' venire
    // da CHIUNQUE sia autenticato TRANNE il richiedente. Guardia stato ===
    // "in_attesa": una richiesta gia' risolta non si riconferma. Il "Si"
    // finalizza subito (rientro: token nuovo, vecchio invalidato; comando:
    // comando trasferito), quindi vince chi arriva prima al Durable Object.
    if (url.pathname.endsWith("/conferma-riconoscimento") && request.method === "POST") {
      const { giocatoreId, token } = await request.json();
      const session = await this.initState();
      const auth = this.autenticaGiocatore(session, giocatoreId, token);
      if (auth.errore) return auth.errore;
      const p = session.riconoscimentoPendente;
      if (!p || p.stato !== "in_attesa") {
        return new Response("Nessuna richiesta di riconoscimento in attesa", { status: 400 });
      }
      if (giocatoreId === p.versoGiocatoreId) {
        return new Response("Non puoi confermare la tua stessa richiesta", { status: 403 });
      }

      if (p.tipo === "rientro") {
        const record = session.giocatori.find((g) => g.id === p.versoGiocatoreId);
        if (!record) {
          session.riconoscimentoPendente = null;
          await this.state.storage.put("session", session);
          return new Response("Il record da riagganciare non esiste piu'", { status: 409 });
        }
        const nuovoToken = crypto.randomUUID();
        record.token = nuovoToken; // invalida il vecchio subito
        p.stato = "approvato";
        p.nuovoToken = nuovoToken; // il richiedente lo raccoglie con /reclama-rientro
        await this.state.storage.put("session", session);
        return Response.json(this.sessionPubblica(session));
      }

      // comando
      const nuovo = session.giocatori.find((g) => g.id === p.versoGiocatoreId);
      if (!nuovo) {
        session.riconoscimentoPendente = null;
        await this.state.storage.put("session", session);
        return new Response("Il richiedente non esiste piu'", { status: 409 });
      }
      const comandanteAttuale = session.giocatori.find((g) => g.comandante);
      if (comandanteAttuale) comandanteAttuale.comandante = false;
      nuovo.comandante = true;
      session.riconoscimentoPendente = null;
      await this.state.storage.put("session", session);
      return Response.json(this.sessionPubblica(session));
    }

    // RIFIUTO -- due poteri distinti, entrambi solo mentre la richiesta e'
    // "in_attesa":
    // - VETO FORTE del diretto interessato: batte qualunque "Si" non ancora
    //   arrivato. Rientro -> chi tiene ANCORA un token valido per il record
    //   reclamato (giocatoreId === versoGiocatoreId autenticato: se il token
    //   fosse davvero perso nessuno potrebbe farlo, ed e' giusto cosi'). Comando
    //   -> il comandante attuale autenticato.
    // - ANNULLAMENTO del richiedente stesso: rientro con `biglietto`, comando
    //   con la propria identita' (giocatoreId === versoGiocatoreId).
    // Chiunque altro (un terzo estraneo) viene rifiutato con 403.
    if (url.pathname.endsWith("/rifiuta-riconoscimento") && request.method === "POST") {
      const { giocatoreId, token, biglietto } = await request.json();
      const session = await this.initState();
      const p = session.riconoscimentoPendente;
      if (!p) {
        return new Response("Nessuna richiesta di riconoscimento in attesa", { status: 400 });
      }
      if (p.stato !== "in_attesa") {
        return new Response("La richiesta e' gia' stata risolta", { status: 409 });
      }

      if (p.tipo === "rientro") {
        // Annullamento del richiedente STESSO (col biglietto): e' lui che
        // rinuncia, quindi si chiude in silenzio (azzerato) -- non c'e' nessun
        // "rifiutato" da fargli scoprire.
        if (biglietto && biglietto === p.biglietto) {
          session.riconoscimentoPendente = null;
          await this.state.storage.put("session", session);
          return Response.json(this.sessionPubblica(session));
        }
        // Veto del diretto interessato: deve autenticarsi come il record reclamato.
        const auth = this.autenticaGiocatore(session, giocatoreId, token);
        if (auth.errore) return auth.errore;
        if (giocatoreId !== p.versoGiocatoreId) {
          return new Response("Solo il diretto interessato puo' rifiutare questo rientro", { status: 403 });
        }
        // NON azzeriamo: lo stato "rifiutato" resta finche' il richiedente non
        // lo legge con /reclama-rientro, cosi' scopre di essere stato rifiutato
        // (non un generico "chiusa"). /reclama-rientro azzera alla lettura.
        p.stato = "rifiutato";
        await this.state.storage.put("session", session);
        return Response.json(this.sessionPubblica(session));
      }

      // comando: veto del comandante attuale, o annullamento del richiedente.
      const auth = this.autenticaGiocatore(session, giocatoreId, token);
      if (auth.errore) return auth.errore;
      const seiRichiedente = giocatoreId === p.versoGiocatoreId;
      const seiComandante = auth.giocatore.comandante === true;
      if (!seiRichiedente && !seiComandante) {
        return new Response("Solo il comandante attuale o il richiedente possono chiudere questa richiesta", {
          status: 403,
        });
      }
      session.riconoscimentoPendente = null;
      await this.state.storage.put("session", session);
      return Response.json(this.sessionPubblica(session));
    }
    // ===== FINE RICONOSCIMENTO =====

    // Le chiavi accettate sono le risorse di squadra oppure "margine" --
    // stesso trattamento che "margine" gia' riceve nel ciclo di effetti di
    // /scegli piu' sotto (una pseudo-risorsa, non nell'oggetto
    // risorseDiSquadra ma modificabile con lo stesso pattern delta).
    // Riservato al comandante: richiede giocatoreId + token validi E
    // comandante === true (vedi autenticaComandante()).
    if (url.pathname.endsWith("/risorse") && request.method === "POST") {
      const { risorsa, delta, giocatoreId, token } = await request.json();
      const session = await this.initState();
      const auth = this.autenticaComandante(session, giocatoreId, token);
      if (auth.errore) return auth.errore;
      if (risorsa === "margine") {
        session.margine += delta;
      } else if (risorsa in session.risorseDiSquadra) {
        session.risorseDiSquadra[risorsa] += delta;
      } else {
        return new Response("Risorsa sconosciuta", { status: 400 });
      }
      await this.state.storage.put("session", session);
      return Response.json(this.sessionPubblica(session));
    }

    // Avvia un Nodo Temporale: parte dalla prima richiesta del nodo,
    // non tocca lo storico. Registra l'inizio nel diario del nodo.
    // Riservato al comandante: richiede giocatoreId + token validi E
    // comandante === true (vedi autenticaComandante()).
    if (url.pathname.endsWith("/avvia-nodo") && request.method === "POST") {
      const { nodoId, giocatoreId, token } = await request.json();
      const nodo = GAME_CONFIG.nodiTemporali.find((n) => n.id === nodoId);
      if (!nodo) return new Response("Nodo sconosciuto", { status: 400 });
      const session = await this.initState();
      const auth = this.autenticaComandante(session, giocatoreId, token);
      if (auth.errore) return auth.errore;
      const primaRichiesta = nodo.richieste[0] ?? null;
      session.nodoAttivo = nodoId;
      session.richiestaIndice = 0;
      session.richiestaAttivaId = primaRichiesta ? primaRichiesta.id : null;
      // Il nuovo nodo riparte con l'anti-ripetizione pulita: gli id dei
      // frammenti sono univoci solo per slot/pool, quindi tra pool di nodi
      // diversi potrebbero collidere; e narrativamente ogni nodo comincia da
      // zero, non deve "ricordare" i frammenti del nodo precedente.
      session.storicoFrammenti = [];
      // Nuovo nodo: nessun esito da mostrare ancora (la vista corrente
      // dell'esito appartiene al nodo appena lasciato). Azzerata.
      session.esitoCorrente = null;
      session.storicoNodo.push({
        nodoId,
        iniziato_il: new Date().toISOString(),
        concluso_il: null,
        esitoFinale: null,
      });
      await this.state.storage.put("session", session);
      return Response.json({ session: this.sessionPubblica(session), richiestaAttiva: primaRichiesta });
    }

    // Richiesta attualmente attiva nel nodo in corso (situazione + risposte disponibili)
    if (url.pathname.endsWith("/richiesta-attiva") && request.method === "GET") {
      const session = await this.initState();
      const richiestaAttiva = this.trovaRichiestaAttiva(session);
      return Response.json({ session: this.sessionPubblica(session), richiestaAttiva });
    }

    // Un giocatore/la squadra sceglie una delle risposte pre-scritte:
    // applica gli effetti (risorse di squadra + margine), fa avanzare
    // l'orologio, registra la scelta nello storico (con chi l'ha fatta),
    // determina la prossima richiesta (ramificazione se `prossima` e'
    // indicata, altrimenti sequenza).
    // `giocatoreId` + `token` sono obbligatori: il server verifica che il
    // token corrisponda proprio a quel giocatore (vedi autenticaGiocatore()),
    // non solo che il giocatoreId esista nella stanza.
    if (url.pathname.endsWith("/scegli") && request.method === "POST") {
      const { risposteIndice, giocatoreId, token } = await request.json();
      const session = await this.initState();

      const auth = this.autenticaGiocatore(session, giocatoreId, token);
      if (auth.errore) return auth.errore;

      const nodo = GAME_CONFIG.nodiTemporali.find((n) => n.id === session.nodoAttivo);
      const richiestaAttiva = this.trovaRichiestaAttiva(session);
      if (!nodo || !richiestaAttiva) {
        return new Response("Nessuna richiesta attiva: avvia prima un nodo", { status: 400 });
      }
      const risposta = richiestaAttiva.risposte[risposteIndice];
      if (!risposta) return new Response("Risposta sconosciuta", { status: 400 });

      const risultato = await this.applicaRisposta(session, richiestaAttiva, risposta, giocatoreId);
      await this.state.storage.put("session", session);
      return Response.json({ session: this.sessionPubblica(session), ...risultato });
    }

    // Testo libero: SI AFFIANCA ai bottoni, non li sostituisce (vedi
    // commento in cima al file). Riceve { testoLibero, richiestaId,
    // giocatoreId, token }. Tre esiti possibili da interpreta():
    // - "automatica": applica subito la risposta trovata, stessa forma di
    //   risposta di /scegli (cosi' il client puo' riusare lo stesso rendering);
    // - "manuale": salva in session.interpretazionePendente per il
    //   comandante, risponde solo { esito: "manuale", session };
    // - "nessuna_corrispondenza": nessuna modifica allo stato, risponde
    //   solo { esito: "nessuna_corrispondenza" } perche' il client mostri
    //   un messaggio invece di un errore grezzo.
    // `giocatoreId` + `token` verificati come in /scegli (vedi autenticaGiocatore()).
    if (url.pathname.endsWith("/interpreta") && request.method === "POST") {
      const { testoLibero, richiestaId, giocatoreId, token } = await request.json();
      const session = await this.initState();

      const auth = this.autenticaGiocatore(session, giocatoreId, token);
      if (auth.errore) return auth.errore;

      const opzioni = await trovaLibreriaPerRichiesta(richiestaId);
      if (!opzioni) {
        return new Response("Questa richiesta non supporta ancora il testo libero", { status: 400 });
      }

      const richiestaAttiva = this.trovaRichiestaAttiva(session);
      if (!richiestaAttiva || richiestaAttiva.id !== richiestaId) {
        return new Response("Nessuna richiesta attiva corrispondente: avvia prima il nodo giusto", {
          status: 400,
        });
      }

      // Soglie PROVVISORIE: da tarare con test dal vivo, non ancora
      // validate su un volume reale di testo libero scritto da persone vere.
      const SOGLIA_ALTA_PROVVISORIA = 0.6;
      const MARGINE_DISTACCO_PROVVISORIO = 0.15;
      const decisione = interpreta(testoLibero, opzioni, {
        sogliaAlta: SOGLIA_ALTA_PROVVISORIA,
        margineDistacco: MARGINE_DISTACCO_PROVVISORIO,
      });

      if (decisione.tipo === "automatica") {
        const indice = parseInt(decisione.opzione.effetto.risposteIndice, 10);
        const risposta = richiestaAttiva.risposte[indice];
        if (!risposta) {
          return new Response(
            "La libreria dell'interprete punta a una risposta inesistente (risposteIndice non valido)",
            { status: 500 }
          );
        }
        const risultato = await this.applicaRisposta(session, richiestaAttiva, risposta, giocatoreId);
        await this.state.storage.put("session", session);
        return Response.json({ session: this.sessionPubblica(session), ...risultato });
      }

      if (decisione.tipo === "manuale") {
        session.interpretazionePendente = {
          giocatoreId,
          richiestaId,
          testoLibero,
          candidati: decisione.candidati.map((c) => {
            const indice = parseInt(c.opzione.effetto.risposteIndice, 10);
            return {
              id: c.id,
              risposteIndice: indice,
              punteggio: c.punteggio,
              testoRisposta: richiestaAttiva.risposte[indice]?.testo ?? null,
            };
          }),
        };
        await this.state.storage.put("session", session);
        return Response.json({ esito: "manuale", session: this.sessionPubblica(session) });
      }

      // "nessuna_corrispondenza": nessuna modifica allo stato.
      return Response.json({ esito: "nessuna_corrispondenza" });
    }

    // Il comandante risolve un'interpretazione pendente: sceglie uno dei
    // candidati ({ risposteIndice }) o scarta tutto ({ annulla: true }),
    // rimettendo il giocatore davanti alla richiesta senza applicare nulla.
    // Riservato al comandante: richiede giocatoreId + token validi E
    // comandante === true (vedi autenticaComandante()) -- nota che il
    // giocatoreId qui e' quello di CHI RISOLVE (il comandante), non quello
    // di chi aveva scritto il testo libero (pendente.giocatoreId), usato
    // solo per applicaRisposta().
    if (url.pathname.endsWith("/risolvi-interpretazione") && request.method === "POST") {
      const { risposteIndice, annulla, giocatoreId, token } = await request.json();
      const session = await this.initState();

      const auth = this.autenticaComandante(session, giocatoreId, token);
      if (auth.errore) return auth.errore;

      if (!session.interpretazionePendente) {
        return new Response("Nessuna interpretazione in attesa di risoluzione", { status: 400 });
      }

      if (annulla) {
        session.interpretazionePendente = null;
        await this.state.storage.put("session", session);
        return Response.json({ session: this.sessionPubblica(session) });
      }

      const pendente = session.interpretazionePendente;
      const richiestaAttiva = this.trovaRichiestaAttiva(session);
      if (!richiestaAttiva || richiestaAttiva.id !== pendente.richiestaId) {
        // La richiesta e' cambiata da quando l'interpretazione e' rimasta
        // pendente (es. qualcun altro ha gia' scelto un bottone nel
        // frattempo): scarta senza applicare, invece di rischiare di
        // applicare una risposta alla richiesta sbagliata.
        session.interpretazionePendente = null;
        await this.state.storage.put("session", session);
        return new Response("La richiesta non e' piu' attiva: interpretazione scartata", { status: 409 });
      }
      const risposta = richiestaAttiva.risposte[risposteIndice];
      if (!risposta) return new Response("Risposta sconosciuta", { status: 400 });

      const risultato = await this.applicaRisposta(session, richiestaAttiva, risposta, pendente.giocatoreId);
      session.interpretazionePendente = null;
      await this.state.storage.put("session", session);
      return Response.json({ session: this.sessionPubblica(session), ...risultato });
    }

    // Chat di squadra: canale puramente umano (il Cronista NON scrive qui,
    // resta nel flusso di narrazione) ed effimero (vive solo nello stato
    // della sessione, mai su D1: muore con la stanza, e' voluto). Scrivere
    // richiede identita' verificata come /scegli (vedi autenticaGiocatore()):
    // chi non ha un token valido non puo' scrivere. Ogni messaggio salva
    // id/nome/giocatoreId/ruolo/testo/timestamp -- il client oggi mostra solo
    // nome + testo, ma ruolo e timestamp si salvano per poter evolvere l'UI
    // senza migrare i dati. Il testo e' troncato a 500 caratteri QUI, lato
    // server, senza fidarsi del client; la coda e' limitata agli ultimi 200
    // (slice(-200) dopo ogni push). La chat viaggia al client dentro
    // sessionPubblica() (GET /state), con lo stesso polling che gia' aggiorna
    // il resto dello stato -- nessun WebSocket, nessun canale a parte, e i
    // token restano esclusi (nel messaggio non c'e' nessun token).
    if (url.pathname.endsWith("/chat") && request.method === "POST") {
      const { testo, giocatoreId, token } = await request.json();
      const session = await this.initState();

      const auth = this.autenticaGiocatore(session, giocatoreId, token);
      if (auth.errore) return auth.errore;

      if (typeof testo !== "string" || testo.trim() === "") {
        return new Response("Messaggio vuoto: niente da inviare", { status: 400 });
      }
      const testoPulito = testo.trim().slice(0, 500);

      session.chat.push({
        id: crypto.randomUUID(),
        nome: auth.giocatore.nome,
        giocatoreId: auth.giocatore.id,
        ruolo: auth.giocatore.ruolo,
        testo: testoPulito,
        timestamp: new Date().toISOString(),
      });
      session.chat = session.chat.slice(-200);

      await this.state.storage.put("session", session);
      return Response.json(this.sessionPubblica(session));
    }

    return new Response("Not found", { status: 404 });
  }

  // Applica gli effetti di una risposta scelta (a bottone o via interprete
  // di testo libero: stessa logica per entrambi, mai duplicata) -- tiro se
  // la risposta ha competenzaRichiesta, effetti sulle risorse/margine,
  // Cronista se applicabile, storicoScelte, complicazione da margine,
  // prossima richiesta (ramificazione o sequenza), ed esito del nodo se la
  // richiesta era l'ultima. Muta `session` sul posto (chi chiama e'
  // responsabile di salvarla su storage), restituisce i campi da comporre
  // nella risposta HTTP: { esito, prossimaRichiesta, esitoNodo,
  // complicazione, tiro }.
  async applicaRisposta(session, richiestaAttiva, risposta, giocatoreId) {
    const giocatore = session.giocatori.find((g) => g.id === giocatoreId);
    const nodo = GAME_CONFIG.nodiTemporali.find((n) => n.id === session.nodoAttivo);

    // Risposta con tiro: il punteggio di competenza del giocatore che sta
    // scegliendo decide l'esito (pieno/parziale/fallimento), che a sua
    // volta seleziona quali effetti applicare e quale testo mostrare.
    // Risposta senza `competenzaRichiesta`: effetto fisso e testo fisso.
    let tiro = null;
    let effettiDaApplicare = risposta.effetti || {};
    let testoEsito = risposta.esito;
    const ruoloGiocatore = GAME_CONFIG.ruoli.find((r) => r.id === giocatore.ruolo);
    if (risposta.competenzaRichiesta) {
      let punteggio = giocatore.competenze[risposta.competenzaRichiesta] ?? 0;
      if (risposta.bonusContesto && risposta.bonusContesto.competenza === risposta.competenzaRichiesta) {
        punteggio += risposta.bonusContesto.valore;
      }
      punteggio += await this.calcolaBonusGrado(giocatore, risposta.competenzaRichiesta);
      const facce =
        ruoloGiocatore?.dadoFacce && risposta.competenzaRichiesta === ruoloGiocatore.competenzaPrincipale
          ? ruoloGiocatore.dadoFacce
          : undefined;
      tiro = risolviAzione(punteggio, null, facce);
      effettiDaApplicare = (risposta.effettiPerEsito && risposta.effettiPerEsito[tiro.esito]) || {};
      testoEsito = (risposta.esito && risposta.esito[tiro.esito]) || null;
    }

    // Effetti: le chiavi possono essere risorse di squadra oppure "margine".
    const margineDeltaAzione = effettiDaApplicare.margine ?? 0;
    for (const [chiave, delta] of Object.entries(effettiDaApplicare)) {
      if (chiave === "margine") {
        session.margine += delta;
      } else {
        session.risorseDiSquadra[chiave] = (session.risorseDiSquadra[chiave] || 0) + delta;
      }
    }

    // Cronista: solo per risposte con tiro, solo se il nodo attivo ha un
    // pool disponibile (vedi commento in cima al file). Sostituisce
    // testoEsito quando applicabile.
    if (tiro) {
      const pool = await trovaPoolPerNodo(session.nodoAttivo);
      if (pool) {
        const { testo, frammentiUsati } = componiNarrazione(pool, {
          esito: tiro.esito,
          competenzaId: risposta.competenzaRichiesta,
          ruoloId: giocatore.ruolo,
          // Id della richiesta che ha generato questo tiro: dato opaco per
          // il motore (come competenzaId/ruoloId), asse su cui un frammento
          // di un .md puo' condizionarsi per non mescolarsi con quelli di
          // un'altra scena dello stesso nodo. Oggi nessun frammento lo usa:
          // e' solo abilitazione, l'asse resta inerte finche' una colonna
          // "richiestaId" non compare in un pool. Stesso id gia' usato qui
          // sotto per storicoScelte.
          richiestaId: richiestaAttiva.id,
          margine: { valore: session.margine, soglia: GAME_CONFIG.margineSoglia ?? null, delta: margineDeltaAzione },
          variabili: { ruolo: ruoloGiocatore?.nomeConArticolo ?? giocatore.ruolo },
          storicoFrammenti: session.storicoFrammenti,
        });
        testoEsito = testo;
        // Finestra scorrevole: accoda gli id appena usati e tieni solo gli
        // ultimi 12, così il prossimo tiro evita di ripeterli (anti-ripetizione
        // del Cronista, vedi scegliFrammento in narratore-simulato.js).
        session.storicoFrammenti = [...session.storicoFrammenti, ...frammentiUsati].slice(-12);
      }
    }

    session.orologio += 1;

    session.storicoScelte.push({
      richiestaId: richiestaAttiva.id,
      risposteTesto: risposta.testo,
      esito: testoEsito,
      giocatoreId,
      tiro,
      timestamp: new Date().toISOString(),
    });

    // Complicazione da margine: soglia configurabile in game-config.js.
    // Al superamento, segnaliamo la complicazione e AZZERIAMO il margine
    // (Decisione #23 nel log: col vecchio dimezzamento a meta' soglia gli
    // scoppi successivi arrivavano ogni ~1,9 tiri, misura Sim B del playtest
    // zero -- guai a raffica; con l'azzeramento ~2,9 tiri e tutte le fasce
    // del Cronista tornano in gioco). NOTA sull'ordine: questo controllo
    // avviene DOPO la chiamata al Cronista qui sopra, che quindi vede ancora
    // il valore pieno (fascia "critico" nel turno dello scoppio) -- non
    // spostare questo blocco prima della composizione della narrazione.
    let complicazione = null;
    const soglia = GAME_CONFIG.margineSoglia ?? null;
    if (soglia !== null && session.margine >= soglia) {
      complicazione = GAME_CONFIG.margineComplicazioneTesto
        ?? "Il margine e' esaurito: qualcosa va storto.";
      session.margine = 0;
    }

    // Prossima richiesta: attenzione, tre casi distinti.
    // - campo "prossima" assente -> nodo non ramificato, si va in sequenza (compatibilità).
    // - "prossima": "<id>" -> ramificazione esplicita verso quella richiesta.
    // - "prossima": null (scritto esplicitamente) -> fine ramo, il nodo si chiude qui,
    //   anche se nell'array ci sono altre richieste dopo. Necessario per non "sbandare"
    //   in sequenza per errore in un nodo che usa la ramificazione.
    let prossimaRichiesta = null;
    if (Object.prototype.hasOwnProperty.call(risposta, "prossima")) {
      prossimaRichiesta = risposta.prossima
        ? nodo.richieste.find((r) => r.id === risposta.prossima) ?? null
        : null;
    } else {
      const indiceCorrente = nodo.richieste.findIndex((r) => r.id === richiestaAttiva.id);
      prossimaRichiesta = nodo.richieste[indiceCorrente + 1] ?? null;
    }
    session.richiestaIndice += 1;
    session.richiestaAttivaId = prossimaRichiesta ? prossimaRichiesta.id : null;

    let esitoNodo = null;
    if (!prossimaRichiesta) {
      esitoNodo = this.valutaEsitoNodo(session);
      const diario = session.storicoNodo[session.storicoNodo.length - 1];
      if (diario && diario.nodoId === session.nodoAttivo && !diario.concluso_il) {
        diario.concluso_il = new Date().toISOString();
        diario.esitoFinale = esitoNodo;
      }
      await this.assegnaXpNodoCompletato(session);
    }

    // Vista corrente dell'esito nello STATO CONDIVISO: gli stessi dati che
    // tornano qui sotto nella risposta HTTP dell'attore, ma salvati sulla
    // sessione cosi' che anche chi NON ha agito possa ridisegnarli (in questo
    // passo e' solo il dato: il front-end non lo legge ancora). Costruita qui
    // e non al push di storicoScelte perche' complicazione, esitoNodo e
    // prossimaRichiesta si conoscono solo a questo punto. prossimaRichiesta e'
    // salvata come solo id (come richiestaAttivaId): l'oggetto si ricostruisce
    // da game-config quando servira'. Nessun token, segreto o dato privato.
    session.esitoCorrente = {
      richiestaId: richiestaAttiva.id,
      esito: testoEsito,
      tiro,
      competenzaId: risposta.competenzaRichiesta ?? null,
      complicazione,
      esitoNodo,
      prossimaRichiestaId: prossimaRichiesta ? prossimaRichiesta.id : null,
    };

    // competenzaId: quale competenza ha deciso il tiro (null se nessun
    // tiro). Serve al client per mostrare il nome leggibile nel dettaglio
    // del tiro -- per un click su un bottone il client lo sa già in
    // anticipo (ha la risposta scelta), ma per l'interprete di testo
    // libero no (è il server a decidere quale risposta si applica).
    return {
      esito: testoEsito,
      prossimaRichiesta,
      esitoNodo,
      complicazione,
      tiro,
      competenzaId: risposta.competenzaRichiesta ?? null,
    };
  }

  trovaRichiestaAttiva(session) {
    if (!session.nodoAttivo) return null;
    const nodo = GAME_CONFIG.nodiTemporali.find((n) => n.id === session.nodoAttivo);
    if (!nodo) return null;
    if (session.richiestaAttivaId) {
      return nodo.richieste.find((r) => r.id === session.richiestaAttivaId) ?? null;
    }
    return nodo.richieste[session.richiestaIndice] ?? null; // fallback legacy
  }

  // Verifica un profiloToken dichiarato al /join (Passo 2 del sistema di
  // token di sessione): ricava il profiloId SOLO da un token valido
  // (esistente in sessioni_profilo, non scaduto) -- MAI da un profiloId
  // dichiarato a parte dal client, che non viene più letto/accettato.
  // Nessun token, o nessun binding D1 in questo ambiente: null senza
  // nemmeno provare la query. Un fallimento D1 e' isolato qui (stesso
  // principio di calcolaBonusGrado sotto): il join non si blocca mai,
  // il giocatore entra semplicemente come ospite (profiloId null).
  async verificaProfiloDaToken(profiloToken) {
    if (!profiloToken || !this.env.DB) return null;
    try {
      return await verificaTokenSessione(this.env.DB, profiloToken);
    } catch (errore) {
      console.error("Verifica profiloToken fallita:", errore);
      return null;
    }
  }

  // Bonus di grado sul tiro (Fase 4, profilo persistente): +1 al punteggio
  // se il giocatore ha un profiloId E quella specifica competenza è tra
  // quelle bonificate nel suo bonus_scelti.assegnati -- letto da D1 a ogni
  // tiro (nessuna cache), trasversale al RUOLO scelto in QUESTA stanza: il
  // bonus si applica per la competenza guadagnata, non per il ruolo che il
  // giocatore aveva quando l'ha ottenuto (nessun collegamento al ruolo,
  // deciso esplicitamente). Nessun profiloId o nessun binding D1 in questo
  // ambiente (es. test che non lo configurano): 0 senza nemmeno provare la
  // query. Un fallimento D1 (rete, tabella, qualunque errore) e' isolato
  // qui: nessun bonus per QUESTO tiro, ma il tiro e il gameplay procedono
  // comunque -- stesso principio gia' seguito in assegnaXpNodoCompletato.
  async calcolaBonusGrado(giocatore, competenzaId) {
    if (giocatore.profiloId == null || !this.env.DB) return 0;
    try {
      const competenzeBonificate = await otteniCompetenzeBonificate(this.env.DB, giocatore.profiloId);
      return competenzeBonificate.has(competenzaId) ? 1 : 0;
    } catch (errore) {
      console.error(`Lettura bonus di grado fallita per profiloId=${giocatore.profiloId}:`, errore);
      return 0;
    }
  }

  // XP al profilo persistente (Fase 3): chiamata SOLO da applicaRisposta()
  // quando un nodo si e' appena chiuso strutturalmente -- evento sempre
  // automatico, mai a discrezione del comandante. Un giocatore alla volta,
  // ciascuno nel proprio try/catch: un fallimento D1 per un giocatore
  // (rete, tabella non ancora migrata, qualunque errore) NON deve
  // impedire agli altri di ricevere il proprio XP, e non deve MAI far
  // fallire il completamento del nodo per la stanza -- l'errore finisce
  // solo nei log (console.error, raccolto da Cloudflare), il gameplay
  // prosegue comunque. Giocatori senza profiloId (anonimi) ignorati.
  async assegnaXpNodoCompletato(session) {
    const giocatoriConProfilo = session.giocatori.filter((g) => g.profiloId != null);
    if (giocatoriConProfilo.length === 0) return;

    if (!this.env.DB) {
      // Binding D1 assente in questo ambiente (es. test che non lo
      // configurano): un solo log generico invece di uno per giocatore.
      console.error(
        `XP non assegnato per il nodo "${session.nodoAttivo}": binding D1 (env.DB) non disponibile in questo ambiente.`
      );
      return;
    }

    for (const giocatore of giocatoriConProfilo) {
      try {
        await assegnaXpCompletamentoNodo(this.env.DB, giocatore.profiloId, session.nodoAttivo);
      } catch (errore) {
        console.error(
          `Assegnazione XP fallita per profiloId=${giocatore.profiloId}, nodo="${session.nodoAttivo}":`,
          errore
        );
      }
    }
  }

  // Valutazione generica delle soglie di un nodo, a prescindere dal nodo:
  // ogni nuovo nodo aggiunto in game-config.js funziona qui senza modifiche.
  valutaEsitoNodo(session) {
    const nodo = GAME_CONFIG.nodiTemporali.find((n) => n.id === session.nodoAttivo);
    if (!nodo || !nodo.esitoFinale) return null;

    for (const variante of nodo.esitoFinale.varianti) {
      const soddisfatta = Object.entries(variante.condizione).every(([risorsa, soglia]) => {
        const valore = session.risorseDiSquadra[risorsa] ?? 0;
        if (soglia.min !== undefined && valore < soglia.min) return false;
        if (soglia.max !== undefined && valore > soglia.max) return false;
        return true;
      });
      if (soddisfatta) return variante.testo;
    }
    return nodo.esitoFinale.default;
  }
}
