# Mundial Infinito

Juego audiovisual en **p5.js** creado por **eeminionn** para **Sinestesia Digital: Ver el Sonido**.

La pieza presenta un único balón mundialista monumental que está vivo: respira, rebota, gira y cambia su anatomía según las frecuencias captadas por el micrófono. Ya no funciona como análisis o visualización de datos; el sonido es directamente el control del juego.

## Concepto

**Mundial Infinito** convierte el balón clásico blanco y negro en un organismo sonoro. El usuario debe mantenerlo en el aire alternando dos tipos de toque:

- **Graves:** deforman y expanden los paneles negros. Funcionan como un golpe pesado que eleva el balón.
- **Agudos:** estiran e iluminan los paneles blancos. Funcionan como la devolución rápida del toque.
- **Medios:** encienden la hinchada, curvan las costuras y estabilizan el tiempo del partido.
- **Volumen:** modifica la respiración general, las luces y la presencia física del balón.

La alternancia entre negro y blanco representa el ritmo de una pelota que pasa de un pie al otro. Cada frecuencia tiene color, material, movimiento y función propios.

## Objetivo del juego

El jugador dispone de **45 segundos** para completar **11 toques alternados**, uno por cada jugador de una selección. Al completar el equipo aparece la Copa y el estadio entra en celebración.

La experiencia está relacionada con los Mundiales mediante:

- El balón clásico como protagonista absoluto.
- La estructura de once jugadores.
- El reloj de partido y las rachas de toques.
- La Copa como estado final.
- Atmósferas inspiradas en México 70, Italia 90, Brasil 2014 y Norteamérica 2026.
- El estadio, la hinchada, los focos y el lenguaje gráfico de transmisión deportiva.

## Arquitectura

La clase `BallPanel` genera múltiples paneles con variaciones de forma y reacción. Las instancias negras responden a graves y las blancas a agudos.

La clase `InfiniteWorldCupGame` controla el tiempo, la alternancia, los toques, la racha, la física del balón y los estados de victoria o fin del partido.

El sketch no necesita CSV, JSON ni datasets externos para funcionar.

## Controles

| Input | Acción |
| --- | --- |
| Sonido grave | Activar panel negro y dar un toque pesado |
| Sonido agudo | Activar panel blanco y devolver el balón |
| Sonido medio | Encender la hinchada y estabilizar el tiempo |
| Movimiento del mouse | Inclinar y modificar la rotación |
| Click sobre el estadio | Impulsar el giro del balón |
| `1 / 2 / 3` | Probar graves, medios y agudos sin micrófono |
| `L` | Mostrar u ocultar la leyenda |
| `R` | Iniciar un partido nuevo |
| `F` | Activar o desactivar fullscreen |
| Flechas | Cambiar la atmósfera mundialista |

Los sliders permiten controlar sensibilidad, umbrales independientes, cantidad de deformación y gravedad. Los checkboxes permiten aislar cada banda.

## Ejecución

Abre el proyecto desde el editor web de p5 o mediante un servidor local:

```bash
python3 -m http.server 8000
```

Luego visita `http://localhost:8000`, activa el micrófono y juega alternando sonidos graves y agudos. Deja una pausa breve entre cada sonido para que el siguiente toque pueda detectarse.
