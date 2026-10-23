'use strict';
// ============================================================
//  Densidad de un sólido — práctica de laboratorio simulada
//  Pesar una muestra desconocida, medir su volumen por inmersión
//  y buscar su densidad en una tabla.
// ============================================================

const CV_W = 900, CV_H = 600;

// ── Geometría de la mesa (coordenadas del lienzo) ──────────
const MESA_Y   = 520;                 // borde superior de la mesa
const BANDEJA  = { x: 120, ancho: 140 };
const BALANZA  = { x: 350, ancho: 220, platoY: MESA_Y - 96 };
const PROBETA  = { x: 615, fondo: MESA_Y - 16, tope: MESA_Y - 276, borde: MESA_Y - 310 };  // tope = raya de la capacidad
const BOTON_ON   = { x: 404, y: MESA_Y - 50, r: 9 };   // teclas de membrana de la balanza
const BOTON_TARA = { x: 435, y: MESA_Y - 50, r: 9 };
const TECLA = { w: 26, h: 18 };
const BOTON_VACIAR = { x: PROBETA.x, y: MESA_Y - 7 };   // en el pie de la probeta
const FRASCO_REPOSO = { x: 845, y: MESA_Y };   // base del frasco lavador
const PICO = { x: -60, y: -126 };              // punta del pico, respecto a la base del frasco
// Volumen dibujado: 1 mL de la probeta ocupa en el lienzo un cilindro de 48 px de
// diámetro y 2,6 px de alto. La muestra (de fondo, el 90 % de su ancho) llena
// en torno al 60 % de su caja, como una piedra irregular.
const PX3_POR_ML = Math.PI / 4 * 48 * 48 * 2.6;
const RELLENO = 0.6 * 0.9;
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
let muestraDef = MUESTRAS[Math.floor(Math.random() * MUESTRAS.length)];   // al azar, salvo ?muestra=N
let muestra = muestraDef;      // la de este intento: mismo material, masa y volumen al azar
let tinte = 0;
let capProbeta = 100;
let forma = [];                // polígono de la muestra (unidades relativas)
let tamano = { w: 40, h: 60 };

let lugar = 'bandeja';         // 'bandeja' | 'balanza' | 'probeta' | 'mano' | 'moviendo'
let mov = null;                // { ruta: [[x,y]…], t, destino }
let pos = { x: 0, y: 0 };      // centro de la muestra

let balanzaEncendida = false;
let balanzaT = 0;              // cuándo se encendió (la pantalla se enciende poco a poco)
let teclaPulsada = { cual: '', t: -1e9 };   // tecla del lienzo que se acaba de pulsar
let deriva = 0;                // lo que marca la balanza vacía antes de tarar
let tara = 0;
let taradaVacia = false;

let agua = 0;                  // mL de agua en la probeta (baja si se derrama)
let nivelMostrado = 0;         // mL que marca el agua (se anima)
let derramado = false;
let rebose = null;             // { t }: el agua se sale por arriba y baja por fuera del vidrio
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
let encima = null;             // lo que se puede coger y está bajo el ratón
let punteroTipo = 'mouse';     // 'mouse' | 'touch' | 'pen': con el dedo no hay resalte al pasar por encima
let pulso = null;              // { obj, t }: el objeto del paso parpadea dos veces (nivel guiado)
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
    setNivel(nivel);
}

function draw() {
    updateTheme();
    avanzarMovimiento();
    avanzarFrasco();
    avanzarAgua();
    avanzarGotas();
    vigilarRebose();
    if (volumenSumergido() > 0.01) mojada = true;
    if (errorPendiente && millis() > errorPendiente.t) {
        const tipo = errorPendiente.tipo;
        errorPendiente = null;
        mostrarError(tipo);
    }

    encima = objetoBajoPuntero();
    background(TH.fondo);
    dibujarEscena();
    dibujarResaltes();
    dibujarRotulos();
    dibujarLupa();
    actualizarCursor();
}

function dibujarEscena() {
    dibujarPared();
    dibujarMesa();
    dibujarBandeja();
    dibujarBalanza();
    dibujarCharcos();
    dibujarProbeta();
    dibujarFrasco();
    if (tumbada()) {
        // En la bandeja descansa tumbada; al cogerla se pone vertical
        const c = centroTumbada();
        push();
        translate(c.x, c.y);
        rotate(HALF_PI);
        dibujarMuestra(0, 0, HALF_PI);
        pop();
    } else if (!muestraEnTubo()) {
        dibujarMuestra(pos.x, pos.y);
    }
    dibujarGoteo();
    dibujarGotas();
}

// La muestra está quieta en la bandeja: se dibuja tumbada
function tumbada() {
    return lugar === 'bandeja' && !mov;
}

function centroTumbada() {
    return { x: BANDEJA.x, y: MESA_Y - 14 - tamano.w / 2 };
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
    if (n >= 1 && n <= MUESTRAS.length) muestraDef = MUESTRAS[n - 1];
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
    muestraDef = MUESTRAS[n - 1];
    document.getElementById('select-muestra').value = String(n);
    const rnd = aleatorioConSemilla(n * 7 + 3);
    forma = [];
    const lados = 9 + Math.floor(rnd() * 3);
    for (let i = 0; i < lados; i++) {
        const a = (i / lados) * TWO_PI + (rnd() - 0.5) * 0.35;
        const r = 0.80 + rnd() * 0.22;
        forma.push([Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5]);
    }
    tinte = Math.round((rnd() - 0.5) * 26);
    reiniciar();
}

// Cada vez que se empieza, la muestra conserva su material (su densidad) pero sale
// con otro volumen, y su masa es ρ·V. Así, repitiendo con la misma muestra se ve
// que la masa cambia y la densidad no.
//   · Hierro y cobre, de 17,5 a 25 cm³; los demás, desde 11 cm³. Con eso, en el nivel
//     guiado ninguna lectura que se da por buena lleva a otro material.
//   · El ancho crece con la raíz cúbica del volumen y no pasa del que cabe en su
//     probeta (las estrechas siguen cabiendo en la de 50 mL).
function tamanoAlAzar(def) {
    const limite = def.ancho < 30 ? 29.9 : 41.5;
    const minimo = ['hierro', 'cobre'].includes(def.mat.id) ? 17.5 : 11;
    const maximo = Math.min(25, def.vol * Math.pow(limite / def.ancho, 3));
    const vol = Math.floor((minimo + Math.random() * (maximo - minimo)) * 10) / 10;   // hacia abajo: nunca pasa del máximo
    const ancho = def.ancho * Math.cbrt(vol / def.vol);
    return { ...def, vol, ancho, masa: Math.round(def.mat.rho * vol * 10) / 10, tinte };
}

function reiniciar() {
    muestra = tamanoAlAzar(muestraDef);
    // A escala: el alto sale del volumen, así se ve tan grande como el agua que desplaza
    tamano = { w: muestra.ancho, h: muestra.vol * PX3_POR_ML / (RELLENO * muestra.ancho * muestra.ancho) };
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
    rebose = null;
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
    if (destino === 'probeta' && agua <= 0) {
        decir(i18n.t('La probeta está vacía: primero hay que echarle agua con el frasco lavador.'));
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
    if (destino === 'probeta' && agua <= 0 && origen !== 'probeta') {
        decir(i18n.t('La probeta está vacía: primero hay que echarle agua con el frasco lavador.'));
        destino = origen === 'mano' ? 'bandeja' : origen;
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
        const maximo = capacidadMax();
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
            derramar();
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
    return Math.min(agua + volumenSumergido(), capacidadMax());
}

// Lo que trepa el menisco por el vidrio (px)
function subeMenisco() {
    return 3 + PROBETAS[capProbeta].ancho * 0.04;
}

// mL con los que el agua, menisco incluido, llega al borde: un poco más se derrama
function capacidadMax() {
    const p = PROBETAS[capProbeta];
    const pxPorMl = (PROBETA.fondo - PROBETA.tope) / p.cap;
    return (PROBETA.fondo - PROBETA.borde - subeMenisco() - 1) / pxPorMl;
}

// En cuanto el agua llega al borde se derrama, también mientras baja o cae la muestra
function vigilarRebose() {
    if (derramado || agua <= 0) return;
    const sumergido = volumenSumergido();
    if (agua + sumergido > capacidadMax() + 1e-6) {
        agua = Math.max(0, capacidadMax() - sumergido);
        porVerter = 0;
        derramar();
    }
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
        if (sobre) arrastre.sobreBoca = true;
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
    const maximo = capacidadMax() - volumenSumergido();
    if (agua + ml > maximo) {
        if (agua < maximo) agua = maximo;
        porVerter = 0;
        if (!derramado) derramar();
        return;
    }
    agua += ml;
}

// El agua pasa del borde: se ve salir por arriba y bajar por fuera, y hay que empezar de nuevo
function derramar() {
    derramado = true;
    rebose = { t: millis() };
    decir(i18n.t('¡Se está saliendo el agua por arriba de la probeta!'), 'aviso');
    errorPendiente = { tipo: 'rebose', t: millis() + 2100 };
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
            decir(i18n.t('Hay demasiada agua: al meter la muestra, el agua pasaría de la última raya. Pulsa VACIAR, en el pie de la probeta, y vuelve a llenarla hasta unos 50 mL.'), 'aviso');
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
    porVerter += p.cap * 0.1;
}

function vaciarProbeta() {
    if (mov || arrastre || bloqueado) return;
    marcarTecla('vaciar');
    if (muestraEnTubo() || lugar === 'probeta') {
        decir(i18n.t('Antes de vaciar la probeta, saca la muestra.'));
        return;
    }
    if (agua <= 0) {
        decir(i18n.t('La probeta ya está vacía.'));
        return;
    }
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
    rebose: {
        titulo: 'Se ha derramado agua de la probeta',
        texto: 'El agua ha pasado del borde y se ha salido de la probeta. Con parte del agua fuera ya no se sabe cuánta agua hay dentro, así que las medidas de volumen no valen. Hay que volver a empezar: echa menos agua, de modo que al meter la muestra el agua no pase de la última raya, o usa una probeta más grande.',
    },
    mojada: {
        titulo: 'La muestra está mojada',
        texto: 'La muestra acaba de salir del agua y lleva agua pegada, que también pesa: la balanza marca más masa de la que tiene la muestra. La masa se mide con la muestra seca, antes de meterla en la probeta. Hay que volver a empezar la práctica desde el principio.',
    },
};

// Viñeta de cada error (SVG en línea; los colores salen de practica.css)
const VINETAS = {
    caida: '<svg viewBox="0 0 160 100" width="160" height="100"><line class="v-mesa" x1="4" y1="92" x2="156" y2="92"/><rect class="v-vidrio-relleno" x="62" y="22" width="36" height="66"/><rect class="v-agua" x="63" y="52" width="34" height="36"/><polygon class="v-muestra" points="72,41 86,38 91,48 85,57 73,55 68,47"/><path class="v-vidrio" d="M56 22H104M62 22V88H98V22M52 92 58 86H102L108 92"/><path class="v-mov" d="M74 24V32M80 21V30M86 24V32"/><path class="v-gota" transform="translate(48 18) rotate(-40)" d="M0-5C3-1 3.5 3 0 3.5-3.5 3-3-1 0-5Z"/><path class="v-gota" transform="translate(112 14) rotate(40)" d="M0-5C3-1 3.5 3 0 3.5-3.5 3-3-1 0-5Z"/><path class="v-gota" transform="translate(36 36) rotate(-60)" d="M0-5C3-1 3.5 3 0 3.5-3.5 3-3-1 0-5Z"/><path class="v-gota" transform="translate(124 32) rotate(60)" d="M0-5C3-1 3.5 3 0 3.5-3.5 3-3-1 0-5Z"/><path class="v-gota" transform="translate(28 62) rotate(-100)" d="M0-5C3-1 3.5 3 0 3.5-3.5 3-3-1 0-5Z"/><path class="v-gota" transform="translate(132 58) rotate(100)" d="M0-5C3-1 3.5 3 0 3.5-3.5 3-3-1 0-5Z"/><ellipse class="v-agua" cx="38" cy="91" rx="12" ry="2.5"/><ellipse class="v-agua" cx="124" cy="91" rx="10" ry="2.5"/></svg>',
    rebose: '<svg viewBox="0 0 160 100" width="160" height="100"><line class="v-mesa" x1="4" y1="92" x2="156" y2="92"/><rect class="v-vidrio-relleno" x="62" y="14" width="36" height="74"/><rect class="v-agua" x="63" y="16" width="34" height="72"/><path class="v-agua" d="M58 15Q80 4 102 15Z"/><path class="v-chorro" d="M57 15C55 30 56 60 55 86M103 15C105 30 104 60 105 86"/><path class="v-vidrio" d="M56 14H104M62 14V88H98V14M52 92 58 86H102L108 92"/><path class="v-gota" transform="translate(55 80) rotate(0)" d="M0-5C3-1 3.5 3 0 3.5-3.5 3-3-1 0-5Z"/><path class="v-gota" transform="translate(105 74) rotate(0)" d="M0-5C3-1 3.5 3 0 3.5-3.5 3-3-1 0-5Z"/><ellipse class="v-agua" cx="40" cy="91" rx="16" ry="2.8"/><ellipse class="v-agua" cx="120" cy="91" rx="16" ry="2.8"/></svg>',
    mojada: '<svg viewBox="0 0 160 100" width="160" height="100"><line class="v-mesa" x1="4" y1="92" x2="156" y2="92"/><rect class="v-columna" x="74" y="50" width="12" height="9"/><path class="v-balanza" d="M26 90 36 58H124L134 90Z"/><rect class="v-pantalla" x="42" y="65" width="52" height="17" rx="2"/><text class="v-lectura" x="90" y="78" text-anchor="end">35,6</text><rect class="v-plato" x="44" y="46" width="72" height="5" rx="2.5"/><polygon class="v-muestra" points="64,45 68,24 82,17 96,24 97,40 86,46"/><ellipse class="v-agua" cx="81" cy="45.5" rx="24" ry="2.2"/><path class="v-gota" transform="translate(74 30) rotate(0)" d="M0-5C3-1 3.5 3 0 3.5-3.5 3-3-1 0-5Z"/><path class="v-gota" transform="translate(88 27) rotate(0)" d="M0-5C3-1 3.5 3 0 3.5-3.5 3-3-1 0-5Z"/><path class="v-gota" transform="translate(80 38) rotate(0)" d="M0-5C3-1 3.5 3 0 3.5-3.5 3-3-1 0-5Z"/><path class="v-gota" transform="translate(118 58) rotate(0)" d="M0-5C3-1 3.5 3 0 3.5-3.5 3-3-1 0-5Z"/><path class="v-gota" transform="translate(118 72) rotate(0)" d="M0-5C3-1 3.5 3 0 3.5-3.5 3-3-1 0-5Z"/></svg>',
};

function mostrarError(tipo) {
    const e = ERRORES[tipo];
    document.getElementById('error-vineta').innerHTML = VINETAS[tipo] || '';
    document.getElementById('error-titulo').textContent = i18n.t(e.titulo);
    document.getElementById('error-texto').textContent = i18n.t(e.texto);
    document.getElementById('error-lab').hidden = false;
    bloqueado = true;
    arrastre = null;
    document.querySelectorAll('.control-panel, .barra-lab, .botones-tactiles, #canvas-container').forEach(el => { el.inert = true; });
    document.getElementById('error-reiniciar').focus();
}

function ocultarError() {
    const caja = document.getElementById('error-lab');
    if (!caja || caja.hidden) return;
    caja.hidden = true;
    bloqueado = false;
    document.querySelectorAll('.control-panel, .barra-lab, .botones-tactiles, #canvas-container').forEach(el => { el.inert = false; });
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
    balanzaT = millis();
    tara = 0;
    taradaVacia = false;
    if (balanzaEncendida && lugar === 'balanza') {
        // Como las de verdad, al encenderse se pone a cero con lo que tenga en el plato
        tara = cargaBalanza() + deriva;
        decir(i18n.t('⚠ Has encendido la balanza con la muestra encima. Al encenderse, la balanza se pone a cero con lo que tiene en el plato: ahora marca 0,0 g aunque la muestra tiene masa. Quita la muestra, pon la balanza a cero con el plato vacío y vuelve a pesarla.'), 'aviso');
    } else {
        decir(balanzaEncendida
            ? i18n.t('Balanza encendida: marca {m} g sin nada encima. Pulsa TARA para ponerla a cero.', { m: lecturaBalanzaTexto() })
            : i18n.t('Balanza apagada.'));
    }
    actualizarInterfaz();
}

// Botón ON de la balanza (en el lienzo o con el teclado)
function pulsarOn() {
    if (bloqueado) return;
    marcarTecla('on');
    if (nivel === 'guiada' && balanzaEncendida) {
        decir(i18n.t('La balanza ya está encendida. No la apagues: la necesitas para pesar.'));
        return;
    }
    encender();
}

// Botón TARA: si no hace nada, dice por qué
function pulsarTara() {
    if (bloqueado) return;
    marcarTecla('tara');
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
    if (lugar === 'balanza') decir(i18n.t('⚠ Has tarado la balanza con la muestra encima: ahora marca 0,0 g aunque la muestra tiene masa. Quita la muestra, pulsa TARA con el plato vacío y vuelve a pesarla.'), 'aviso');
    else decir(i18n.t('Balanza tarada: marca 0,0 g.'));
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
        res.textContent = i18n.t('✓ {mat}. Práctica terminada. Tu densidad es {r} g/cm³ y la de la tabla, {t} g/cm³. Error relativo: |{r} − {t}| / {t} × 100 = {e} %. Pulsa «Empezar de nuevo» y repítela con la misma muestra: tendrá otra masa y otro volumen. ¿Te sale la misma densidad?', {
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
    elegirMuestra(muestraDef.n);
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
    // Tampoco se desactivan los de mover la muestra: si no toca, dicen por qué
    bBal.disabled = !quieta;
    bPro.disabled = !quieta;
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
        pulso = OBJETO_PASO[paso] ? { obj: OBJETO_PASO[paso], t: millis() } : null;
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
    document.getElementById('tactil-on').addEventListener('click', pulsarOn);
    document.getElementById('tactil-tara').addEventListener('click', pulsarTara);
    document.getElementById('tactil-vaciar').addEventListener('click', vaciarProbeta);
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
// Vista frontal pura (el ojo, a la altura de la mesa) y una sola luz, arriba a la izquierda.
// El cian marca lo que se puede coger y dónde se puede soltar.

// Pared lisa: sin cuadrícula ni azulejos, cuyas juntas se confundirían en la lupa con las rayas
function dibujarPared() {
    const ctx = drawingContext;
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, MESA_Y);
    g.addColorStop(0, TH.pared1);
    g.addColorStop(1, TH.pared2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CV_W, MESA_Y);
    if (TH.luzPared) {
        const r = ctx.createRadialGradient(300, 120, 20, 300, 120, 560);
        r.addColorStop(0, TH.luzPared);
        r.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = r;
        ctx.fillRect(0, 0, CV_W, MESA_Y);
    }
    ctx.restore();
}

function dibujarMesa() {
    noStroke();
    fill(TH.encimeraCanto);
    rect(0, MESA_Y, CV_W, 3);
    fill(TH.encimeraFrente);
    rect(0, MESA_Y + 3, CV_W, 15);
    fill(TH.mesa);
    rect(0, MESA_Y + 18, CV_W, CV_H - MESA_Y - 18);
    fill(TH.sombraCanto);
    rect(0, MESA_Y + 18, CV_W, 3);
}

// Sombra difusa donde un objeto toca la superficie
function sombraContacto(x, ancho, y = MESA_Y) {
    if (TH.contraste) return;
    noStroke();
    fill(TH.sombra);
    ellipse(x, y + 1, ancho, 7);
    ellipse(x, y + 1, ancho * 0.7, 4);
}

// Color del tema con otra opacidad (0-255)
function conAlfa(c, a) {
    const k = color(c);
    k.setAlpha(a);
    return k;
}

// Bandeja de pesada: plástico claro con el borde levantado y la etiqueta con el número
function dibujarBandeja() {
    const x = BANDEJA.x, a = BANDEJA.ancho, y = MESA_Y - 14;
    sombraContacto(x, a + 14);
    if (tumbada() && !TH.contraste) {
        fill(TH.sombra);
        ellipse(x, y + 1, tamano.h * 0.85, 4);
    }
    stroke(TH.bandejaBorde);
    strokeWeight(TH.contraste ? 2 : 1.2);
    fill(TH.bandeja);
    quad(x - a / 2, y, x + a / 2, y, x + a / 2 - 6, MESA_Y, x - a / 2 + 6, MESA_Y);
    noStroke();
    fill(TH.bandejaLuz);
    rect(x - a / 2 + 2, y + 1, a - 4, 2, 1);
    // Etiqueta de papel
    fill(TH.etiqueta);
    stroke(TH.etiquetaBorde);
    strokeWeight(0.8);
    rect(x - 21, y + 4, 42, 8.5, 1.5);
    noStroke();
    fill(TH.etiquetaTexto);
    textSize(7.5);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text(i18n.t('N.º {n}', { n: muestra.n }), x, y + 8.6);
    textStyle(NORMAL);
    rotulo([i18n.t('bandeja')], x);
}

// Rótulo bajo un instrumento: nombre y, debajo, el dato técnico más pequeño.
// En pantallas pequeñas crece y no se sale del lienzo.
function rotulo(lineas, x, nombres = 1) {
    noStroke();
    textAlign(CENTER, TOP);
    const t1 = tamTexto(13), t2 = tamTexto(11);
    let y = MESA_Y + 26;
    lineas.forEach((l, i) => {
        const esNombre = i < nombres;
        const t = esNombre ? t1 : t2;
        textSize(t);
        fill(esNombre ? TH.texto : TH.textoTenue);
        const medio = textWidth(l) / 2 + 6;
        text(l, constrain(x, medio, CV_W - medio), y);
        y += t * 1.25;
    });
}

// Tecla de membrana con el rótulo impreso
function tecla(cx, cy, w, h, txt, cual) {
    const pulsada = teclaPulsada.cual === cual && millis() - teclaPulsada.t < 160;
    const dy = pulsada ? 1 : 0;
    stroke(TH.teclaBorde);
    strokeWeight(TH.contraste ? 1.5 : 1);
    fill(pulsada ? TH.teclaPulsada : TH.tecla);
    rect(cx - w / 2, cy - h / 2 + dy, w, h, 4);
    if (!pulsada && !TH.contraste) {
        noStroke();
        fill(TH.teclaLuz);
        rect(cx - w / 2 + 2, cy - h / 2 + 1.5, w - 4, 1.5, 1);
    }
    noStroke();
    fill(TH.teclaTexto);
    textSize(8);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text(txt, cx, cy + 0.5 + dy);
    textStyle(NORMAL);
}

function marcarTecla(cual) {
    teclaPulsada = { cual, t: millis() };
}

// Dígitos de siete segmentos, como en la pantalla de la balanza de clase
const SEGMENTOS = {
    '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg',
    '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '−': 'g', '-': 'g',
};
const DIGITO = { w: 14, h: 26, t: 4, hueco: 4, coma: 7 };

function digito(x, y, segs) {
    const { w, h, t } = DIGITO;
    const g = 0.8, l = t / 2 + g;
    const R = {
        a: [x + l, y, w - 2 * l, t],
        g: [x + l, y + h / 2 - t / 2, w - 2 * l, t],
        d: [x + l, y + h - t, w - 2 * l, t],
        f: [x, y + l, t, h / 2 - l - g],
        b: [x + w - t, y + l, t, h / 2 - l - g],
        e: [x, y + h / 2 + g, t, h / 2 - l - g],
        c: [x + w - t, y + h / 2 + g, t, h / 2 - l - g],
    };
    for (const s of segs) rect(...R[s], 1.2);
}

// Cuatro cifras y la coma; la lectura se alinea a la derecha. Detrás, los segmentos
// apagados se ven muy tenues, como en un visor de verdad.
function dibujarLectura(xDer, y, encendido) {
    const { w, hueco, coma, h } = DIGITO;
    const xs = [];
    let x = xDer;
    for (let i = 0; i < 4; i++) {
        x -= w;
        xs.unshift(x);
        x -= i === 0 ? coma : hueco;
    }
    const xComa = xs[3] - coma / 2 - 0.5;
    noStroke();
    fill(TH.segFantasma);
    xs.forEach(xi => digito(xi, y, SEGMENTOS['8']));
    separador(xComa, y + h - 2);
    if (encendido <= 0) return;
    fill(conAlfa(TH.pantallaTexto, 255 * encendido));
    const txt = lecturaBalanzaTexto();
    const cifras = txt.replace(/[.,]/g, '').split('');
    // Las cifras se colocan desde la derecha: la última va tras la coma
    for (let i = 0; i < cifras.length && i < 4; i++) {
        const c = cifras[cifras.length - 1 - i];
        if (SEGMENTOS[c]) digito(xs[3 - i], y, SEGMENTOS[c]);
    }
    separador(xComa, y + h - 2);
}

// Separador decimal: coma (con su rabito) o punto, según el idioma
function separador(x, y) {
    circle(x, y, 4.5);
    if (i18n.num(0.5, 1).indexOf(',') >= 0) quad(x + 0.6, y, x + 2.2, y + 0.4, x - 0.6, y + 5.2, x - 1.8, y + 4.6);
}

function dibujarBalanza() {
    const x0 = BALANZA.x - BALANZA.ancho / 2, x1 = x0 + BALANZA.ancho;
    const yTop = MESA_Y - 80, yBase = MESA_Y - 4;
    const gruesa = TH.contraste ? 2 : 1.2;
    sombraContacto(BALANZA.x, BALANZA.ancho + 16);
    // Pies
    noStroke();
    fill(TH.pies);
    rect(x0 + 10, yBase, 20, 4, 0, 0, 2, 2);
    rect(x1 - 30, yBase, 20, 4, 0, 0, 2, 2);
    // Columna y plato redondo de acero, visto de canto
    fill(TH.balanzaColumna);
    rect(BALANZA.x - 8, BALANZA.platoY + 5, 16, yTop - BALANZA.platoY - 4);
    if (lugar === 'balanza' && !mov && !TH.contraste) {
        fill(TH.sombra);
        ellipse(BALANZA.x, BALANZA.platoY + 1, tamano.w * 0.9, 4);
    }
    stroke(TH.balanzaBorde);
    strokeWeight(gruesa);
    fill(TH.plato);
    rect(BALANZA.x - 75, BALANZA.platoY, 150, 6, 3);
    noStroke();
    fill(TH.platoLuz);
    rect(BALANZA.x - 66, BALANZA.platoY + 1.2, 96, 1.6, 1);
    // Carcasa: bisel de arriba con luz y canto de abajo en sombra
    stroke(TH.balanzaBorde);
    strokeWeight(gruesa);
    fill(TH.balanza);
    quad(x0, yBase, x0 + 14, yTop, x1 - 14, yTop, x1, yBase);
    noStroke();
    const lado = y => 14 * (yBase - y) / (yBase - yTop);    // entrada del lateral a la altura y
    fill(TH.balanzaLuz);
    quad(x0 + 14.6, yTop + 0.6, x1 - 14.6, yTop + 0.6, x1 - lado(yTop + 9), yTop + 9, x0 + lado(yTop + 9), yTop + 9);
    fill(TH.balanzaSombra);
    quad(x0 + lado(yBase - 7) + 0.6, yBase - 7, x1 - lado(yBase - 7) - 0.6, yBase - 7, x1 - 0.8, yBase - 0.6, x0 + 0.8, yBase - 0.6);
    // Pantalla con la unidad dentro
    const px = x0 + 30, py = MESA_Y - 62;
    stroke(TH.balanzaBorde);
    strokeWeight(gruesa);
    fill(TH.pantalla);
    rect(px, py, 116, 40, 4);
    const encendido = balanzaEncendida ? Math.min(1, (millis() - balanzaT) / 200) : 0;
    dibujarLectura(px + 94, py + 7, encendido);
    noStroke();
    fill(encendido > 0 ? conAlfa(TH.pantallaTexto, 80 + 175 * encendido) : TH.segFantasma);
    textSize(14);
    textStyle(BOLD);
    textAlign(LEFT, BASELINE);
    text('g', px + 100, py + 32);
    textStyle(NORMAL);
    // Piloto de encendido y teclas
    const on = BOTON_ON, ta = BOTON_TARA;
    if (balanzaEncendida && !TH.contraste) {
        fill(conAlfa(TH.ledOn, 70));
        circle(on.x, on.y - 16, 9);
    }
    fill(balanzaEncendida ? TH.ledOn : TH.ledOff);
    circle(on.x, on.y - 16, 4.5);
    tecla(on.x, on.y, TECLA.w, TECLA.h, 'ON', 'on');
    tecla(ta.x, ta.y, TECLA.w, TECLA.h, i18n.t('TARA'), 'tara');
    rotulo([i18n.t('balanza electrónica'), i18n.t('precisión 0,1 g')], BALANZA.x);
}

function dibujarProbeta() {
    const p = PROBETAS[capProbeta];
    const w = p.ancho;
    const x0 = PROBETA.x - w / 2, x1 = PROBETA.x + w / 2;

    // Pie hexagonal de vidrio, visto de frente, con la tecla para vaciarla
    sombraContacto(PROBETA.x, w + 66);
    const yp = MESA_Y - 14;
    stroke(TH.vidrio);
    strokeWeight(TH.contraste ? 2 : 1.4);
    fill(TH.vidrioPie);
    quad(x0 - 18, yp, x1 + 18, yp, x1 + 28, MESA_Y, x0 - 28, MESA_Y);
    stroke(TH.vidrioArista);
    strokeWeight(1);
    line(x0 - 4, yp, x0 - 8, MESA_Y);
    line(x1 + 4, yp, x1 + 8, MESA_Y);
    tecla(BOTON_VACIAR.x, BOTON_VACIAR.y, 52, 11, i18n.t('VACIAR'), 'vaciar');

    // Interior
    noStroke();
    fill(TH.vidrioFondo);
    rect(x0, PROBETA.borde, w, PROBETA.fondo - PROBETA.borde);

    // Muestra sumergida (detrás del agua)
    if (muestraEnTubo()) dibujarMuestra(pos.x, pos.y);

    // Agua con su menisco: junto al vidrio el agua sube por la pared y en el centro queda
    // plana. La parte baja del menisco, la que se lee, está justo en yAgua.
    const yAgua = yDeMl(nivelMostrado);
    if (nivelMostrado > 0.05) {
        const sube = Math.min(subeMenisco(), PROBETA.fondo - yAgua + 2);   // lo que trepa por el vidrio
        const curva = w * 0.34;                                            // ancho de la zona curvada
        const a = x0 + 1, b = x1 - 1;
        const menisco = (dy = 0) => {
            vertex(a, yAgua - sube + dy);
            bezierVertex(a, yAgua - sube * 0.25 + dy, a + curva * 0.45, yAgua + dy, a + curva, yAgua + dy);
            vertex(b - curva, yAgua + dy);
            bezierVertex(b - curva * 0.45, yAgua + dy, b, yAgua - sube * 0.25 + dy, b, yAgua - sube + dy);
        };
        noStroke();
        fill(TH.agua);
        beginShape();
        vertex(a, PROBETA.fondo);
        menisco();
        vertex(b, PROBETA.fondo);
        endShape(CLOSE);
        // Bajo la superficie, una banda más clara que acompaña la curva
        noFill();
        if (PROBETA.fondo - yAgua > 6) {
            stroke(TH.aguaLuz);
            strokeWeight(4);
            beginShape();
            menisco(2.8);
            endShape();
        }
        // Superficie: una línea que sigue el menisco
        stroke(TH.aguaBorde);
        strokeWeight(1.8);
        beginShape();
        menisco();
        endShape();
    }

    // Reflejos en la mitad derecha, lejos de las rayas y los números
    stroke(TH.brillo);
    strokeWeight(3);
    line(x1 - 5, PROBETA.tope + 8, x1 - 5, PROBETA.fondo - 12);
    stroke(TH.brilloFino);
    strokeWeight(1);
    line(x1 - 9.5, PROBETA.tope + 26, x1 - 9.5, PROBETA.fondo - 46);

    // Rayas
    const largoEtiqueta = Math.min(w * 0.5, 24);
    const nDiv = Math.round(p.cap / p.div);
    for (let i = 1; i <= nDiv; i++) {
        const ml = i * p.div;
        const y = yDeMl(ml);
        const etiqueta = ml % p.etiqueta === 0;
        const medio = ml % p.medio === 0;
        stroke(TH.raya);
        // Las rayas pequeñas de la probeta de 250 mL, más finas para que no formen una mancha
        strokeWeight(etiqueta ? 1.3 : medio ? 0.8 : (p.div > 1 ? 0.45 : 0.8));
        // Largo de las rayas como en la de 100 mL, también en la ancha de 250 mL: así caben en la lupa
        line(x0, y, x0 + (etiqueta ? largoEtiqueta : medio ? Math.min(w * 0.36, 17) : Math.min(w * 0.2, 10)), y);
        // Los números van impresos en el vidrio, junto a la raya larga (así se ven en la lupa)
        if (etiqueta) {
            noStroke();
            fill(TH.raya);
            textSize(9);
            textAlign(LEFT, CENTER);
            text(String(ml), x0 + largoEtiqueta + 2, y);
        }
    }
    // Marcas impresas: unidad y temperatura de calibrado
    noStroke();
    fill(TH.raya);
    textSize(9);
    textAlign(LEFT, CENTER);
    text('mL', x0 + largoEtiqueta + 2, PROBETA.tope - 24);
    fill(TH.textoTenue);
    textSize(6.5);
    text('20°C', x0 + largoEtiqueta + 2, PROBETA.tope - 13);

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
    noStroke();
    if (rebose) dibujarRebose(x0, x1);

    rotulo([i18n.t('probeta de {c} mL', { c: p.cap }), i18n.t('división de {d} mL', { d: p.div })], PROBETA.x);
}

// Frasco lavador: plástico lechoso, tapón de rosca y tubo curvo. Se aprieta (se arrastra)
// con el pico sobre la boca de la probeta, y al apretarlo se estrecha un poco.
function dibujarFrasco() {
    const { x, y } = frascoPos;
    const tx = x + PICO.x, ty = y + PICO.y;
    const k = (vertiendo || porVerter > 0) ? 3.5 : 0;
    if (y >= MESA_Y - 0.5) sombraContacto(x, 54);
    // Chorro
    if (vertiendo || porVerter > 0) {
        stroke(TH.aguaBorde);
        strokeWeight(2.4);
        line(tx, ty + 2, tx, yDeMl(nivelMostrado));
    }
    // Tubo y punta fina
    noFill();
    stroke(TH.frascoTubo);
    strokeWeight(3);
    beginShape();
    vertex(x, y - 104);
    vertex(x, y - 118);
    bezierVertex(x, y - 128, x - 8, y - 134, x - 18, y - 134);
    vertex(x - 46, y - 134);
    endShape();
    strokeWeight(1.8);
    line(x - 47, y - 133.4, tx, ty);
    // Tapón de rosca
    stroke(TH.frascoBorde);
    strokeWeight(1);
    fill(TH.frascoTapon);
    rect(x - 10, y - 106, 20, 14, 2);
    stroke(TH.frascoRosca);
    for (const dy of [102, 98.5, 95]) line(x - 8, y - dy, x + 8, y - dy);
    // Cuerpo con hombros
    stroke(TH.frascoBorde);
    strokeWeight(TH.contraste ? 2 : 1.4);
    fill(TH.frasco);
    beginShape();
    vertex(x - 10, y - 92);
    bezierVertex(x - 10, y - 84, x - 22, y - 85, x - 22, y - 74);
    bezierVertex(x - 22 + k, y - 52, x - 22 + k, y - 30, x - 22, y - 9);
    bezierVertex(x - 22, y - 3, x - 19, y, x - 13, y);
    vertex(x + 13, y);
    bezierVertex(x + 19, y, x + 22, y - 3, x + 22, y - 9);
    bezierVertex(x + 22 - k, y - 30, x + 22 - k, y - 52, x + 22, y - 74);
    bezierVertex(x + 22, y - 85, x + 10, y - 84, x + 10, y - 92);
    endShape(CLOSE);
    // Agua, que se ve a través del plástico
    noStroke();
    fill(TH.agua);
    beginShape();
    vertex(x - 20 + k * 0.85, y - 56);
    bezierVertex(x - 20 + k, y - 40, x - 20 + k * 0.6, y - 22, x - 20, y - 9);
    bezierVertex(x - 20, y - 4, x - 17.5, y - 2, x - 13, y - 2);
    vertex(x + 13, y - 2);
    bezierVertex(x + 17.5, y - 2, x + 20, y - 4, x + 20, y - 9);
    bezierVertex(x + 20 - k * 0.6, y - 22, x + 20 - k, y - 40, x + 20 - k * 0.85, y - 56);
    endShape(CLOSE);
    // Reflejo y rótulo impreso
    stroke(TH.frascoBrillo);
    strokeWeight(3);
    line(x - 15 + k * 0.6, y - 70, x - 15 + k * 0.6, y - 16);
    noStroke();
    fill(TH.frascoTexto);
    textSize(9);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text('H₂O', x + 2, y - 65);
    textStyle(NORMAL);
    rotulo([i18n.t('frasco'), i18n.t('lavador')], FRASCO_REPOSO.x, 2);
}

// Agua que se sale por arriba: rebosa por la boca, baja por fuera del vidrio y encharca la mesa
function dibujarRebose(x0, x1) {
    const k = constrain((millis() - rebose.t) / 1100, 0, 1);
    const yB = PROBETA.borde, yPie = MESA_Y - 14;
    const yFin = yB + (MESA_Y - yB) * k;
    // Abombado sobre la boca
    noStroke();
    fill(TH.agua);
    beginShape();
    vertex(x0 - 6, yB);
    bezierVertex(x0, yB - 7, x1, yB - 7, x1 + 6, yB);
    endShape(CLOSE);
    // Chorros por las dos paredes
    noFill();
    for (const [xa, xb] of [[x0 - 6, x0 - 2], [x1 + 6, x1 + 2]]) {
        stroke(TH.agua);
        strokeWeight(6);
        line(xa, yB, xb, Math.min(yFin, yPie));
        stroke(TH.aguaBorde);
        strokeWeight(1.8);
        line(xa, yB, xb, Math.min(yFin, yPie));
        if (k < 1) {
            noStroke();
            fill(TH.aguaBorde);
            gotaLagrima(xb, Math.min(yFin, yPie) + 3, 3, HALF_PI);
            noFill();
        }
    }
    // Charcos que crecen junto al pie
    if (yFin >= yPie) {
        const c = constrain((millis() - rebose.t - 1100 * (yPie - yB) / (MESA_Y - yB)) / 700, 0, 1);
        noStroke();
        fill(TH.agua);
        ellipse(x0 - 34, MESA_Y + 1, 70 * c, 6.5);
        ellipse(x1 + 34, MESA_Y + 1, 64 * c, 6.5);
        if (!TH.contraste) {
            fill(TH.aguaReflejo);
            ellipse(x0 - 40, MESA_Y + 0.4, 26 * c, 1.6);
            ellipse(x1 + 28, MESA_Y + 0.4, 22 * c, 1.6);
        }
    }
}

function dibujarCharcos() {
    noStroke();
    charcos.forEach(c => {
        fill(TH.agua);
        ellipse(c.x, MESA_Y + 1, c.w, 4);
        if (!TH.contraste) {
            fill(TH.aguaReflejo);
            ellipse(c.x - c.w * 0.15, MESA_Y + 0.4, c.w * 0.4, 1.4);
        }
    });
}

// Gota en forma de lágrima que avanza en la dirección ang (la punta queda detrás)
function gotaLagrima(x, y, s, ang) {
    push();
    translate(x, y);
    rotate(ang - HALF_PI);
    beginShape();
    vertex(0, -s * 1.3);
    bezierVertex(s * 0.55, -s * 0.3, s * 0.75, s * 0.75, 0, s * 0.8);
    bezierVertex(-s * 0.75, s * 0.75, -s * 0.55, -s * 0.3, 0, -s * 1.3);
    endShape(CLOSE);
    noStroke();
    if (!TH.contraste) {
        fill(255, 255, 255, 170);
        circle(-s * 0.22, s * 0.2, s * 0.4);
        fill(TH.aguaBorde);
    }
    pop();
}

function dibujarGotas() {
    noStroke();
    fill(TH.aguaBorde);
    gotas.forEach(g => { fill(TH.aguaBorde); gotaLagrima(g.x, g.y, 3, Math.atan2(g.vy, g.vx)); });
}

// Todas las muestras están pintadas del mismo color mate (ciruela, que no es el de ningún
// material de la tabla): así el aspecto no delata el material y hay que medir. De una
// muestra a otra solo cambia un poco la luminosidad.
function tonoMuestra(c) {
    const f = 1 + muestra.tinte / 220;
    const k = color(c);
    return color(red(k) * f, green(k) * f, blue(k) * f);
}

// Abanico desde el centro con los vértices que miran hacia el ángulo a0 (± ancho)
function faceta(pts, angs, centro, a0, ancho) {
    const n = pts.length;
    const dentro = angs.map(a => Math.abs(((a - a0) % TWO_PI + 3 * PI) % TWO_PI - PI) < ancho);
    const inicio = dentro.findIndex((d, i) => d && !dentro[(i - 1 + n) % n]);
    if (inicio < 0) return;
    beginShape();
    vertex(centro[0], centro[1]);
    for (let j = 0; j < n; j++) {
        const i = (inicio + j) % n;
        if (!dentro[i]) break;
        vertex(pts[i][0], pts[i][1]);
    }
    endShape(CLOSE);
}

// giro: la muestra se dibuja girada (tumbada en la bandeja); la luz sigue arriba a la izquierda
function dibujarMuestra(cx, cy, giro = 0) {
    const { w, h } = tamano;
    const pts = forma.map(([fx, fy]) => [cx + fx * w, cy + fy * h]);
    const angs = forma.map(([fx, fy]) => Math.atan2(fy, fx));
    const luz = -3 * QUARTER_PI - giro;
    // Cuerpo
    fill(tonoMuestra(TH.muestraBase));
    stroke(TH.contraste ? TH.contornoMuestra : TH.muestraBorde);
    strokeWeight(TH.contraste ? 2 : 1.2);
    beginShape();
    pts.forEach(q => vertex(q[0], q[1]));
    endShape(CLOSE);
    // Facetas: el mismo tono, más claro hacia la luz y más oscuro en el lado contrario
    noStroke();
    const centro = [cx - w * 0.06, cy - h * 0.05];
    fill(tonoMuestra(TH.muestraLuz));
    faceta(pts, angs, centro, luz, 1.15);
    fill(tonoMuestra(TH.muestraSombra));
    faceta(pts, angs, centro, luz + PI, 0.95);
    // Mojada: más oscura y con gotas pegadas
    if (mojada && !muestraEnTubo()) {
        fill(0, 0, 0, 38);
        beginShape();
        pts.forEach(q => vertex(q[0], q[1]));
        endShape(CLOSE);
        // Brillo de película de agua
        if (!TH.contraste) {
            stroke(255, 255, 255, 110);
            strokeWeight(1.6);
            const v = giro ? -1 : 1;
            line(cx - w * 0.28, cy - v * h * 0.18, cx - w * 0.1, cy - v * h * 0.3);
            line(cx + w * 0.12, cy + v * h * 0.02, cx + w * 0.26, cy - v * h * 0.08);
        }
        const cae = HALF_PI - giro;
        const gota = (fx, fy, t) => {
            stroke(TH.aguaBorde);
            strokeWeight(0.8);
            fill(TH.gotaMojada);
            gotaLagrima(cx + w * fx, cy + h * fy, t, cae);
        };
        gota(0.18, 0.1, 3.6);
        gota(-0.14, 0.3, 3.2);
        gota(0.04, -0.22, 2.8);
        gota(-0.22, -0.04, 2.6);
        gota(0.22, 0.34, 2.4);
    }
}

// Una gota que se forma bajo la muestra mojada y, si va en la mano, cae
function dibujarGoteo() {
    if (!mojada || muestraEnTubo()) return;
    const quieta = tumbada() || (lugar === 'balanza' && !mov);
    const x = tumbada() ? centroTumbada().x : pos.x;
    const yAbajo = tumbada() ? centroTumbada().y + tamano.w / 2 : pos.y + tamano.h / 2;
    const f = (millis() % 2400) / 2400;
    noStroke();
    // Tumbada en la bandeja, deja un poco de agua en ella
    if (tumbada()) {
        fill(TH.agua);
        ellipse(x + 6, MESA_Y - 14.5, tamano.h * 0.7, 3);
        return;
    }
    fill(TH.gotaMojada);
    if (f < 0.5) {
        gotaLagrima(x + 3, yAbajo + 1 + f * 4, 1 + f * 3, HALF_PI);
    } else if (!quieta && f < 0.8) {
        const k = (f - 0.5) / 0.3;
        fill(conAlfa(TH.gotaMojada, 255 * (1 - k)));
        gotaLagrima(x + 3, yAbajo + 3 + 46 * k * k, 2.4, HALF_PI);
    }
}

// Con la probeta de 250 mL las rayas están muy juntas: la lupa aumenta más
function aumentoLupa() {
    return capProbeta === 250 ? 4 : 3.2;
}

function radioLupa() {
    return escala < 0.62 ? 104 : 82;     // en pantallas pequeñas, más grande
}

// Donde espera la lupa hasta que se arrastra: a la derecha, sin tapar la probeta ni el frasco
function lupaReposo() {
    return escala < 0.62 ? { x: 768, y: 262 } : { x: 770, y: 290 };
}

// La lupa está sobre la probeta: la línea de los ojos se ve a pleno color
function lupaSobreProbeta() {
    const p = PROBETAS[capProbeta];
    return Math.abs(lupaPos.x - PROBETA.x) < p.ancho / 2 + 24 && lupaPos.y > PROBETA.borde && lupaPos.y < PROBETA.fondo;
}

// Lupa de verdad: amplía lo que tiene debajo. Se lleva a la probeta para leer el menisco.
function dibujarLupa() {
    const { x, y } = lupaPos;
    const r = radioLupa();
    const cogida = arrastre && arrastre.que === 'lupa';
    const leyendo = lupaSobreProbeta();

    // Mango: cuello metálico y empuñadura cian (cian = se puede coger)
    strokeCap(ROUND);
    stroke(TH.aro);
    strokeWeight(8);
    line(x + r * 0.7, y + r * 0.7, x + r * 0.88, y + r * 0.88);
    stroke(TH.empunadura);
    strokeWeight(13);
    line(x + r * 0.9, y + r * 0.9, x + r * 1.27, y + r * 1.27);
    if (!TH.contraste) {
        stroke(TH.empunaduraLuz);
        strokeWeight(2.5);
        line(x + r * 0.93 + 2.6, y + r * 0.93 - 2.6, x + r * 1.22 + 2.6, y + r * 1.22 - 2.6);
    }
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
    scale(aumentoLupa());
    translate(-x, -y);
    dibujarEscena();
    pop();
    // Línea de los ojos: se pone sobre la parte baja del menisco para leer
    stroke(conAlfa(TH.ojos, leyendo ? 255 : 102));
    strokeWeight(1.3);
    drawingContext.setLineDash([5, 4]);
    line(x - r, y, x + r, y);
    drawingContext.setLineDash([]);
    // Reflejo del cristal, arriba a la izquierda, lejos de la línea de lectura
    if (!TH.contraste) {
        noFill();
        stroke(255, 255, 255, 70);
        strokeWeight(3.5);
        arc(x, y, r * 1.62, r * 1.62, PI * 1.2, PI * 1.42);
        strokeWeight(1.5);
        arc(x, y, r * 1.45, r * 1.45, PI * 1.25, PI * 1.36);
    }
    drawingContext.restore();

    // Aro metálico, con luz arriba a la izquierda
    noFill();
    if (!TH.contraste) {
        stroke(TH.aroSombra);
        strokeWeight(6.5);
        circle(x, y, 2 * r);
    }
    stroke(TH.aro);
    strokeWeight(4.5);
    circle(x, y, 2 * r);
    if (!TH.contraste) {
        stroke(TH.aroLuz);
        strokeWeight(1.6);
        arc(x, y, 2 * r, 2 * r, PI * 1.03, PI * 1.47);
    }
    // Filo cian al pasar el ratón o al arrastrarla, y pulsos del nivel guiado
    const a = Math.max(cogida || encima === 'lupa' ? 230 : 0, 255 * intensidadPulso('lupa'));
    if (a > 0) {
        stroke(conAlfa(TH.acento, a));
        strokeWeight(2);
        circle(x, y, 2 * r + 9);
    }
    // Ojo a la altura de la línea
    dibujarOjo(x - r - 22, y, leyendo ? 255 : 102);
}

function dibujarOjo(ex, y, alfa) {
    stroke(conAlfa(TH.ojos, alfa));
    strokeWeight(1.4);
    fill(conAlfa(TH.ojoBlanco, alfa));
    beginShape();
    vertex(ex - 12, y);
    bezierVertex(ex - 5, y - 8.5, ex + 5, y - 8.5, ex + 12, y);
    bezierVertex(ex + 5, y + 8.5, ex - 5, y + 8.5, ex - 12, y);
    endShape(CLOSE);
    noStroke();
    fill(conAlfa(TH.ojos, alfa));
    circle(ex, y, 9);
    fill(conAlfa(TH.pupila, alfa));
    circle(ex, y, 4.2);
    fill(255, 255, 255, alfa * 0.9);
    circle(ex - 1.6, y - 1.6, 1.8);
}

// La lupa se centra sobre las rayas y los números, junto a la pared izquierda
function llevarLupaAlAgua() {
    const p = PROBETAS[capProbeta];
    lupaPos = { x: PROBETA.x - p.ancho / 2 + 22, y: yDeMl(nivelObjetivo()) };
}

// ── Resaltes en cian: lo que se puede coger y dónde se puede soltar ──

// Objeto del lienzo que se señala en cada paso del nivel guiado
const OBJETO_PASO = [null, 'balanza', 'muestra', 'frasco', 'lupa', 'muestra', 'lupa', null, null];
const MOVIMIENTO_REDUCIDO = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Dos pulsos suaves de 600 ms al empezar el paso
function intensidadPulso(obj) {
    if (!pulso || pulso.obj !== obj || MOVIMIENTO_REDUCIDO) return 0;
    const t = millis() - pulso.t;
    return t < 1200 ? Math.sin(PI * (t % 600) / 600) : 0;
}

// Lo que hay bajo el ratón (con el dedo no hay «pasar por encima»)
function objetoBajoPuntero() {
    if (punteroTipo !== 'mouse' || arrastre || bloqueado) return null;
    if (mouseX < 0 || mouseY < 0 || mouseX > CV_W || mouseY > CV_H) return null;
    const q = { x: mouseX, y: mouseY };
    if (sobreLupa(q)) return 'lupa';
    if (!mov && sobreMuestra(q)) return 'muestra';
    if (porVerter === 0 && sobreFrasco(q)) return 'frasco';
    return null;
}

function contornoMuestra(alfa) {
    const { w, h } = tamano;
    const tum = tumbada();
    const c = tum ? centroTumbada() : pos;
    push();
    translate(c.x, c.y);
    if (tum) rotate(HALF_PI);
    noFill();
    stroke(conAlfa(TH.acento, alfa));
    strokeWeight(2);
    beginShape();
    forma.forEach(([fx, fy]) => vertex(fx * (w + 9), fy * (h + 9)));
    endShape(CLOSE);
    pop();
}

function zonaSoltar(x, y, w, h, activa) {
    noFill();
    stroke(conAlfa(TH.acento, activa ? 255 : 150));
    strokeWeight(activa ? 2 : 1.3);
    if (!activa) drawingContext.setLineDash([5, 4]);
    rect(x, y, w, h, 6);
    drawingContext.setLineDash([]);
}

function dibujarResaltes() {
    // Al arrastrar la muestra: dónde se puede soltar
    if (arrastre && arrastre.que === 'muestra') {
        const p = PROBETAS[capProbeta];
        const d = destinoAlSoltar();
        zonaSoltar(BANDEJA.x - 80, MESA_Y - 24, 160, 28, d === 'bandeja');
        zonaSoltar(BALANZA.x - 84, BALANZA.platoY - 8, 168, 18, d === 'balanza');
        zonaSoltar(PROBETA.x - p.ancho / 2 - 12, PROBETA.borde - 12, p.ancho + 24, 22, d === 'probeta');
        contornoMuestra(200);
        return;
    }
    if (mov) return;
    const a = obj => Math.max(encima === obj ? 200 : 0, 255 * intensidadPulso(obj));
    if (a('muestra') > 0 && !muestraEnTubo()) contornoMuestra(a('muestra'));
    if (a('frasco') > 0) {
        const { x, y } = frascoPos;
        noFill();
        stroke(conAlfa(TH.acento, a('frasco')));
        strokeWeight(2);
        rect(x - 28, y - 113, 56, 118, 12);
    }
    if (a('balanza') > 0) {
        noFill();
        stroke(conAlfa(TH.acento, a('balanza')));
        strokeWeight(2);
        rect(BOTON_ON.x - TECLA.w / 2 - 6, BOTON_ON.y - 26, BOTON_TARA.x - BOTON_ON.x + TECLA.w + 12, 41, 7);
    }
}

// ── Textos del lienzo: tarjeta de indicación y pastilla de la muestra ──

// Corta un texto en líneas que caben en el ancho dado (con el tamaño de letra activo)
function envolver(txt, ancho) {
    const lineas = [];
    let l = '';
    txt.split(' ').forEach(p => {
        const prueba = l ? l + ' ' + p : p;
        if (l && textWidth(prueba) > ancho) { lineas.push(l); l = p; } else l = prueba;
    });
    if (l) lineas.push(l);
    return lineas;
}

function espaciado(px) {
    try { drawingContext.letterSpacing = px + 'px'; } catch (e) { /* sin letterSpacing */ }
}

function dibujarRotulos() {
    const movil = escala < 0.62;
    const m = 12;
    const duracion = mensajeTipo === 'aviso' ? DURACION_AVISO * 2 : DURACION_AVISO;
    const hayMensaje = millis() - mensajeT < duracion && !mov && !arrastre;
    const esAviso = hayMensaje && mensajeTipo === 'aviso';
    const paso = pasoActual();
    let cuerpo = hayMensaje ? mensaje : indicacion();
    if (!hayMensaje && nivel === 'guiada' && paso <= N_PASOS) cuerpo = cuerpo.replace(/^[^:]{1,16}:\s+/, '');
    cuerpo = cuerpo.replace(/^⚠\s*/, '');
    const etiqueta = esAviso ? i18n.t('AVISO')
        : nivel === 'libre' ? i18n.t('NIVEL LIBRE')
        : paso <= N_PASOS ? i18n.t('PASO {n} DE {t}', { n: paso, t: N_PASOS })
        : i18n.t('PRÁCTICA TERMINADA');

    // Pastilla con la muestra y la probeta (en el nivel libre se copia en la hoja)
    const p = PROBETAS[capProbeta];
    const tp = tamTexto(13);
    textSize(tp);
    textStyle(NORMAL);
    const txtP = i18n.t('Muestra {n} · probeta de {c} mL', { n: muestra.n, c: p.cap });
    const wP = textWidth(txtP) + 26, hP = tp + 14;

    // Tarjeta de indicación
    const tt = tamTexto(15), te = tamTexto(11);
    const wC = movil ? CV_W - 2 * m : CV_W - 3 * m - wP;
    const sangria = esAviso ? te * 1.9 : 0;
    textSize(tt);
    const lineas = envolver(cuerpo, wC - 32);
    const hC = 14 + te + 9 + lineas.length * tt * 1.32 + 8;
    stroke(esAviso ? TH.aviso : TH.tarjetaBorde);
    strokeWeight(esAviso ? 1.6 : 1);
    fill(TH.tarjeta);
    rect(m, m, wC, hC, 8);
    noStroke();
    if (esAviso) {
        fill(TH.aviso);
        circle(m + 16 + te * 0.7, m + 14 + te * 0.5, te * 1.4);
        fill(TH.fondo);
        textSize(te);
        textStyle(BOLD);
        textAlign(CENTER, CENTER);
        text('!', m + 16 + te * 0.7, m + 14 + te * 0.55);
    }
    fill(esAviso ? TH.aviso : TH.acento);
    textSize(te);
    textStyle(BOLD);
    textAlign(LEFT, TOP);
    espaciado(1.4);
    text(etiqueta, m + 16 + sangria, m + 14);
    espaciado(0);
    textStyle(NORMAL);
    fill(TH.texto);
    textSize(tt);
    lineas.forEach((l, i) => text(l, m + 16, m + 14 + te + 9 + i * tt * 1.32));

    const xP = movil ? m : CV_W - m - wP;
    const yP = movil ? m + hC + 8 : m;
    stroke(TH.tarjetaBorde);
    strokeWeight(1);
    fill(TH.pastilla);
    rect(xP, yP, wP, hP, hP / 2);
    noStroke();
    fill(TH.texto);
    textSize(tp);
    textAlign(CENTER, CENTER);
    text(txtP, xP + wP / 2, yP + hP / 2 + 0.5);
    if (derramado && lugar === 'probeta') {
        fill(TH.aviso);
        textAlign(movil ? LEFT : RIGHT, TOP);
        text(i18n.t('Se ha derramado agua'), movil ? xP + 4 : xP + wP - 4, yP + hP + 6);
    }
}


// En pantallas pequeñas el lienzo se encoge: los textos crecen para seguir leyéndose
function tamTexto(base) {
    return constrain(base * 0.7 / escala, base, base * 1.9);
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
    if (tumbada()) {
        const c = centroTumbada();
        return Math.abs(q.x - c.x) < tamano.h / 2 + m && Math.abs(q.y - c.y) < tamano.w / 2 + m;
    }
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

// Botón «vaciar» del pie de la probeta (en pantallas pequeñas responde en una zona mayor)
function sobreVaciar(q) {
    const extra = Math.max(4, 12 / escala - 8);
    return Math.abs(q.x - BOTON_VACIAR.x) < 26 + extra && Math.abs(q.y - BOTON_VACIAR.y) < 7 + extra;
}

function sobreFrasco(q) {
    const { x, y } = frascoPos;
    const enCuerpo = q.x > x - 26 && q.x < x + 26 && q.y > y - 108 && q.y < y + 2;
    const enPico = q.x > x + PICO.x - 6 && q.x < x + 4 && q.y > y + PICO.y - 14 && q.y < y - 100;
    return enCuerpo || enPico;
}

function setupPuntero(cv) {
    cv.style.touchAction = 'none';

    cv.addEventListener('pointermove', (e) => { punteroTipo = e.pointerType; });
    cv.addEventListener('pointerdown', (e) => {
        punteroTipo = e.pointerType;
        if (bloqueado) return;
        const q = puntoLienzo(e, cv);
        if (sobreBoton(q, BOTON_ON)) { pulsarOn(); return; }
        if (sobreBoton(q, BOTON_TARA)) { pulsarTara(); return; }
        if (sobreVaciar(q)) { vaciarProbeta(); return; }
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
            else {
                avisoVertido = '';
                // Cerca de la probeta pero sin acertar con el pico
                if (!a.sobreBoca && dist(frascoPos.x + PICO.x, frascoPos.y + PICO.y, PROBETA.x, PROBETA.borde) < 110) {
                    decir(i18n.t('Para echar agua, pon el pico del frasco justo encima de la boca de la probeta.'));
                }
            }
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
        const entra = Math.abs(x - PROBETA.x) < p.ancho / 2 && cabeEnProbeta() && agua > 0
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
        if (sobreBoton(q, BOTON_ON) || sobreBoton(q, BOTON_TARA) || sobreVaciar(q)) c = 'pointer';
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
            fondo: '#e2e8f0', pared1: '#f1f4f8', pared2: '#e2e8f0', luzPared: 'rgba(255,255,255,0.45)',
            encimeraCanto: '#9eabbd', encimeraFrente: '#c4cdda', mesa: '#d3dae4', sombraCanto: 'rgba(40,55,80,0.12)', sombra: 'rgba(40,55,80,0.22)',
            texto: '#0d1520', textoTenue: '#46556e', acento: '#00628e', aviso: '#9a5a00', ojos: '#8a6000', ojoBlanco: '#ffffff', pupila: '#1a1a1a',
            bandeja: '#d6dce5', bandejaBorde: '#7d8aa0', bandejaLuz: '#eef1f5', etiqueta: '#fffdf6', etiquetaBorde: '#b9b2a0', etiquetaTexto: '#2a3140',
            balanza: '#f7f9fb', balanzaBorde: '#7d8aa0', balanzaLuz: '#ffffff', balanzaSombra: '#d5dbe4', balanzaColumna: '#a9b2c0',
            plato: '#cfd6e0', platoLuz: '#ffffff', pies: '#5a6578',
            pantalla: '#10241a', pantallaTexto: '#5ef0a8', segFantasma: 'rgba(94,240,168,0.08)', ledOn: '#16a34a', ledOff: '#8a93a3',
            tecla: '#e1e6ee', teclaLuz: '#f6f8fb', teclaPulsada: '#c9d0db', teclaBorde: '#7d8aa0', teclaTexto: '#1a2236',
            vidrio: '#5a6a84', vidrioFondo: 'rgba(255,255,255,0.45)', vidrioPie: 'rgba(255,255,255,0.75)', vidrioArista: 'rgba(90,106,132,0.6)',
            brillo: 'rgba(255,255,255,0.75)', brilloFino: 'rgba(255,255,255,0.9)',
            agua: 'rgba(40,110,210,0.45)', aguaLuz: 'rgba(255,255,255,0.25)', aguaBorde: '#1d5fbf', aguaReflejo: 'rgba(255,255,255,0.6)', gotaMojada: '#5b9be8', raya: '#1a2236',
            contraste: false,
            muestraBase: '#8e5c82', muestraLuz: '#a97a9c', muestraSombra: '#6b4263', muestraBorde: '#4a2c44',
            aro: '#7d8797', aroLuz: '#dfe4ea', aroSombra: 'rgba(30,40,60,0.3)', empunadura: '#0088bb', empunaduraLuz: 'rgba(255,255,255,0.45)',
            frasco: 'rgba(255,255,255,0.88)', frascoBorde: '#5f6d85', frascoTapon: '#f2f4f7', frascoRosca: '#9aa3b2', frascoTubo: '#5a6a84',
            frascoBrillo: 'rgba(255,255,255,0.9)', frascoTexto: '#2a3a55',
            tarjeta: 'rgba(255,255,255,0.92)', tarjetaBorde: '#c3ccd9', pastilla: 'rgba(255,255,255,0.92)',
        };
    } else if (isContrast) {
        TH = {
            fondo: '#000000', pared1: '#000000', pared2: '#000000',
            encimeraCanto: '#ffff00', encimeraFrente: '#000000', mesa: '#000000', sombraCanto: '#000000', sombra: 'rgba(0,0,0,0)',
            texto: '#ffffff', textoTenue: '#ffffff', acento: '#00ffff', aviso: '#ffaa00', ojos: '#ffff00', ojoBlanco: '#ffffff', pupila: '#000000',
            bandeja: '#000000', bandejaBorde: '#ffffff', bandejaLuz: '#000000', etiqueta: '#000000', etiquetaBorde: '#ffffff', etiquetaTexto: '#ffffff',
            balanza: '#000000', balanzaBorde: '#ffffff', balanzaLuz: '#000000', balanzaSombra: '#000000', balanzaColumna: '#666666',
            plato: '#000000', platoLuz: '#000000', pies: '#ffffff',
            pantalla: '#000000', pantallaTexto: '#00ff88', segFantasma: 'rgba(0,255,136,0.06)', ledOn: '#00ff88', ledOff: '#666666',
            tecla: '#000000', teclaLuz: '#000000', teclaPulsada: '#333333', teclaBorde: '#ffffff', teclaTexto: '#ffffff',
            vidrio: '#ffffff', vidrioFondo: 'rgba(255,255,255,0.06)', vidrioPie: '#000000', vidrioArista: '#ffffff',
            brillo: 'rgba(255,255,255,0)', brilloFino: 'rgba(255,255,255,0)',
            agua: 'rgba(80,170,255,0.55)', aguaLuz: 'rgba(0,0,0,0)', aguaBorde: '#66ccff', aguaReflejo: 'rgba(0,0,0,0)', gotaMojada: '#66ccff', raya: '#ffffff',
            contraste: true, contornoMuestra: '#ffff00',
            muestraBase: '#b07aa0', muestraLuz: '#c792b6', muestraSombra: '#8a5a7e', muestraBorde: '#ffff00',
            aro: '#ffffff', aroLuz: '#ffffff', aroSombra: '#000000', empunadura: '#00ffff', empunaduraLuz: '#000000',
            frasco: '#000000', frascoBorde: '#ffffff', frascoTapon: '#000000', frascoRosca: '#ffffff', frascoTubo: '#ffffff',
            frascoBrillo: 'rgba(0,0,0,0)', frascoTexto: '#ffffff',
            tarjeta: '#000000', tarjetaBorde: '#ffff00', pastilla: '#000000',
        };
    } else {
        TH = {
            fondo: '#0d1016', pared1: '#161b24', pared2: '#0d1016', luzPared: 'rgba(120,150,200,0.07)',
            encimeraCanto: '#46526a', encimeraFrente: '#1f2633', mesa: '#141922', sombraCanto: 'rgba(0,0,0,0.35)', sombra: 'rgba(0,0,0,0.4)',
            texto: '#d8dee8', textoTenue: '#8d9ab3', acento: '#00c8ff', aviso: '#f0a832', ojos: '#ffd24a', ojoBlanco: '#f4f6fa', pupila: '#1a1a1a',
            bandeja: '#c3cad6', bandejaBorde: '#8d95a5', bandejaLuz: '#e2e7ee', etiqueta: '#f4f1e6', etiquetaBorde: '#b9b2a0', etiquetaTexto: '#2a3140',
            balanza: '#d9dee6', balanzaBorde: '#8d95a5', balanzaLuz: '#eef1f5', balanzaSombra: '#b3bac6', balanzaColumna: '#9aa2b0',
            plato: '#c9cfd8', platoLuz: '#f2f5f8', pies: '#3a4150',
            pantalla: '#0c1712', pantallaTexto: '#5ef0a8', segFantasma: 'rgba(94,240,168,0.07)', ledOn: '#34c782', ledOff: '#4b5563',
            tecla: '#c3c9d3', teclaLuz: '#dde2e9', teclaPulsada: '#aab1bd', teclaBorde: '#8d95a5', teclaTexto: '#2a3140',
            vidrio: '#c8d4e6', vidrioFondo: 'rgba(200,212,230,0.06)', vidrioPie: 'rgba(200,212,230,0.14)', vidrioArista: 'rgba(200,212,230,0.35)',
            brillo: 'rgba(255,255,255,0.16)', brilloFino: 'rgba(255,255,255,0.28)',
            agua: 'rgba(55,130,215,0.50)', aguaLuz: 'rgba(150,200,255,0.18)', aguaBorde: '#7fb8ff', aguaReflejo: 'rgba(255,255,255,0.35)', gotaMojada: '#b4dcff', raya: '#e4ecf8',
            contraste: false,
            muestraBase: '#9a6a8c', muestraLuz: '#b88aa8', muestraSombra: '#6e4566', muestraBorde: '#4a2c44',
            aro: '#9aa4b2', aroLuz: '#e6ebf2', aroSombra: 'rgba(0,0,0,0.45)', empunadura: '#00c8ff', empunaduraLuz: 'rgba(255,255,255,0.45)',
            frasco: 'rgba(235,240,248,0.22)', frascoBorde: '#b8c2d2', frascoTapon: '#e4e8ee', frascoRosca: '#9aa3b2', frascoTubo: '#dfe6f0',
            frascoBrillo: 'rgba(255,255,255,0.22)', frascoTexto: '#e8eef6',
            tarjeta: 'rgba(22,27,36,0.92)', tarjetaBorde: '#2c3546', pastilla: 'rgba(22,27,36,0.92)',
        };
    }
}
