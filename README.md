# Densidad de un sólido — Simulación Interactiva

Práctica de laboratorio simulada para **Física y Química de la ESO**: el alumno recibe una
**muestra desconocida**, la pesa en una balanza electrónica, mide su volumen **por inmersión**
en una probeta, calcula su densidad y busca el material en una tabla de densidades.

Es la primera de la gama **Prácticas de laboratorio** de [simulaciencia.es](https://simulaciencia.es).

## Niveles

- **Guiada (paso a paso):** siete pasos numerados y un cuaderno de laboratorio en pantalla.
  La simulación comprueba cada lectura y cada cálculo al apuntarlos y, al final, si el material
  elegido en la tabla es el correcto.
- **Libre (con guión en papel):** la simulación solo pone los instrumentos y el número de muestra.
  El alumno sigue un guión impreso, apunta las medidas y hace los cálculos en la hoja. No hay
  cuaderno, tabla ni corrección en pantalla: corrige el profesor con la clave de las muestras.
  Se puede elegir la probeta (50, 100 o 250 mL) y se pueden cometer errores reales, como pesar
  sin tarar la balanza o usar una probeta en la que la muestra no cabe.

## Criterio didáctico

- La simulación **nunca muestra el volumen**: hay que leerlo en la escala de la probeta, con una
  lupa que amplía el menisco. La masa sí se lee en la pantalla de la balanza, como en el laboratorio.
- Las 20 muestras son fijas (material, masa y volumen), para que el profesor pueda repartirlas por
  número. Todas se hunden en agua. La forma es irregular para que la inmersión tenga sentido, y el
  aspecto no delata el material.
- Las lecturas se aceptan con un margen de media división (±0,5 mL en la probeta de 100 mL).

## Uso

Abre `index.html` en un navegador. No necesita instalación ni conexión: incluye [p5.js](https://p5js.org/)
en `js/vendor/`. Incluye temas oscuro, claro y alto contraste (botón del engranaje).

Parámetros de la dirección, para repartir la práctica:

| Parámetro | Efecto |
|---|---|
| `?nivel=libre` | Abre el nivel libre |
| `?muestra=7` | Empieza con la muestra 7 (de 1 a 20) |
| `?probeta=250` | En el nivel libre, empieza con la probeta de 250 mL (50, 100 o 250) |

Por ahora la interfaz solo está en español; las traducciones se harán con la versión definitiva.

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Panel de controles de los dos niveles |
| `css/style.css` | Estilos y temas (mismo sistema visual que el resto de simulaciones) |
| `css/practica.css` | Estilos propios: pasos, cuaderno, tabla de densidades y botones de los instrumentos |
| `js/muestras.js` | Tabla de densidades, las 20 muestras y las probetas |
| `js/sketch.js` | Mesa de laboratorio, balanza, probeta, lupa, pasos y comprobaciones |
| `js/i18n.js`, `js/i18n-en.js`, `js/i18n-ca.js`, `js/i18n-eu.js`, `js/i18n-gl.js` | Idioma de la interfaz (diccionarios pendientes) |
