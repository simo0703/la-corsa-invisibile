// Libreria dell'interprete per la richiesta "emergenza-famiglia" (nodo
// emergenza-civile). Stesso schema di carso-bombardamento.js: importa il
// .md come testo (risolvibile solo da Wrangler, vedi [[rules]] in
// wrangler.toml) e lo trasforma subito in dati strutturati.
import testoGrezzo from "./emergenza-famiglia.md";
import { analizzaLibreria } from "../libreria.js";

export const opzioni = analizzaLibreria(testoGrezzo);
