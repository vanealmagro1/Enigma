// trabajador.js — corre la Bombe en un hilo aparte.
// Así el servidor sigue respondiendo (y la pantalla sigue animando) mientras se rompe el mensaje.
import { parentPort, workerData } from "node:worker_threads";
import { Enigma } from "../web/enigma.js";
import { romper } from "../bombe/bombe2.js";

const { cifrado, crib } = workerData;
const t0 = performance.now();
try {
  const { candidatas, estadisticas, menu } = romper(cifrado, crib);
  parentPort.postMessage({
    ok: true,
    ms: performance.now() - t0,
    candidatas: candidatas.map((c) => ({ ...c, mensaje: new Enigma(c).procesar(cifrado) })),
    estadisticas,
    menu,
  });
} catch (e) {
  parentPort.postMessage({ ok: false, error: String(e.message || e) });
}
