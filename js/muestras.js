'use strict';
// ============================================================
//  Materiales, muestras y probetas de la práctica
// ============================================================

// Tabla de densidades que consulta el alumno (g/cm³, a 20 °C).
// Dos vecinos se separan al menos un 13 %: así, en el nivel guiado, ninguna
// lectura que se da por buena lleva a otro material.
const MATERIALES = [
  { id: 'pvc',      nombre: 'PVC',      rho: 1.40 },
  { id: 'magnesio', nombre: 'Magnesio', rho: 1.74 },
  { id: 'teflon',   nombre: 'Teflón',   rho: 2.20 },
  { id: 'aluminio', nombre: 'Aluminio', rho: 2.70 },
  { id: 'titanio',  nombre: 'Titanio',  rho: 4.51 },
  { id: 'hierro',   nombre: 'Hierro',   rho: 7.87 },
  { id: 'cobre',    nombre: 'Cobre',    rho: 8.96 },
  { id: 'plomo',    nombre: 'Plomo',    rho: 11.34 },
];

// Las 20 muestras son fijas para que el profesor pueda repartirlas por número
// y tener la clave. Todas se hunden en agua.
//   vol: volumen real (cm³); ancho: anchura dibujada (px). El alto sale del
//   volumen, para que la muestra se vea del tamaño del agua que desplaza.
//   Las de ancho menor de 30 px caben también en la probeta de 50 mL.
const MUESTRAS_DEF = [
  { n:  1, mat: 'aluminio', vol: 18.6, ancho: 38 },
  { n:  2, mat: 'hierro',   vol: 21.3, ancho: 38 },
  { n:  3, mat: 'pvc',      vol: 16.4, ancho: 40 },
  { n:  4, mat: 'cobre',    vol: 19.7, ancho: 36 },
  { n:  5, mat: 'teflon',   vol: 13.2, ancho: 29.5 },
  { n:  6, mat: 'plomo',    vol: 12.8, ancho: 29 },
  { n:  7, mat: 'aluminio', vol: 23.1, ancho: 40 },
  { n:  8, mat: 'titanio',  vol: 15.5, ancho: 33 },
  { n:  9, mat: 'magnesio', vol: 20.4, ancho: 39 },
  { n: 10, mat: 'hierro',   vol: 17.6, ancho: 36 },
  { n: 11, mat: 'cobre',    vol: 23.4, ancho: 40 },
  { n: 12, mat: 'pvc',      vol: 12.3, ancho: 29 },
  { n: 13, mat: 'plomo',    vol: 16.9, ancho: 35 },
  { n: 14, mat: 'teflon',   vol: 21.7, ancho: 40 },
  { n: 15, mat: 'aluminio', vol: 11.8, ancho: 28 },
  { n: 16, mat: 'magnesio', vol: 13.6, ancho: 33 },
  { n: 17, mat: 'hierro',   vol: 24.2, ancho: 40 },
  { n: 18, mat: 'titanio',  vol: 22.5, ancho: 38 },
  { n: 19, mat: 'cobre',    vol: 17.3, ancho: 34 },
  { n: 20, mat: 'plomo',    vol: 20.6, ancho: 37 },
];

const MUESTRAS = MUESTRAS_DEF.map(d => {
  const mat = MATERIALES.find(m => m.id === d.mat);
  return {
    n: d.n,
    mat,
    vol: d.vol,
    ancho: d.ancho,
    masa: Math.round(mat.rho * d.vol * 10) / 10,   // lo que marca la balanza tarada (0,1 g)
  };
});

// Probetas disponibles. ancho: diámetro interior en px del lienzo. Las tres se
// dibujan igual de altas, así que el ancho crece con la capacidad para que 1 mL
// ocupe lo mismo en todas.
//   div: valor de una división; medio: raya media; etiqueta: cada cuánto lleva número.
//   caudal: mL por segundo que echa el frasco lavador.
const PROBETAS = {
  50:  { cap: 50,  div: 1, medio: 5,  etiqueta: 10, ancho: 34, caudal: 6 },
  100: { cap: 100, div: 1, medio: 5,  etiqueta: 10, ancho: 48, caudal: 10 },
  250: { cap: 250, div: 2, medio: 10, etiqueta: 20, ancho: 76, caudal: 24 },
};

// Generador pseudoaleatorio con semilla: cada muestra tiene siempre la misma forma.
function aleatorioConSemilla(semilla) {
  let s = semilla * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
