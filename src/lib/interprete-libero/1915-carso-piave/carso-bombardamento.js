// Libreria dell'interprete per la richiesta "carso-bombardamento" (nodo
// 1915-carso-piave). Stesso schema di milano-barricata.js: importa il .md
// come testo (risolvibile solo da Wrangler, vedi [[rules]] in
// wrangler.toml) e lo trasforma subito in dati strutturati.
import testoGrezzo from "./carso-bombardamento.md";
import { analizzaLibreria } from "../libreria.js";

export const opzioni = analizzaLibreria(testoGrezzo);
