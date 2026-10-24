// servidor.js — ULTRA en la laptop. Sin dependencias: solo Node.
//
//   node servidor/servidor.js          (desde la raíz del repo)
//
// Qué hace:
//   - Sirve la carpeta web/ (celular.html para el visitante, pantalla.html para la laptop).
//   - POST /api/interceptar  ← el celular manda SOLO el texto cifrado.
//   - Llama a romper() de la Bombe y guarda el resultado.
//   - GET  /api/estado       → la pantalla de la laptop pregunta cada medio segundo.
//   - GET  /api/config       → el celular pregunta cuál es el crib.

import http from "node:http";
import os from "node:os";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { Enigma } from "../web/enigma.js";
import { CRIB } from "../bombe/bombe.js";
import { romper, letraDePrueba } from "../bombe/bombe2.js";   // v2: con clavijero

const PUERTO = Number(process.env.PORT) || 8080;
const RAIZ_WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../web");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

// ---------- Estado compartido ----------
// Solo se guarda el último mensaje: la pantalla muestra uno a la vez.
let estado = { id: 0, fase: "esperando" };
let rotosHoy = 0;

function interceptar(cifrado) {
  const id = estado.id + 1;
  estado = { id, fase: "rompiendo", cifrado, crib: CRIB, letraPrueba: letraDePrueba(CRIB, cifrado), recibido: Date.now() };

  // Se responde al celular primero y la Bombe corre justo después,
  // así el celular no se queda colgado mientras se rompe el mensaje.
  setImmediate(() => {
    const t0 = performance.now();
    let candidatas, estadisticas, menu;
    try {
      ({ candidatas, estadisticas, menu } = romper(cifrado, CRIB));
      candidatas = candidatas.map((c) => ({ ...c, mensaje: new Enigma(c).procesar(cifrado) }));
    } catch (e) {
      console.error("La Bombe falló:", e);
      estado = { ...estado, fase: "error", error: String(e.message || e) };
      return;
    }
    const ms = performance.now() - t0;
    if (candidatas.length) rotosHoy++;
    estado = {
      ...estado,
      fase: "listo",
      resultado: { candidatas, ms: Math.round(ms), probadas: estadisticas.total, estadisticas, menu },
      rotosHoy,
    };
    const c = candidatas[0];
    console.log(
      c
        ? `  ✔ Roto en ${Math.round(ms)} ms → ${c.rotores.join("-")} ${c.posiciones} [${c.clavijero || "sin cables"}]: ${c.mensaje}`
        : `  ✘ Sin candidatas (${Math.round(ms)} ms)`
    );
  });
  return id;
}

// ---------- Utilidades HTTP ----------
function json(res, codigo, datos) {
  res.writeHead(codigo, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(datos));
}

function leerCuerpo(req, limite = 10_000) {
  return new Promise((ok, mal) => {
    let datos = "";
    req.on("data", (trozo) => {
      datos += trozo;
      if (datos.length > limite) { mal(new Error("Mensaje demasiado grande")); req.destroy(); }
    });
    req.on("end", () => ok(datos));
    req.on("error", mal);
  });
}

async function servirArchivo(req, res) {
  let ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (ruta === "/") ruta = "/celular.html";
  const archivo = path.resolve(RAIZ_WEB, "." + ruta);
  if (!archivo.startsWith(RAIZ_WEB + path.sep)) return json(res, 403, { error: "No" });  // nada fuera de web/
  try {
    const contenido = await readFile(archivo);
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(archivo).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(contenido);
  } catch {
    json(res, 404, { error: "No existe: " + ruta });
  }
}

// ---------- Rutas ----------
const servidor = http.createServer(async (req, res) => {
  const ruta = new URL(req.url, "http://x").pathname;

  try {
    if (req.method === "GET" && ruta === "/api/config") {
      return json(res, 200, { crib: CRIB });
    }

    if (req.method === "GET" && ruta === "/api/estado") {
      return json(res, 200, { ...estado, rotosHoy, direcciones: direccionesLocales() });
    }

    if (req.method === "POST" && ruta === "/api/interceptar") {
      const { cifrado } = JSON.parse((await leerCuerpo(req)) || "{}");
      const limpio = String(cifrado || "").toUpperCase();
      if (!/^[A-Z]+$/.test(limpio) || limpio.length <= CRIB.length || limpio.length > 300) {
        return json(res, 400, { error: "Cifrado no válido" });
      }
      console.log(`\n📡 Interceptado (${limpio.length} letras): ${limpio}`);
      return json(res, 200, { ok: true, id: interceptar(limpio) });
    }

    if (req.method === "GET") return servirArchivo(req, res);
    json(res, 405, { error: "Método no permitido" });
  } catch (e) {
    json(res, 400, { error: String(e.message || e) });
  }
});

function direccionesLocales() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
}

servidor.listen(PUERTO, "0.0.0.0", () => {
  console.log("\n  ULTRA está escuchando\n");
  console.log(`  Pantalla de la laptop:  http://localhost:${PUERTO}/pantalla.html`);
  const ips = direccionesLocales();
  if (ips.length) for (const ip of ips) console.log(`  Celular (misma red):    http://${ip}:${PUERTO}`);
  else console.log("  (No hay red: conecta la laptop al hotspot para que entre el celular)");
  console.log(`\n  Crib: ${CRIB}\n`);
});
