// bombe-web.js — la Bombe v2 corriendo en un hilo del navegador (Web Worker).
// Lo usa la pantalla de la laptop en modo nube: el servidor ya no existe, así que la laptop rompe sola.
import { Enigma } from "./enigma.js";
import { romper } from "../bombe/bombe2.js";

self.onmessage = ({ data: { cifrado, crib } }) => {
  const t0 = performance.now();
  try {
    const { candidatas, estadisticas, menu } = romper(cifrado, crib);
    self.postMessage({
      ok: true,
      ms: performance.now() - t0,
      candidatas: candidatas.map((c) => ({ ...c, mensaje: new Enigma(c).procesar(cifrado) })),
      estadisticas,
      menu,
    });
  } catch (e) {
    self.postMessage({ ok: false, error: String(e.message || e) });
  }
};
