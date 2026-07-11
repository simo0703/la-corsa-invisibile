// Libreria dell'interprete per la richiesta "moderna-provocazione" (nodo
// missione-moderna). Stesso schema di emergenza-famiglia.js: importa il
// .md come testo (risolvibile solo da Wrangler, vedi [[rules]] in
// wrangler.toml) e lo trasforma subito in dati strutturati.
import testoGrezzo from "./moderna-provocazione.md";
import { analizzaLibreria } from "simulatore-interprete/src/libreria.js";

export const opzioni = analizzaLibreria(testoGrezzo);
