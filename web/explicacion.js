// explicacion.js — "Así funciona una Enigma": una lámina que se abre con la tecla E en la pantalla.
//
// Se engancha a pantalla.html con UNA línea, sin tocar el resto del código:
//   <script type="module" src="explicacion.js"></script>
//
// - E avanza: foto con sus partes → recorrido de la corriente → cerrar. Esc cierra.
// - Si llega un mensaje (la escena "interceptado" se activa), la lámina se cierra sola.
// - La página sigue escuchando el buzón por debajo: nunca se pierde un mensaje.
// - Foto opcional: guarda una imagen en web/img/enigma.jpg.

const FOTO = "img/enigma.jpg";

const css = `
#explicacion { position: fixed; inset: 0; z-index: 20; display: none; flex-direction: column; gap: 2vh;
  padding: 3vh 4vw; background: var(--cuerpo); overflow: hidden; }
#explicacion.ver { display: flex; animation: aparecer .35s ease-out; }
@keyframes aparecer { from { opacity: 0; transform: translateY(1.5vh); } to { opacity: 1; transform: none; } }
#explicacion h2 { margin: 0; font-family: var(--maquina); font-weight: 400; font-size: 4.6vh; letter-spacing: .1em; color: var(--texto); }
#explicacion .sub { margin: 0; font-size: 2.1vh; color: var(--tenue); }
#explicacion .cuerpo { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 30vw; gap: 2.4vw; }
#explicacion .lamina { min-height: 0; border: 1px solid var(--borde); border-radius: 1.2vh; background: var(--panel); padding: 1.6vh 1.4vw; display: flex; }
#explicacion .lamina svg { width: 100%; height: 100%; display: block; }
#explicacion aside { display: flex; flex-direction: column; gap: 1.6vh; min-height: 0; }
#explicacion figure { margin: 0; flex: 1; min-height: 0; display: flex; flex-direction: column; gap: .6vh; }
#explicacion figure img { flex: 1; min-height: 0; width: 100%; object-fit: cover; border-radius: 1vh; border: 1px solid var(--borde); }
#explicacion figure[hidden] { display: none; }
#explicacion figcaption { font-size: 1.4vh; color: var(--tenue); }
#explicacion ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 1.2vh; }
#explicacion li { font-size: 2.1vh; line-height: 1.4; color: var(--texto); padding-left: 1.4vw; border-left: .5vh solid var(--acento); }
#explicacion li b { font-family: var(--maquina); font-weight: 400; font-size: 2.6vh; }
#explicacion .pie { font-size: 1.6vh; color: var(--tenue); text-align: right; }
#explicacion .pagina { display: none; flex: 1; min-height: 0; flex-direction: column; gap: 2vh; }
#explicacion .pagina.activa { display: flex; }
#explicacion .foto-grid { flex: 1; min-height: 0; display: grid; grid-template-columns: auto 1fr; gap: 3vw; align-items: center; }
#explicacion .foto-grid svg { height: 100%; max-height: 74vh; width: auto; display: block; border-radius: 1vh; }
#explicacion .marca circle { fill: var(--acento); stroke: #fff; stroke-width: 6; }
#explicacion .marca text { fill: #fff; font: 700 44px var(--mono); text-anchor: middle; dominant-baseline: central; }
#explicacion ol.partes { margin: 0; padding: 0; list-style: none; display: grid; gap: 2.2vh; }
#explicacion ol.partes li { display: grid; grid-template-columns: 5.4vh 1fr; gap: 1.2vw; align-items: start;
  border: none; padding: 0; font-size: 2.2vh; line-height: 1.45; color: var(--texto); }
#explicacion ol.partes li span.n { width: 5.4vh; height: 5.4vh; border-radius: 50%; background: var(--acento); color: #fff;
  display: grid; place-items: center; font-weight: 700; font-size: 2.6vh; }
#explicacion ol.partes li b { display: block; font-family: var(--maquina); font-weight: 400; font-size: 3vh; letter-spacing: .06em; }
`;

// Recorrido real de la corriente: rotores I-II-III en AAA, se aprieta A (los rotores pasan a AAB) y se prende B.
const lamina = `
<svg viewBox="0 0 1000 495" role="img" aria-label="Recorrido de la corriente en una Enigma: A se convierte en B" font-family="var(--mono)">
  <defs>
    <marker id="exp-ida" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ambar)"/></marker>
    <marker id="exp-vuelta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--acento)"/></marker>
  </defs>

  <!-- Columnas: cada pieza de la máquina -->
  <g fill="none" stroke="var(--borde)" stroke-width="2">
    <rect x="20"  y="60" width="120" height="250" rx="10"/>
    <rect x="190" y="60" width="120" height="250" rx="10"/>
    <rect x="360" y="60" width="110" height="250" rx="55"/>
    <rect x="510" y="60" width="110" height="250" rx="55"/>
    <rect x="660" y="60" width="110" height="250" rx="55"/>
    <rect x="820" y="60" width="160" height="250" rx="10"/>
  </g>
  <g fill="var(--texto)" font-size="20" font-weight="700" text-anchor="middle">
    <text x="80"  y="44">Teclado</text>
    <text x="250" y="44">Clavijero</text>
    <text x="415" y="44">Rotor III</text>
    <text x="565" y="44">Rotor II</text>
    <text x="715" y="44">Rotor I</text>
    <text x="900" y="44">Reflector</text>
  </g>

  <!-- Ida (arriba, amarilla) -->
  <g stroke="var(--ambar)" stroke-width="4" fill="none" marker-end="url(#exp-ida)">
    <path d="M118 130H212"/><path d="M288 130H380"/><path d="M450 130H530"/><path d="M600 130H680"/><path d="M750 130H862"/>
  </g>
  <!-- Vuelta del reflector -->
  <path d="M900 140V230" stroke="var(--acento)" stroke-width="4" fill="none" stroke-dasharray="8 6" marker-end="url(#exp-vuelta)"/>
  <!-- Vuelta (abajo, roja) -->
  <g stroke="var(--acento)" stroke-width="4" fill="none" marker-end="url(#exp-vuelta)">
    <path d="M862 240H750"/><path d="M680 240H600"/><path d="M530 240H450"/><path d="M380 240H288"/><path d="M212 240H118"/>
  </g>

  <!-- Letras en cada punto del camino -->
  <g font-family="var(--maquina)" font-size="34" text-anchor="middle" fill="var(--texto)">
    <text x="80"  y="142">A</text><text x="250" y="142">A</text><text x="415" y="142">C</text>
    <text x="565" y="142">D</text><text x="715" y="142">F</text><text x="900" y="142">S</text>
    <text x="715" y="252">S</text><text x="565" y="252">E</text><text x="415" y="252">B</text>
    <text x="250" y="252">B</text>
  </g>
  <g>
    <circle cx="80" cy="240" r="30" fill="var(--ambar)"/>
    <text x="80" y="252" font-family="var(--maquina)" font-size="34" text-anchor="middle" fill="#2a1d00">B</text>
    <text x="80" y="290" font-size="15" text-anchor="middle" fill="var(--tenue)">lámpara</text>
  </g>

  <!-- Qué hace cada pieza -->
  <g font-size="15" fill="var(--tenue)" text-anchor="middle">
    <text x="80"  y="340">Aprietas A…</text>
    <text x="80"  y="360">se prende B</text>
    <text x="250" y="340">Cables que</text>
    <text x="250" y="360">cambian pares</text>
    <text x="250" y="380">de letras</text>
    <text x="565" y="340">Cada rotor revuelve las letras a su manera</text>
    <text x="565" y="360">y gira con cada tecla: por eso A no da</text>
    <text x="565" y="380">siempre la misma letra</text>
    <text x="900" y="340">Devuelve la</text>
    <text x="900" y="360">corriente por</text>
    <text x="900" y="380">otro camino</text>
  </g>
  <text x="500" y="428" font-size="19" font-weight="700" text-anchor="middle" fill="var(--acento)">Por el reflector, ninguna letra se cifra como ella misma:</text>
  <text x="500" y="452" font-size="19" font-weight="700" text-anchor="middle" fill="var(--acento)">la debilidad que usó Bletchley Park</text>
  <text x="500" y="480" font-size="13" text-anchor="middle" fill="var(--tenue)">Ejemplo real calculado con el motor de ULTRA: rotores I-II-III en AAA, sin cables</text>
</svg>`;

// Marcadores sobre la foto (coordenadas en píxeles de img/enigma.jpg, 1400 × 1341), en el orden en que pasa la corriente.
const marca = (n, x, y) => `<g class="marca"><circle cx="${x}" cy="${y}" r="38"/><text x="${x}" y="${y + 2}">${n}</text></g>`;
const fotoConPartes = `
<svg viewBox="0 0 1400 1341" role="img" aria-label="Foto de una Enigma con sus partes numeradas">
  <image href="${FOTO}" width="1400" height="1341"/>
  ${marca(1, 782, 696)}
  ${marca(2, 729, 1057)}
  ${marca(3, 664, 336)}
  ${marca(4, 400, 336)}
  ${marca(5, 714, 528)}
</svg>`;

const html = `
  <h2>ASÍ FUNCIONA UNA ENIGMA</h2>
  <section class="pagina activa" id="expPaginaFoto">
    <p class="sub">Una Enigma real. Los números siguen el camino de la corriente cuando aprietas una tecla.</p>
    <div class="foto-grid">
      ${fotoConPartes}
      <div>
        <ol class="partes">
          <li><span class="n">1</span><div><b>Teclado</b>Escribes el mensaje original, letra por letra.</div></li>
          <li><span class="n">2</span><div><b>Clavijero</b>Cables que intercambian pares de letras. Es lo más difícil de romper.</div></li>
          <li><span class="n">3</span><div><b>Rotores</b>Tres ruedas que revuelven las letras y giran con cada tecla. Las letras del borde marcan la posición.</div></li>
          <li><span class="n">4</span><div><b>Reflector</b>Devuelve la corriente por otro camino: por eso ninguna letra se cifra como ella misma.</div></li>
          <li><span class="n">5</span><div><b>Lámparas</b>Se enciende la letra cifrada. El operador la anota y la transmite por radio.</div></li>
        </ol>
      </div>
    </div>
  </section>
  <section class="pagina" id="expPaginaRecorrido">
    <p class="sub">Cada tecla manda corriente por un camino de ida y vuelta; la letra que se enciende es la cifrada.</p>
    <div class="cuerpo">
      <div class="lamina">${lamina}</div>
      <aside>
        <ul>
          <li><b>3 rotores</b> de 5 posibles, en el orden que elijas</li>
          <li><b>17 576</b> posiciones iniciales (26 × 26 × 26)</li>
          <li><b>Hasta 10 cables</b> en la guerra (aquí, 4)</li>
          <li><b>≈ 1.6 × 10²⁰</b> claves posibles</li>
        </ul>
      </aside>
    </div>
  </section>
  <div class="pie" id="expPie"></div>`;

const estilo = document.createElement("style");
estilo.textContent = css;
document.head.appendChild(estilo);

const panel = document.createElement("section");
panel.id = "explicacion";
panel.setAttribute("aria-label", "Así funciona una Enigma");
panel.innerHTML = html;
document.body.appendChild(panel);

// Páginas: E avanza (foto → recorrido → cerrar). Si la foto no carga, se salta su página.
const paginas = [panel.querySelector("#expPaginaFoto"), panel.querySelector("#expPaginaRecorrido")];
let hayFoto = true, pagina = -1;
const prueba = new Image();
prueba.onerror = () => (hayFoto = false);
prueba.src = FOTO;

function mostrarPagina(n) {
  pagina = n;
  if (n < 0) return panel.classList.remove("ver");
  paginas.forEach((p, i) => p.classList.toggle("activa", i === n));
  panel.querySelector("#expPie").textContent = n === 0 ? "E: ver el recorrido de la corriente · Esc: volver" : "E o Esc: volver";
  panel.classList.add("ver");
}
function avanzar() {
  if (pagina < 0) return mostrarPagina(hayFoto ? 0 : 1);
  if (pagina === 0) return mostrarPagina(1);
  mostrarPagina(-1);
}

const abrir = () => mostrarPagina(hayFoto ? 0 : 1);
const cerrar = () => mostrarPagina(-1);

window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (e.key === "Escape") return cerrar();
  if (e.key.toLowerCase() === "e") avanzar();
});

// Llega un mensaje → la escena "interceptado" se activa → la lámina se cierra sola.
const interceptado = document.getElementById("interceptado");
if (interceptado) {
  new MutationObserver(() => { if (interceptado.classList.contains("activa")) cerrar(); })
    .observe(interceptado, { attributes: true, attributeFilter: ["class"] });
}

export { abrir, cerrar };
