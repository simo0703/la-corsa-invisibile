// Test locale: node test-profili-giocatore.mjs
//
// Fase 1 del profilo giocatore persistente: solo schema + registrazione/
// accesso, nessun collegamento al gameplay esistente. Nessun bisogno di
// wrangler/miniflare: un fake D1 minimale (stesso spirito del fake storage
// usato per GameSession, ma per db.prepare().bind().first()/.run()) copre
// esattamente le due query emesse da src/lib/profili-giocatore.js.

import {
  registraGiocatore,
  accediGiocatore,
  validaNome,
  validaPin,
  calcolaGrado,
  normalizzaBonusScelti,
  otteniStatoProfilo,
  assegnaBonusProfilo,
} from "./src/lib/profili-giocatore.js";

let falliti = 0;
function verifica(descrizione, condizione) {
  if (condizione) {
    console.log(`OK   - ${descrizione}`);
  } else {
    console.log(`FAIL - ${descrizione}`);
    falliti += 1;
  }
}

// Fake D1: righe in memoria, riconosce le due forme di query usate dal
// modulo (SELECT ... WHERE nome = ?, INSERT INTO giocatori_persistenti).
function creaDbFinto() {
  const righe = [];
  let prossimoId = 1;

  function prepare(sql) {
    const normalizzata = sql.replace(/\s+/g, " ").trim();
    return {
      bind(...args) {
        return {
          async first() {
            if (normalizzata.includes("WHERE id = ?")) {
              const [id] = args;
              const riga = righe.find((r) => r.id === id);
              return riga ? { ...riga } : null;
            }
            if (normalizzata.startsWith("SELECT")) {
              const [nome] = args;
              const riga = righe.find((r) => r.nome === nome);
              return riga ? { ...riga } : null;
            }
            throw new Error(`Query .first() non gestita dal fake DB: ${normalizzata}`);
          },
          async run() {
            if (normalizzata.startsWith("INSERT INTO giocatori_persistenti")) {
              const [nome, pinHash, salt] = args;
              righe.push({
                id: prossimoId++,
                nome,
                pin_hash: pinHash,
                pin_salt: salt,
                xp_totale: 0,
                bonus_scelti: "[]",
                nodi_completati: "[]",
                created_at: new Date().toISOString(),
              });
              return { success: true };
            }
            if (normalizzata.startsWith("UPDATE giocatori_persistenti SET bonus_scelti = ? WHERE id = ?")) {
              const [bonusSceltiJson, id] = args;
              const riga = righe.find((r) => r.id === id);
              if (riga) riga.bonus_scelti = bonusSceltiJson;
              return { success: true };
            }
            throw new Error(`Query .run() non gestita dal fake DB: ${normalizzata}`);
          },
        };
      },
    };
  }

  // Solo per test: imposta xp_totale direttamente su una riga già creata,
  // per simulare un profilo che ha già accumulato XP (registraGiocatore
  // parte sempre da 0, nessun endpoint reale lo permette diversamente).
  function impostaXpTotale(id, xp) {
    const riga = righe.find((r) => r.id === id);
    riga.xp_totale = xp;
  }

  return { prepare, impostaXpTotale };
}

console.log("--- validazione formato ---");
{
  verifica("nome di 2 caratteri è troppo corto", validaNome("ab") === "nome_troppo_corto");
  verifica("nome di 3 caratteri è valido", validaNome("abc") === null);
  verifica("nome di 31 caratteri è troppo lungo", validaNome("a".repeat(31)) === "nome_troppo_lungo");
  verifica("nome di 30 caratteri è valido (limite incluso)", validaNome("a".repeat(30)) === null);
  verifica("nome con solo spazi (trim -> vuoto) è troppo corto", validaNome("   ") === "nome_troppo_corto");

  verifica("pin di 6 cifre è valido", validaPin("123456") === null);
  verifica("pin di 5 cifre è invalido", validaPin("12345") === "pin_formato_non_valido");
  verifica("pin di 7 cifre è invalido", validaPin("1234567") === "pin_formato_non_valido");
  verifica("pin con lettere è invalido", validaPin("12345a") === "pin_formato_non_valido");
  verifica("pin con simboli è invalido", validaPin("123-45") === "pin_formato_non_valido");
}

console.log("\n--- registrazione riuscita ---");
{
  const db = creaDbFinto();
  const risultato = await registraGiocatore(db, "Luca", "123456");
  verifica("registrazione riuscita", risultato.successo === true);
  verifica("il profilo restituito ha il nome corretto", risultato.profilo.nome === "Luca");
  verifica("xpTotale parte da 0", risultato.profilo.xpTotale === 0);
  verifica("bonusScelti parte vuoto", Array.isArray(risultato.profilo.bonusScelti) && risultato.profilo.bonusScelti.length === 0);
  verifica("il profilo NON espone pin_hash/pin_salt", risultato.profilo.pin_hash === undefined && risultato.profilo.pin_salt === undefined);
  verifica("ha un id numerico", typeof risultato.profilo.id === "number");
  verifica("ha una data di creazione", typeof risultato.profilo.creatoIl === "string" && risultato.profilo.creatoIl.length > 0);
}

console.log("\n--- registrazione con nome duplicato fallisce ---");
{
  const db = creaDbFinto();
  await registraGiocatore(db, "Luca", "123456");
  const risultato = await registraGiocatore(db, "Luca", "999999");
  verifica("la seconda registrazione con lo stesso nome fallisce", risultato.successo === false);
  verifica("l'errore è nome_gia_in_uso", risultato.errore === "nome_gia_in_uso");
}

console.log("\n--- registrazione con formato invalido fallisce con errore specifico ---");
{
  const db = creaDbFinto();
  const nomeCorto = await registraGiocatore(db, "ab", "123456");
  verifica("nome troppo corto: registrazione fallisce", nomeCorto.successo === false);
  verifica("errore specifico (non generico)", nomeCorto.errore === "nome_troppo_corto");

  const pinInvalido = await registraGiocatore(db, "Marco", "12ab56");
  verifica("pin non numerico: registrazione fallisce", pinInvalido.successo === false);
  verifica("errore specifico (non generico)", pinInvalido.errore === "pin_formato_non_valido");
}

console.log("\n--- login riuscito ---");
{
  const db = creaDbFinto();
  await registraGiocatore(db, "Nico", "654321");
  const risultato = await accediGiocatore(db, "Nico", "654321");
  verifica("login riuscito con le credenziali giuste", risultato.successo === true);
  verifica("il profilo restituito ha il nome corretto", risultato.profilo.nome === "Nico");
  verifica("il profilo NON espone pin_hash/pin_salt", risultato.profilo.pin_hash === undefined && risultato.profilo.pin_salt === undefined);
}

console.log("\n--- login con pin sbagliato fallisce (errore generico) ---");
{
  const db = creaDbFinto();
  await registraGiocatore(db, "Sara", "111111");
  const risultato = await accediGiocatore(db, "Sara", "222222");
  verifica("login con pin sbagliato fallisce", risultato.successo === false);
  verifica("l'errore è il generico credenziali_non_valide", risultato.errore === "credenziali_non_valide");
}

console.log("\n--- login con nome inesistente fallisce (stesso errore generico, non distinguibile) ---");
{
  const db = creaDbFinto();
  await registraGiocatore(db, "Elisa", "111111");
  const risultato = await accediGiocatore(db, "NomeCheNonEsiste", "111111");
  verifica("login con nome inesistente fallisce", risultato.successo === false);
  verifica(
    "l'errore è lo STESSO codice generico usato per il pin sbagliato (non si distingue nome da pin)",
    risultato.errore === "credenziali_non_valide"
  );
}

console.log("\n--- login con pin di formato invalido fallisce con lo stesso errore generico ---");
{
  const db = creaDbFinto();
  await registraGiocatore(db, "Vale", "111111");
  const risultato = await accediGiocatore(db, "Vale", "abcdef");
  verifica("login con pin di formato invalido fallisce", risultato.successo === false);
  verifica(
    "anche un formato non valido usa il messaggio generico, non uno che riveli il problema",
    risultato.errore === "credenziali_non_valide"
  );
}

console.log("\n--- l'hash del PIN non è mai il PIN in chiaro ---");
{
  // Verifica indiretta (il modulo non espone derivaPin): due giocatori con
  // lo stesso PIN devono comunque autenticarsi correttamente ciascuno con
  // le proprie credenziali (salt diverso per record -- se il codice
  // salvasse il PIN in chiaro o senza salt questo test passerebbe comunque,
  // ma la property più a monte, "profilo non contiene mai pin_hash/salt",
  // è già coperta sopra su ogni percorso di successo).
  const db = creaDbFinto();
  await registraGiocatore(db, "GiocatoreA", "424242");
  await registraGiocatore(db, "GiocatoreB", "424242");
  const loginA = await accediGiocatore(db, "GiocatoreA", "424242");
  const loginB = await accediGiocatore(db, "GiocatoreB", "424242");
  verifica("due giocatori con lo stesso PIN si autenticano entrambi correttamente", loginA.successo && loginB.successo);
  verifica("i profili restituiti sono distinti", loginA.profilo.id !== loginB.profilo.id);
}

console.log("\n--- normalizzaBonusScelti ---");
{
  verifica(
    "array bare '[]' (formato pre-Fase 4) normalizza a { assegnati: [] }",
    JSON.stringify(normalizzaBonusScelti("[]")) === JSON.stringify({ assegnati: [] })
  );
  const conAssegnati = normalizzaBonusScelti('{"assegnati":[{"grado":2,"competenza":"cadenza"}]}');
  verifica("oggetto già strutturato passa invariato", conAssegnati.assegnati.length === 1 && conAssegnati.assegnati[0].competenza === "cadenza");
  verifica(
    "oggetto senza chiave assegnati normalizza comunque ad array vuoto",
    JSON.stringify(normalizzaBonusScelti("{}")) === JSON.stringify({ assegnati: [] })
  );
}

console.log("\n--- calcolaGrado ---");
{
  const nessunBonus = { assegnati: [] };
  verifica("0 XP: grado 1 Bersagliere, nessun bonus disponibile", (() => {
    const g = calcolaGrado(0, nessunBonus);
    return g.gradoNumero === 1 && g.gradoNome === "Bersagliere" && g.bonusDisponibili === 0 && g.sogliaGradoAttuale === 0 && g.sogliaProssimoGrado === 200;
  })());
  verifica("199 XP: resta grado 1 (soglia non ancora raggiunta)", calcolaGrado(199, nessunBonus).gradoNumero === 1);
  verifica("200 XP: sale a grado 2 Bersagliere Scelto, 1 bonus disponibile", (() => {
    const g = calcolaGrado(200, nessunBonus);
    return g.gradoNumero === 2 && g.gradoNome === "Bersagliere Scelto" && g.bonusDisponibili === 1;
  })());
  verifica("399 XP: resta grado 2", calcolaGrado(399, nessunBonus).gradoNumero === 2);
  verifica("1800 XP: grado 10 Capitano, soglia prossimo grado null (grado massimo)", (() => {
    const g = calcolaGrado(1800, nessunBonus);
    return g.gradoNumero === 10 && g.gradoNome === "Capitano" && g.sogliaProssimoGrado === null;
  })());
  verifica("XP oltre il grado massimo resta comunque a grado 10 (capped)", calcolaGrado(50_000, nessunBonus).gradoNumero === 10);
  verifica(
    "1800 XP senza bonus assegnati: 5 bonus disponibili (gradi 2,4,6,8,10)",
    calcolaGrado(1800, nessunBonus).bonusDisponibili === 5
  );
  verifica(
    "1800 XP con 2 bonus già assegnati: 3 bonus ancora disponibili",
    calcolaGrado(1800, { assegnati: [{ grado: 2, competenza: "cadenza" }, { grado: 4, competenza: "precisione" }] }).bonusDisponibili === 3
  );
  verifica(
    "1800 XP con tutti e 5 i bonus già assegnati: 0 disponibili",
    calcolaGrado(1800, {
      assegnati: [2, 4, 6, 8, 10].map((grado) => ({ grado, competenza: "cadenza" })),
    }).bonusDisponibili === 0
  );
  verifica("bonusScelti assente (undefined): trattato come nessun bonus assegnato", calcolaGrado(200, undefined).bonusDisponibili === 1);
}

console.log("\n--- otteniStatoProfilo ---");
{
  const db = creaDbFinto();
  const registrazione = await registraGiocatore(db, "Marta", "135790");
  const profiloId = registrazione.profilo.id;

  const credenzialiSbagliate = await otteniStatoProfilo(db, profiloId, "000000");
  verifica("pin sbagliato: fallisce con errore generico", credenzialiSbagliate.successo === false && credenzialiSbagliate.errore === "credenziali_non_valide");

  const idInesistente = await otteniStatoProfilo(db, 99999, "135790");
  verifica(
    "id inesistente: stesso errore generico (non distinguibile dal pin sbagliato)",
    idInesistente.successo === false && idInesistente.errore === "credenziali_non_valide"
  );

  const formatoPinInvalido = await otteniStatoProfilo(db, profiloId, "abc");
  verifica("formato pin invalido: stesso errore generico", formatoPinInvalido.successo === false && formatoPinInvalido.errore === "credenziali_non_valide");

  const risultato = await otteniStatoProfilo(db, profiloId, "135790");
  verifica("credenziali corrette: successo", risultato.successo === true);
  verifica("xpTotale a 0 per un profilo appena creato", risultato.stato.xpTotale === 0);
  verifica("grado iniziale Bersagliere (numero 1)", risultato.stato.grado.numero === 1 && risultato.stato.grado.nome === "Bersagliere");
  verifica("nessun bonus disponibile a XP 0", risultato.stato.bonusDisponibili === 0);
  verifica("bonusAssegnati vuoto per un profilo appena creato", Array.isArray(risultato.stato.bonusAssegnati) && risultato.stato.bonusAssegnati.length === 0);
  verifica("nodiCompletati vuoto per un profilo appena creato", Array.isArray(risultato.stato.nodiCompletati) && risultato.stato.nodiCompletati.length === 0);
  verifica("lo stato NON espone pin_hash/pin_salt", risultato.stato.pin_hash === undefined && risultato.stato.pin_salt === undefined);
}

console.log("\n--- assegnaBonusProfilo ---");
{
  const db = creaDbFinto();
  const registrazione = await registraGiocatore(db, "Elena", "246810");
  const profiloId = registrazione.profilo.id;

  const senzaXp = await assegnaBonusProfilo(db, profiloId, "246810", "cadenza");
  verifica(
    "0 XP (grado 1, nessun bonus disponibile): rifiutato con errore chiaro",
    senzaXp.successo === false && senzaXp.errore === "nessun_bonus_disponibile"
  );

  db.impostaXpTotale(profiloId, 200); // grado 2: 1 bonus disponibile

  const pinSbagliato = await assegnaBonusProfilo(db, profiloId, "000000", "cadenza");
  verifica("pin sbagliato: rifiutato con errore generico, nessuna scrittura", pinSbagliato.successo === false && pinSbagliato.errore === "credenziali_non_valide");

  const competenzaInvalida = await assegnaBonusProfilo(db, profiloId, "246810", "furtivita_inesistente");
  verifica(
    "competenza inesistente: rifiutata con errore specifico, nessuna scrittura",
    competenzaInvalida.successo === false && competenzaInvalida.errore === "competenza_non_valida"
  );

  const primoBonus = await assegnaBonusProfilo(db, profiloId, "246810", "cadenza");
  verifica("bonus disponibile: assegnazione riuscita", primoBonus.successo === true);
  verifica("il bonus assegnato registra grado 2 e la competenza scelta", primoBonus.bonusAssegnato.grado === 2 && primoBonus.bonusAssegnato.competenza === "cadenza");
  verifica("bonusDisponibili scende a 0 dopo l'assegnazione", primoBonus.bonusDisponibili === 0);

  const secondoTentativoStessoGrado = await assegnaBonusProfilo(db, profiloId, "246810", "precisione");
  verifica(
    "nessun altro bonus disponibile allo stesso grado: rifiutato, non sovrascrive quello già assegnato",
    secondoTentativoStessoGrado.successo === false && secondoTentativoStessoGrado.errore === "nessun_bonus_disponibile"
  );

  const statoDopo = await otteniStatoProfilo(db, profiloId, "246810");
  verifica(
    "lo stato profilo riflette il bonus assegnato (un solo elemento, competenza cadenza)",
    statoDopo.stato.bonusAssegnati.length === 1 && statoDopo.stato.bonusAssegnati[0].competenza === "cadenza"
  );

  db.impostaXpTotale(profiloId, 1800); // grado 10: 5 traguardi raggiunti, 1 già assegnato -> 4 disponibili
  const secondoBonus = await assegnaBonusProfilo(db, profiloId, "246810", "ancoraggio");
  verifica("al grado 10, con un bonus già assegnato a grado 2: il prossimo assegnato è per il grado 4", secondoBonus.bonusAssegnato.grado === 4);
  verifica("bonusDisponibili scende da 4 a 3", secondoBonus.bonusDisponibili === 3);
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
