'use strict';
// ============================================================
//  Materiales, muestras y probetas de la práctica
// ============================================================

// Tabla de densidades que consulta el alumno (g/cm³, a 20 °C).
// Los vecinos se separan al menos un 8 %, salvo latón y cobre (5 %).
const MATERIALES = [
  { id: 'nailon',   nombre: 'Nailon',   rho: 1.15,  aspecto: 'plastico-claro' },
  { id: 'pvc',      nombre: 'PVC',      rho: 1.40,  aspecto: 'plastico-gris' },
  { id: 'magnesio', nombre: 'Magnesio', rho: 1.74,  aspecto: 'metal' },
  { id: 'vidrio',   nombre: 'Vidrio',   rho: 2.50,  aspecto: 'vidrio' },
  { id: 'aluminio', nombre: 'Aluminio', rho: 2.70,  aspecto: 'metal' },
  { id: 'titanio',  nombre: 'Titanio',  rho: 4.51,  aspecto: 'metal' },
  { id: 'cinc',     nombre: 'Cinc',     rho: 7.13,  aspecto: 'metal' },
  { id: 'hierro',   nombre: 'Hierro',   rho: 7.87,  aspecto: 'metal' },
  { id: 'laton',    nombre: 'Latón',    rho: 8.50,  aspecto: 'dorado' },
  { id: 'cobre',    nombre: 'Cobre',    rho: 8.96,  aspecto: 'cobrizo' },
  { id: 'plomo',    nombre: 'Plomo',    rho: 11.34, aspecto: 'metal' },
];

// Las 20 muestras son fijas para que el profesor pueda repartirlas por número
// y tener la clave. Todas se hunden en agua.
//   vol: volumen real (cm³); k: desplaza el agua inicial de la probeta.
const MUESTRAS_DEF = [
  { n:  1, mat: 'aluminio', vol: 18.6, k: 3 },
  { n:  2, mat: 'hierro',   vol: 12.3, k: 6 },
  { n:  3, mat: 'pvc',      vol: 24.4, k: 1 },
  { n:  4, mat: 'cobre',    vol: 35.4, k: 4 },
  { n:  5, mat: 'vidrio',   vol: 21.4, k: 7 },
  { n:  6, mat: 'plomo',    vol: 14.8, k: 2 },
  { n:  7, mat: 'aluminio', vol: 20.1, k: 5 },
  { n:  8, mat: 'cinc',     vol: 16.5, k: 0 },
  { n:  9, mat: 'nailon',   vol: 27.3, k: 8 },
  { n: 10, mat: 'titanio',  vol: 13.7, k: 3 },
  { n: 11, mat: 'magnesio', vol: 22.6, k: 6 },
  { n: 12, mat: 'laton',    vol: 34.2, k: 1 },
  { n: 13, mat: 'hierro',   vol: 25.4, k: 4 },
  { n: 14, mat: 'aluminio', vol: 31.4, k: 2 },
  { n: 15, mat: 'pvc',      vol: 15.6, k: 7 },
  { n: 16, mat: 'plomo',    vol:  9.8, k: 5 },
  { n: 17, mat: 'vidrio',   vol: 28.6, k: 0 },
  { n: 18, mat: 'cinc',     vol: 30.7, k: 3 },
  { n: 19, mat: 'titanio',  vol: 19.4, k: 8 },
  { n: 20, mat: 'magnesio', vol: 11.8, k: 1 },
];

const MUESTRAS = MUESTRAS_DEF.map(d => {
  const mat = MATERIALES.find(m => m.id === d.mat);
  return {
    n: d.n,
    mat,
    vol: d.vol,
    k: d.k,
    masa: Math.round(mat.rho * d.vol * 10) / 10,   // lo que marca la balanza tarada (0,1 g)
  };
});

// Probetas disponibles. ancho: diámetro interior en px del lienzo.
//   div: valor de una división; medio: raya media; etiqueta: cada cuánto lleva número.
//   agua(k): volumen de agua con el que empieza la probeta.
const PROBETAS = {
  50:  { cap: 50,  div: 1, medio: 5,  etiqueta: 10, ancho: 34, agua: k => 20 + k },
  100: { cap: 100, div: 1, medio: 5,  etiqueta: 10, ancho: 48, agua: k => 45 + k },
  250: { cap: 250, div: 2, medio: 10, etiqueta: 50, ancho: 66, agua: k => 100 + 2 * k },
};

// Generador pseudoaleatorio con semilla: cada muestra tiene siempre la misma forma.
function aleatorioConSemilla(semilla) {
  let s = semilla * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
