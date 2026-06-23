# La Copa Resonante

Pieza interactiva en **p5.js** para **Sinestesia Digital: Ver el Sonido**, creada por **eeminionn**. El proyecto transforma el estadio y la memoria de los Mundiales en un instrumento audiovisual que se juega con la voz.

La experiencia deja el análisis de datos en segundo plano: los partidos históricos ya no son el contenido que el usuario debe estudiar, sino las memorias que despierta al jugar. El objetivo es completar una secuencia sonora y marcar cinco goles para levantar la Copa del Mundial seleccionado.

## Concepto

**La Copa Resonante** imagina el estadio como un organismo colectivo. La tribuna respira, la pelota escucha y cada frecuencia cumple un rol dentro de un ataque de fútbol:

- **Graves — cargar:** una voz baja, un golpe o un bombo acumulan presión, expanden aureolas de goles pares y hacen vibrar la tribuna.
- **Medios — construir:** hablar, cantar o tararear conduce la pelota, acelera las órbitas y dibuja la trayectoria de la jugada.
- **Agudos — rematar:** un aplauso, silbido o sonido agudo dispara la pelota, activa los goles impares y provoca la celebración.
- **Volumen — atmósfera:** la intensidad general abre las luces, modifica el campo y aumenta la presencia de todos los organismos visuales.

La secuencia **graves → medios → agudos** representa la estructura emocional de un gol: expectativa, construcción y liberación.

## Objetivos

1. Convertir el audio en una mecánica comprensible y no solamente en un efecto decorativo.
2. Dar al usuario una meta clara: completar cinco ataques sonoros y conquistar la Copa.
3. Mantener el vínculo con los Mundiales mediante años, sedes, campeones, partidos y goleadores reales.
4. Diferenciar visualmente cada rango de frecuencia por color, forma, movimiento y función.
5. Mantener la pieza atractiva en estado pasivo mediante la respiración del campo, las órbitas y la tribuna luminosa.

## Sistema visual

Cada partido del Mundial seleccionado es una instancia de la clase `MatchOrb`. Las instancias varían según etapa, cantidad de goles, presencia del campeón y condición de anfitrión. Todas reaccionan al análisis FFT, pero sus aureolas se comportan de manera diferente según la paridad de sus goles.

La clase `ResonantCupGame` interpreta esas frecuencias como estados del juego. Al marcar, selecciona una memoria real del dataset, ilumina su partido y muestra marcador, goleador, minuto y fase. Así, los datos funcionan como archivo afectivo del Mundial y no como dashboard.

## Interacción

| Input | Acción |
| --- | --- |
| Sonido grave | Cargar la energía de la tribuna |
| Sonido medio | Construir la jugada y conducir la pelota |
| Sonido agudo | Rematar y marcar |
| Movimiento del mouse | Apuntar el remate |
| Click / drag | Explorar y orbitar las memorias |
| Rueda del mouse | Acercar o alejar el estadio |
| `1 / 2 / 3` | Probar graves, medios y agudos sin micrófono |
| `L` | Mostrar u ocultar la leyenda |
| `F` | Activar o desactivar fullscreen |
| `R` | Empezar una Copa nueva |
| `A / Z` | Aumentar o disminuir el ritmo |
| Flechas | Cambiar de Mundial |

Los sliders permiten ajustar sensibilidad del micrófono, umbrales independientes para graves, medios y agudos, respuesta visual, ritmo de juego y mezcla de color. Los checkboxes permiten aislar cada banda.

## Archivos principales

| Archivo | Función |
| --- | --- |
| `index.html` | Punto de entrada y librerías de p5 |
| `style.css` | Sistema visual y acabado de la interfaz |
| `sketch.js` | Juego, clases, visualización y análisis sonoro |
| `matches_clean.csv` | Archivo histórico de partidos |
| `goals_clean.csv` | Archivo histórico de goles |
| `tournaments_clean.csv` | Sedes, campeones y datos de torneos |
| `live_worldcup_2026.json` | Estado actualizado del Mundial 2026 |

## Ejecución local

Como la pieza usa micrófono, debe abrirse desde un servidor local:

```bash
python3 -m http.server 8000
```

Luego abre `http://localhost:8000`, acepta el permiso del micrófono y presiona **Entrar al estadio**.

## Mundial 2026 en vivo

El archivo `live_worldcup_2026.json` se regenera con:

```bash
node scripts/updateLiveWorldCup2026.mjs
```

El workflow `.github/workflows/update-live-worldcup-2026.yml` ejecuta esa actualización cada hora y hace commit solo cuando encuentra cambios. En el editor web de p5, `sketch.js` intenta leer primero:

```text
https://raw.githubusercontent.com/eeminionn/PulsoDeEstadioSinestesico/main/live_worldcup_2026.json
```

Si la URL remota falla, usa el JSON local como respaldo. Solo se incorporan partidos que ya tienen un resultado confirmado.
