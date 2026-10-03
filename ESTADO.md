# Estado del proyecto

## Versión
- Actual: 1.15.2
- Último publicado en Expo: 1.15.2 (update afc4305f iOS, f0ed74cc Android)

## Hecho recientemente
- Hoja Create a new plan / Keep current plan al salir de Your profile
- Animación de carga al crear el plan (mínimo 1,2 s, con estado de error)
- Rueda de respuestas arreglada
- Niveles pro: half, marathon y competitive
- Volumen y fondo largo por nivel y objetivo
- Edad, peso y altura influyen un poco en el plan (progresión y arranque suave)
- Editor de workouts arreglado
- Tuerca de Plan a 52 px
- Mike en Stats: mensaje personalizado por reglas (descanso, hitos, récords, rachas, vuelta tras pausa, días perdidos, ritmo, adherencia, horario)
- Pulido: estado vacío de Stats solo con la burbuja de Mike y el botón; vista "Run too short" con distancia y tiempo; botón primario azul en toda la app
- Stats rediseñada con el historial real: tarjeta de Mike, corridas por mes, hoja de detalle (mapa, métricas, parciales, plan vs real) y borrar con confirmación
- Historial de corridas: se guarda toda corrida de 500 m y 3 min o más; las más cortas no se guardan y muestran un aviso en los resultados
- README actualizado y CLAUDE.md dividido en docs/
- Sin sesión regenerativa al inicio de un plan (1.14.8-1.14.9)
- Antes: intervalos, corridas con objetivo, sesiones estructuradas, resultados de corrida, onboarding del Plan

## Pendiente
- Rediseño de la pantalla de corrida (reloj chico en Regenerative)
- Verificar en Expo Go el update 1.15.2
- Probar una corrida real (haptics, alertas, Reps)
- Guardar el nombre del usuario para que Mike salude por nombre; totales o filtros en Stats
- Probar Stats en un build de desarrollo (agregar corridas de ejemplo con pulsación larga en el título)
- Recuperar una corrida si la app se cierra a mitad (hoy se pierde)
- Renovar el plan mensual
- Editar reps, series y zonas en el editor
- Mover un entrenamiento de día
- Calentamiento como nota de texto
- Sesiones de niveles bajos fuera de los límites del editor (fondos 5K de 36-39 min, fartleks de 29-33 min)

## Decisiones
- En sesiones Z2 la distancia es el dato principal de la corrida
- Stats agrupa por mes (con corridas y km del mes); el helper de corridas de ejemplo solo existe con __DEV__
- Un solo color primario para los botones: el azul de Start run (iosBlue); blanco sobre ese azul da 4.0:1, el mismo par que usa Apple
- Mike en Stats calcula lo hecho solo con corridas guardadas; del plan usa solo lo planificado
- Una corrida cuenta (historial y Plan) desde 500 m y 3 min de tiempo en movimiento; las pausas no suman
- El lag se mide también en el bundle de producción

## Dudas abiertas
- Una corrida Regenerative marcaba 1:00:57 y la tarjeta decía 55 min (sin confirmar)
