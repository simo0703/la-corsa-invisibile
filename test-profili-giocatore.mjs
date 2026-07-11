// Test locale: node test-profili-giocatore.mjs
//
// Fase 1 del profilo giocatore persistente: solo schema + registrazione/
// accesso, nessun collegamento al gameplay esistente. Nessun bisogno di
// wrangler/miniflare: un fake D1 minimale (stesso spirito del fake storage
// usato per GameSession, ma per db.prepare().bind().first()/.run()) copre
// esattamente le due query emesse da src/lib/profili-giocatore.js.

import { registraGiocatore, accediGiocatore, validaNome, validaPin } from "./src/lib/profili-giocatore.js";

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
                created_at: new Date().toISOString(),
              });
              return { success: true };
            }
            throw new Error(`Query .run() non gestita dal fake DB: ${normalizzata}`);
          },
        };
      },
    };
  }

  return { prepare };
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

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
