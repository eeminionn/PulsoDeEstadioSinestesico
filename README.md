# PulsoDeEstadioSinestesico

Pieza interactiva en **p5.js** para **Sinestesia Digital: Ver el Sonido**, construida a partir del concepto de un **pulso de estadio sinestésico**, donde los datos del Mundial se transforman en una visualización viva impulsada por el micrófono.

El proyecto convierte partidos de la FIFA World Cup en entidades reactivas: cada partido aparece como una órbita sobre la cancha y sus aureolas ya no responden a una línea de tiempo. Ahora, los **goles pares reaccionan a los graves** y los **goles impares reaccionan a los agudos**, usando el sonido en vivo como motor visual.

## Concepto

**Pulso de estadio sinestésico** explora la tensión colectiva del fútbol como si el estadio fuera un organismo. El sistema visual trata los partidos como cuerpos, los goles como capas de memoria y el sonido como la fuerza que los activa.

- **Graves**: despiertan aureolas ligadas a goles pares.
- **Agudos**: despiertan aureolas ligadas a goles impares.
- **Medios**: alteran la deriva, el movimiento orbital y la inestabilidad visual.
- **Volumen**: amplifica la presión general de la escena.

## Características

- Entrada en vivo por micrófono con sensibilidad ajustable.
- Análisis FFT para **graves**, **medios** y **agudos**.
- Clase principal reactiva con múltiples instancias y variaciones de comportamiento.
- Controles en tiempo real para sensibilidad, umbrales, escala de aureolas, velocidad y flujo de color.
- Activación y desactivación de bandas sonoras con checkboxes.
- Leyenda visible u oculta con la tecla `L`.
- Ejecución apta para fullscreen en contexto de entrega o exhibición.
- Estructura basada en datasets históricos del Mundial.

## Controles

| Input | Acción |
| --- | --- |
| `L` | Mostrar u ocultar la leyenda |
| `F` | Activar o desactivar fullscreen |
| `A / Z` | Aumentar o disminuir la velocidad |
| `Left / Right` | Cambiar de Mundial |
| Drag con mouse | Orbitar la cancha |
| Rueda del mouse | Zoom |
| Click sobre una órbita | Fijar información del partido |
| Sliders | Ajustar sensibilidad, umbrales, escala, velocidad y color |
| Checkboxes | Activar o desactivar graves, medios y agudos |

## Archivos

| Archivo | Función |
| --- | --- |
| `index.html` | Punto de entrada |
| `style.css` | Estilos base de interfaz |
| `sketch.js` | Lógica principal de visualización y reacción al audio |
| `matches_clean.csv` | Dataset de partidos |
| `goals_clean.csv` | Dataset de goles |
| `teams_clean.csv` | Metadatos de equipos |
| `tournaments_clean.csv` | Metadatos de torneos |

## Ejecución local

Como la pieza usa micrófono, conviene abrirla desde un servidor local y no directamente desde el sistema de archivos.

```bash
python3 -m http.server 8000
```

Luego abre:

```text
http://localhost:8000
```

Acepta el permiso del micrófono en el navegador y activa el botón de audio desde la interfaz.

## Actualización del Mundial 2026

El proyecto incluye un archivo local llamado `live_worldcup_2026.json` para incorporar el Mundial 2026 que se está jugando actualmente.

Ese archivo se puede regenerar con:

```bash
node scripts/updateLiveWorldCup2026.mjs
```

El script descarga partidos, equipos y estadios, normaliza los resultados y deja el JSON listo para que `sketch.js` lo lea junto con los CSV históricos.

Si estás trabajando dentro del editor web de p5, el flujo recomendado es:

1. Actualizar `live_worldcup_2026.json` localmente con el script.
2. Subir o reemplazar ese JSON dentro del proyecto de p5.
3. Volver a cargar el sketch.

## Contexto

Esta pieza nace de una visualización previa de datos de mundiales y fue adaptada hacia una entrega final centrada en la idea de **ver el sonido** por medio de color, forma y movimiento. El resultado mantiene el archivo futbolero como materia prima, pero lo desplaza hacia una experiencia performática y sinestésica en tiempo real.
