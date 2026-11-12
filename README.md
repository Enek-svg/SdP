# SdP – Simulador de coordinación policial

Este proyecto es una página web de simulación policial tipo sala de mando, donde puedes seleccionar avisos, asignar unidades y avanzar el turno.

## Cómo probarlo

1. Abre el archivo `index.html` directamente en el navegador, o bien sirve la carpeta con:
   `python3 -m http.server 8000`
2. Entra en `http://localhost:8000`.
3. Selecciona un aviso pendiente, elige una unidad y asigna la intervención.
4. Pulsa “Avanzar 5 minutos” para simular la resolución del aviso.
5. Usa “Nuevo aviso” para añadir más casos al turno.

## Funcionalidades actuales

- Cola de avisos con prioridad y ubicación
- Unidades operativas y asignación rápida
- Mapa operativo con avisos y unidades
- Registro del turno y alertas visuales
- Métricas de confianza y avisos atendidos

## Mejoras recomendadas

- Añadir historial por distrito, turno y tipo de incidencia
- Incluir más tipos de unidad: UPR, tráfico, ambulancia, soporte
- Crear un sistema de alarmas por prioridad con sonidos
- Añadir filtros por nivel de riesgo y zona del mapa
- Guardar puntuación por sesión y permitir reinicios con dificultad variable
