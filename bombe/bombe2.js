// bombe2.js — Bombe v2: ataque de Turing–Welchman CON clavijero (plugboard).
//
// La idea en una frase: el clavijero P es desconocido, pero para cada letra del crib se cumple
//
//        P(cifrado[i]) = S_i( P(crib[i]) )
//
// donde S_i es lo que hacen los rotores + reflector en la posición i (sin clavijero), y eso SÍ
// lo podemos calcular para cada configuración de rotores. Entonces:
//
//   1. MENÚ: unimos crib[i] — cifrado[i] con una arista etiquetada i. Es un grafo entre letras.
//   2. CICLOS: si las aristas forman un ciclo L0 → L1 → … → L0, recorrerlo aplicando cada S_i
//      tiene que devolver P(L0) a sí mismo. Solo las hipótesis "P(L0) = h" que sobreviven la
//      vuelta completa (puntos fijos) pueden ser ciertas. Las demás se descartan por contradicción.
//   3. PROPAGACIÓN: con una hipótesis viva, se deduce el clavijero de todas las letras conectadas.
//      Si una letra termina con dos parejas distintas, o el cable no es recíproco (tablero
//      diagonal de Welchman), o salen más cables de los que existen, la hipótesis muere.
//   4. COMPROBACIÓN: con el clavijero deducido se cifra el crib con la Enigma real. Si coincide,
//      encontramos la clave, y se descifra el mensaje completo.

import { Enigma, ROTORES, REFLECTORES } from "../web/enigma.js";

export const MAX_CABLES = 4;
const ORDEN_ROTORES = ["I", "II", "III", "IV", "V"];
const N = 26;
const A = 65;

// ---------------------------------------------------------------------------
// Tablas precalculadas: recorrer un rotor en la posición p es una sola consulta.
//   ADELANTE[r][p*26 + x] = salida del rotor r en posición p para la entrada x
// ---------------------------------------------------------------------------
const ADELANTE = {}, ATRAS = {}, MUESCA = {};
for (const [nombre, { cableado, muescas }] of Object.entries(ROTORES)) {
  const fw = [...cableado].map((c) => c.charCodeAt(0) - A);
  const bw = new Array(N);
  fw.forEach((v, i) => (bw[v] = i));
  const tf = new Uint8Array(N * N), tb = new Uint8Array(N * N);
  for (let p = 0; p < N; p++)
    for (let x = 0; x < N; x++) {
      tf[p * N + x] = (fw[(x + p) % N] - p + N) % N;
      tb[p * N + x] = (bw[(x + p) % N] - p + N) % N;
    }
  ADELANTE[nombre] = tf;
  ATRAS[nombre] = tb;
  MUESCA[nombre] = Uint8Array.from({ length: N }, (_, i) => (muescas.includes(String.fromCharCode(A + i)) ? 1 : 0));
}
const REFLECTOR_B = Uint8Array.from([...REFLECTORES.B].map((c) => c.charCodeAt(0) - A));

function ordenesDeRotores() {
  const ordenes = [];
  for (const a of ORDEN_ROTORES)
    for (const b of ORDEN_ROTORES)
      for (const c of ORDEN_ROTORES)
        if (a !== b && a !== c && b !== c) ordenes.push([a, b, c]);
  return ordenes;
}

// ---------------------------------------------------------------------------
// El menú: aristas, componentes y una base de ciclos
// ---------------------------------------------------------------------------
export function construirMenu(crib, cifrado) {
  const aristas = [...crib].map((p, i) => ({ a: p.charCodeAt(0) - A, b: cifrado.charCodeAt(i) - A, i }));
  const vecinos = Array.from({ length: N }, () => []);
  for (const e of aristas) { vecinos[e.a].push(e); vecinos[e.b].push(e); }
  const letras = [...new Set(aristas.flatMap((e) => [e.a, e.b]))];

  // Componentes conexas
  const comp = new Int8Array(N).fill(-1);
  const componentes = [];
  for (const l of letras) {
    if (comp[l] !== -1) continue;
    const id = componentes.length, miembros = [], cola = [l];
    comp[l] = id;
    while (cola.length) {
      const x = cola.pop();
      miembros.push(x);
      for (const e of vecinos[x]) {
        const y = e.a === x ? e.b : e.a;
        if (comp[y] === -1) { comp[y] = id; cola.push(y); }
      }
    }
    componentes.push(miembros);
  }

  // Base de ciclos (árbol generador + aristas que cierran)
  const padre = Int8Array.from({ length: N }, (_, i) => i);
  const raiz = (x) => { while (padre[x] !== x) x = padre[x] = padre[padre[x]]; return x; };
  const arbol = Array.from({ length: N }, () => []);
  const ciclos = [];
  for (const e of aristas) {
    const ra = raiz(e.a), rb = raiz(e.b);
    if (ra !== rb) { padre[ra] = rb; arbol[e.a].push(e); arbol[e.b].push(e); }
    else ciclos.push(cicloPor(e, arbol));
  }
  ciclos.sort((x, y) => x.pasos.length - y.pasos.length);
  return { aristas, vecinos, letras, componentes, comp, ciclos };
}

// Ciclo que cierra la arista e: camino en el árbol de e.b a e.a, más la propia e.
// Se devuelve como una lista de pasos { desde, hacia, i } que empieza y termina en la misma letra.
function cicloPor(e, arbol) {
  const previo = new Map([[e.b, null]]), cola = [e.b];
  while (cola.length) {
    const x = cola.shift();
    if (x === e.a) break;
    for (const f of arbol[x]) {
      const y = f.a === x ? f.b : f.a;
      if (!previo.has(y)) { previo.set(y, f); cola.push(y); }
    }
  }
  // Reconstruir e.a → … → e.b por el árbol, y cerrar con e (e.b → e.a)
  const pasos = [];
  let x = e.a;
  while (x !== e.b) {
    const f = previo.get(x);
    const y = f.a === x ? f.b : f.a;
    pasos.push({ desde: x, hacia: y, i: f.i });
    x = y;
  }
  pasos.push({ desde: e.b, hacia: e.a, i: e.i });
  return { inicio: e.a, pasos };
}

// ---------------------------------------------------------------------------
// La Bombe
// ---------------------------------------------------------------------------
export function romper(cifrado, crib, { maxCables = MAX_CABLES } = {}) {
  const L = crib.length;
  const menu = construirMenu(crib, cifrado);
  const ciclo = menu.ciclos[0] ?? null;
  const prueba = ciclo ? ciclo.inicio : letraMasConectada(menu);

  const est = { total: 0, trasCiclo: 0, trasPropagacion: 0, finales: 0 };
  const candidatas = [];

  // Posiciones de los rotores en cada letra del crib (con el doble paso)
  const pl = new Uint8Array(L), pm = new Uint8Array(L), pr = new Uint8Array(L);
  const P = new Int8Array(N);
  const cola = new Int8Array(4 * N);

  for (const orden of ordenesDeRotores()) {
    const [FL, FM, FR] = orden.map((r) => ADELANTE[r]);
    const [BL, BM, BR] = orden.map((r) => ATRAS[r]);
    const [, mM, mR] = orden.map((r) => MUESCA[r]);

    // S_i(x): rotores + reflector en la posición i, sin clavijero
    const S = (i, x) => {
      x = FR[pr[i] * N + x]; x = FM[pm[i] * N + x]; x = FL[pl[i] * N + x];
      x = REFLECTOR_B[x];
      x = BL[pl[i] * N + x]; x = BM[pm[i] * N + x]; return BR[pr[i] * N + x];
    };

    for (let inicio = 0; inicio < N * N * N; inicio++) {
      est.total++;
      // Simular el avance (igual que Enigma.avanzarRotores)
      let l = (inicio / 676) | 0, m = ((inicio / 26) | 0) % 26, r = inicio % 26;
      for (let i = 0; i < L; i++) {
        const avL = mM[m], avM = mR[r] || mM[m];
        if (avL) l = (l + 1) % N;
        if (avM) m = (m + 1) % N;
        r = (r + 1) % N;
        pl[i] = l; pm[i] = m; pr[i] = r;
      }

      for (let h = 0; h < N; h++) {
        // --- 2. Prueba del ciclo: P(inicio) = h tiene que sobrevivir la vuelta ---
        if (ciclo) {
          let v = h;
          for (const paso of ciclo.pasos) v = S(paso.i, v);
          if (v !== h) continue;
        }
        est.trasCiclo++;

        // --- 3. Propagación con tablero diagonal ---
        P.fill(-1);
        if (!propagar(prueba, h, P, menu, S, cola, maxCables)) continue;
        est.trasPropagacion++;

        // --- Completar los demás componentes del menú y comprobar ---
        const completo = completar(P, menu, S, cola, maxCables);
        if (!completo) continue;
        const clavijero = paresDe(completo);
        const posiciones = String.fromCharCode(A + ((inicio / 676) | 0), A + (((inicio / 26) | 0) % 26), A + (inicio % 26));
        const maquina = new Enigma({ rotores: orden, posiciones, clavijero });
        if (maquina.procesar(crib) !== cifrado.slice(0, L)) continue;

        est.finales++;
        candidatas.push({ rotores: orden, posiciones, clavijero });
      }
    }
  }
  // Si el rotor central empieza justo en su muesca, el doble paso hace que dos posiciones
  // iniciales cifren igual (p. ej. RVY y SWY con II-III-V). Se muestra primero la "normal".
  const anomala = (c) => MUESCA[c.rotores[1]][c.posiciones.charCodeAt(1) - A];
  candidatas.sort((x, y) => anomala(x) - anomala(y));
  est.hipotesis = est.total * N;
  return { candidatas, estadisticas: est, menu: resumenMenu(menu, prueba) };
}

// Asigna P(a) = b (y P(b) = a) y deduce todo lo que se pueda. false = contradicción.
function propagar(a, b, P, menu, S, cola, maxCables) {
  let ini = 0, fin = 0;
  const asignar = (x, y) => {
    if (P[x] === -1 && P[y] === -1) {
      P[x] = y; P[y] = x;
      cola[fin++] = x; if (x !== y) cola[fin++] = y;
      return true;
    }
    return P[x] === y && P[y] === x;   // ya estaba igual: bien; distinto: contradicción
  };
  if (!asignar(a, b)) return false;
  while (ini < fin) {
    const x = cola[ini++];
    for (const e of menu.vecinos[x]) {
      const otro = e.a === x ? e.b : e.a;
      if (!asignar(otro, S(e.i, P[x]))) return false;
    }
  }
  return contarCables(P) <= maxCables;
}

// Los componentes del menú que la letra de prueba no alcanzó se resuelven por separado,
// probando hipótesis para una de sus letras. Se elige la solución con menos cables.
function completar(P, menu, S, cola, maxCables) {
  const pendientes = menu.componentes.filter((c) => c.some((x) => P[x] === -1));
  let mejor = null;
  const buscar = (k, actual) => {
    if (k === pendientes.length) {
      if (!mejor || contarCables(actual) < contarCables(mejor)) mejor = Int8Array.from(actual);
      return;
    }
    const comp = pendientes[k];
    if (comp.every((y) => actual[y] !== -1)) return buscar(k + 1, actual);
    const fija = comp.find((y) => actual[y] !== -1);
    if (fija !== undefined) {
      // El tablero diagonal ya fijó una letra de este componente: basta con propagar desde ella.
      const copia = Int8Array.from(actual);
      if (propagarDesde(fija, copia[fija], copia, menu, S, cola, maxCables)) buscar(k + 1, copia);
      return;
    }
    const x = comp.reduce((m, y) => (menu.vecinos[y].length > menu.vecinos[m].length ? y : m), comp[0]);
    // Primero la hipótesis "sin cable", que es la más probable con pocos cables.
    const orden = [x, ...Array.from({ length: N }, (_, i) => i).filter((i) => i !== x)];
    for (const h of orden) {
      const copia = Int8Array.from(actual);
      if (copia[x] !== -1 && copia[x] !== h) continue;
      if (copia[x] === -1 && copia[h] !== -1) continue;
      if (!propagarDesde(x, h, copia, menu, S, cola, maxCables)) continue;
      if (mejor && contarCables(copia) >= contarCables(mejor)) continue;
      buscar(k + 1, copia);
    }
  };
  buscar(0, Int8Array.from(P));
  if (!mejor) return null;
  for (let i = 0; i < N; i++) if (mejor[i] === -1) mejor[i] = i;   // letras fuera del menú: sin cable
  return mejor;
}

// Como propagar(), pero acepta que x ya tenga asignado h (recorre igual sus aristas).
function propagarDesde(x, h, P, menu, S, cola, maxCables) {
  if (P[x] === h && P[h] === x) {
    let ini = 0, fin = 0;
    cola[fin++] = x; if (h !== x) cola[fin++] = h;
    const asignar = (a, b) => {
      if (P[a] === -1 && P[b] === -1) { P[a] = b; P[b] = a; cola[fin++] = a; if (a !== b) cola[fin++] = b; return true; }
      return P[a] === b && P[b] === a;
    };
    while (ini < fin) {
      const y = cola[ini++];
      for (const e of menu.vecinos[y]) {
        const otro = e.a === y ? e.b : e.a;
        if (!asignar(otro, S(e.i, P[y]))) return false;
      }
    }
    return contarCables(P) <= maxCables;
  }
  return propagar(x, h, P, menu, S, cola, maxCables);
}

function contarCables(P) {
  let n = 0;
  for (let i = 0; i < N; i++) if (P[i] > i) n++;
  return n;
}

function paresDe(P) {
  const pares = [];
  for (let i = 0; i < N; i++) if (P[i] > i) pares.push(String.fromCharCode(A + i, A + P[i]));
  return pares.join(" ");
}

// La letra por la que empieza la Bombe: el inicio del ciclo más corto.
export function letraDePrueba(crib, cifrado) {
  const menu = construirMenu(crib, cifrado);
  return String.fromCharCode(A + (menu.ciclos[0] ? menu.ciclos[0].inicio : letraMasConectada(menu)));
}

function letraMasConectada(menu) {
  return menu.letras.reduce((m, x) => (menu.vecinos[x].length > menu.vecinos[m].length ? x : m), menu.letras[0]);
}

function resumenMenu(menu, prueba) {
  return {
    letras: menu.letras.length,
    aristas: menu.aristas.length,
    ciclos: menu.ciclos.length,
    componentes: menu.componentes.length,
    letraDePrueba: String.fromCharCode(A + prueba),
  };
}
