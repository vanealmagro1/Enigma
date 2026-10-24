/*
 * enigma.cpp - Simulador de la máquina Enigma I / M3
 *
 * Reproduce la Enigma de tres rotores usada por el Heer, la Luftwaffe
 * (Enigma I) y la Kriegsmarine (M3) durante la Segunda Guerra Mundial:
 *
 *   - Clavijero (Steckerbrett): intercambia pares de letras a la entrada
 *     y a la salida de los rotores.
 *   - Rotores (Walzen) I a VIII con su cableado histórico, ajuste de anillo
 *     (Ringstellung) y posición inicial (Grundstellung).
 *   - Mecanismo de avance por muescas, incluida la anomalía del "doble paso"
 *     del rotor central.
 *   - Reflector (Umkehrwalze) UKW-A, UKW-B o UKW-C.
 *
 * Compilar:  g++ -std=c++17 -O2 -Wall -o enigma enigma.cpp
 * Usar:      ./enigma            (modo interactivo)
 *            ./enigma --prueba   (pruebas de verificación)
 */

#include <array>
#include <cctype>
#include <iomanip>
#include <iostream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#ifdef _WIN32
#define NOMINMAX
#include <windows.h>
#endif

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
constexpr int NUM_LETRAS = 26;

inline int mod26(int x) { return ((x % NUM_LETRAS) + NUM_LETRAS) % NUM_LETRAS; }

inline bool esLetra(char c) {
    return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
}

inline int letraAIndice(char c) {
    return std::toupper(static_cast<unsigned char>(c)) - 'A';
}

inline char indiceALetra(int i) { return static_cast<char>('A' + i); }

std::string aMayusculas(std::string s) {
    for (char& c : s) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
    return s;
}

std::vector<std::string> separarPalabras(const std::string& linea) {
    std::istringstream iss(linea);
    std::vector<std::string> palabras;
    std::string p;
    while (iss >> p) palabras.push_back(p);
    return palabras;
}

std::string recortar(const std::string& s) {
    const auto ini = s.find_first_not_of(" \t\r\n");
    if (ini == std::string::npos) return "";
    const auto fin = s.find_last_not_of(" \t\r\n");
    return s.substr(ini, fin - ini + 1);
}

// Comprueba que un cableado sea una permutación de las 26 letras.
void validarPermutacion(const std::string& cableado, const std::string& nombre) {
    if (cableado.size() != NUM_LETRAS)
        throw std::invalid_argument("El cableado de " + nombre + " debe tener 26 letras.");
    std::array<bool, NUM_LETRAS> visto{};
    for (char c : cableado) {
        if (c < 'A' || c > 'Z')
            throw std::invalid_argument("Carácter no válido en el cableado de " + nombre);
        if (visto[c - 'A'])
            throw std::invalid_argument("El cableado de " + nombre + " repite la letra " + c);
        visto[c - 'A'] = true;
    }
}

// Convierte "AAA", "a a a", "Q E V"... en una cadena de 3 letras mayúsculas.
std::string normalizarPosiciones(const std::string& entrada) {
    std::string p;
    for (char c : entrada) {
        if (std::isspace(static_cast<unsigned char>(c))) continue;
        if (!esLetra(c)) throw std::invalid_argument("La posición solo admite letras de la A a la Z.");
        p += static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
    }
    if (p.size() != 3) throw std::invalid_argument("Hay que indicar exactamente 3 letras.");
    return p;
}

// Ringstellung: admite "AAA", "A A A", "01 01 01" o "1 1 1". Devuelve valores 0-25.
std::array<int, 3> parsearAnillos(const std::string& entrada) {
    std::vector<std::string> t = separarPalabras(aMayusculas(entrada));
    if (t.size() == 1 && t[0].size() == 3 && esLetra(t[0][0]) && esLetra(t[0][1]) && esLetra(t[0][2]))
        t = {std::string(1, t[0][0]), std::string(1, t[0][1]), std::string(1, t[0][2])};
    if (t.size() != 3) throw std::invalid_argument("Hay que indicar exactamente 3 anillos.");

    std::array<int, 3> anillos{};
    for (int i = 0; i < 3; ++i) {
        const std::string& v = t[i];
        if (v.size() == 1 && esLetra(v[0])) {
            anillos[i] = letraAIndice(v[0]);
        } else if (!v.empty() && v.find_first_not_of("0123456789") == std::string::npos) {
            const int n = std::stoi(v);
            if (n < 1 || n > 26) throw std::invalid_argument("Los anillos numéricos van de 1 a 26.");
            anillos[i] = n - 1;
        } else {
            throw std::invalid_argument("Valor de anillo no válido: " + v);
        }
    }
    return anillos;
}

// ---------------------------------------------------------------------------
// Rotor (Walze)
// ---------------------------------------------------------------------------
class Rotor {
public:
    Rotor(std::string nombre, const std::string& cableado, std::string muescas)
        : nombre_(std::move(nombre)), muescas_(std::move(muescas)) {
        validarPermutacion(cableado, "rotor " + nombre_);
        for (int i = 0; i < NUM_LETRAS; ++i) {
            adelante_[i] = cableado[i] - 'A';
            atras_[adelante_[i]] = i;  // cableado inverso para el camino de vuelta
        }
    }

    const std::string& nombre() const { return nombre_; }
    int posicion() const { return posicion_; }
    int anillo() const { return anillo_; }
    void setPosicion(int p) { posicion_ = mod26(p); }
    void setAnillo(int r) { anillo_ = mod26(r); }

    // La muesca va fijada al anillo, así que se identifica por la letra
    // visible en la ventanilla, independientemente del Ringstellung.
    bool enMuesca() const {
        return muescas_.find(indiceALetra(posicion_)) != std::string::npos;
    }

    void avanzar() { posicion_ = (posicion_ + 1) % NUM_LETRAS; }

    // Corriente de derecha a izquierda (hacia el reflector).
    int haciaAdelante(int c) const {
        const int d = posicion_ - anillo_;
        return mod26(adelante_[mod26(c + d)] - d);
    }

    // Corriente de izquierda a derecha (de vuelta desde el reflector).
    int haciaAtras(int c) const {
        const int d = posicion_ - anillo_;
        return mod26(atras_[mod26(c + d)] - d);
    }

private:
    std::string nombre_;
    std::string muescas_;
    std::array<int, NUM_LETRAS> adelante_{};
    std::array<int, NUM_LETRAS> atras_{};
    int posicion_ = 0;  // Grundstellung / letra en la ventanilla (0 = A)
    int anillo_ = 0;    // Ringstellung (0 = A = 01)
};

// ---------------------------------------------------------------------------
// Reflector (Umkehrwalze)
// ---------------------------------------------------------------------------
class Reflector {
public:
    Reflector(std::string nombre, const std::string& cableado) : nombre_(std::move(nombre)) {
        validarPermutacion(cableado, "reflector " + nombre_);
        for (int i = 0; i < NUM_LETRAS; ++i) conexion_[i] = cableado[i] - 'A';
        // Un reflector conecta letras por parejas y nunca deja una letra en sí misma.
        for (int i = 0; i < NUM_LETRAS; ++i)
            if (conexion_[i] == i || conexion_[conexion_[i]] != i)
                throw std::invalid_argument("El reflector " + nombre_ + " no está formado por parejas.");
    }

    const std::string& nombre() const { return nombre_; }
    int reflejar(int c) const { return conexion_[c]; }

private:
    std::string nombre_;
    std::array<int, NUM_LETRAS> conexion_{};
};

// ---------------------------------------------------------------------------
// Clavijero (Steckerbrett)
// ---------------------------------------------------------------------------
class Clavijero {
public:
    Clavijero() {
        for (int i = 0; i < NUM_LETRAS; ++i) conexion_[i] = i;
    }

    void conectar(char a, char b) {
        if (!esLetra(a) || !esLetra(b))
            throw std::invalid_argument("El clavijero solo admite letras de la A a la Z.");
        const int x = letraAIndice(a), y = letraAIndice(b);
        if (x == y)
            throw std::invalid_argument(std::string("No se puede conectar la letra ") + indiceALetra(x) + " consigo misma.");
        if (conexion_[x] != x)
            throw std::invalid_argument(std::string("La letra ") + indiceALetra(x) + " ya tiene un cable.");
        if (conexion_[y] != y)
            throw std::invalid_argument(std::string("La letra ") + indiceALetra(y) + " ya tiene un cable.");
        conexion_[x] = y;
        conexion_[y] = x;
    }

    // Admite pares separados por espacios, p. ej. "AV BS CG DL FU HZ IN KM OW RX".
    // Históricamente se usaban 10 cables; el máximo físico es 13.
    void configurar(const std::string& pares) {
        for (const std::string& p : separarPalabras(pares)) {
            if (p.size() != 2) throw std::invalid_argument("Par de clavijero no válido: " + p);
            conectar(p[0], p[1]);
        }
    }

    int intercambiar(int c) const { return conexion_[c]; }

    std::string descripcion() const {
        std::string s;
        for (int i = 0; i < NUM_LETRAS; ++i)
            if (conexion_[i] > i) {
                if (!s.empty()) s += ' ';
                s += indiceALetra(i);
                s += indiceALetra(conexion_[i]);
            }
        return s.empty() ? "(sin cables)" : s;
    }

private:
    std::array<int, NUM_LETRAS> conexion_{};
};

// ---------------------------------------------------------------------------
// Catálogo histórico de rotores y reflectores
// ---------------------------------------------------------------------------
Rotor crearRotor(std::string nombre) {
    struct Datos { const char* cableado; const char* muescas; };
    static const std::map<std::string, Datos> catalogo = {
        {"I",    {"EKMFLGDQVZNTOWYHXUSPAIBRCJ", "Q"}},
        {"II",   {"AJDKSIRUXBLHWTMCQGZNPYFVOE", "E"}},
        {"III",  {"BDFHJLCPRTXVZNYEIWGAKMUSQO", "V"}},
        {"IV",   {"ESOVPZJAYQUIRHXLNFTGKDCMWB", "J"}},
        {"V",    {"VZBRGITYUPSDNHLXAWMJQOFECK", "Z"}},
        {"VI",   {"JPGVOUMFYQBENHZRDKASXLICTW", "ZM"}},  // VI-VIII: solo Kriegsmarine
        {"VII",  {"NZJHGRCXMYSWBOUFAIVLPEKQDT", "ZM"}},
        {"VIII", {"FKQHTLXOCBJSPDZRAMEWNIUYGV", "ZM"}},
    };
    static const std::map<std::string, std::string> arabigos = {
        {"1", "I"}, {"2", "II"}, {"3", "III"}, {"4", "IV"},
        {"5", "V"}, {"6", "VI"}, {"7", "VII"}, {"8", "VIII"},
    };

    nombre = aMayusculas(recortar(nombre));
    if (auto a = arabigos.find(nombre); a != arabigos.end()) nombre = a->second;
    const auto it = catalogo.find(nombre);
    if (it == catalogo.end()) throw std::invalid_argument("Rotor desconocido: " + nombre);
    return Rotor(nombre, it->second.cableado, it->second.muescas);
}

Reflector crearReflector(std::string nombre) {
    static const std::map<std::string, const char*> catalogo = {
        {"A", "EJMZALYXVBWFCRQUONTSPIKHGD"},
        {"B", "YRUHQSLDPXNGOKMIEBFZCWVJAT"},
        {"C", "FVPJIAOYEDRZXWGCTKUQSBNMHL"},
    };

    nombre = aMayusculas(recortar(nombre));
    if (nombre.rfind("UKW-", 0) == 0) nombre = nombre.substr(4);
    const auto it = catalogo.find(nombre);
    if (it == catalogo.end()) throw std::invalid_argument("Reflector desconocido: " + nombre);
    return Reflector("UKW-" + nombre, it->second);
}

// ---------------------------------------------------------------------------
// Máquina Enigma
// ---------------------------------------------------------------------------
class Enigma {
public:
    // Los rotores se indican de izquierda a derecha, como se ven en la máquina.
    Enigma(Rotor izquierdo, Rotor central, Rotor derecho,
           Reflector reflector, Clavijero clavijero = Clavijero())
        : rotores_{{std::move(izquierdo), std::move(central), std::move(derecho)}},
          reflector_(std::move(reflector)),
          clavijero_(std::move(clavijero)) {}

    void setAnillos(const std::array<int, 3>& anillos) {
        for (int i = 0; i < 3; ++i) rotores_[i].setAnillo(anillos[i]);
    }

    void setPosiciones(const std::string& posiciones) {
        const std::string p = normalizarPosiciones(posiciones);
        for (int i = 0; i < 3; ++i) rotores_[i].setPosicion(letraAIndice(p[i]));
    }

    std::string posiciones() const {
        std::string s;
        for (const Rotor& r : rotores_) s += indiceALetra(r.posicion());
        return s;
    }

    // Simula la pulsación de una tecla y devuelve la lámpara que se enciende.
    char pulsarTecla(char letra) {
        if (!esLetra(letra)) throw std::invalid_argument("La Enigma solo tiene teclas de la A a la Z.");

        avanzarRotores();  // los rotores giran ANTES de que se cierre el circuito

        int c = letraAIndice(letra);
        c = clavijero_.intercambiar(c);                               // entrada por el clavijero
        for (int i = 2; i >= 0; --i) c = rotores_[i].haciaAdelante(c);  // derecho -> izquierdo
        c = reflector_.reflejar(c);                                   // reflector
        for (int i = 0; i < 3; ++i) c = rotores_[i].haciaAtras(c);    // izquierdo -> derecho
        c = clavijero_.intercambiar(c);                               // salida por el clavijero
        return indiceALetra(c);
    }

    // Cifra (o descifra, es la misma operación) un texto. Los caracteres que
    // no son letras se copian tal cual y no mueven los rotores.
    std::string procesar(const std::string& texto) {
        std::string salida;
        salida.reserve(texto.size());
        for (char ch : texto) salida += esLetra(ch) ? pulsarTecla(ch) : ch;
        return salida;
    }

    std::string descripcion() const {
        std::ostringstream os;
        os << "Rotores:    " << rotores_[0].nombre() << " - " << rotores_[1].nombre()
           << " - " << rotores_[2].nombre() << "\n"
           << "Reflector:  " << reflector_.nombre() << "\n"
           << "Anillos:   ";
        for (const Rotor& r : rotores_)
            os << ' ' << std::setw(2) << std::setfill('0') << (r.anillo() + 1)
               << '(' << indiceALetra(r.anillo()) << ')';
        os << "\nPosición:   " << posiciones() << "\n"
           << "Clavijero:  " << clavijero_.descripcion();
        return os.str();
    }

private:
    // Mecanismo de trinquetes y muescas:
    //  - El rotor derecho avanza en cada pulsación.
    //  - Si el derecho está en su muesca, arrastra al central.
    //  - Si el central está en su muesca, avanza él mismo y arrastra al
    //    izquierdo (doble paso: el central avanza dos pulsaciones seguidas).
    void avanzarRotores() {
        Rotor& izq = rotores_[0];
        Rotor& cen = rotores_[1];
        Rotor& der = rotores_[2];

        const bool avanzaIzquierdo = cen.enMuesca();
        const bool avanzaCentral = der.enMuesca() || cen.enMuesca();

        if (avanzaIzquierdo) izq.avanzar();
        if (avanzaCentral) cen.avanzar();
        der.avanzar();
    }

    std::array<Rotor, 3> rotores_;
    Reflector reflector_;
    Clavijero clavijero_;
};

// ---------------------------------------------------------------------------
// Pruebas de verificación
// ---------------------------------------------------------------------------
int ejecutarPruebas() {
    int fallos = 0;
    auto comprobar = [&](const std::string& nombre, bool ok) {
        std::cout << (ok ? "[ OK ]  " : "[FALLO] ") << nombre << "\n";
        if (!ok) ++fallos;
    };

    {   // Vector de referencia clásico
        Enigma m(crearRotor("I"), crearRotor("II"), crearRotor("III"), crearReflector("B"));
        m.setPosiciones("AAA");
        comprobar("I-II-III, UKW-B, anillos AAA, posición AAA: AAAAA -> BDZGO",
                  m.procesar("AAAAA") == "BDZGO");
    }
    {   // Doble paso del rotor central
        Enigma m(crearRotor("I"), crearRotor("II"), crearRotor("III"), crearReflector("B"));
        m.setPosiciones("ADU");
        std::string secuencia;
        for (int i = 0; i < 3; ++i) {
            m.pulsarTecla('A');
            secuencia += m.posiciones() + ' ';
        }
        comprobar("Doble paso: ADU -> ADV -> AEW -> BFX", secuencia == "ADV AEW BFX ");
    }
    {   // Reciprocidad: cifrar dos veces con la misma configuración devuelve el original
        Clavijero c;
        c.configurar("AV BS CG DL FU HZ IN KM OW RX");
        Enigma emisor(crearRotor("II"), crearRotor("IV"), crearRotor("V"), crearReflector("B"), c);
        emisor.setAnillos(parsearAnillos("02 21 12"));
        emisor.setPosiciones("BLA");
        Enigma receptor = emisor;  // misma configuración diaria

        const std::string claro = "ANGRIFFAMMORGENBEIMSONNENAUFGANGXSTOPX";
        const std::string cifrado = emisor.procesar(claro);
        comprobar("Reciprocidad con clavijero y anillos (II-IV-V, 02 21 12, BLA)",
                  cifrado != claro && receptor.procesar(cifrado) == claro);
    }
    {   // Propiedad histórica: ninguna letra se cifra como ella misma
        Enigma m(crearRotor("III"), crearRotor("I"), crearRotor("V"), crearReflector("C"));
        m.setPosiciones("XQZ");
        bool ok = true;
        for (int i = 0; i < 50000 && ok; ++i) {
            const char l = indiceALetra(i % NUM_LETRAS);
            if (m.pulsarTecla(l) == l) ok = false;
        }
        comprobar("Ninguna letra se cifra como ella misma (50 000 pulsaciones)", ok);
    }
    {   // Periodo del mecanismo de avance: 26 x 25 x 26 = 16 900 pulsaciones
        Enigma m(crearRotor("I"), crearRotor("II"), crearRotor("III"), crearReflector("B"));
        m.setPosiciones("AAA");
        int pulsaciones = 0;
        do { m.pulsarTecla('A'); ++pulsaciones; } while (m.posiciones() != "AAA" && pulsaciones < 20000);
        comprobar("Periodo de los rotores = 16900 pulsaciones (obtenido: " +
                  std::to_string(pulsaciones) + ")", pulsaciones == 16900);
    }

    std::cout << "\n" << (fallos == 0 ? "Todas las pruebas superadas." : "Hay pruebas fallidas.") << "\n";
    return fallos == 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Modo interactivo por consola
// ---------------------------------------------------------------------------
std::string leerLinea() {
    std::string linea;
    if (!std::getline(std::cin, linea)) throw std::runtime_error("Fin de la entrada.");
    return linea;
}

// Pregunta hasta que la conversión de la respuesta no lance una excepción.
template <typename Conversor>
auto pedirHastaValido(const std::string& mensaje, const std::string& porDefecto, Conversor convertir) {
    while (true) {
        std::cout << mensaje << " [" << (porDefecto.empty() ? "ninguno" : porDefecto) << "]: ";
        std::string entrada = recortar(leerLinea());
        if (entrada.empty()) entrada = porDefecto;
        try {
            return convertir(entrada);
        } catch (const std::exception& e) {
            std::cout << "  Error: " << e.what() << "\n";
        }
    }
}

int modoInteractivo() {
    std::cout << "==============================================\n"
              << "    Simulador de la máquina Enigma I / M3\n"
              << "==============================================\n"
              << "Rotores disponibles:     I II III IV V VI VII VIII\n"
              << "Reflectores disponibles: A B C\n"
              << "(Pulsa Intro para aceptar el valor entre corchetes)\n\n";

    auto rotores = pedirHastaValido("Rotores (izquierdo central derecho)", "I II III",
        [](const std::string& e) {
            const auto t = separarPalabras(e);
            if (t.size() != 3) throw std::invalid_argument("Hay que indicar exactamente 3 rotores.");
            std::vector<Rotor> v;
            for (const auto& n : t) v.push_back(crearRotor(n));
            if (v[0].nombre() == v[1].nombre() || v[0].nombre() == v[2].nombre() ||
                v[1].nombre() == v[2].nombre())
                throw std::invalid_argument("Cada rotor existe una sola vez; no se puede repetir.");
            return v;
        });

    auto reflector = pedirHastaValido("Reflector (UKW)", "B",
        [](const std::string& e) { return crearReflector(e); });

    auto anillos = pedirHastaValido("Ringstellung (anillos: letras o 1-26)", "01 01 01", parsearAnillos);

    auto posicionInicial = pedirHastaValido("Grundstellung (posición inicial)", "AAA", normalizarPosiciones);

    auto clavijero = pedirHastaValido("Clavijero (pares, p. ej. AV BS CG)", "",
        [](const std::string& e) { Clavijero c; c.configurar(e); return c; });

    Enigma maquina(rotores[0], rotores[1], rotores[2], reflector, clavijero);
    maquina.setAnillos(anillos);
    maquina.setPosiciones(posicionInicial);

    std::cout << "\n--- Configuración ---\n" << maquina.descripcion() << "\n\n"
              << "Escribe el texto a cifrar o descifrar.\n"
              << "Comandos: :reset (volver a la posición inicial)  :salir\n\n";

    while (true) {
        std::cout << "Entrada > ";
        std::string linea;
        if (!std::getline(std::cin, linea)) break;
        const std::string comando = recortar(linea);

        if (comando == ":salir") break;
        if (comando == ":reset") {
            maquina.setPosiciones(posicionInicial);
            std::cout << "Rotores devueltos a " << maquina.posiciones() << "\n\n";
            continue;
        }
        if (comando.empty()) continue;

        std::cout << "Salida  > " << maquina.procesar(aMayusculas(linea)) << "\n"
                  << "Rotores:  " << maquina.posiciones() << "\n\n";
    }
    return 0;
}

int main(int argc, char* argv[]) {
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);  // para que los acentos se vean bien en la consola de Windows
#endif
    if (argc > 1 && std::string(argv[1]) == "--prueba") return ejecutarPruebas();

    try {
        return modoInteractivo();
    } catch (const std::exception& e) {
        std::cerr << "\n" << e.what() << "\n";
        return 1;
    }
}
