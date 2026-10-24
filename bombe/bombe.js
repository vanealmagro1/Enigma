import { Enigma } from "../web/enigma.js";

const CRIB = "FERIABEADRAGON";
const ROTORES = ["I", "II", "III", "IV", "V"];

// ---------- Paso A: un mensaje "secreto" para probar ----------
// Tú eliges la clave. Sin cables (la v1 no los rompe).
const secreta = new Enigma({ rotores: ["IV", "I", "V"], posiciones: "QUT" });
const cifrado = secreta.procesar(CRIB + "NOSVEMOSENLAFERIA");
console.log("Interceptado:", cifrado);

// ---------- Paso B: los 60 órdenes de rotores ----------
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
// Prueba: console.log(ordenesDeRotores().length)  → debe dar 60

// ---------- Paso C: las 17 576 posiciones ----------
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
// Prueba: length → 17576, y el último debe ser "ZZZ"

// ---------- Paso D: la Bombe ----------
function romper(cifrado, crib) {
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

// ---------- Paso E: probarla ----------
console.time("Bombe");
const resultado = romper(cifrado, CRIB);
console.timeEnd("Bombe");
console.log(resultado);

for (const candidata of resultado) {
  const m = new Enigma({ rotores: candidata.rotores, posiciones: candidata.posiciones });
  console.log(candidata, "->", m.procesar(cifrado));
}