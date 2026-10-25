// servidor.js — ULTRA en la laptop. Sin dependencias: solo Node.
//
//   node servidor/servidor.js          (desde la raíz del repo)
//
// Qué hace: es solo un buzón. La Bombe corre en el navegador de la pantalla (web/bombe-web.js).
//   - Sirve web/ en "/" (celular.html para el visitante, pantalla.html para la laptop),
//     y también /web/* y /bombe/* (los necesita el Web Worker de la Bombe).
//   - POST /api/interceptar          ← el celular manda SOLO el texto cifrado.
//   - GET  /api/mensajes?desde=N     → la pantalla lee los mensajes nuevos, en orden.
//   - GET  /api/mensajes?ultimo=1    → al abrir, la pantalla pregunta dónde va el buzón.
//   - GET  /api/config               → el crib (y las direcciones para el QR).

import http from "node:http";
import os from "node:os";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { CRIB } from "../bombe/bombe.js";

const PUERTO = Number(process.env.PORT) || 8080;
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAIZ_WEB = path.join(RAIZ, "web");
// Carpetas que se pueden pedir con prefijo; todo lo demás sale de web/.
const CARPETAS = { "/web/": RAIZ_WEB, "/bombe/": path.join(RAIZ, "bombe") };

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

// ---------- Buzón en memoria ----------
// Todos los mensajes, en orden de llegada. La pantalla los atiende uno por uno.
const MAX_BUZON = 500;
const buzon = [];          // [{ id, cifrado, creado }]
let ultimoId = 0;

function interceptar(cifrado) {
  const id = ++ultimoId;
  buzon.push({ id, cifrado, creado: new Date().toISOString() });
  if (buzon.length > MAX_BUZON) buzon.splice(0, buzon.length - MAX_BUZON);   // se van los más viejos
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
  let raiz = RAIZ_WEB;
  for (const [prefijo, carpeta] of Object.entries(CARPETAS)) {
    if (ruta.startsWith(prefijo)) { raiz = carpeta; ruta = ruta.slice(prefijo.length - 1); break; }
  }
  const archivo = path.resolve(raiz, "." + ruta);
  if (!archivo.startsWith(raiz + path.sep)) return json(res, 403, { error: "No" });  // nada fuera de web/ y bombe/
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
  const url = new URL(req.url, "http://x"), ruta = url.pathname;

  try {
    if (req.method === "GET" && ruta === "/api/config") {
      return json(res, 200, { crib: CRIB, direcciones: direccionesLocales() });
    }

    if (req.method === "GET" && ruta === "/api/mensajes") {
      if (url.searchParams.has("ultimo")) return json(res, 200, { ultimoId });
      const desde = Number(url.searchParams.get("desde")) || 0;
      // ultimoId va también aquí: si el servidor se reinició, la pantalla lo nota (ultimoId < desde).
      return json(res, 200, {
        mensajes: buzon.filter((m) => m.id > desde).slice(0, 20),
        direcciones: direccionesLocales(),
        ultimoId,
      });
    }

    if (req.method === "POST" && ruta === "/api/interceptar") {
      const { cifrado } = JSON.parse((await leerCuerpo(req)) || "{}");
      const limpio = String(cifrado || "").toUpperCase();
      if (!/^[A-Z]+$/.test(limpio) || limpio.length <= CRIB.length || limpio.length > 300) {
        return json(res, 400, { error: "Cifrado no válido" });
      }
      const id = interceptar(limpio);
      console.log(`📡 Interceptado #${id} (${limpio.length} letras)`);
      return json(res, 200, { ok: true, id });
    }

    if (req.method === "GET") return servirArchivo(req, res);
    json(res, 405, { error: "Método no permitido" });
  } catch (e) {
    json(res, 400, { error: String(e.message || e) });
  }
});

function direccionesLocales() {
  // Las redes virtuales (VirtualBox, WSL, Hyper-V, VMware, Docker) no las ve el celular: van al final.
  const esVirtual = (i) => /virtual|vbox|vmware|vethernet|wsl|hyper-v|docker/i.test(i.nombre) || i.address.startsWith("192.168.56.");
  return Object.entries(os.networkInterfaces())
    .flatMap(([nombre, lista]) => (lista || []).map((i) => ({ nombre, ...i })))
    .filter((i) => i.family === "IPv4" && !i.internal)
    .sort((a, b) => esVirtual(a) - esVirtual(b))
    .map((i) => i.address);
}

servidor.listen(PUERTO, () => {
  console.log("\n  ULTRA está escuchando\n");
  console.log(`  Pantalla de la laptop:  http://localhost:${PUERTO}/pantalla.html`);
  const ips = direccionesLocales();
  if (ips.length) for (const ip of ips) console.log(`  Celular (misma red):    http://${ip}:${PUERTO}`);
  else console.log("  (No hay red: conecta la laptop al hotspot para que entre el celular)");
  console.log(`\n  Crib: ${CRIB}\n`);
});
