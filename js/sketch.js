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
const PROBETA  = { x: 615, fondo: 484, tope: 130, borde: 92 };   // tope = raya de la capacidad
const BOTON_ON   = { x: 416, y: 450, r: 9 };
const BOTON_TARA = { x: 441, y: 450, r: 9 };
const LUPA_REPOSO = { x: 800, y: 300 };  // donde espera la lupa hasta que se arrastra
const LUPA_AUMENTO = 3.2;
const REBOSE   = 1.12;                // la probeta admite un 12 % más por encima de la última raya
const DURACION_MOV = 1.1;             // s que tarda la muestra en ir de un sitio a otro

const PASOS = [
    'Encender y tarar la balanza',
    'Pesar la muestra',
    'Leer el volumen inicial del agua',
    'Meter la muestra en la probeta',
    'Leer el volumen final',
    'Calcular el volumen y la densidad',
    'Buscar el material en la tabla',
];

const INDICACIONES = [
    'Paso 1: enciende la balanza con su botón ON y pulsa TARA para ponerla a cero.',
    'Paso 2: arrastra la muestra al plato de la balanza y apunta la masa en el cuaderno.',
    'Paso 3: lleva la lupa al agua de la probeta, lee el volumen y apúntalo.',
    'Paso 4: arrastra la muestra hasta la boca de la probeta y suéltala.',
    'Paso 5: lee con la lupa el nuevo volumen y apúntalo.',
    'Paso 6: calcula el volumen de la muestra y su densidad.',
    'Paso 7: busca en la tabla el material con la densidad más parecida.',
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
let lupaPos = { ...LUPA_REPOSO };
let arrastre = null;           // { que: 'muestra' | 'lupa', dx, dy, origen }
let avisoFuera = false;        // se soltó la muestra fuera de su sitio

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
    canvas.elt.setAttribute('aria-label', i18n.t('Mesa de laboratorio con una bandeja, una balanza electrónica, una probeta con agua y una lupa. Con el ratón o el dedo se arrastran la muestra y la lupa. Con el teclado, las flechas mueven la lupa. Los mensajes de la simulación se leen en voz alta.'));
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
    avanzarAgua();

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
    dibujarProbeta();
    if (!muestraEnTubo()) dibujarMuestra(pos.x, pos.y);
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
    // Muestras alargadas para que quepan en la probeta; el tamaño crece con el volumen
    const h = 26 + 1.1 * muestra.vol;
    tamano = { w: h * 0.6, h };
    reiniciar();
}

function reiniciar() {
    lugar = 'bandeja';
    mov = null;
    arrastre = null;
    pos = anclaje('bandeja');
    lupaPos = { ...LUPA_REPOSO };
    balanzaEncendida = false;
    deriva = (2 + Math.floor(Math.random() * 4)) / 10;
    tara = 0;
    taradaVacia = false;
    agua = PROBETAS[capProbeta].agua(muestra.k);
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
    mov = { ruta: [[a.x, a.y], [a.x, alto], [b.x, alto], [b.x, b.y]], t: 0, destino, origen: lugar };
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
    if (destino === 'probeta') {
        const boca = PROBETA.borde - tamano.h / 2 - 4;
        ruta = muestraEnTubo() ? [[a.x, a.y], [b.x, b.y]] : [[a.x, a.y], [b.x, Math.min(a.y, boca)], [b.x, b.y]];
    } else if (muestraEnTubo()) {
        const fuera = PROBETA.borde - tamano.h / 2 - 14;
        ruta = [[a.x, a.y], [a.x, fuera], [b.x, Math.min(fuera, b.y)], [b.x, b.y]];
    } else {
        ruta = [[a.x, a.y], [b.x, b.y]];
    }
    mov = { ruta, t: 0, destino, origen, lento: destino === 'probeta' };
    lugar = 'moviendo';
    actualizarInterfaz();
}

// En el nivel guiado no se puede saltar un paso
function permitido(destino, origen) {
    if (nivel !== 'guiada') return true;
    const paso = pasoActual();
    if (destino === 'balanza') {
        if (paso === 2 || origen === 'balanza') return true;
        decir(paso === 1 ? i18n.t('Antes de pesar, enciende la balanza y pulsa TARA.') : i18n.t(INDICACIONES[paso - 1]));
        return false;
    }
    if (destino === 'probeta') {
        if (paso === 4 || origen === 'probeta') return true;
        decir(paso < 4 ? i18n.t('Todavía no: antes de meter la muestra tienes que pesarla y leer el volumen inicial del agua.') : i18n.t(INDICACIONES[paso - 1]));
        return false;
    }
    return true;
}

function avanzarMovimiento() {
    if (!mov) return;
    mov.t = Math.min(1, mov.t + deltaTime / 1000 / (mov.lento ? DURACION_MOV * 1.4 : DURACION_MOV * 0.7));
    const r = mov.ruta;
    const largos = [];
    let total = 0;
    for (let i = 1; i < r.length; i++) {
        const d = dist(r[i - 1][0], r[i - 1][1], r[i][0], r[i][1]);
        largos.push(d);
        total += d;
    }
    // Suave al arrancar y al llegar
    const e = mov.t < 0.5 ? 2 * mov.t * mov.t : 1 - Math.pow(-2 * mov.t + 2, 2) / 2;
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
    if (mov.t >= 1) {
        const destino = mov.destino;
        const origen = mov.origen;
        mov = null;
        lugar = destino;
        alLlegar(destino, origen);
    }
}

function alLlegar(destino, origen) {
    if (origen === 'probeta' && destino !== 'probeta') {
        derramado = false;
    }
    if (destino === origen && !avisoFuera) { actualizarInterfaz(); return; }
    if (destino === 'balanza') {
        decir(balanzaEncendida
            ? i18n.t('La balanza marca {m} g.', { m: lecturaBalanzaTexto() })
            : i18n.t('La muestra está en el plato, pero la balanza está apagada.'));
    } else if (destino === 'probeta') {
        const p = PROBETAS[capProbeta];
        const maximo = p.cap * REBOSE;
        if (derramado) {
            // Ya se había derramado: no se pierde más agua
        } else if (agua + muestra.vol > maximo) {
            agua = maximo - muestra.vol;
            derramado = true;
            decir(i18n.t('¡Se ha salido agua por arriba! Esta medida no vale: usa una probeta más grande.'));
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

// Volumen sumergido de la muestra (cm³) según dónde esté ahora
function volumenSumergido() {
    if (lugar === 'probeta') return muestra.vol;
    if (!muestraEnTubo()) return 0;
    // Entrando o saliendo: parte de la muestra que está por debajo del agua
    const superficie = yDeMl(Math.min(agua, PROBETAS[capProbeta].cap * REBOSE));
    const abajo = pos.y + tamano.h / 2;
    const f = constrain((abajo - superficie) / tamano.h, 0, 1);
    return f * muestra.vol;
}

function nivelObjetivo() {
    const p = PROBETAS[capProbeta];
    return Math.min(agua + volumenSumergido(), p.cap * REBOSE);
}

function avanzarAgua() {
    const objetivo = nivelObjetivo();
    nivelMostrado += (objetivo - nivelMostrado) * Math.min(1, deltaTime / 120);
    if (Math.abs(objetivo - nivelMostrado) < 0.001) nivelMostrado = objetivo;
}

// ============================================================
//  Balanza
// ============================================================
function cargaBalanza() {
    return lugar === 'balanza' ? muestra.masa : 0;
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
        ? i18n.t('Balanza encendida: marca {m} g sin nada encima. Pulsa «Tarar» para ponerla a cero.', { m: lecturaBalanzaTexto() })
        : i18n.t('Balanza apagada.'));
    actualizarInterfaz();
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
    return Math.min(agua + muestra.vol, PROBETAS[capProbeta].cap * REBOSE);
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
    if (!correctos.vi) return 3;
    if (lugar !== 'probeta' && !correctos.vf) return 4;
    if (!correctos.vf) return 5;
    if (!(correctos.v && correctos.rho)) return 6;
    if (!terminado) return 7;
    return 8;
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
    const margenV = p.div / 2 + 0.05;
    let ok = false, pista = '';

    if (id === 'm') {
        ok = Math.abs(x - muestra.masa) <= 0.05 + 1e-9;
        pista = i18n.t('Revisa la masa: copia el número de la pantalla de la balanza, con su decimal.');
    } else if (id === 'vi' || id === 'vf') {
        const real = id === 'vi' ? PROBETAS[capProbeta].agua(muestra.k) : volumenFinalReal();
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
        avisoCuaderno(i18n.t('Bien apuntado.') + (siguiente <= 7 ? ' ' + i18n.t(INDICACIONES[siguiente - 1]) : ''), 'bien');
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
    if (nivel !== 'guiada' || pasoActual() < 7) return;
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
        res.textContent = i18n.t('✓ {mat}. Tu densidad ({r} g/cm³) se aleja un {e} % del valor de la tabla ({t} g/cm³). Práctica terminada.', {
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

    if (guiada) {
        bEnc.disabled = !(paso === 1 && !balanzaEncendida);
        bTar.disabled = !(paso === 1 && balanzaEncendida);
        bBal.disabled = !quieta || !((paso === 2 && lugar === 'bandeja') || lugar === 'balanza');
        bPro.disabled = !quieta || !((paso === 4 && lugar !== 'probeta') || lugar === 'probeta');
    } else {
        bEnc.disabled = false;
        bTar.disabled = !balanzaEncendida;
        bBal.disabled = !quieta;
        bPro.disabled = !quieta;
    }

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
        b.disabled = !(guiada && paso >= 7);
        const sel = b.dataset.id === eleccion;
        b.setAttribute('aria-checked', String(sel));
        b.classList.toggle('elegida', sel);
        b.classList.toggle('acierto', sel && terminado);
    });

    // Al cambiar de paso, se anuncia la nueva indicación
    if (guiada && paso !== ultimoPaso) {
        ultimoPaso = paso;
        if (paso <= 7) anunciar(i18n.t(INDICACIONES[paso - 1]));
    }
}

// Indicación fija de la franja superior cuando no hay ningún aviso reciente
function indicacion() {
    if (nivel === 'libre') return i18n.t('Sigue tu guión. Apunta en el papel todo lo que midas.');
    const paso = pasoActual();
    return paso <= 7 ? i18n.t(INDICACIONES[paso - 1]) : i18n.t('Práctica terminada. Elige otra muestra para repetirla.');
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

    document.getElementById('btn-encender').addEventListener('click', encender);
    document.getElementById('btn-tarar').addEventListener('click', tarar);
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
    noStroke();
    fill(TH.textoTenue);
    textSize(13);
    textAlign(CENTER, TOP);
    text(i18n.t('bandeja'), BANDEJA.x, MESA_Y + 26);
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
    // Rótulo
    fill(TH.textoTenue);
    textSize(13);
    textAlign(CENTER, TOP);
    text(i18n.t('balanza electrónica · 0,1 g'), BALANZA.x, MESA_Y + 26);
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
    if (lugar === 'probeta' && !mov) dibujarMuestra(pos.x, pos.y);

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

    // Rótulo
    fill(TH.textoTenue);
    textSize(13);
    textAlign(CENTER, TOP);
    text(i18n.t('probeta de {c} mL · división de {d} mL', { c: p.cap, d: p.div }), PROBETA.x, MESA_Y + 26);
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
}

function radioLupa() {
    return escala < 0.62 ? 115 : 82;     // en pantallas pequeñas, más grande
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
    const aviso = millis() - mensajeT < duracion && !mov;
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

function setupPuntero(cv) {
    cv.style.touchAction = 'none';

    cv.addEventListener('pointerdown', (e) => {
        const q = puntoLienzo(e, cv);
        if (sobreBoton(q, BOTON_ON)) {
            if (nivel !== 'guiada' || !document.getElementById('btn-encender').disabled) encender();
            return;
        }
        if (sobreBoton(q, BOTON_TARA)) {
            if (!document.getElementById('btn-tarar').disabled) tarar();
            return;
        }
        if (mov) return;
        // La lupa va por encima de todo: se coge primero
        if (sobreLupa(q)) {
            arrastre = { que: 'lupa', dx: lupaPos.x - q.x, dy: lupaPos.y - q.y };
        } else if (sobreMuestra(q)) {
            arrastre = { que: 'muestra', dx: pos.x - q.x, dy: pos.y - q.y, origen: lugar, enTubo: muestraEnTubo() };
            lugar = 'mano';
            actualizarInterfaz();
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
        } else {
            moverMuestraA(q.x + arrastre.dx, q.y + arrastre.dy);
        }
    });

    const terminar = () => {
        if (!arrastre) return;
        const a = arrastre;
        arrastre = null;
        if (a.que === 'muestra') soltar(destinoAlSoltar(), a.origen);
    };
    cv.addEventListener('pointerup', terminar);
    cv.addEventListener('pointercancel', terminar);

    // Flechas: mueven la lupa (Mayús para ir más deprisa)
    cv.addEventListener('keydown', (e) => {
        const paso = e.shiftKey ? 20 : 4;
        const d = { ArrowUp: [0, -paso], ArrowDown: [0, paso], ArrowLeft: [-paso, 0], ArrowRight: [paso, 0] }[e.key];
        if (!d) return;
        e.preventDefault();
        lupaPos.x = constrain(lupaPos.x + d[0], 0, CV_W);
        lupaPos.y = constrain(lupaPos.y + d[1], 0, MESA_Y);
    });
}

// La muestra en la mano no atraviesa la mesa, la balanza ni el vidrio de la probeta
function moverMuestraA(x, y) {
    const { w, h } = tamano;
    const p = PROBETAS[capProbeta];
    x = constrain(x, w / 2, CV_W - w / 2);
    y = constrain(y, h / 2, MESA_Y - h / 2);
    // Si estaba dentro de la probeta, solo puede salir hacia arriba
    if (muestraEnTubo()) {
        if (y + h / 2 > PROBETA.borde) x = PROBETA.x;
    } else if (Math.abs(x - PROBETA.x) < p.ancho / 2 + w / 2 + 4) {
        y = Math.min(y, PROBETA.borde - h / 2);
    }
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
        else if (sobreLupa(q) || (!mov && sobreMuestra(q))) c = 'grab';
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
        };
    }
}
