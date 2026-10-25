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
import { Worker } from "node:worker_threads";

import { CRIB } from "../bombe/bombe.js";
import { letraDePrueba } from "../bombe/bombe2.js";   // la Bombe v2 corre en trabajador.js

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

  // La Bombe corre en otro hilo (trabajador.js): el servidor sigue atendiendo a la pantalla
  // y al celular mientras se rompe el mensaje.
  const hilo = new Worker(new URL("./trabajador.js", import.meta.url), { workerData: { cifrado, crib: CRIB } });
  hilo.once("message", (r) => {
    if (estado.id !== id) return;              // ya llegó otro mensaje: este resultado es viejo
    if (!r.ok) {
      console.error("La Bombe falló:", r.error);
      estado = { ...estado, fase: "error", error: r.error };
      return;
    }
    const { candidatas, estadisticas, menu } = r, ms = Math.round(r.ms);
    if (candidatas.length) rotosHoy++;
    estado = {
      ...estado,
      fase: "listo",
      resultado: { candidatas, ms, probadas: estadisticas.total, estadisticas, menu },
      rotosHoy,
    };
    const c = candidatas[0];
    console.log(
      c
        ? `  ✔ Roto en ${ms} ms → ${c.rotores.join("-")} ${c.posiciones} [${c.clavijero || "sin cables"}]: ${c.mensaje}`
        : `  ✘ Sin candidatas (${ms} ms)`
    );
  });
  hilo.once("error", (e) => {
    console.error("La Bombe falló:", e);
    if (estado.id === id) estado = { ...estado, fase: "error", error: String(e.message || e) };
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
