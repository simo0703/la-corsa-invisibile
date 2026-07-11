// Libreria dell'interprete per la richiesta "decalogo-ginnastica" (nodo
// 1836-torino). Stesso schema di narratore-corsa-invisibile.js per il
// Cronista: importa il .md come testo (risolvibile solo da Wrangler, vedi
// [[rules]] in wrangler.toml) e lo trasforma subito in dati strutturati.
import testoGrezzo from "./decalogo-ginnastica.md";
import { analizzaLibreria } from "../libreria.js";

export const opzioni = analizzaLibreria(testoGrezzo);
