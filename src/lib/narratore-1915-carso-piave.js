// Pool di contenuto del Cronista per il nodo "1915-carso-piave", pronto per
// essere passato a componiNarrazione() (src/lib/narratore-simulato.js).
//
// Il contenuto vero vive in narratore-1915-carso-piave.md (tabelle
// leggibili), non qui: questo file si limita a importarlo come testo e a
// passarlo al caricatore. I Cloudflare Workers non hanno accesso al
// filesystem a runtime, quindi il .md non può essere letto con fs.readFile
// in esecuzione — l'import qui sotto viene invece risolto da Wrangler in
// fase di build (regola [[rules]] in wrangler.toml: i file .md vengono
// incorporati come stringa nel bundle, non letti da disco a runtime).
//
// Questo file NON viene eseguito sotto Node puro (l'import di un .md non è
// JS valido per il resolver di Node) — per questo i test caricano invece il
// .md a mano con fs.readFileSync e usano narratore-corsa-invisibile-loader.js
// direttamente. Vedi test-narratore-1915-carso-piave.mjs.
import testoGrezzo from "./narratore-1915-carso-piave.md";
import { creaPool } from "./narratore-corsa-invisibile-loader.js";

export const { ottieniFrammenti } = creaPool(testoGrezzo);
