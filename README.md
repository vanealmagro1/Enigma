# ULTRA

El visitante elige una clave secreta y cifra un mensaje en su celular con una **Enigma I**.
Solo las letras cifradas viajan a la laptop, y la laptop rompe el mensaje en vivo con el
**ataque de Turing–Welchman** (la Bombe), sin ver nunca la clave.

## Cómo funciona la demo

```
 Celular                     Buzón                         Laptop (pantalla)
 web/celular.html   ──►  Supabase: tabla mensajes   ──►  web/pantalla.html
 elige la clave,          (modo nube)                     pone los mensajes en cola,
 escribe y cifra          o servidor/servidor.js          corre la Bombe (Web Worker)
                          (modo local)                    y enseña la clave encontrada
```

1. **Celular** (`web/celular.html`). El visitante gira las ruedas para elegir 3 rotores (de I a V)
   y su posición inicial, y une hasta 4 pares de letras en el clavijero (o toca *Al azar*).
   Después escribe su mensaje en el teclado: se encienden las lámparas, como en la máquina real.
   Al tocar *Transmitir*, el celular manda **solo el texto cifrado**. Antes del mensaje, el celular
   cifra siempre el mismo encabezado oficial, el *crib* `FERIABEADRAGONENLAUSFQ` (definido en
   `web/config.js`). La clave nunca sale del teléfono.
2. **Buzón**. Solo guarda el texto cifrado; no rompe nada. Hay dos modos, y las páginas eligen
   solas (`modo: "auto"` en `web/config.js`):
   - **Nube**: el celular inserta el cifrado en la tabla `mensajes` de Supabase (`web/nube.js`).
   - **Local**: si las páginas las sirve `node servidor/servidor.js`, el celular hace
     `POST /api/interceptar` y el servidor guarda los mensajes en memoria (hasta 500).
   La página sabe en qué modo está preguntando por `/api/config`: si responde JSON, hay
   servidor local; si no, está en la nube.
3. **Pantalla** (`web/pantalla.html`). Cada segundo lee del buzón los mensajes nuevos
   (nube: `mensajesDesde` en `web/nube.js`; local: `GET /api/mensajes?desde=N`) y los pone en una
   **cola**: se atienden todos, uno por uno, en orden de llegada. Al abrir la página no repite
   los mensajes viejos. Con cada mensaje muestra la "estación de escucha" (las letras llegan una
   por una), señala las primeras letras que esconden el crib, dibuja el menú de Turing del
   mensaje y anima la búsqueda. Al final muestra el mensaje descifrado, los rotores, la posición
   y los cables encontrados.
   - Si hay otros esperando, cada resultado se queda al menos 15 s (`RESULTADO_MIN_MS`).
     Arriba a la derecha aparece "En cola: N mensajes" en rojo.
   - Si nadie transmite durante 45 s después de un resultado (`VOLVER_A_ESPERA_MS`),
     vuelve la escena del QR.
4. **Bombe** (`bombe/bombe2.js`). En los dos modos corre en el navegador de la laptop, en un
   **Web Worker** (`web/bombe-web.js`) para que la pantalla no se congele. Cada mensaje tiene
   su propio Worker: un mensaje nuevo nunca interrumpe al que se está rompiendo.

## Cómo funciona la Bombe

El problema: hay **60** formas de elegir y ordenar 3 rotores de 5, y **17 576** posiciones
iniciales (26 × 26 × 26). Son **1 054 560 configuraciones** de rotores. Encima está el
clavijero, con muchísimas combinaciones de cables, así que probar todo a lo bruto no es una opción.

Lo que sí sabemos es que todo mensaje empieza con el crib. Con eso, `bombe/bombe2.js` hace esto:

1. **Crib.** Ponemos el crib debajo de las primeras letras cifradas. Cada columna nos dice
   "en la posición *i*, la letra X del crib se convirtió en la letra Y del cifrado".
2. **Menú.** Con esas parejas armamos un **grafo**: cada letra es un punto y cada columna
   *i* es una línea entre X e Y con el número *i*. Ese dibujo es el que aparece en la pantalla.
3. **Ciclos.** A veces las líneas forman un ciclo, por ejemplo A → M → T → A. Para cualquier
   configuración de rotores, podemos calcular qué hacen los rotores y el reflector en cada
   posición *i* (sin el clavijero). Si recorremos el ciclo entero, la letra tiene que volver
   a sí misma. Si no vuelve, esa configuración es imposible.
4. **Hipótesis sobre el clavijero.** El clavijero no lo conocemos, así que la Bombe toma una
   **letra de prueba** (el inicio del ciclo más corto) y supone con qué letra está conectada:
   hay 26 posibilidades (incluida ella misma, que significa "sin cable"). Cada suposición
   se hace dar la vuelta al ciclo; la mayoría no regresan y se descartan.
5. **Propagación con tablero diagonal.** Si una suposición sobrevive, se deduce el resto de cables
   siguiendo las líneas del menú. Los cables van en los dos sentidos (si A está unida con M,
   M está unida con A); a esto Welchman lo llamó tablero diagonal, y ayuda a encontrar
   contradicciones mucho antes. Si una letra termina con dos parejas distintas, o salen más
   de 4 cables, la suposición muere.
6. **Comprobación final.** Con los rotores, la posición y los cables deducidos, se cifra el crib
   con una Enigma de verdad (`web/enigma.js`). Si sale exactamente el inicio del cifrado,
   encontramos la clave y desciframos el mensaje completo.

### El embudo

Ejemplo real con la clave `II-V-I`, posición `KDQ`, cables `AM FT RX` y el mensaje `NOSVEMOSENLAFERIA`:

| Paso | Cuántas quedan |
|---|---|
| Configuraciones de rotores | 1 054 560 |
| × 26 hipótesis para la letra de prueba | 27 418 560 |
| Pasan el primer ciclo | 1 097 574 |
| Sin contradicciones tras la propagación | 1 |
| Clave final (comprobada con la Enigma) | **1** |

En esta laptop eso tomó unos 4 segundos. La pantalla muestra estos mismos números al final de cada mensaje.

## Estructura del repo

| Ruta | Qué es |
|---|---|
| `index.html` | Redirige a `web/celular.html` (es lo que abre el QR en la nube). |
| `web/celular.html` | La Enigma del visitante: elegir clave, escribir, transmitir. |
| `web/pantalla.html` | La pantalla de la laptop: QR de espera, cola de mensajes, interceptación, grafo, resultado. |
| `web/explicacion.js` | Lámina "Así funciona una Enigma" (tecla E): foto con sus partes y recorrido de la corriente. |
| `web/img/enigma.jpg` | Foto de una Enigma que usa la lámina. |
| `web/enigma.js` | Motor de la Enigma I/M3 en JavaScript (rotores I–VIII, reflectores A–C, anillos, clavijero, doble paso). Lo usan el celular, la Bombe y las pruebas. |
| `web/config.js` | Lo único que se edita: modo (`auto`/`nube`/`local`), URL y clave pública de Supabase, `urlPublica` para el QR y el crib. |
| `web/nube.js` | Habla con Supabase por la API REST (sin librerías): enviar, leer el último y leer los nuevos (`mensajesDesde`). |
| `web/bombe-web.js` | Web Worker que corre la Bombe en el navegador de la pantalla (en los dos modos). |
| `web/temas/` | Temas de la pantalla (`a-enigma.css`, `b-bletchley.css`) y sus fuentes. |
| `web/vendor/qrcode.js` | Librería para generar el QR sin internet. |
| `bombe/bombe2.js` | La Bombe v2: ataque de Turing–Welchman con clavijero (hasta 4 cables). |
| `bombe/bombe.js` | La Bombe v1, sin clavijero (fuerza bruta sobre las 1 054 560 configuraciones). Exporta el `CRIB`. |
| `bombe/prueba.js`, `bombe/prueba2.js` | Pruebas de la Bombe v1 y v2. |
| `servidor/servidor.js` | Servidor local sin dependencias (solo Node), solo como buzón: sirve `web/` (y `/web/*`, `/bombe/*` para el Worker) y la API (`/api/interceptar`, `/api/mensajes`, `/api/config`). |
| `herramientas/simular-visitantes.mjs` | Simula varios visitantes que transmiten seguidos, para probar la cola. |
| `supabase/esquema.sql` | Tabla `mensajes` y sus políticas de seguridad (RLS). |
| `simulador/enigma.cpp` | La Enigma original en C++, con sus pruebas. |
| `contrato.md` | Esqueleto del formato de mensajes entre las piezas (sin completar). |

## Cómo correrlo

### Modo nube (el normal en la feria)

- Celular (este es el link del QR): https://ultra-enigma.pages.dev
- Pantalla de la laptop: https://ultra-enigma.pages.dev/web/pantalla.html

La pantalla genera el QR sola con su propia dirección (o con `urlPublica` de `web/config.js`
si se llena). La laptop necesita internet.

### Modo local (respaldo, sin internet)

```
node servidor/servidor.js
```

- Escucha en el puerto **8080** (se puede cambiar con la variable `PORT`).
- Conecta la laptop y los celulares al mismo hotspot.
- Abre la pantalla en `http://localhost:8080/pantalla.html`. La consola también muestra
  las direcciones para el celular (`http://<IP-de-la-laptop>:8080`).
- El QR de la pantalla se genera solo con la IP del wifi.

### Teclas de la pantalla

- **T** cambia de tema (A → B → original). También se puede elegir en el link:
  `?tema=a` (Enigma I, sala oscura) o `?tema=b` (Bletchley Park, luz de día, el predeterminado).
  El último tema elegido se recuerda en ese navegador.
- **E** abre la lámina "Así funciona una Enigma": la foto con sus partes; otra **E** pasa al
  recorrido de la corriente, y otra **E** (o **Esc**) la cierra. Si llega un mensaje, se cierra sola.

## Pruebas

Desde la raíz del repo:

```
node web/enigma.js --prueba     # 5 pruebas de la Enigma (doble paso, reciprocidad, periodo 16 900…)
node bombe/prueba.js            # Bombe v1: rompe un mensaje sin cables
node bombe/prueba2.js 10        # Bombe v2: 10 claves al azar con 0 a 4 cables
```

`prueba2.js` termina con un resumen como `Clave correcta: 10/10 · mensaje exacto: …`.
Acepta un segundo argumento con otro crib (por defecto usa `FERIABEADRAGON`).

El simulador en C++: `g++ -std=c++17 -O2 -Wall -o enigma simulador/enigma.cpp` y luego `./enigma --prueba`.

Para probar la cola de la pantalla, con la pantalla abierta:

```
node herramientas/simular-visitantes.mjs local 3 3   # 3 visitantes al servidor local, uno cada 3 s
node herramientas/simular-visitantes.mjs nube 3 3    # lo mismo, a Supabase
```

Cada visitante usa una clave al azar (0 a 4 cables) y un mensaje distinto (`VISITANTEUNO`,
`VISITANTEDOS`, …). El script imprime la clave y el mensaje que debería aparecer en la pantalla.

## Cómo publicar cambios

Cloudflare Pages publica la carpeta `dist/` (está en `.gitignore`). Solo lleva lo que necesita
el navegador; `servidor/` y `simulador/` no se publican. En PowerShell:

```powershell
Remove-Item dist -Recurse -Force
New-Item -ItemType Directory dist
Copy-Item index.html dist/
Copy-Item web dist/web -Recurse
Copy-Item bombe dist/bombe -Recurse
npx wrangler pages deploy dist --project-name ultra-enigma
```

La base de datos está descrita en `supabase/esquema.sql`. Para crearla en un proyecto nuevo se pega
en Supabase → SQL Editor → Run. Solo acepta textos de 10 a 300 letras A–Z, cualquiera puede
insertar y solo se pueden leer los mensajes de los últimos 15 minutos. En `web/config.js` va
**solo la clave pública** (anon / publishable), nunca la `service_role`.

## Limitaciones conocidas

- Los anillos (Ringstellung) están fijos en A, tanto en el celular como en la Bombe.
- Solo reflector B y rotores I a V.
- La Bombe busca hasta 4 cables en el clavijero.
- Si un cable une dos letras que no aparecen en el menú, la Bombe no puede deducirlo:
  la clave sale bien, pero 1 o 2 letras del mensaje pueden quedar mal.
- Por el doble paso del rotor central, a veces dos posiciones iniciales distintas cifran igual
  (por ejemplo `RVY` y `SWY` con `II-III-V`). La Bombe encuentra las dos, las ordena con la
  "normal" primero, y la pantalla muestra esa; el mensaje descifrado es el mismo.
- En modo nube, la laptop necesita internet. Sin internet se usa el modo local.

## Créditos

Hecho por [Nombre 1] y [Nombre 2] para la feria **Be a Dragon** de la USFQ.
