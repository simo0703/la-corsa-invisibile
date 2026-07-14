// Test locale: node test-websocket-notifica.mjs
//
// Passo 2/3 del WebSocket: il canale "sola notizia" del Durable Object.
// Il server manda lo stato pieno pubblico ai socket connessi a ogni mutazione;
// il socket è anonimo, in sola lettura, e i messaggi in arrivo dal client sono
// ignorati (le azioni restano su HTTP col token). In questo passo il front-end
// NON è toccato: si testano accettaSocket() e broadcast() direttamente, con un
// socket finto (i globali Cloudflare WebSocketPair/Response non esistono sotto
// Node puro, quindi l'handshake fetch è testato a parte con quei globali mockati).

import { GameSession } from "./src/durable-objects/GameSession.js";

let falliti = 0;
function verifica(descrizione, condizione) {
  if (condizione) {
    console.log(`OK   - ${descrizione}`);
  } else {
    console.log(`FAIL - ${descrizione}`);
    falliti += 1;
  }
}

function creaStorageFinto() {
  const dati = new Map();
  return {
    async get(k) { return dati.has(k) ? structuredClone(dati.get(k)) : undefined; },
    async put(k, v) { dati.set(k, structuredClone(v)); },
  };
}
function nuovaSessione() {
  const storage = creaStorageFinto();
  return { gs: new GameSession({ storage }, {}), storage };
}
async function chiamata(gs, path, method = "GET", body = null) {
  const init = { method };
  if (body !== null) { init.headers = { "content-type": "application/json" }; init.body = JSON.stringify(body); }
  const r = await gs.fetch(new Request(`https://fake.test/room/xyz${path}`, init));
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
}
async function joinComandante(gs, nome = "Anna", ruolo = "esploratore") {
  const tokenCreazione = crypto.randomUUID();
  await chiamata(gs, "/crea", "POST", { tokenCreazione });
  const join = await chiamata(gs, "/join", "POST", { nome, ruolo, tokenCreazione });
  return { giocatoreId: join.json.giocatori.find((g) => g.nome === nome).id, token: join.json.token };
}
function contieneChiaveSensibile(valore) {
  if (Array.isArray(valore)) return valore.some(contieneChiaveSensibile);
  if (valore && typeof valore === "object") {
    return (
      Object.keys(valore).some((k) => ["token", "tokenCreazione", "biglietto", "nuovoToken"].includes(k)) ||
      Object.values(valore).some(contieneChiaveSensibile)
    );
  }
  return false;
}

// Socket finto: registra i messaggi inviati e permette di simulare eventi.
class MockSocket {
  constructor() { this.inviati = []; this.listeners = {}; this.accettato = false; this.chiuso = false; this.lanciaSuSend = false; }
  accept() { this.accettato = true; }
  send(data) { if (this.chiuso || this.lanciaSuSend) throw new Error("socket non disponibile"); this.inviati.push(data); }
  addEventListener(tipo, fn) { (this.listeners[tipo] ||= []).push(fn); }
  emetti(tipo, ev) { (this.listeners[tipo] || []).forEach((fn) => fn(ev)); }
  simulaChiusura() { this.chiuso = true; this.emetti("close"); }
}

console.log("--- connessione: accept, registrazione, stato iniziale ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId } = await joinComandante(gs, "Anna");
  const sock = new MockSocket();
  await gs.accettaSocket(sock);
  verifica("accept() chiamato sul socket", sock.accettato === true);
  verifica("il socket è nell'elenco dei connessi", gs.sockets.has(sock));
  verifica("alla connessione arriva subito 1 messaggio (stato iniziale)", sock.inviati.length === 1);
  const msg = JSON.parse(sock.inviati[0]);
  verifica("il messaggio iniziale è { tipo:'stato', session }", msg.tipo === "stato" && !!msg.session);
  verifica("lo stato iniziale contiene il roster (Anna)", msg.session.giocatori.some((g) => g.id === giocatoreId && g.nome === "Anna"));
}

console.log("\n--- un messaggio dal client via socket viene IGNORATO ---");
{
  const { gs, storage } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });
  const sock = new MockSocket();
  await gs.accettaSocket(sock);
  const risorsePrima = JSON.stringify((await storage.get("session")).risorseDiSquadra);
  const inviatiPrima = sock.inviati.length;
  sock.emetti("message", { data: JSON.stringify({ tipo: "scegli", risposteIndice: 0 }) });
  const risorseDopo = JSON.stringify((await storage.get("session")).risorseDiSquadra);
  verifica("un messaggio dal client non cambia lo stato (nessun comando eseguito)", risorsePrima === risorseDopo);
  verifica("un messaggio dal client non genera nuovi broadcast", sock.inviati.length === inviatiPrima);
}

console.log("\n--- chiusura del socket: rimozione dall'elenco ---");
{
  const { gs } = nuovaSessione();
  await joinComandante(gs);
  const sock = new MockSocket();
  await gs.accettaSocket(sock);
  verifica("socket connesso prima della chiusura", gs.sockets.has(sock));
  sock.simulaChiusura();
  verifica("dopo la chiusura il socket è rimosso dall'elenco", !gs.sockets.has(sock));
}

console.log("\n--- broadcast dopo l'azione di un ALTRO giocatore + assenza di segreti ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId: annaId, token: annaTok } = await joinComandante(gs, "Anna");
  const joinB = await chiamata(gs, "/join", "POST", { nome: "Bruno", ruolo: "custode" });
  const brunoId = joinB.json.giocatori.find((g) => g.nome === "Bruno").id;
  const brunoTok = joinB.json.token;
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId: annaId, token: annaTok });

  const osservatore = new MockSocket();
  await gs.accettaSocket(osservatore);
  const inviatiPrima = osservatore.inviati.length; // 1: stato iniziale

  // Bruno (un ALTRO giocatore) risolve un momento via HTTP.
  await chiamata(gs, "/scegli", "POST", { risposteIndice: 2, giocatoreId: brunoId, token: brunoTok });

  verifica("dopo l'azione di un altro giocatore l'osservatore riceve un broadcast", osservatore.inviati.length > inviatiPrima);
  const ultimo = JSON.parse(osservatore.inviati[osservatore.inviati.length - 1]);
  verifica("il broadcast è { tipo:'stato', session } aggiornato", ultimo.tipo === "stato" && !!ultimo.session);
  verifica("il broadcast porta lo stato aggiornato (esitoCorrente del momento risolto)",
    ultimo.session.esitoCorrente && ultimo.session.esitoCorrente.richiestaId === "decalogo-ginnastica");
  verifica("il payload broadcast NON contiene token né segreti del Riconoscimento", !contieneChiaveSensibile(ultimo.session));
  verifica("nel payload i giocatori non hanno il campo token", ultimo.session.giocatori.every((g) => !("token" in g)));
}

console.log("\n--- pulizia dei socket morti durante il broadcast ---");
{
  const { gs } = nuovaSessione();
  const { giocatoreId, token } = await joinComandante(gs);
  await chiamata(gs, "/avvia-nodo", "POST", { nodoId: "1836-torino", giocatoreId, token });
  const buono = new MockSocket();
  const morto = new MockSocket();
  await gs.accettaSocket(buono);
  await gs.accettaSocket(morto);
  morto.lanciaSuSend = true; // da ora il suo send() lancia: socket "morto"
  verifica("due socket connessi prima del broadcast", gs.sockets.size === 2);
  await chiamata(gs, "/scegli", "POST", { risposteIndice: 2, giocatoreId, token }); // innesca il broadcast
  verifica("il socket morto (send che lancia) viene rimosso durante il broadcast", !gs.sockets.has(morto));
  verifica("il socket buono resta connesso e ha ricevuto il broadcast", gs.sockets.has(buono) && buono.inviati.length >= 2);
}

console.log("\n--- handshake via fetch (Upgrade:websocket) con globali Cloudflare mockati ---");
{
  const { gs } = nuovaSessione();
  await joinComandante(gs);
  const RealResponse = globalThis.Response;
  const RealWSP = globalThis.WebSocketPair;
  globalThis.WebSocketPair = function () { return { 0: new MockSocket(), 1: new MockSocket() }; };
  // Response con status 101 non è costruibile sotto Node: wrapper minimo.
  globalThis.Response = class extends RealResponse {
    constructor(body, init) {
      if (init && init.status === 101) { super(null, { status: 200 }); this._webSocket = init.webSocket; this._status101 = true; }
      else super(body, init);
    }
  };
  try {
    // Header "Upgrade" è forbidden nel costruttore Request di Node (viene tolto),
    // quindi passo una request finta con solo ciò che serve al ramo handshake.
    const fakeReq = { url: "https://fake.test/room/xyz/ws", headers: { get: (h) => (h === "Upgrade" ? "websocket" : null) } };
    const res = await gs.fetch(fakeReq);
    verifica("fetch con Upgrade:websocket entra nel ramo handshake (status 101)", !!res && res._status101 === true);
    verifica("l'handshake registra esattamente un socket connesso", gs.sockets.size === 1);
    const sock = [...gs.sockets][0];
    verifica("il socket connesso via fetch ha ricevuto lo stato iniziale", sock.inviati.length === 1);
  } finally {
    globalThis.Response = RealResponse;
    globalThis.WebSocketPair = RealWSP;
  }
}

console.log(`\n${falliti === 0 ? "Tutti i test passati." : `${falliti} test falliti.`}`);
process.exit(falliti === 0 ? 0 : 1);
