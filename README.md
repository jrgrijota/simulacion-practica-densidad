# Densidad de un sólido — Simulación Interactiva

Práctica de laboratorio simulada para **Física y Química de la ESO**: el alumno recibe una
**muestra desconocida**, la pesa en una balanza electrónica, mide su volumen **por inmersión**
en una probeta, calcula su densidad y busca el material en una tabla de densidades.

Es la primera de la gama **Prácticas de laboratorio** de [simulaciencia.es](https://simulaciencia.es).

## Niveles

- **Guiada (paso a paso):** ocho pasos numerados y un cuaderno de laboratorio en pantalla.
  La simulación comprueba cada lectura y cada cálculo al apuntarlos y, al final, si el material
  elegido en la tabla es el correcto.
- **Libre (con guión en papel):** la simulación solo pone los instrumentos y el número de muestra.
  El alumno sigue un guión impreso, apunta las medidas y hace los cálculos en la hoja. No hay
  cuaderno, tabla ni corrección en pantalla: corrige el profesor con la clave de las muestras.
  Se puede elegir la probeta (50, 100 o 250 mL) y se pueden cometer errores reales, como pesar
  sin tarar la balanza o usar una probeta en la que la muestra no cabe.

## Cómo se maneja

- La probeta empieza **vacía**. Se llena arrastrando el **frasco lavador** hasta que su pico quede sobre
  la boca: mientras está ahí, echa agua. «Vaciar la probeta» la deja vacía otra vez.
- La **muestra** se arrastra con el ratón o con el dedo hasta el plato de la balanza o dentro de la
  probeta. A la probeta hay que **bajarla con la mano hasta el agua** antes de soltarla: si se suelta
  desde arriba, cae, el agua salpica y se sale, y hay que empezar de nuevo con la misma muestra.
  Si se suelta en otro sitio, vuelve a la bandeja con un aviso: en el laboratorio las muestras solo
  se dejan en su sitio.
- Si se pesa la muestra **mojada**, después de sacarla de la probeta, la balanza marca de más
  (el agua pegada) y hay que empezar de nuevo.
- La **lupa** también se arrastra y amplía lo que tiene debajo. Su línea amarilla marca la altura de
  los ojos: se pone sobre la parte baja del menisco para leer.
- Los botones **ON** y **TARA** se pulsan sobre la propia balanza, y **VACIAR**, en el pie de la probeta.
- En la bandeja la muestra descansa tumbada; al cogerla se pone vertical.
- **Con el teclado:** el tabulador lleva a unos botones que solo aparecen al recibir el foco
  (encender, tarar, poner en la balanza, meter en la probeta con cuidado, echar agua y llevar la
  lupa al agua), y con el
  lienzo enfocado las flechas mueven la lupa. «Describir la escala» dice entre qué rayas está el agua.

## Criterio didáctico

- La simulación **nunca muestra el volumen**: hay que leerlo en la escala de la probeta, con una
  lupa que amplía el menisco. La masa sí se lee en la pantalla de la balanza, como en el laboratorio.
- Hay 20 muestras numeradas y cada número es siempre del mismo material, para que el profesor pueda
  repartirlas por número. Al abrir la simulación sale una al azar. Lo fijo de cada muestra es su
  material (su densidad): la masa y el volumen salen al azar cada vez que se empieza, en los dos
  niveles (la masa es ρ·V). Así cada alumno tiene sus propios números y, repitiendo con la misma
  muestra, se ve que la masa cambia y la densidad no. La clave da el material y su densidad. Todas se hunden en agua. La forma es irregular para que la inmersión tenga sentido, y el
  aspecto no delata el material: todas están pintadas del mismo color mate (ciruela, que no es el de ningún material de la tabla).
- Las muestras se dibujan **a escala**: su tamaño corresponde al agua que desplazan. Por eso son
  alargadas, como las que caben en una probeta real. Solo las más estrechas (5, 6, 12 y 15) caben en
  la de 50 mL.
- En el nivel guiado solo se da por buena la **raya más cercana** al agua. La tabla de densidades y las
  muestras están elegidas para que, con esas lecturas, la densidad calculada lleve siempre al material
  correcto, sea cual sea el tamaño que salga (hierro y cobre, de 17,5 a 25 cm³; el resto, desde
  11 cm³). En el nivel libre, con otras probetas, no tiene por qué ser así.

## Uso

Abre `index.html` en un navegador. No necesita instalación ni conexión: incluye [p5.js](https://p5js.org/)
en `js/vendor/`. Incluye temas oscuro, claro y alto contraste (botón del engranaje).

Parámetros de la dirección, para repartir la práctica:

| Parámetro | Efecto |
|---|---|
| `?nivel=libre` | Abre el nivel libre |
| `?muestra=7` | Empieza con la muestra 7 (de 1 a 20); sin él, sale una al azar |
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
