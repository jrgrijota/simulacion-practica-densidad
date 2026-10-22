'use strict';
// ============================================================
//  Densidad de un sólido — práctica de laboratorio simulada
//  Pesar una muestra desconocida, medir su volumen por inmersión
//  y buscar su densidad en una tabla.
// ============================================================

const CV_W = 900, CV_H = 600;

// ── Geometría de la mesa (coordenadas del lienzo) ──────────
const MESA_Y   = 500;                 // borde superior de la mesa
const BANDEJA  = { x: 120, ancho: 140 };
const BALANZA  = { x: 350, ancho: 220, platoY: 404 };
const PROBETA  = { x: 615, fondo: 484, tope: 224, borde: 190 };  // tope = raya de la capacidad
const BOTON_ON   = { x: 416, y: 450, r: 9 };
const BOTON_TARA = { x: 441, y: 450, r: 9 };
const LUPA_AUMENTO = 3.2;
const FRASCO_REPOSO = { x: 845, y: MESA_Y };   // base del frasco lavador
const PICO = { x: -60, y: -126 };              // punta del pico, respecto a la base del frasco
// Volumen dibujado: 1 mL de la probeta ocupa en el lienzo un cilindro de 48 px de
// diámetro y 2,6 px de alto. La muestra (de fondo, el 90 % de su ancho) llena
// en torno al 60 % de su caja, como una piedra irregular.
const PX3_POR_ML = Math.PI / 4 * 48 * 48 * 2.6;
const RELLENO = 0.6 * 0.9;
const REBOSE   = 1.12;                // la probeta admite un 12 % más por encima de la última raya
const DURACION_MOV = 1.1;             // s que tarda la muestra en ir de un sitio a otro

const PASOS = [
    'Encender y tarar la balanza',
    'Pesar la muestra',
    'Llenar la probeta con agua',
    'Leer el volumen inicial del agua',
    'Meter la muestra en la probeta',
    'Leer el volumen final',
    'Calcular el volumen y la densidad',
    'Buscar el material en la tabla',
];
const N_PASOS = PASOS.length;

const INDICACIONES = [
    'Paso 1: enciende la balanza con su botón ON y pulsa TARA para ponerla a cero.',
    'Paso 2: arrastra la muestra al plato de la balanza y apunta la masa en el cuaderno.',
    'Paso 3: lleva el frasco lavador sobre la boca de la probeta y échale agua hasta unos 50 mL.',
    'Paso 4: lleva la lupa al agua de la probeta, lee el volumen y apúntalo.',
    'Paso 5: baja la muestra con cuidado dentro de la probeta hasta el agua y suéltala allí. Si la dejas caer, salpicará.',
    'Paso 6: lee con la lupa el nuevo volumen y apúntalo.',
    'Paso 7: calcula el volumen de la muestra y su densidad.',
    'Paso 8: busca en la tabla el material con la densidad más parecida.',
];

// ── Estado ─────────────────────────────────────────────────
let nivel = 'guiada';          // 'guiada' | 'libre'
let muestra = MUESTRAS[6];
let capProbeta = 100;
let forma = [];                // polígono de la muestra (unidades relativas)
let tamano = { w: 40, h: 60 };

let lugar = 'bandeja';         // 'bandeja' | 'balanza' | 'probeta' | 'mano' | 'moviendo'
let mov = null;                // { ruta: [[x,y]…], t, destino }
let pos = { x: 0, y: 0 };      // centro de la muestra

let balanzaEncendida = false;
let deriva = 0;                // lo que marca la balanza vacía antes de tarar
let tara = 0;
let taradaVacia = false;

let agua = 0;                  // mL de agua en la probeta (baja si se derrama)
let nivelMostrado = 0;         // mL que marca el agua (se anima)
let derramado = false;
let lupaPos = { x: 0, y: 0 };
let frascoPos = { ...FRASCO_REPOSO };
let vertiendo = false;         // el frasco está echando agua en la probeta
let porVerter = 0;             // mL que quedan por echar con el botón del teclado
let avisoVertido = '';         // último aviso dado mientras se echa agua (para no repetirlo)
let arrastre = null;           // { que: 'muestra' | 'lupa' | 'frasco', dx, dy, origen }
let avisoFuera = false;        // se soltó la muestra fuera de su sitio
let mojada = false;            // la muestra ha estado en el agua
let aguaPegada = 0;            // g de agua que se lleva la muestra al salir
let gotas = [];                // salpicaduras { x, y, vx, vy }
let charcos = [];              // agua derramada en la mesa { x, w }
let errorPendiente = null;     // { tipo, t }: error que obliga a empezar de nuevo
let bloqueado = false;         // hay un mensaje de error abierto

let datos = {};                // valores del cuaderno (números)
let correctos = {};            // qué datos del cuaderno están bien
let eleccion = null;           // material elegido en la tabla
let terminado = false;

let mensaje = '';              // aviso de lo último que ha pasado
let mensajeT = -1e9;           // cuándo se dio (ms)
let mensajeTipo = '';          // 'aviso' para los avisos de seguridad (más tiempo y en otro color)
let ultimoPaso = 0;
const DURACION_AVISO = 6000;   // ms que se ve un aviso antes de volver a la indicación
let TH = {};
let escala = 1;                // px de pantalla por px del lienzo (lo calcula fitCanvas)

// ============================================================
//  p5
// ============================================================
function setup() {
    const canvas = createCanvas(CV_W, CV_H);
    canvas.parent('canvas-container');
    canvas.elt.setAttribute('role', 'application');
    canvas.elt.setAttribute('tabindex', '0');
    canvas.elt.setAttribute('aria-label', i18n.t('Mesa de laboratorio con una bandeja, una balanza electrónica, una probeta, un frasco lavador con agua y una lupa. Con el ratón o el dedo se arrastran la muestra, el frasco y la lupa. Con el teclado, las flechas mueven la lupa. Los mensajes de la simulación se leen en voz alta.'));
    setupPuntero(canvas.elt);
    fitCanvas();
    frameRate(60);
    textFont('monospace');

    leerParametros();
    rellenarMuestras();
    rellenarTabla();
    setupControles();
    setupThemeSelector();
    elegirMuestra(muestra.n);
    setNivel(nivel);
}

function draw() {
    updateTheme();
    avanzarMovimiento();
    avanzarFrasco();
    avanzarAgua();
    avanzarGotas();
    if (volumenSumergido() > 0.01) mojada = true;
    if (errorPendiente && millis() > errorPendiente.t) {
        const tipo = errorPendiente.tipo;
        errorPendiente = null;
        mostrarError(tipo);
    }

    background(TH.fondo);
    dibujarEscena();
    dibujarLupa();
    dibujarRotulos();
    actualizarCursor();
}

function dibujarEscena() {
    dibujarCuadricula();
    dibujarMesa();
    dibujarBandeja();
    dibujarBalanza();
    dibujarCharcos();
    dibujarProbeta();
    dibujarFrasco();
    if (!muestraEnTubo()) dibujarMuestra(pos.x, pos.y);
    dibujarGotas();
}

// La muestra está dentro de la probeta (o entrando o saliendo por la boca)
function muestraEnTubo() {
    return Math.abs(pos.x - PROBETA.x) < 0.5 && pos.y + tamano.h / 2 > PROBETA.borde;
}

// ============================================================
//  Parámetros de la dirección (para que el profesor reparta)
//    ?nivel=libre  ?muestra=7  ?probeta=50
// ============================================================
function leerParametros() {
    const p = new URLSearchParams(location.search);
    if (p.get('nivel') === 'libre') nivel = 'libre';
    const n = parseInt(p.get('muestra'), 10);
    if (n >= 1 && n <= MUESTRAS.length) muestra = MUESTRAS[n - 1];
    const c = parseInt(p.get('probeta'), 10);
    if (PROBETAS[c]) {
        capProbeta = c;
        document.getElementById('select-probeta').value = String(c);
    }
}

// ============================================================
//  Muestra, probeta y reinicio
// ============================================================
function elegirMuestra(n) {
    muestra = MUESTRAS[n - 1];
    document.getElementById('select-muestra').value = String(n);
    const rnd = aleatorioConSemilla(n * 7 + 3);
    forma = [];
    const lados = 9 + Math.floor(rnd() * 3);
    for (let i = 0; i < lados; i++) {
        const a = (i / lados) * TWO_PI + (rnd() - 0.5) * 0.35;
        const r = 0.80 + rnd() * 0.22;
        forma.push([Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5]);
    }
    muestra.tinte = Math.round((rnd() - 0.5) * 26);
    // A escala: el alto sale del volumen, así se ve tan grande como el agua que desplaza
    const w = muestra.ancho;
    tamano = { w, h: muestra.vol * PX3_POR_ML / (RELLENO * w * w) };
    reiniciar();
}

function reiniciar() {
    lugar = 'bandeja';
    mov = null;
    arrastre = null;
    pos = anclaje('bandeja');
    lupaPos = lupaReposo();
    frascoPos = { ...FRASCO_REPOSO };
    vertiendo = false;
    porVerter = 0;
    avisoVertido = '';
    mojada = false;
    aguaPegada = (4 + Math.floor(Math.random() * 6)) / 10;
    gotas = [];
    charcos = [];
    errorPendiente = null;
    ocultarError();
    balanzaEncendida = false;
    deriva = (2 + Math.floor(Math.random() * 4)) / 10;
    tara = 0;
    taradaVacia = false;
    agua = 0;                  // la probeta empieza vacía: se llena con el frasco lavador
    nivelMostrado = agua;
    derramado = false;
    datos = {};
    correctos = {};
    eleccion = null;
    terminado = false;
    document.querySelectorAll('.dato').forEach(inp => { inp.value = ''; });
    document.querySelectorAll('.marca').forEach(m => { m.textContent = ''; m.className = 'marca'; });
    const res = document.getElementById('resultado');
    res.hidden = true;
    res.textContent = '';
    avisoCuaderno(i18n.t('Escribe lo que leas en los instrumentos y pulsa Intro. 1 mL = 1 cm³.'), '');
    mensaje = '';
    mensajeT = -1e9;
    ultimoPaso = 0;
    actualizarInterfaz();
}

function cambiarProbeta(cap) {
    capProbeta = cap;
    reiniciar();
}

function anclaje(sitio) {
    const { h } = tamano;
    if (sitio === 'bandeja') return { x: BANDEJA.x, y: MESA_Y - 14 - h / 2 };
    if (sitio === 'balanza') return { x: BALANZA.x, y: BALANZA.platoY - h / 2 };
    return { x: PROBETA.x, y: PROBETA.fondo - h / 2 - 1 };
}

// ============================================================
//  Movimientos de la muestra
// ============================================================
function cabeEnProbeta() {
    return tamano.w <= PROBETAS[capProbeta].ancho * 0.88;
}

// Con los botones del teclado: la muestra sube, va por encima y baja
function mover(destino) {
    if (mov || arrastre) return;
    if (!permitido(destino, lugar)) return;
    if (destino === 'probeta' && !cabeEnProbeta()) {
        decir(i18n.t('La muestra no cabe por la boca de esta probeta. Elige una más ancha.'));
        return;
    }
    const a = { x: pos.x, y: pos.y };
    const b = anclaje(destino);
    const alto = Math.min(a.y, b.y, PROBETA.borde - tamano.h / 2 - 14);
    // A la probeta se baja despacio, con la mano: así no salpica
    mov = { ruta: [[a.x, a.y], [a.x, alto], [b.x, alto], [b.x, b.y]], t: 0, destino, origen: lugar, lento: destino === 'probeta' };
    lugar = 'moviendo';
    actualizarInterfaz();
}

// Al soltar la muestra que se arrastra: va al sitio más cercano por el camino corto
function soltar(destino, origen) {
    if (destino === 'fuera') {
        destino = 'bandeja';
        avisoFuera = true;
    }
    if (!permitido(destino, origen)) destino = origen === 'mano' ? 'bandeja' : origen;
    if (destino === 'probeta' && !cabeEnProbeta()) {
        decir(i18n.t('La muestra no cabe por la boca de esta probeta. Elige una más ancha.'));
        destino = origen === 'probeta' ? 'bandeja' : origen;
    }
    const a = { x: pos.x, y: pos.y };
    const b = anclaje(destino);
    let ruta;
    let caida = false;
    if (destino === 'probeta') {
        // Si se suelta por encima del agua, la muestra cae; si ya está en el agua, se posa despacio
        const superficie = yDeMl(nivelObjetivo());
        caida = superficie - (a.y + tamano.h / 2) > 14;
        ruta = muestraEnTubo() ? [[a.x, a.y], [b.x, b.y]] : [[a.x, a.y], [b.x, Math.min(a.y, PROBETA.borde - tamano.h / 2)], [b.x, b.y]];
    } else if (muestraEnTubo()) {
        const fuera = PROBETA.borde - tamano.h / 2 - 14;
        ruta = [[a.x, a.y], [a.x, fuera], [b.x, Math.min(fuera, b.y)], [b.x, b.y]];
    } else {
        ruta = [[a.x, a.y], [b.x, b.y]];
    }
    mov = { ruta, t: 0, destino, origen, lento: destino === 'probeta' && !caida, caida, salpicado: false };
    lugar = 'moviendo';
    actualizarInterfaz();
}

// En el nivel guiado no se puede saltar un paso
function permitido(destino, origen) {
    if (nivel !== 'guiada') return true;
    const paso = pasoActual();
    if (destino === 'balanza') {
        // Una muestra mojada sí se deja pesar: así se ve el error
        if (paso === 2 || origen === 'balanza' || mojada) return true;
        decir(paso === 1 ? i18n.t('Antes de pesar, enciende la balanza y pulsa TARA.') : i18n.t(INDICACIONES[paso - 1]));
        return false;
    }
    if (destino === 'probeta') {
        if (paso === 5 || origen === 'probeta') return true;
        decir(paso < 5 ? i18n.t('Todavía no: antes de meter la muestra tienes que pesarla, llenar la probeta y leer el volumen inicial del agua.') : i18n.t(INDICACIONES[paso - 1]));
        return false;
    }
    return true;
}

function avanzarMovimiento() {
    if (!mov) return;
    const duracion = mov.caida ? 0.5 : mov.lento ? DURACION_MOV * 1.4 : DURACION_MOV * 0.7;
    mov.t = Math.min(1, mov.t + deltaTime / 1000 / duracion);
    const r = mov.ruta;
    const largos = [];
    let total = 0;
    for (let i = 1; i < r.length; i++) {
        const d = dist(r[i - 1][0], r[i - 1][1], r[i][0], r[i][1]);
        largos.push(d);
        total += d;
    }
    // Suave al arrancar y al llegar; al caer, cada vez más deprisa
    const e = mov.caida ? mov.t * mov.t : mov.t < 0.5 ? 2 * mov.t * mov.t : 1 - Math.pow(-2 * mov.t + 2, 2) / 2;
    let falta = e * total;
    for (let i = 0; i < largos.length; i++) {
        if (falta <= largos[i] || i === largos.length - 1) {
            const f = largos[i] > 0 ? Math.min(1, falta / largos[i]) : 1;
            pos.x = lerp(r[i][0], r[i + 1][0], f);
            pos.y = lerp(r[i][1], r[i + 1][1], f);
            break;
        }
        falta -= largos[i];
    }
    // Al chocar con el agua, salpica
    if (mov.caida && !mov.salpicado && agua > 0 && pos.y + tamano.h / 2 >= yDeMl(agua)) {
        mov.salpicado = true;
        salpicar();
    }
    if (mov.t >= 1) {
        const m = mov;
        mov = null;
        lugar = m.destino;
        alLlegar(m.destino, m.origen, m);
    }
}

// La muestra cae al agua: salen gotas, parte por encima del borde, y se pierde agua
function salpicar() {
    const p = PROBETAS[capProbeta];
    const y = yDeMl(agua);
    for (let i = 0; i < 40; i++) {
        const lado = Math.random() < 0.5 ? -1 : 1;
        gotas.push({
            x: PROBETA.x + (Math.random() - 0.5) * p.ancho * 0.7,
            y,
            vx: lado * (40 + Math.random() * 220),
            vy: -(420 + Math.random() * 360),
        });
    }
    agua = Math.max(0, agua - (1.5 + Math.random() * 2) * p.cap / 100);
}

function avanzarGotas() {
    if (!gotas.length) return;
    const dt = Math.min(0.05, deltaTime / 1000);
    const p = PROBETAS[capProbeta];
    const x0 = PROBETA.x - p.ancho / 2, x1 = PROBETA.x + p.ancho / 2;
    gotas = gotas.filter(g => {
        g.vy += 900 * dt;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        const dentro = g.x > x0 && g.x < x1;
        if (g.y > PROBETA.borde && dentro) {
            // Dentro del vidrio rebota en las paredes y vuelve al agua
            if (g.x < x0 + 2 || g.x > x1 - 2) g.vx *= -0.4;
            return g.vy < 0 || g.y < yDeMl(nivelMostrado);
        }
        if (g.y >= MESA_Y) {
            charcos.push({ x: g.x, w: 6 + Math.random() * 10 });
            return false;
        }
        return g.x > -10 && g.x < CV_W + 10;
    });
}

function alLlegar(destino, origen, m) {
    if (origen === 'probeta' && destino !== 'probeta') {
        derramado = false;
    }
    if (destino === origen && !avisoFuera && !(m && m.caida)) { actualizarInterfaz(); return; }
    if (destino === 'balanza') {
        decir(balanzaEncendida
            ? i18n.t('La balanza marca {m} g.', { m: lecturaBalanzaTexto() })
            : i18n.t('La muestra está en el plato, pero la balanza está apagada.'));
        if (mojada) errorPendiente = { tipo: 'mojada', t: millis() + 1400 };
    } else if (destino === 'probeta') {
        const p = PROBETAS[capProbeta];
        const maximo = p.cap * REBOSE;
        const sumergido = volumenSumergido();
        if (m && m.caida && m.salpicado) {
            decir(i18n.t('¡Has dejado caer la muestra y el agua ha salpicado!'), 'aviso');
            errorPendiente = { tipo: 'caida', t: millis() + 900 };
        } else if (m && m.caida && agua === 0) {
            decir(i18n.t('⚠ Has dejado caer la muestra en la probeta vacía. Un golpe así puede romper el fondo: las muestras se bajan siempre con cuidado.'), 'aviso');
        } else if (derramado) {
            // Ya se había derramado: no se pierde más agua
        } else if (agua + sumergido > maximo) {
            agua = maximo - sumergido;
            derramado = true;
            charcos.push({ x: PROBETA.x - p.ancho / 2 - 30, w: 26 }, { x: PROBETA.x + p.ancho / 2 + 26, w: 20 });
            decir(i18n.t('¡Se ha salido agua por arriba! Esta medida no vale: usa una probeta más grande o echa menos agua.'));
        } else if (sumergido < muestra.vol - 0.05) {
            decir(i18n.t('La muestra no ha quedado cubierta del todo por el agua.'));
        } else {
            decir(i18n.t('La muestra está sumergida: el agua ha subido.'));
        }
    } else if (avisoFuera) {
        decir(i18n.t('⚠ En el laboratorio, las muestras solo se dejan en la bandeja, en el plato de la balanza o dentro de la probeta, nunca sobre la mesa. La muestra ha vuelto a la bandeja.'), 'aviso');
    } else {
        decir(i18n.t('La muestra está en la bandeja.'));
    }
    avisoFuera = false;
    actualizarInterfaz();
}

// Volumen sumergido de la muestra (cm³): la parte que queda por debajo del agua.
// Al subir el agua se cubre más muestra, así que se ajusta unas cuantas veces.
function volumenSumergido() {
    if (lugar !== 'probeta' && !muestraEnTubo()) return 0;
    const abajo = pos.y + tamano.h / 2;
    let nivel = agua;
    for (let i = 0; i < 6; i++) {
        const f = constrain((abajo - yDeMl(nivel)) / tamano.h, 0, 1);
        nivel = agua + f * muestra.vol;
    }
    return nivel - agua;
}

function nivelObjetivo() {
    const p = PROBETAS[capProbeta];
    return Math.min(agua + volumenSumergido(), p.cap * REBOSE);
}

function avanzarAgua() {
    // Agua que se echa con el frasco lavador
    const p = PROBETAS[capProbeta];
    if (porVerter > 0 && !vertiendo) {
        const d = Math.min(porVerter, p.caudal * deltaTime / 1000);
        porVerter -= d;
        echarAgua(d);
        if (porVerter <= 0) { porVerter = 0; frascoPos = { ...FRASCO_REPOSO }; alTerminarDeVerter(); }
    } else if (vertiendo) {
        echarAgua(p.caudal * deltaTime / 1000);
    }
    const objetivo = nivelObjetivo();
    nivelMostrado += (objetivo - nivelMostrado) * Math.min(1, deltaTime / 120);
    if (Math.abs(objetivo - nivelMostrado) < 0.001) nivelMostrado = objetivo;
}

// ============================================================
//  Frasco lavador: llenar y vaciar la probeta
// ============================================================
function picoSobreBoca() {
    const p = PROBETAS[capProbeta];
    const px = frascoPos.x + PICO.x, py = frascoPos.y + PICO.y;
    return Math.abs(px - PROBETA.x) < p.ancho / 2 - 3 && py < PROBETA.borde;
}

// En el nivel guiado solo se echa agua en los pasos 3 y 4
function puedeVerter() {
    return nivel !== 'guiada' || [3, 4].includes(pasoActual());
}

// El frasco no atraviesa la mesa, la balanza ni la probeta
function limitarFrasco(x, y) {
    const p = PROBETAS[capProbeta];
    x = constrain(x, 30, CV_W - 26);
    y = constrain(y, 140, MESA_Y);
    if (Math.abs(x - PROBETA.x) < p.ancho / 2 + 28) y = Math.min(y, PROBETA.borde - 2);
    if (Math.abs(x - BALANZA.x) < BALANZA.ancho / 2 + 22) y = Math.min(y, BALANZA.platoY - 2);
    return { x, y };
}

function avanzarFrasco() {
    if (arrastre && arrastre.que === 'frasco') {
        const sobre = picoSobreBoca();
        if (sobre && !puedeVerter()) {
            decirVertido(i18n.t('Ahora no hace falta echar agua. {i}', { i: i18n.t(INDICACIONES[pasoActual() - 1]) }));
            vertiendo = false;
        } else {
            vertiendo = sobre;
            if (sobre) arrastre.vertido = true;
        }
        return;
    }
    vertiendo = false;
    if (porVerter > 0) return;
    // Suelto, el frasco vuelve a su sitio
    frascoPos.x += (FRASCO_REPOSO.x - frascoPos.x) * Math.min(1, deltaTime / 90);
    frascoPos.y += (FRASCO_REPOSO.y - frascoPos.y) * Math.min(1, deltaTime / 90);
}

function echarAgua(ml) {
    const p = PROBETAS[capProbeta];
    const maximo = p.cap * REBOSE - volumenSumergido();
    if (agua + ml > maximo) {
        if (agua < maximo) agua = maximo;
        if (avisoVertido.indexOf('borde') < 0) charcos.push({ x: PROBETA.x - p.ancho / 2 - 30, w: 24 }, { x: PROBETA.x + p.ancho / 2 + 24, w: 18 });
        decirVertido(i18n.t('El agua ya llega al borde y se está saliendo por arriba.'));
        return;
    }
    agua += ml;
}

// Un aviso mientras se echa agua se da una sola vez
function decirVertido(txt) {
    if (avisoVertido === txt) return;
    avisoVertido = txt;
    decir(txt);
}

// Agua mínima para que la muestra quede cubierta al meterla
function aguaMinima() {
    const p = PROBETAS[capProbeta];
    const pxPorMl = (PROBETA.fondo - PROBETA.tope) / p.cap;
    return Math.max(0, (tamano.h + 3) / pxPorMl - muestra.vol);
}

// Nivel guiado: hay agua para cubrir la muestra y no rebosará al meterla
function llenadoBien() {
    const p = PROBETAS[capProbeta];
    return agua >= aguaMinima() && agua + muestra.vol <= p.cap - 1 && !vertiendo && porVerter === 0;
}

function alTerminarDeVerter() {
    avisoVertido = '';
    if (nivel === 'guiada' && pasoActual() <= 4 && agua > 0) {
        const p = PROBETAS[capProbeta];
        if (agua + muestra.vol > p.cap - 1) {
            decir(i18n.t('Hay demasiada agua: al meter la muestra, el agua pasaría de la última raya. Pulsa «Vaciar la probeta» y vuelve a llenarla hasta unos 50 mL.'), 'aviso');
        } else if (agua < aguaMinima()) {
            decir(i18n.t('Echa un poco más de agua: con tan poca, la muestra no quedaría cubierta del todo.'));
        }
    }
    actualizarInterfaz();
}

// Con el teclado: el frasco se pone sobre la probeta y echa un chorrito
function verterConTeclado() {
    if (mov || arrastre || bloqueado) return;
    if (!puedeVerter()) {
        decir(i18n.t('Ahora no hace falta echar agua. {i}', { i: i18n.t(INDICACIONES[pasoActual() - 1]) }));
        return;
    }
    const p = PROBETAS[capProbeta];
    frascoPos = limitarFrasco(PROBETA.x - PICO.x, PROBETA.borde - 20 - PICO.y);
    porVerter += p.cap * 0.05;
}

function vaciarProbeta() {
    if (mov || arrastre || bloqueado || muestraEnTubo() || lugar === 'probeta') return;
    agua = 0;
    derramado = false;
    porVerter = 0;
    // Con la probeta vacía, el volumen inicial que se hubiera apuntado ya no vale
    if (nivel === 'guiada' && !correctos.vf) {
        delete correctos.vi;
        delete datos.vi;
        document.getElementById('dato-vi').value = '';
        const marca = document.getElementById('marca-vi');
        marca.textContent = '';
        marca.className = 'marca';
    }
    decir(i18n.t('Probeta vacía.'));
    actualizarInterfaz();
}

// ============================================================
//  Errores que obligan a empezar de nuevo
// ============================================================
const ERRORES = {
    caida: {
        titulo: 'Se ha salido agua de la probeta',
        texto: 'Has dejado caer la muestra y el agua ha salpicado fuera de la probeta. El volumen de agua inicial ya no es válido, porque al dejar caer la muestra se ha salido parte del agua. Hay que volver a empezar: llena la probeta e introduce la muestra con cuidado, bajándola con la mano hasta el agua antes de soltarla.',
    },
    mojada: {
        titulo: 'La muestra está mojada',
        texto: 'La muestra acaba de salir del agua y lleva agua pegada, que también pesa: la balanza marca más masa de la que tiene la muestra. La masa se mide con la muestra seca, antes de meterla en la probeta. Hay que volver a empezar la práctica desde el principio.',
    },
};

function mostrarError(tipo) {
    const e = ERRORES[tipo];
    document.getElementById('error-titulo').textContent = i18n.t(e.titulo);
    document.getElementById('error-texto').textContent = i18n.t(e.texto);
    document.getElementById('error-lab').hidden = false;
    bloqueado = true;
    arrastre = null;
    document.querySelectorAll('.control-panel, .barra-lab, #canvas-container').forEach(el => { el.inert = true; });
    document.getElementById('error-reiniciar').focus();
}

function ocultarError() {
    const caja = document.getElementById('error-lab');
    if (!caja || caja.hidden) return;
    caja.hidden = true;
    bloqueado = false;
    document.querySelectorAll('.control-panel, .barra-lab, #canvas-container').forEach(el => { el.inert = false; });
}

// ============================================================
//  Balanza
// ============================================================
function cargaBalanza() {
    if (lugar !== 'balanza') return 0;
    return muestra.masa + (mojada ? aguaPegada : 0);
}

function lecturaBalanza() {
    return Math.round((cargaBalanza() + deriva - tara) * 10) / 10;
}

function lecturaBalanzaTexto() {
    const v = lecturaBalanza();
    const t = i18n.num(Math.abs(v), 1);
    return v < -0.04 ? '−' + t : t;
}

function encender() {
    balanzaEncendida = !balanzaEncendida;
    tara = 0;
    taradaVacia = false;
    decir(balanzaEncendida
        ? i18n.t('Balanza encendida: marca {m} g sin nada encima. Pulsa TARA para ponerla a cero.', { m: lecturaBalanzaTexto() })
        : i18n.t('Balanza apagada.'));
    actualizarInterfaz();
}

// Botón ON de la balanza (en el lienzo o con el teclado)
function pulsarOn() {
    if (bloqueado) return;
    if (nivel === 'guiada' && balanzaEncendida) {
        decir(i18n.t('La balanza ya está encendida. No la apagues: la necesitas para pesar.'));
        return;
    }
    encender();
}

// Botón TARA: si no hace nada, dice por qué
function pulsarTara() {
    if (bloqueado) return;
    if (!balanzaEncendida) {
        decir(i18n.t('La balanza está apagada: enciéndela primero con el botón ON.'));
        return;
    }
    if (nivel === 'guiada' && pasoActual() > 1) {
        decir(lugar === 'balanza'
            ? i18n.t('No tares ahora: con la muestra encima, la balanza marcaría 0,0 g y perderías su masa.')
            : i18n.t('La balanza ya está tarada: marca 0,0 g sin nada encima.'));
        return;
    }
    tarar();
}

function tarar() {
    if (!balanzaEncendida) return;
    tara = cargaBalanza() + deriva;
    taradaVacia = lugar !== 'balanza';
    decir(lugar === 'balanza'
        ? i18n.t('Balanza tarada con la muestra encima: ahora marca 0,0 g aunque la muestra tiene masa.')
        : i18n.t('Balanza tarada: marca 0,0 g.'));
    actualizarInterfaz();
}

// ============================================================
//  Probeta: escala
// ============================================================
function yDeMl(ml) {
    const p = PROBETAS[capProbeta];
    return PROBETA.fondo - (ml / p.cap) * (PROBETA.fondo - PROBETA.tope);
}

function volumenFinalReal() {
    return nivelObjetivo();
}

// Texto para lectores de pantalla: entre qué rayas está la parte baja del menisco
function describirEscala() {
    const p = PROBETAS[capProbeta];
    const ml = nivelObjetivo();
    if (ml > p.cap) {
        decir(i18n.t('El agua está por encima de la última raya: no se puede leer.'));
        return;
    }
    const abajo = Math.floor(ml / p.div + 1e-6) * p.div;
    const resto = (ml - abajo) / p.div;
    let txt;
    if (resto < 0.15) txt = i18n.t('La parte baja del menisco está justo en la raya de {a} mL.', { a: abajo });
    else if (resto > 0.85) txt = i18n.t('La parte baja del menisco está justo en la raya de {a} mL.', { a: abajo + p.div });
    else txt = i18n.t('La parte baja del menisco está entre las rayas de {a} y {b} mL, {c}.', {
        a: abajo, b: abajo + p.div,
        c: resto < 0.5 ? i18n.t('más cerca de {a}', { a: abajo }) : resto > 0.5 ? i18n.t('más cerca de {b}', { b: abajo + p.div }) : i18n.t('justo en medio'),
    });
    txt += ' ' + i18n.t('Cada raya vale {d} mL.', { d: p.div });
    decir(txt);
}

// ============================================================
//  Nivel guiado: pasos y cuaderno
// ============================================================
function pasoActual() {
    if (!(balanzaEncendida && taradaVacia)) return 1;
    if (!correctos.m) return 2;
    if (!correctos.vi && !llenadoBien()) return 3;
    if (!correctos.vi) return 4;
    if (lugar !== 'probeta' && !correctos.vf) return 5;
    if (!correctos.vf) return 6;
    if (!(correctos.v && correctos.rho)) return 7;
    if (!terminado) return 8;
    return 9;
}

function leerNumero(txt) {
    const s = String(txt).trim().replace(/\s/g, '').replace(',', '.').replace('−', '-');
    if (s === '' || !/^-?\d*\.?\d+$/.test(s)) return null;
    return parseFloat(s);
}

function comprobarDato(id) {
    const inp = document.getElementById('dato-' + id);
    const x = leerNumero(inp.value);
    if (x === null) {
        if (inp.value.trim() !== '') avisoCuaderno(i18n.t('Escribe solo el número, sin la unidad.'), 'mal');
        return;
    }
    datos[id] = x;
    const p = PROBETAS[capProbeta];
    // Solo vale la raya más cercana al agua (las dos si está justo en medio)
    const margenV = p.div / 2 + 0.02;
    let ok = false, pista = '';

    if (id === 'm') {
        ok = Math.abs(x - muestra.masa) <= 0.05 + 1e-9;
        pista = i18n.t('Revisa la masa: copia el número de la pantalla de la balanza, con su decimal.');
    } else if (id === 'vi' || id === 'vf') {
        const real = id === 'vi' ? agua : volumenFinalReal();
        ok = Math.abs(x - real) <= margenV;
        pista = Math.abs(x - real) <= 3 * p.div
            ? i18n.t('Casi. Fíjate en la parte de abajo del menisco y cuenta las rayitas desde la raya con número.')
            : i18n.t('Revisa la lectura. Lleva la lupa al agua para ver bien las rayas.');
    } else if (id === 'v') {
        const esperado = datos.vf - datos.vi;
        ok = Math.abs(x - esperado) <= 0.05 + 1e-9;
        pista = i18n.t('El volumen de la muestra es lo que ha subido el agua: V = Vf − Vi.');
    } else if (id === 'rho') {
        const esperado = datos.m / datos.v;
        ok = Math.abs(x - esperado) <= Math.max(0.011, esperado * 0.006);
        pista = Math.abs(x - datos.v / datos.m) < 0.011
            ? i18n.t('Lo has dividido al revés: la densidad es la masa entre el volumen, ρ = m / V.')
            : i18n.t('Revisa la división: ρ = m / V, con tu masa y tu volumen. Redondea a dos decimales.');
    }

    correctos[id] = ok;
    const marca = document.getElementById('marca-' + id);
    marca.textContent = ok ? '✓' : '✗';
    marca.className = 'marca ' + (ok ? 'bien' : 'mal');
    if (ok) {
        const siguiente = pasoActual();
        avisoCuaderno(i18n.t('Bien apuntado.') + (siguiente <= N_PASOS ? ' ' + i18n.t(INDICACIONES[siguiente - 1]) : ''), 'bien');
    } else {
        avisoCuaderno(pista, 'mal');
    }
    actualizarInterfaz();
}

function avisoCuaderno(txt, tipo) {
    const el = document.getElementById('aviso-cuaderno');
    el.textContent = txt;
    el.className = 'aviso-cuaderno' + (tipo ? ' ' + tipo : '');
}

function elegirMaterial(id) {
    if (nivel !== 'guiada' || pasoActual() < N_PASOS) return;
    eleccion = id;
    const mat = MATERIALES.find(m => m.id === id);
    const rhoAlumno = datos.rho;
    let cercano = MATERIALES[0];
    MATERIALES.forEach(m => { if (Math.abs(m.rho - rhoAlumno) < Math.abs(cercano.rho - rhoAlumno)) cercano = m; });
    const res = document.getElementById('resultado');
    res.hidden = false;
    const rhoTxt = i18n.num(rhoAlumno);
    if (mat === muestra.mat) {
        terminado = true;
        const err = Math.abs(rhoAlumno - mat.rho) / mat.rho * 100;
        res.className = 'resultado bien';
        res.textContent = i18n.t('✓ {mat}. Práctica terminada. Tu densidad es {r} g/cm³ y la de la tabla, {t} g/cm³. Error relativo: |{r} − {t}| / {t} × 100 = {e} %.', {
            mat: i18n.t(mat.nombre), r: rhoTxt, e: i18n.num(err, 1), t: i18n.num(mat.rho, 2),
        });
        decir(i18n.t('Práctica terminada. La muestra {n} es de {mat}.', { n: muestra.n, mat: i18n.t(mat.nombre).toLowerCase() }));
    } else if (mat !== cercano) {
        res.className = 'resultado mal';
        res.textContent = i18n.t('✗ No es {mat}. Busca en la tabla el valor más cercano a tu densidad ({r} g/cm³).', { mat: i18n.t(mat.nombre).toLowerCase(), r: rhoTxt });
    } else {
        res.className = 'resultado mal';
        res.textContent = i18n.t('✗ No es {mat}, aunque es el valor más cercano a tu medida. Con una probeta que solo aprecia {d} mL no se distinguen bien los materiales de densidad parecida. Prueba con el siguiente más cercano.', {
            mat: i18n.t(mat.nombre).toLowerCase(), d: PROBETAS[capProbeta].div,
        });
    }
    actualizarInterfaz();
}

// ============================================================
//  Interfaz: botones, pasos y nivel
// ============================================================
function setNivel(n) {
    nivel = n;
    document.body.classList.remove('nivel-guiada', 'nivel-libre');
    document.body.classList.add('nivel-' + n);
    ['guiada', 'libre'].forEach(m => {
        const b = document.getElementById('nivel-' + m);
        b.classList.toggle('active', m === n);
        b.setAttribute('aria-selected', String(m === n));
    });
    if (n === 'guiada' && capProbeta !== 100) {
        capProbeta = 100;
        document.getElementById('select-probeta').value = '100';
    }
    reiniciar();
    fitCanvas();
}

function actualizarInterfaz() {
    const guiada = nivel === 'guiada';
    const paso = pasoActual();
    const quieta = !mov && !arrastre;

    const bEnc = document.getElementById('btn-encender');
    const bTar = document.getElementById('btn-tarar');
    const bBal = document.getElementById('btn-balanza');
    const bPro = document.getElementById('btn-probeta');

    bEnc.textContent = balanzaEncendida ? i18n.t('⏻ Apagar') : i18n.t('⏻ Encender');
    bBal.textContent = lugar === 'balanza' ? i18n.t('↑ Quitar de la balanza') : i18n.t('↓ Poner en la balanza');
    bPro.textContent = lugar === 'probeta' ? i18n.t('← Sacar de la probeta') : i18n.t('→ Meter en la probeta');

    // ON y TARA nunca se desactivan: si no toca pulsarlos, dicen por qué
    if (guiada) {
        bBal.disabled = !quieta || !((paso === 2 && lugar === 'bandeja') || lugar === 'balanza');
        bPro.disabled = !quieta || !((paso === 5 && lugar !== 'probeta') || lugar === 'probeta');
    } else {
        bBal.disabled = !quieta;
        bPro.disabled = !quieta;
    }
    document.getElementById('btn-vaciar').disabled = !quieta || lugar === 'probeta' || muestraEnTubo() || agua <= 0;

    // Pasos
    const lista = document.getElementById('lista-pasos');
    lista.innerHTML = '';
    PASOS.forEach((txt, i) => {
        const li = document.createElement('li');
        const n = i + 1;
        const estado = n < paso ? 'hecho' : n === paso ? 'ahora' : '';
        li.className = estado;
        if (estado === 'ahora') li.setAttribute('aria-current', 'step');
        const num = document.createElement('span');
        num.className = 'num';
        num.setAttribute('aria-hidden', 'true');
        num.textContent = estado === 'hecho' ? '✓' : String(n);
        li.appendChild(num);
        li.appendChild(document.createTextNode(i18n.t(txt) + (estado === 'hecho' ? ' ' : '')));
        if (estado === 'hecho') {
            const sr = document.createElement('span');
            sr.className = 'sr-only';
            sr.textContent = i18n.t('(hecho)');
            li.appendChild(sr);
        }
        lista.appendChild(li);
    });

    // Cuaderno: cada dato se puede escribir cuando llega su paso
    document.querySelectorAll('.dato').forEach(inp => {
        const id = inp.id.replace('dato-', '');
        const pasoDato = parseInt(inp.dataset.paso, 10);
        let activo = pasoDato <= paso && !correctos[id];
        if (id === 'm' && lugar !== 'balanza') activo = false;
        if (id === 'vf' && lugar !== 'probeta') activo = false;
        inp.disabled = !activo;
        inp.classList.toggle('bien', !!correctos[id]);
    });

    // Tabla
    document.querySelectorAll('.fila-material').forEach(b => {
        b.disabled = !(guiada && paso >= N_PASOS);
        const sel = b.dataset.id === eleccion;
        b.setAttribute('aria-checked', String(sel));
        b.classList.toggle('elegida', sel);
        b.classList.toggle('acierto', sel && terminado);
    });

    // Al cambiar de paso, se anuncia la nueva indicación
    if (guiada && paso !== ultimoPaso) {
        ultimoPaso = paso;
        if (paso <= N_PASOS) anunciar(i18n.t(INDICACIONES[paso - 1]));
    }
}

// Indicación fija de la franja superior cuando no hay ningún aviso reciente
function indicacion() {
    if (nivel === 'libre') return i18n.t('Sigue tu guión. Apunta en el papel todo lo que midas.');
    const paso = pasoActual();
    return paso <= N_PASOS ? i18n.t(INDICACIONES[paso - 1]) : i18n.t('Práctica terminada. Elige otra muestra para repetirla.');
}

// Aviso de lo que acaba de pasar: se ve en el lienzo y lo lee el lector de pantalla
function decir(txt, tipo) {
    mensaje = txt;
    mensajeTipo = tipo || '';
    mensajeT = millis();
    anunciar(txt);
}

function anunciar(txt) {
    const el = document.getElementById('anuncio');
    el.textContent = el.textContent === txt ? txt + ' ' : txt;
}

function rellenarMuestras() {
    const sel = document.getElementById('select-muestra');
    MUESTRAS.forEach(m => {
        const o = document.createElement('option');
        o.value = String(m.n);
        o.textContent = i18n.t('Muestra {n}', { n: m.n });
        sel.appendChild(o);
    });
}

function rellenarTabla() {
    const t = document.getElementById('tabla-densidades');
    const cab = document.createElement('div');
    cab.className = 'fila-cabecera';
    cab.setAttribute('aria-hidden', 'true');
    cab.innerHTML = `<span>${i18n.t('Material')}</span><span>${i18n.t('ρ (g/cm³)')}</span>`;
    t.appendChild(cab);
    const agua = document.createElement('div');
    agua.className = 'fila-referencia';
    agua.innerHTML = `<span>${i18n.t('Agua (referencia)')}</span><span>${i18n.num(1, 2)}</span>`;
    t.appendChild(agua);
    MATERIALES.forEach(m => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'fila-material';
        b.dataset.id = m.id;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', 'false');
        b.innerHTML = `<span>${i18n.t(m.nombre)}</span><span>${i18n.num(m.rho, 2)}</span>`;
        b.addEventListener('click', () => elegirMaterial(m.id));
        t.appendChild(b);
    });
}

function setupControles() {
    document.getElementById('nivel-guiada').addEventListener('click', () => setNivel('guiada'));
    document.getElementById('nivel-libre').addEventListener('click', () => setNivel('libre'));
    document.getElementById('select-muestra').addEventListener('change', e => elegirMuestra(parseInt(e.target.value, 10)));
    document.getElementById('btn-azar').addEventListener('click', () => {
        let n;
        do { n = 1 + Math.floor(Math.random() * MUESTRAS.length); } while (n === muestra.n);
        elegirMuestra(n);
    });
    document.getElementById('select-probeta').addEventListener('change', e => cambiarProbeta(parseInt(e.target.value, 10)));

    document.getElementById('btn-encender').addEventListener('click', pulsarOn);
    document.getElementById('btn-tarar').addEventListener('click', pulsarTara);
    document.getElementById('btn-agua').addEventListener('click', verterConTeclado);
    document.getElementById('btn-vaciar').addEventListener('click', vaciarProbeta);
    // El mensaje de error solo se cierra con su botón: el foco no sale de él
    document.getElementById('error-lab').addEventListener('keydown', e => {
        if (e.key === 'Tab') { e.preventDefault(); document.getElementById('error-reiniciar').focus(); }
    });
    document.getElementById('error-reiniciar').addEventListener('click', () => {
        reiniciar();
        document.querySelector('#canvas-container canvas').focus();
    });
    document.getElementById('btn-balanza').addEventListener('click', () => mover(lugar === 'balanza' ? 'bandeja' : 'balanza'));
    document.getElementById('btn-probeta').addEventListener('click', () => mover(lugar === 'probeta' ? 'bandeja' : 'probeta'));
    document.getElementById('btn-lupa').addEventListener('click', () => {
        llevarLupaAlAgua();
        decir(i18n.t('La lupa está sobre el agua. Muévela con las flechas si quieres ver otra parte de la escala.'));
        document.querySelector('#canvas-container canvas').focus();
    });
    document.getElementById('btn-describir').addEventListener('click', describirEscala);
    document.getElementById('btn-reiniciar').addEventListener('click', reiniciar);

    document.querySelectorAll('.dato').forEach(inp => {
        const id = inp.id.replace('dato-', '');
        inp.addEventListener('change', () => comprobarDato(id));
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); comprobarDato(id); } });
    });
}

// ============================================================
//  Dibujo
// ============================================================
function dibujarCuadricula() {
    stroke(TH.cuadricula);
    strokeWeight(0.6);
    for (let x = 0; x < width; x += 40) line(x, 0, x, MESA_Y);
    for (let y = 0; y < MESA_Y; y += 40) line(0, y, width, y);
    noStroke();
}

function dibujarMesa() {
    noStroke();
    fill(TH.mesaBorde);
    rect(0, MESA_Y, width, 16);
    fill(TH.mesa);
    rect(0, MESA_Y + 16, width, height - MESA_Y - 16);
}

function dibujarBandeja() {
    const x = BANDEJA.x - BANDEJA.ancho / 2;
    fill(TH.bandeja);
    stroke(TH.bandejaBorde);
    strokeWeight(1.2);
    rect(x, MESA_Y - 14, BANDEJA.ancho, 14, 3);
    rotulo([i18n.t('bandeja')], BANDEJA.x);
}

// Rótulo bajo un instrumento, en la mesa. En pantallas pequeñas crece y no se sale del lienzo.
function rotulo(lineas, x) {
    noStroke();
    fill(TH.textoTenue);
    const t = tamTexto(13);
    textSize(t);
    textAlign(CENTER, TOP);
    lineas.forEach((l, i) => {
        const medio = textWidth(l) / 2 + 6;
        text(l, constrain(x, medio, CV_W - medio), MESA_Y + 22 + i * t * 1.25);
    });
}

function dibujarBalanza() {
    const x0 = BALANZA.x - BALANZA.ancho / 2;
    // Cuerpo
    stroke(TH.balanzaBorde);
    strokeWeight(1.2);
    fill(TH.balanza);
    quad(x0, MESA_Y, x0 + 14, MESA_Y - 80, x0 + BALANZA.ancho - 14, MESA_Y - 80, x0 + BALANZA.ancho, MESA_Y);
    // Columna y plato
    fill(TH.balanzaPlato);
    rect(BALANZA.x - 12, BALANZA.platoY + 8, 24, MESA_Y - 80 - BALANZA.platoY - 8);
    rect(BALANZA.x - 75, BALANZA.platoY, 150, 9, 2);
    // Pantalla
    const px = x0 + 30, py = MESA_Y - 62;
    fill(TH.pantalla);
    stroke(TH.balanzaBorde);
    rect(px, py, 116, 40, 4);
    noStroke();
    if (balanzaEncendida) {
        fill(TH.pantallaTexto);
        textSize(26);
        textStyle(BOLD);
        textAlign(RIGHT, CENTER);
        text(lecturaBalanzaTexto(), px + 106, py + 21);
        textStyle(NORMAL);
    }
    fill(TH.balanzaRotulo);
    textSize(15);
    textStyle(BOLD);
    textAlign(LEFT, CENTER);
    text('g', px + 124, py + 21);
    textStyle(NORMAL);
    // Botones de la balanza (se pulsan con el ratón o el dedo)
    const on = BOTON_ON, ta = BOTON_TARA;
    stroke(TH.balanzaBorde);
    strokeWeight(1.2);
    fill(balanzaEncendida ? TH.ledOn : TH.ledOff);
    circle(on.x, on.y, 2 * on.r);
    fill(TH.botonTara);
    circle(ta.x, ta.y, 2 * ta.r);
    noStroke();
    fill(TH.balanzaRotulo);
    textSize(9);
    textStyle(BOLD);
    textAlign(CENTER, TOP);
    text('ON', on.x, on.y + on.r + 3);
    text(i18n.t('TARA'), ta.x, ta.y + ta.r + 3);
    textStyle(NORMAL);
    rotulo([i18n.t('balanza electrónica'), i18n.t('precisión 0,1 g')], BALANZA.x);
}

function dibujarProbeta() {
    const p = PROBETAS[capProbeta];
    const w = p.ancho;
    const x0 = PROBETA.x - w / 2, x1 = PROBETA.x + w / 2;

    // Pie
    noStroke();
    fill(TH.vidrioPie);
    rect(PROBETA.x - w / 2 - 26, MESA_Y - 14, w + 52, 14, 3);

    // Interior
    fill(TH.vidrioFondo);
    rect(x0, PROBETA.borde, w, PROBETA.fondo - PROBETA.borde);

    // Muestra sumergida (detrás del agua)
    if (muestraEnTubo()) dibujarMuestra(pos.x, pos.y);

    // Agua
    const yAgua = yDeMl(nivelMostrado);
    fill(TH.agua);
    rect(x0 + 1, yAgua, w - 2, PROBETA.fondo - yAgua);
    noFill();
    stroke(TH.aguaBorde);
    strokeWeight(1.6);
    bezier(x0 + 1, yAgua - 3, x0 + w * 0.3, yAgua + 1.5, x1 - w * 0.3, yAgua + 1.5, x1 - 1, yAgua - 3);

    // Rayas
    const nDiv = Math.round(p.cap / p.div);
    for (let i = 1; i <= nDiv; i++) {
        const ml = i * p.div;
        const y = yDeMl(ml);
        const etiqueta = ml % p.etiqueta === 0;
        const medio = ml % p.medio === 0;
        stroke(TH.raya);
        strokeWeight(etiqueta ? 1.3 : 0.8);
        line(x0, y, x0 + (etiqueta ? w * 0.5 : medio ? w * 0.36 : w * 0.2), y);
        // Los números van impresos en el vidrio, junto a la raya larga (así se ven en la lupa)
        if (etiqueta) {
            noStroke();
            fill(TH.raya);
            textSize(9);
            textAlign(LEFT, CENTER);
            text(String(ml), x0 + w * 0.5 + 2, y);
        }
    }
    noStroke();
    fill(TH.raya);
    textSize(9);
    textAlign(LEFT, CENTER);
    text('mL', x0 + w * 0.5 + 2, PROBETA.tope - 18);

    // Vidrio
    noFill();
    stroke(TH.vidrio);
    strokeWeight(2.2);
    line(x0, PROBETA.borde, x0, PROBETA.fondo);
    line(x1, PROBETA.borde, x1, PROBETA.fondo);
    line(x0, PROBETA.fondo, x1, PROBETA.fondo);
    line(x0 - 6, PROBETA.borde, x1 + 6, PROBETA.borde);
    line(x0 - 6, PROBETA.borde, x0, PROBETA.borde + 4);
    line(x1 + 6, PROBETA.borde, x1, PROBETA.borde + 4);
    // Brillo
    stroke(TH.brillo);
    strokeWeight(3);
    line(x0 + 5, PROBETA.borde + 12, x0 + 5, PROBETA.fondo - 10);
    noStroke();

    rotulo([i18n.t('probeta de {c} mL', { c: p.cap }), i18n.t('división de {d} mL', { d: p.div })], PROBETA.x);
}

// Frasco lavador: se aprieta (se arrastra) con el pico sobre la boca de la probeta
function dibujarFrasco() {
    const { x, y } = frascoPos;
    const tx = x + PICO.x, ty = y + PICO.y;
    // Chorro
    if (vertiendo || porVerter > 0) {
        stroke(TH.aguaBorde);
        strokeWeight(2.4);
        line(tx, ty + 2, tx, yDeMl(nivelMostrado));
    }
    // Tubo y pico
    noFill();
    stroke(TH.frascoTubo);
    strokeWeight(3);
    beginShape();
    vertex(x, y - 104);
    vertex(x, y - 118);
    bezierVertex(x, y - 128, x - 8, y - 134, x - 18, y - 134);
    vertex(x - 48, y - 134);
    vertex(tx, ty);
    endShape();
    // Tapón
    noStroke();
    fill(TH.frascoTapon);
    rect(x - 9, y - 106, 18, 14, 2);
    // Cuerpo con agua
    stroke(TH.frascoBorde);
    strokeWeight(1.4);
    fill(TH.frasco);
    rect(x - 22, y - 92, 44, 92, 9);
    noStroke();
    fill(TH.agua);
    rect(x - 20, y - 56, 40, 54, 0, 0, 7, 7);
    rotulo([i18n.t('frasco'), i18n.t('lavador')], FRASCO_REPOSO.x);
}

function dibujarCharcos() {
    noStroke();
    fill(TH.agua);
    charcos.forEach(c => ellipse(c.x, MESA_Y + 1, c.w, 4));
}

function dibujarGotas() {
    noStroke();
    fill(TH.aguaBorde);
    gotas.forEach(g => circle(g.x, g.y, 3.8));
}

function colorMuestra() {
    const t = muestra.tinte;
    switch (muestra.mat.aspecto) {
        case 'plastico-claro': return { base: [226 + t / 3, 220 + t / 3, 204], borde: [150, 144, 128], brillo: 90 };
        case 'plastico-gris':  return { base: [112 + t, 118 + t, 128 + t], borde: [70, 74, 82], brillo: 40 };
        case 'vidrio':         return { base: [150, 205 + t / 2, 195], borde: [90, 140, 132], brillo: 160, alfa: 175 };
        case 'dorado':         return { base: [204 + t / 2, 168 + t / 2, 88], borde: [130, 100, 40], brillo: 150 };
        case 'cobrizo':        return { base: [192 + t / 2, 110, 70], borde: [120, 62, 34], brillo: 130 };
        default:               return { base: [172 + t, 178 + t, 190 + t], borde: [96, 102, 114], brillo: 170 };
    }
}

function dibujarMuestra(cx, cy) {
    const { w, h } = tamano;
    const c = colorMuestra();
    // Sombra (solo sobre la mesa o el plato)
    noStroke();
    // Cuerpo
    fill(c.base[0], c.base[1], c.base[2], c.alfa || 255);
    stroke(TH.contraste ? TH.contornoMuestra : color(...c.borde));
    strokeWeight(TH.contraste ? 2 : 1.2);
    beginShape();
    forma.forEach(([fx, fy]) => vertex(cx + fx * w, cy + fy * h));
    endShape(CLOSE);
    // Sombreado inferior
    noStroke();
    fill(0, 0, 0, 40);
    beginShape();
    forma.forEach(([fx, fy]) => { if (fy > -0.05) vertex(cx + fx * w * 0.92, cy + fy * h * 0.92); });
    endShape(CLOSE);
    // Brillo
    stroke(255, 255, 255, c.brillo);
    strokeWeight(1.6);
    noFill();
    line(cx - w * 0.22, cy - h * 0.22, cx - w * 0.05, cy - h * 0.34);
    line(cx - w * 0.26, cy - h * 0.08, cx - w * 0.24, cy + h * 0.12);
    noStroke();
    // Mojada: gotas de agua pegadas
    if (mojada && !muestraEnTubo()) {
        fill(TH.aguaBorde);
        circle(cx + w * 0.18, cy + h * 0.1, 4);
        circle(cx - w * 0.1, cy + h * 0.32, 3.5);
        circle(cx + w * 0.05, cy - h * 0.2, 3);
        ellipse(cx + w * 0.02, cy + h * 0.5 + 3, 3, 5);
    }
}

function radioLupa() {
    return escala < 0.62 ? 115 : 82;     // en pantallas pequeñas, más grande
}

// Donde espera la lupa hasta que se arrastra: a la derecha, sin tapar la probeta ni el frasco
function lupaReposo() {
    return escala < 0.62 ? { x: 772, y: 262 } : { x: 770, y: 270 };
}

// Lupa de verdad: amplía lo que tiene debajo. Se lleva a la probeta para leer el menisco.
function dibujarLupa() {
    const { x, y } = lupaPos;
    const r = radioLupa();

    // Mango
    stroke(TH.mango);
    strokeWeight(12);
    strokeCap(ROUND);
    line(x + r * 0.72, y + r * 0.72, x + r * 1.25, y + r * 1.25);
    strokeCap(SQUARE);

    // Interior: la escena ampliada alrededor del centro de la lupa
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.arc(x, y, r, 0, TWO_PI);
    drawingContext.clip();
    noStroke();
    fill(TH.fondo);
    rect(x - r, y - r, 2 * r, 2 * r);
    push();
    translate(x, y);
    scale(LUPA_AUMENTO);
    translate(-x, -y);
    dibujarEscena();
    pop();
    // Línea de los ojos: se pone sobre la parte baja del menisco para leer
    stroke(TH.ojos);
    strokeWeight(1.3);
    drawingContext.setLineDash([5, 4]);
    line(x - r, y, x + r, y);
    drawingContext.setLineDash([]);
    drawingContext.restore();

    // Aro
    noFill();
    stroke(TH.acento);
    strokeWeight(3);
    circle(x, y, 2 * r);
    // Ojo a la altura de la línea
    stroke(TH.ojos);
    strokeWeight(1.6);
    const ex = x - r - 18;
    bezier(ex - 10, y, ex - 4, y - 7, ex + 4, y - 7, ex + 10, y);
    bezier(ex - 10, y, ex - 4, y + 7, ex + 4, y + 7, ex + 10, y);
    noStroke();
    fill(TH.ojos);
    circle(ex, y, 6);
}

function llevarLupaAlAgua() {
    lupaPos = { x: PROBETA.x, y: yDeMl(nivelObjetivo()) };
}

function dibujarRotulos() {
    noStroke();
    fill(TH.texto);
    textSize(tamTexto(15));
    textAlign(LEFT, TOP);
    const duracion = mensajeTipo === 'aviso' ? DURACION_AVISO * 2 : DURACION_AVISO;
    const aviso = millis() - mensajeT < duracion && !mov && !arrastre;
    if (aviso && mensajeTipo === 'aviso') fill(TH.aviso);
    text(aviso ? mensaje : indicacion(), 20, 16, width - 40, 80);
    fill(TH.acento);
    textSize(tamTexto(13));
    const p = PROBETAS[capProbeta];
    const yInfo = 16 + tamTexto(15) * 2.6;
    text(i18n.t('Muestra {n} · probeta de {c} mL', { n: muestra.n, c: p.cap }), 20, yInfo);
    if (derramado && lugar === 'probeta') {
        fill(TH.aviso);
        text(i18n.t('Se ha derramado agua'), 20, yInfo + tamTexto(13) * 1.5);
    }
}

// En pantallas pequeñas el lienzo se encoge: los textos crecen para seguir leyéndose
function tamTexto(base) {
    return constrain(base * 0.62 / escala, base, base * 1.9);
}

// ═══════════════════════════════════════════════════════════════════
//  RATÓN, DEDO Y TECLADO
// ═══════════════════════════════════════════════════════════════════

// Punto del lienzo bajo el puntero (el lienzo está escalado con CSS)
function puntoLienzo(e, cv) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * CV_W / r.width, y: (e.clientY - r.top) * CV_H / r.height };
}

function sobreMuestra(q) {
    const m = 6;
    return Math.abs(q.x - pos.x) < tamano.w / 2 + m && Math.abs(q.y - pos.y) < tamano.h / 2 + m;
}

function sobreLupa(q) {
    const r = radioLupa();
    const enAro = dist(q.x, q.y, lupaPos.x, lupaPos.y) < r;
    // El mango también sirve para cogerla
    const t = ((q.x - lupaPos.x) + (q.y - lupaPos.y)) / 2;
    const enMango = t > r * 0.6 && t < r * 1.35 && Math.abs((q.x - lupaPos.x) - (q.y - lupaPos.y)) < 18;
    return enAro || enMango;
}

// Los botones de la balanza son pequeños: en pantallas pequeñas la zona que responde
// al dedo crece, y si toca a los dos gana el más cercano
function sobreBoton(q, b) {
    const alcance = Math.max(b.r + 8, 20 / escala);
    const otro = b === BOTON_ON ? BOTON_TARA : BOTON_ON;
    const d = dist(q.x, q.y, b.x, b.y);
    return d < alcance && d <= dist(q.x, q.y, otro.x, otro.y);
}

function sobreFrasco(q) {
    const { x, y } = frascoPos;
    const enCuerpo = q.x > x - 26 && q.x < x + 26 && q.y > y - 108 && q.y < y + 2;
    const enPico = q.x > x + PICO.x - 6 && q.x < x + 4 && q.y > y + PICO.y - 14 && q.y < y - 100;
    return enCuerpo || enPico;
}

function setupPuntero(cv) {
    cv.style.touchAction = 'none';

    cv.addEventListener('pointerdown', (e) => {
        if (bloqueado) return;
        const q = puntoLienzo(e, cv);
        if (sobreBoton(q, BOTON_ON)) { pulsarOn(); return; }
        if (sobreBoton(q, BOTON_TARA)) { pulsarTara(); return; }
        if (mov) return;
        // La lupa va por encima de todo: se coge primero
        if (sobreLupa(q)) {
            // Con el dedo se coge por el mango, para que el dedo no tape lo que se amplía
            const r = radioLupa();
            arrastre = e.pointerType === 'touch'
                ? { que: 'lupa', dx: -r * 1.05, dy: -r * 1.05 }
                : { que: 'lupa', dx: lupaPos.x - q.x, dy: lupaPos.y - q.y };
            lupaPos.x = constrain(q.x + arrastre.dx, 0, CV_W);
            lupaPos.y = constrain(q.y + arrastre.dy, 0, MESA_Y);
        } else if (sobreMuestra(q)) {
            arrastre = { que: 'muestra', dx: pos.x - q.x, dy: pos.y - q.y, origen: lugar, enTubo: muestraEnTubo() };
            lugar = 'mano';
            actualizarInterfaz();
        } else if (porVerter === 0 && sobreFrasco(q)) {
            arrastre = { que: 'frasco', dx: frascoPos.x - q.x, dy: frascoPos.y - q.y, vertido: false };
        } else {
            return;
        }
        cv.setPointerCapture(e.pointerId);
        e.preventDefault();
    });

    cv.addEventListener('pointermove', (e) => {
        if (!arrastre) return;
        const q = puntoLienzo(e, cv);
        if (arrastre.que === 'lupa') {
            lupaPos.x = constrain(q.x + arrastre.dx, 0, CV_W);
            lupaPos.y = constrain(q.y + arrastre.dy, 0, MESA_Y);
        } else if (arrastre.que === 'frasco') {
            frascoPos = limitarFrasco(q.x + arrastre.dx, q.y + arrastre.dy);
        } else {
            moverMuestraA(q.x + arrastre.dx, q.y + arrastre.dy);
        }
    });

    const terminar = () => {
        if (!arrastre) return;
        const a = arrastre;
        arrastre = null;
        if (a.que === 'muestra') soltar(destinoAlSoltar(), a.origen);
        if (a.que === 'frasco') {
            vertiendo = false;
            if (a.vertido) alTerminarDeVerter();
            else avisoVertido = '';
        }
    };
    cv.addEventListener('pointerup', terminar);
    cv.addEventListener('pointercancel', terminar);

    // Flechas: mueven la lupa (Mayús para ir más deprisa)
    cv.addEventListener('keydown', (e) => {
        if (bloqueado) return;
        const paso = e.shiftKey ? 20 : 4;
        const d = { ArrowUp: [0, -paso], ArrowDown: [0, paso], ArrowLeft: [-paso, 0], ArrowRight: [paso, 0] }[e.key];
        if (!d) return;
        e.preventDefault();
        lupaPos.x = constrain(lupaPos.x + d[0], 0, CV_W);
        lupaPos.y = constrain(lupaPos.y + d[1], 0, MESA_Y);
    });
}

// La muestra en la mano no atraviesa la mesa, la balanza ni el vidrio de la probeta.
// Por la boca de la probeta entra si va centrada y cabe, y dentro solo sube y baja.
function moverMuestraA(x, y) {
    const { w, h } = tamano;
    const p = PROBETAS[capProbeta];
    x = constrain(x, w / 2, CV_W - w / 2);
    y = constrain(y, h / 2, MESA_Y - h / 2);
    if (muestraEnTubo()) {
        if (y + h / 2 > PROBETA.borde) x = PROBETA.x;
    } else if (Math.abs(x - PROBETA.x) < p.ancho / 2 + w / 2 + 4 && y + h / 2 > PROBETA.borde) {
        const entra = Math.abs(x - PROBETA.x) < p.ancho / 2 && cabeEnProbeta()
            && pos.y + h / 2 <= PROBETA.borde + 2
            && (nivel !== 'guiada' || pasoActual() === 5 || arrastre.origen === 'probeta');
        if (entra) x = PROBETA.x;
        else y = PROBETA.borde - h / 2;
    }
    if (x === PROBETA.x && y + h / 2 > PROBETA.borde) y = Math.min(y, PROBETA.fondo - h / 2 - 1);
    if (Math.abs(x - BALANZA.x) < BALANZA.ancho / 2 + w / 2 && y + h / 2 > BALANZA.platoY) {
        y = BALANZA.platoY - h / 2;
    }
    pos.x = x;
    pos.y = y;
}

function destinoAlSoltar() {
    const p = PROBETAS[capProbeta];
    if (muestraEnTubo()) return 'probeta';
    if (Math.abs(pos.x - PROBETA.x) < p.ancho / 2 + 26 && pos.y < PROBETA.borde + 10) return 'probeta';
    if (Math.abs(pos.x - BALANZA.x) < 95 && pos.y + tamano.h / 2 > BALANZA.platoY - 90) return 'balanza';
    if (Math.abs(pos.x - BANDEJA.x) < BANDEJA.ancho / 2 + 20 && pos.y + tamano.h / 2 > MESA_Y - 120) return 'bandeja';
    return 'fuera';
}

function actualizarCursor() {
    const cv = document.querySelector('#canvas-container canvas');
    if (!cv) return;
    let c = 'default';
    if (arrastre) c = 'grabbing';
    else {
        const q = { x: mouseX, y: mouseY };
        if (sobreBoton(q, BOTON_ON) || sobreBoton(q, BOTON_TARA)) c = 'pointer';
        else if (sobreLupa(q) || (!mov && sobreMuestra(q)) || sobreFrasco(q)) c = 'grab';
    }
    if (cv.style.cursor !== c) cv.style.cursor = c;
}

// ═══════════════════════════════════════════════════════════════════
//  TAMAÑO DEL CANVAS
// ═══════════════════════════════════════════════════════════════════

// Ajusta el canvas al hueco disponible sin deformarlo (proporción 3:2).
// En pantallas estrechas el panel va debajo y el canvas ocupa todo el ancho.
function fitCanvas() {
    const cont = document.getElementById('canvas-container');
    const cv = cont.querySelector('canvas');
    if (!cv) return;
    const cs = getComputedStyle(cont);
    const w = cont.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const apilado = window.matchMedia('(max-width: 1100px)').matches;
    const h = apilado ? Infinity : cont.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const s = Math.max(0.1, Math.min(w / CV_W, h / CV_H));
    escala = s;
    cv.style.width  = Math.floor(CV_W * s) + 'px';
    cv.style.height = Math.floor(CV_H * s) + 'px';
}

function windowResized() { fitCanvas(); }

// ═══════════════════════════════════════════════════════════════════
//  TEMAS (oscuro · claro · alto contraste)
// ═══════════════════════════════════════════════════════════════════
const CLAVE_TEMA = 'sim-practica-densidad-tema';

function setupThemeSelector() {
    const themeBtn   = document.getElementById('theme-btn');
    const themePanel = document.getElementById('theme-panel');
    const themeOpts  = document.querySelectorAll('.theme-opt');

    const closePanel = () => {
        themePanel.classList.remove('open');
        themePanel.setAttribute('aria-hidden', 'true');
        themeBtn.classList.remove('active');
        themeBtn.setAttribute('aria-expanded', 'false');
    };

    const aplicar = (theme) => {
        document.body.classList.remove('theme-light', 'theme-contrast');
        if (theme !== 'dark') document.body.classList.add('theme-' + theme);
        themeOpts.forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
    };

    themeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = themePanel.classList.toggle('open');
        themeBtn.classList.toggle('active', isOpen);
        themeBtn.setAttribute('aria-expanded', String(isOpen));
        themePanel.setAttribute('aria-hidden', String(!isOpen));
    });

    document.addEventListener('click', (e) => {
        if (!themeBtn.contains(e.target) && !themePanel.contains(e.target)) closePanel();
    });

    themeOpts.forEach(btn => {
        btn.addEventListener('click', () => {
            aplicar(btn.dataset.theme);
            try { localStorage.setItem(CLAVE_TEMA, btn.dataset.theme); } catch (e) { /* sin almacenamiento */ }
            closePanel();
        });
    });

    try {
        const guardado = localStorage.getItem(CLAVE_TEMA);
        if (guardado === 'light' || guardado === 'contrast') aplicar(guardado);
    } catch (e) { /* sin almacenamiento */ }
}

function updateTheme() {
    const isLight    = document.body.classList.contains('theme-light');
    const isContrast = document.body.classList.contains('theme-contrast');

    if (isLight) {
        TH = {
            fondo: '#ccd6e8', cuadricula: '#bfcade', mesa: '#9aa6ba', mesaBorde: '#7d8aa0',
            texto: '#0d1520', textoTenue: '#3d4b66', acento: '#00628e', aviso: '#9a5a00', ojos: '#8a6000',
            bandeja: '#b4bfd2', bandejaBorde: '#7d8aa0',
            balanza: '#eef1f6', balanzaBorde: '#7d8aa0', balanzaPlato: '#c4cbd8', balanzaRotulo: '#3d4b66',
            pantalla: '#10241a', pantallaTexto: '#5ef0a8', ledOn: '#16a34a', ledOff: '#6b7280', botonTara: '#2563eb',
            vidrio: '#5a6a84', vidrioFondo: 'rgba(255,255,255,0.35)', vidrioPie: '#8d99ae', brillo: 'rgba(255,255,255,0.7)',
            agua: 'rgba(40,110,210,0.45)', aguaBorde: '#1d5fbf', raya: '#1a2236',
            contraste: false, mango: '#5a4632',
            frasco: 'rgba(255,255,255,0.55)', frascoBorde: '#7d8aa0', frascoTapon: '#d04040', frascoTubo: '#5a6a84',
        };
    } else if (isContrast) {
        TH = {
            fondo: '#000000', cuadricula: '#141414', mesa: '#1a1a1a', mesaBorde: '#ffff00',
            texto: '#ffffff', textoTenue: '#ffffff', acento: '#00ffff', aviso: '#ffaa00', ojos: '#ffff00',
            bandeja: '#000000', bandejaBorde: '#ffffff',
            balanza: '#000000', balanzaBorde: '#ffffff', balanzaPlato: '#444444', balanzaRotulo: '#ffffff',
            pantalla: '#000000', pantallaTexto: '#00ff88', ledOn: '#00ff88', ledOff: '#666666', botonTara: '#00ffff',
            vidrio: '#ffffff', vidrioFondo: 'rgba(255,255,255,0.06)', vidrioPie: '#666666', brillo: 'rgba(255,255,255,0.35)',
            agua: 'rgba(80,170,255,0.55)', aguaBorde: '#66ccff', raya: '#ffffff',
            contraste: true, contornoMuestra: '#ffff00', mango: '#ffffff',
            frasco: '#000000', frascoBorde: '#ffffff', frascoTapon: '#ff4444', frascoTubo: '#ffffff',
        };
    } else {
        TH = {
            fondo: '#0e1014', cuadricula: '#171b22', mesa: '#161b26', mesaBorde: '#2b3343',
            texto: '#d8dee8', textoTenue: '#8d9ab3', acento: '#00c8ff', aviso: '#f0a832', ojos: '#ffd24a',
            bandeja: '#232b3a', bandejaBorde: '#38445a',
            balanza: '#d6dbe4', balanzaBorde: '#8d95a5', balanzaPlato: '#b9c0cc', balanzaRotulo: '#2a3140',
            pantalla: '#0e1a14', pantallaTexto: '#5ef0a8', ledOn: '#34c782', ledOff: '#4b5563', botonTara: '#3b82f6',
            vidrio: '#c8d4e6', vidrioFondo: 'rgba(200,212,230,0.06)', vidrioPie: '#5b6578', brillo: 'rgba(255,255,255,0.18)',
            agua: 'rgba(55,130,215,0.50)', aguaBorde: '#7fb8ff', raya: '#e4ecf8',
            contraste: false, mango: '#3a2c20',
            frasco: 'rgba(220,230,245,0.16)', frascoBorde: '#a8b4c8', frascoTapon: '#d04848', frascoTubo: '#c8d4e6',
        };
    }
}
