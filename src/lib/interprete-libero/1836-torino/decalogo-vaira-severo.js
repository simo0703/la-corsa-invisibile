// Libreria dell'interprete per la richiesta "decalogo-vaira-severo" (nodo
// 1836-torino). Stesso schema di decalogo-ginnastica.js.
import testoGrezzo from "./decalogo-vaira-severo.md";
import { analizzaLibreria } from "../libreria.js";

export const opzioni = analizzaLibreria(testoGrezzo);
