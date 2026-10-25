// nube.js — buzón de mensajes en Supabase (API REST directa, sin librerías).
// El celular inserta el texto cifrado; la pantalla de la laptop lee el último.
import { CONFIG } from "./config.js";

const tabla = () => `${CONFIG.supabaseUrl.replace(/\/$/, "")}/rest/v1/mensajes`;
const cabeceras = () => ({ apikey: CONFIG.supabaseKey, "Content-Type": "application/json" });

// ¿Nos sirve el servidor local (hotspot) o estamos en la nube?
export async function detectarModo() {
  if (CONFIG.modo === "nube" || CONFIG.modo === "local") return CONFIG.modo;
  if (location.protocol === "file:") return "local";
  try {
    const r = await fetch("/api/config", { cache: "no-store" });
    if (r.ok && (r.headers.get("content-type") || "").includes("json")) return "local";
  } catch {}
  return "nube";
}

export async function enviarMensaje(cifrado) {
  const r = await fetch(tabla(), {
    method: "POST",
    headers: { ...cabeceras(), Prefer: "return=minimal" },
    body: JSON.stringify({ cifrado }),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
}

export async function ultimoMensaje() {
  const r = await fetch(`${tabla()}?select=id,cifrado,creado&order=id.desc&limit=1`, {
    headers: cabeceras(),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  const [m] = await r.json();
  return m ?? null;
}

export async function probarConexion() {
  await ultimoMensaje();
  return true;
}
