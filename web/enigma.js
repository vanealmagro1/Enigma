// enigma.js — Port a JavaScript de enigma.cpp (Enigma I / M3)
// Misma lógica y mismas pruebas que la versión en C++.
// Funciona en el navegador (<script type="module">) y en Node (node enigma.js --prueba).

const N = 26;
const mod26 = (x) => ((x % N) + N) % N;
const aIndice = (c) => c.toUpperCase().charCodeAt(0) - 65;
const aLetra = (i) => String.fromCharCode(65 + i);
const esLetra = (c) => /^[A-Za-z]$/.test(c);

export const ROTORES = {
  I:    { cableado: "EKMFLGDQVZNTOWYHXUSPAIBRCJ", muescas: "Q" },
  II:   { cableado: "AJDKSIRUXBLHWTMCQGZNPYFVOE", muescas: "E" },
  III:  { cableado: "BDFHJLCPRTXVZNYEIWGAKMUSQO", muescas: "V" },
  IV:   { cableado: "ESOVPZJAYQUIRHXLNFTGKDCMWB", muescas: "J" },
  V:    { cableado: "VZBRGITYUPSDNHLXAWMJQOFECK", muescas: "Z" },
  VI:   { cableado: "JPGVOUMFYQBENHZRDKASXLICTW", muescas: "ZM" },
  VII:  { cableado: "NZJHGRCXMYSWBOUFAIVLPEKQDT", muescas: "ZM" },
  VIII: { cableado: "FKQHTLXOCBJSPDZRAMEWNIUYGV", muescas: "ZM" },
};

export const REFLECTORES = {
  A: "EJMZALYXVBWFCRQUONTSPIKHGD",
  B: "YRUHQSLDPXNGOKMIEBFZCWVJAT",
  C: "FVPJIAOYEDRZXWGCTKUQSBNMHL",
};

class Rotor {
  constructor(nombre) {
    const datos = ROTORES[nombre];
    if (!datos) throw new Error(`Rotor desconocido: ${nombre}`);
    this.nombre = nombre;
    this.muescas = datos.muescas;
    this.adelante = [...datos.cableado].map((c) => c.charCodeAt(0) - 65);
    this.atras = new Array(N);
    this.adelante.forEach((v, i) => (this.atras[v] = i));
    this.posicion = 0;
    this.anillo = 0;
  }
  enMuesca() { return this.muescas.includes(aLetra(this.posicion)); }
  avanzar() { this.posicion = (this.posicion + 1) % N; }
  haciaAdelante(c) { const d = this.posicion - this.anillo; return mod26(this.adelante[mod26(c + d)] - d); }
  haciaAtras(c) { const d = this.posicion - this.anillo; return mod26(this.atras[mod26(c + d)] - d); }
}

export class Enigma {
  /**
   * @param {object} config
   * @param {string[]} config.rotores    izquierdo→derecho, p. ej. ["I","II","III"]
   * @param {string}   config.reflector  "A" | "B" | "C"
   * @param {number[]} [config.anillos]  0-25 cada uno (0 = A = 01)
   * @param {string}   [config.posiciones] p. ej. "AAA"
   * @param {string}   [config.clavijero]  p. ej. "AV BS CG"
   */
  constructor({ rotores, reflector = "B", anillos = [0, 0, 0], posiciones = "AAA", clavijero = "" }) {
    if (new Set(rotores).size !== 3) throw new Error("Hay que usar 3 rotores distintos.");
    this.rotores = rotores.map((n) => new Rotor(n));
    const ref = REFLECTORES[reflector];
    if (!ref) throw new Error(`Reflector desconocido: ${reflector}`);
    this.reflector = [...ref].map((c) => c.charCodeAt(0) - 65);
    this.clavijero = Array.from({ length: N }, (_, i) => i);
    this.configurarClavijero(clavijero);
    this.setAnillos(anillos);
    this.setPosiciones(posiciones);
  }

  configurarClavijero(pares) {
    for (const p of pares.trim().split(/\s+/).filter(Boolean)) {
      if (p.length !== 2 || !esLetra(p[0]) || !esLetra(p[1])) throw new Error(`Par no válido: ${p}`);
      const x = aIndice(p[0]), y = aIndice(p[1]);
      if (x === y) throw new Error(`No se puede conectar ${aLetra(x)} consigo misma.`);
      if (this.clavijero[x] !== x || this.clavijero[y] !== y) throw new Error(`Letra repetida en ${p}`);
      this.clavijero[x] = y;
      this.clavijero[y] = x;
    }
  }

  setAnillos(a) { a.forEach((v, i) => (this.rotores[i].anillo = mod26(v))); }
  setPosiciones(p) {
    const s = p.replace(/\s/g, "").toUpperCase();
    if (!/^[A-Z]{3}$/.test(s)) throw new Error("Hay que indicar exactamente 3 letras.");
    [...s].forEach((c, i) => (this.rotores[i].posicion = aIndice(c)));
  }
  posiciones() { return this.rotores.map((r) => aLetra(r.posicion)).join(""); }

  // Doble paso: el central avanza si el derecho está en muesca o si él mismo lo está.
  avanzarRotores() {
    const [izq, cen, der] = this.rotores;
    const avanzaIzq = cen.enMuesca();
    const avanzaCen = der.enMuesca() || cen.enMuesca();
    if (avanzaIzq) izq.avanzar();
    if (avanzaCen) cen.avanzar();
    der.avanzar();
  }

  /** Pulsa una tecla y devuelve la lámpara que se enciende. */
  pulsarTecla(letra) {
    if (!esLetra(letra)) throw new Error("La Enigma solo tiene teclas de la A a la Z.");
    this.avanzarRotores();
    let c = this.clavijero[aIndice(letra)];
    for (let i = 2; i >= 0; i--) c = this.rotores[i].haciaAdelante(c);
    c = this.reflector[c];
    for (let i = 0; i < 3; i++) c = this.rotores[i].haciaAtras(c);
    return aLetra(this.clavijero[c]);
  }

  /** Cifra o descifra (es la misma operación). Lo que no es letra pasa tal cual. */
  procesar(texto) {
    return [...texto].map((ch) => (esLetra(ch) ? this.pulsarTecla(ch) : ch)).join("");
  }
}

// ---------------------------------------------------------------------------
// Pruebas — las mismas cinco de enigma.cpp
// ---------------------------------------------------------------------------
export function ejecutarPruebas(log = console.log) {
  let fallos = 0;
  const comprobar = (nombre, ok) => { log(`${ok ? "[ OK ] " : "[FALLO]"} ${nombre}`); if (!ok) fallos++; };

  {
    const m = new Enigma({ rotores: ["I", "II", "III"], reflector: "B" });
    comprobar("I-II-III, UKW-B, AAA: AAAAA -> BDZGO", m.procesar("AAAAA") === "BDZGO");
  }
  {
    const m = new Enigma({ rotores: ["I", "II", "III"], reflector: "B", posiciones: "ADU" });
    const sec = [0, 1, 2].map(() => (m.pulsarTecla("A"), m.posiciones())).join(" ");
    comprobar("Doble paso: ADU -> ADV -> AEW -> BFX", sec === "ADV AEW BFX");
  }
  {
    const cfg = { rotores: ["II", "IV", "V"], reflector: "B", anillos: [1, 20, 11],
                  posiciones: "BLA", clavijero: "AV BS CG DL FU HZ IN KM OW RX" };
    const claro = "ANGRIFFAMMORGENBEIMSONNENAUFGANGXSTOPX";
    const cifrado = new Enigma(cfg).procesar(claro);
    comprobar("Reciprocidad con clavijero y anillos", cifrado !== claro && new Enigma(cfg).procesar(cifrado) === claro);
  }
  {
    const m = new Enigma({ rotores: ["III", "I", "V"], reflector: "C", posiciones: "XQZ" });
    let ok = true;
    for (let i = 0; i < 50000 && ok; i++) { const l = aLetra(i % N); if (m.pulsarTecla(l) === l) ok = false; }
    comprobar("Ninguna letra se cifra como ella misma (50 000 pulsaciones)", ok);
  }
  {
    const m = new Enigma({ rotores: ["I", "II", "III"], reflector: "B" });
    let n = 0;
    do { m.pulsarTecla("A"); n++; } while (m.posiciones() !== "AAA" && n < 20000);
    comprobar(`Periodo de los rotores = 16900 (obtenido: ${n})`, n === 16900);
  }

  log(fallos === 0 ? "\nTodas las pruebas superadas." : "\nHay pruebas fallidas.");
  return fallos === 0;
}

// node enigma.js --prueba
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("enigma.js") && process.argv.includes("--prueba")) {
  process.exit(ejecutarPruebas() ? 0 : 1);
}