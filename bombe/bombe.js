import { Enigma } from "../web/enigma.js";

// Crib: el encabezado fijo con el que empieza todo mensaje.
// El celular lo pide al servidor, así hay una sola fuente de verdad.
export const CRIB = "FERIABEADRAGONENLAUSFQ";   // largo: así el menú casi siempre tiene ciclos
const ROTORES = ["I", "II", "III", "IV", "V"];

// ---------- Los 60 órdenes de rotores ----------
function ordenesDeRotores() {
  const ordenes = [];
  for (const a of ROTORES) {
    for (const b of ROTORES) {
      for (const c of ROTORES) {
        if (a !== b && a !== c && b !== c) ordenes.push([a, b, c]);
      }
    }
  }
  return ordenes;
}

// ---------- Las 17 576 posiciones ----------
function todasLasPosiciones() {
  const posiciones = [];
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      for (let k = 0; k < 26; k++) {
        posiciones.push(
          String.fromCharCode(65 + i) +
            String.fromCharCode(65 + j) +
            String.fromCharCode(65 + k)
        );
      }
    }
  }
  return posiciones;
}

// ---------- La Bombe (v1, sin plugboard) ----------
export function romper(cifrado, crib) {
  const candidatas = [];
  const inicio = cifrado.slice(0, crib.length);
  const posiciones = todasLasPosiciones();

  for (const rotores of ordenesDeRotores()) {
    const m = new Enigma({ rotores });       // una máquina por orden, no un millón
    for (const pos of posiciones) {
      m.setPosiciones(pos);
      let coincide = true;
      for (let i = 0; i < crib.length; i++) {
        if (m.pulsarTecla(crib[i]) !== inicio[i]) { coincide = false; break; }
      }
      if (coincide) candidatas.push({ rotores, posiciones: pos });
    }
  }
  return candidatas;
}

// Total de configuraciones que revisa romper(): 60 órdenes × 17 576 posiciones
export const TOTAL_CONFIGURACIONES = 60 * 26 * 26 * 26;
