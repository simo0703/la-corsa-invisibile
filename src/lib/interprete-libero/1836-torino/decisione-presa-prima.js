// Libreria dell'interprete per la richiesta "decisione-presa-prima" (nodo
// 1836-torino). Stesso schema di decalogo-ginnastica.js: importa il .md come
// testo (risolvibile solo da Wrangler, vedi [[rules]] in wrangler.toml) e lo
// trasforma subito in dati strutturati.
import testoGrezzo from "./decisione-presa-prima.md";
import { analizzaLibreria } from "simulatore-interprete/src/libreria.js";

export const opzioni = analizzaLibreria(testoGrezzo);
