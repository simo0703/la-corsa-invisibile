// Libreria dell'interprete per la richiesta "decalogo-vaira" (nodo
// 1836-torino). Stesso schema di decalogo-ginnastica.js.
import testoGrezzo from "./decalogo-vaira.md";
import { analizzaLibreria } from "simulatore-interprete/src/libreria.js";

export const opzioni = analizzaLibreria(testoGrezzo);
