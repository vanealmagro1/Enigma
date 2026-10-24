// Prueba masiva de la Bombe v2: claves al azar con 0–4 cables.
//   node bombe/prueba2.js [cantidad] [crib]
import { Enigma } from "../web/enigma.js";
import { romper } from "./bombe2.js";

const N = Number(process.argv[2]) || 10;
const CRIB = process.argv[3] || "FERIABEADRAGON";
const MENSAJES = ["VANESSA", "NOSVEMOSENLAFERIA", "ATACARALAMANECER", "HOLAMUNDO", "ELDRAGONVIVE", "QUITO", "BLETCHLEYPARK"];
const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", R = ["I", "II", "III", "IV", "V"];
const azar = (a) => a[Math.floor(Math.random() * a.length)];

let bienClave = 0, bienMensaje = 0, tiempo = 0, maxT = 0, multiples = 0;
for (let t = 0; t < N; t++) {
  const rotores = [...R].sort(() => Math.random() - 0.5).slice(0, 3);
  const posiciones = [0, 1, 2].map(() => azar(L)).join("");
  const letras = [...L].sort(() => Math.random() - 0.5);
  const cables = t % 5;                                   // 0, 1, 2, 3, 4 cables
  const clavijero = Array.from({ length: cables }, (_, k) => letras[2 * k] + letras[2 * k + 1]).join(" ");
  const claro = CRIB + azar(MENSAJES);
  const cifrado = new Enigma({ rotores, posiciones, clavijero }).procesar(claro);

  const t0 = performance.now();
  const { candidatas, estadisticas, menu } = romper(cifrado, CRIB);
  const ms = performance.now() - t0;
  tiempo += ms; maxT = Math.max(maxT, ms);
  if (candidatas.length > 1) { multiples++; console.log("   múltiples:", JSON.stringify(candidatas), "real:", rotores.join("-"), posiciones, clavijero); }

  const ok = candidatas.find((c) => c.rotores.join() === rotores.join() && c.posiciones === posiciones);
  if (ok) bienClave++;
  const descifrado = ok ? new Enigma(ok).procesar(cifrado) : "";
  if (descifrado === claro) bienMensaje++;
  console.log(
    `${ok ? "✔" : "✘"} ${rotores.join("-")} ${posiciones} [${clavijero || "sin cables"}] → ` +
    `${candidatas.length} cand, ${menu.ciclos} ciclos, ${Math.round(ms)} ms` +
    (ok && descifrado !== claro ? `  ⚠ mensaje: ${descifrado.slice(CRIB.length)} (era ${claro.slice(CRIB.length)}), cables hallados [${ok.clavijero}]` : "") +
    (!ok ? `  tras ciclo ${estadisticas.trasCiclo}, tras propagación ${estadisticas.trasPropagacion}` : "")
  );
}
console.log(`\nClave correcta: ${bienClave}/${N} · mensaje exacto: ${bienMensaje}/${N} · varias candidatas: ${multiples}` +
            ` · promedio ${Math.round(tiempo / N)} ms, máximo ${Math.round(maxT)} ms`);
