# Enigma

Simulación de la máquina Enigma y ataque Bombe, pensado para una demo interactiva:
alguien usa su celular como "mensaje a cifrar", el servidor coordina, la Bombe
intenta romper el cifrado, y todo se muestra en una pantalla grande.

## Estructura

- `simulador/enigma.cpp` — la Enigma original en C++, con sus pruebas.
- `bombe/bombe.js` — el ataque de la Bombe (importa `web/enigma.js`).
- `servidor/main.py` — servidor FastAPI: recibe datos del celular y llama a la Bombe.
- `web/enigma.js` — el motor de la Enigma en JS, compartido por el celular y la Bombe.
- `web/celular.html` — la app web que usa el visitante desde su celular.
- `web/celular-solo.html` — la misma app, empaquetada en un solo archivo.
- `web/pantalla.html` — la pantalla grande que se muestra en la laptop (por hacer).
- `contrato.md` — formato de los mensajes que se intercambian entre las piezas.

## Cómo correrlo

TODO: documentar los pasos una vez que el servidor y la pantalla estén listos.
