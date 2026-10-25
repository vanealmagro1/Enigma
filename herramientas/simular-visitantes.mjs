// simular-visitantes.mjs — varios "visitantes" transmiten seguidos, para probar la cola de la pantalla.
//
//   node herramientas/simular-visitantes.mjs [local|nube] [cantidad=3] [segundos=3]
//
// Cada visitante usa una clave al azar (3 rotores I–V distintos, posición al azar, 0–4 cables),
// cifra CRIB + un mensaje corto distinto con web/enigma.js y lo envía igual que el celular:
//   local → POST http://localhost:8080/api/interceptar
//   nube  → insert en la tabla mensajes de Supabase (URL y clave pública de web/config.js)
import { Enigma } from "../web/enigma.js";
import { CONFIG } from "../web/config.js";

const modo = process.argv[2] || "local";
const cantidad = Number(process.argv[3]) || 3;
const segundos = process.argv[4] !== undefined ? Number(process.argv[4]) : 3;
if (!["local", "nube"].includes(modo) || !(cantidad > 0) || !(segundos >= 0)) {
  console.error("Uso: node herramientas/simular-visitantes.mjs [local|nube] [cantidad=3] [segundos=3]");
  process.exit(1);
}

const LETRAS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
const ROTORES = ["I", "II", "III", "IV", "V"];
const NUMEROS = ["UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ"];
const azar = (n) => Math.floor(Math.random() * n);
const mezclar = (a) => [...a].sort(() => Math.random() - 0.5);
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
// VISITANTEUNO … VISITANTEDIEZ; del 11 en adelante se combinan dos (UNOUNO, UNODOS, …), siempre distintos.
const nombre = (i) => "VISITANTE" + (i < 10 ? NUMEROS[i] : NUMEROS[Math.floor(i / 10) - 1] + NUMEROS[i % 10]);

function claveAlAzar() {
  const letras = mezclar(LETRAS), cables = azar(5);
  return {
    rotores: mezclar(ROTORES).slice(0, 3),
    posiciones: [0, 1, 2].map(() => LETRAS[azar(26)]).join(""),
    clavijero: Array.from({ length: cables }, (_, k) => letras[2 * k] + letras[2 * k + 1]).join(" "),
  };
}

async function enviar(cifrado) {
  if (modo === "local") {
    const r = await fetch(`http://localhost:${process.env.PORT || 8080}/api/interceptar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cifrado }),
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`servidor ${r.status}: ${JSON.stringify(datos)}`);
    return datos.id;
  }
  const r = await fetch(`${CONFIG.supabaseUrl.replace(/\/$/, "")}/rest/v1/mensajes`, {
    method: "POST",
    headers: { apikey: CONFIG.supabaseKey, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ cifrado }),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return (await r.json())[0]?.id;
}

console.log(`Modo ${modo}: ${cantidad} visitantes, uno cada ${segundos} s. Crib: ${CONFIG.crib}\n`);
for (let i = 0; i < cantidad; i++) {
  if (i) await dormir(segundos * 1000);
  const clave = claveAlAzar(), mensaje = nombre(i);
  const cifrado = new Enigma(clave).procesar(CONFIG.crib + mensaje);
  try {
    const id = await enviar(cifrado);
    console.log(`#${i + 1}  id ${id}  ${clave.rotores.join("-")} ${clave.posiciones} [${clave.clavijero || "sin cables"}]  → esperado: ${mensaje}`);
  } catch (e) {
    console.error(`#${i + 1}  NO SE ENVIÓ: ${e.message}`);
    process.exitCode = 1;
  }
}
