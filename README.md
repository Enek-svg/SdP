# SdP – Simulador de coordinación policial

Este proyecto es una página web de simulación policial tipo sala de mando, donde puedes seleccionar avisos, asignar unidades y avanzar el turno.

## Archivos

- `index.html`: estructura de la página
- `styles.css`: estilos y diseño adaptable
- `app.js`: lógica del simulador, reloj, avisos y decisiones

## Cómo probarlo

1. Abre el archivo `index.html` directamente en el navegador, o bien sirve la carpeta con:
   `python3 -m http.server 8000`
2. Entra en `http://localhost:8000`.
3. Selecciona un aviso pendiente, elige una unidad y asigna la intervención.
4. Avanza el reloj manualmente o inicia el tiempo automático; las unidades llegarán y pedirán una decisión.
5. Elige cómo responder al aviso para ver el efecto en el turno.
6. Usa “Nuevo aviso” para añadir más casos al turno.

## Funcionalidades actuales

- Cola de avisos con prioridad y ubicación
- Unidades operativas y asignación rápida
- Mapa operativo con avisos y unidades
- Mapa vectorial de ciudad con calles con nombre, manzanas, parques, río y zona de atención
- Unidades que avanzan por rutas al pasar el tiempo y escenas de manifestación con personas animadas
- Registro del turno y alertas visuales
- Métricas de confianza y avisos atendidos

## Mejoras recomendadas

- Añadir historial por distrito, turno y tipo de incidencia
- Incluir más tipos de unidad: UPR, tráfico, ambulancia, soporte
- Crear un sistema de alarmas por prioridad con sonidos
- Añadir filtros por nivel de riesgo y zona del mapa
- Guardar puntuación por sesión y permitir reinicios con dificultad variable
