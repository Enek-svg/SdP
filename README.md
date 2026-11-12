# SdP – Simulador de coordinación policial

Sala de mando en tiempo real: las unidades se mueven solas por el mapa mientras
asignas avisos, decides cómo resolverlos y controlas la velocidad del turno.

## Archivos

- `index.html`: estructura de la página
- `styles.css`: estilos y diseño adaptable
- `utils.js`: funciones pequeñas sin dependencias (reloj, texto seguro, etc.)
- `constants.js`: datos fijos — avisos de ejemplo, unidades, mapa, dificultad
- `engine.js`: reglas del juego y estado, sin tocar el DOM (se puede probar con Node)
- `render.js`: todo el dibujado en pantalla a partir del estado
- `main.js`: conecta todo, controles y el bucle de animación en tiempo real

## Cómo probarlo

1. Abre `index.html` directamente en el navegador, o sirve la carpeta con:
   `python3 -m http.server 8000` y entra en `http://localhost:8000`.
2. El tiempo avanza solo. Usa los botones **1× / 3× / 6×** para la velocidad
   y **Pausa** para detenerlo.
3. Selecciona un aviso pendiente y una unidad libre, elige el enfoque y pulsa
   **Asignar unidad**: la verás moverse por el mapa en tiempo real.
4. Cuando llegue, aparecerá un aviso de "Decisión requerida" (y también en la
   franja superior si tienes otro aviso seleccionado). Elige cómo resolverlo.
5. Con una unidad libre seleccionada, haz clic en el mapa para mandarla de
   patrulla a esa zona sin esperar un aviso.
6. Nuevos avisos aparecen solos de vez en cuando (más rápido en dificultad
   difícil); también puedes forzar uno con "Nuevo aviso".

## Funcionalidades actuales

- Movimiento continuo de las unidades (no por turnos ni botones): cuando
  despachas una o la mandas de patrulla, se desliza por el mapa frame a frame.
- Velocidad del tiempo ajustable (1×/3×/6×) y pausa.
- Generación automática de avisos con temporizador propio, además del botón manual.
- Patrulla libre: reposiciona unidades sin aviso haciendo clic en el mapa.
- El enfoque elegido al despachar (diálogo / tráfico / asistencia) cambia el
  tiempo de llegada y da un extra de confianza si coincide con la decisión final.
- Aviso visual (franja superior) para cualquier aviso esperando decisión,
  aunque no esté seleccionado.
- Sonidos simples (beeps) para nuevo aviso, llegada y decisión, con botón para silenciar.
- Cola de avisos con prioridad y filtros por zona/prioridad.
- Mapa vectorial con calles, manzanas, parque, río y manifestaciones animadas.
- Historial por distrito, registro del turno, métricas de confianza/puntuación
  y guardado automático de la sesión en el navegador.

## Mejoras recomendadas

- Añadir más tipos de unidad: tráfico, ambulancia, soporte, cada una con su propia velocidad.
- Sonidos distintos según la prioridad del aviso, con volumen ajustable.
- Guardar una tabla de mejores puntuaciones (ranking local).
- Añadir un modo "sandbox" sin penalización de puntuación para practicar.
- Caminos que sigan de verdad las calles del mapa SVG en vez de una ruta en L.
