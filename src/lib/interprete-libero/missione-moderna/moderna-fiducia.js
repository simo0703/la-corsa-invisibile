// Libreria dell'interprete per la richiesta "moderna-fiducia" (nodo
// missione-moderna). Stesso schema di emergenza-scelta.js: importa il .md
// come testo (risolvibile solo da Wrangler, vedi [[rules]] in
// wrangler.toml) e lo trasforma subito in dati strutturati.
import testoGrezzo from "./moderna-fiducia.md";
import { analizzaLibreria } from "../libreria.js";

export const opzioni = analizzaLibreria(testoGrezzo);
