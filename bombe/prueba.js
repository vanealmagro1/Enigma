// Prueba de la Bombe: cifra un mensaje con una clave conocida y comprueba que la encuentra.
// Correr desde la raíz del repo:  node bombe/prueba.js
import { Enigma } from "../web/enigma.js";
import { romper, CRIB } from "./bombe.js";

// ---------- Paso A: un mensaje "secreto" para probar ----------
const secreta = new Enigma({ rotores: ["IV", "I", "V"], posiciones: "QUT" });
const cifrado = secreta.procesar(CRIB + "NOSVEMOSENLAFERIA");
console.log("Interceptado:", cifrado);

// ---------- Paso E: probarla ----------
console.time("Bombe");
const resultado = romper(cifrado, CRIB);
console.timeEnd("Bombe");
console.log(resultado);

for (const candidata of resultado) {
  const m = new Enigma({ rotores: candidata.rotores, posiciones: candidata.posiciones });
  console.log(candidata, "->", m.procesar(cifrado));
}
