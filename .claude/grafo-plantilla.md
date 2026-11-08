# Plantilla de grafo de agentes (método de la casa, 08/11/2026)

Adaptado del prompt de grafos inspirado en Karpathy y del bucle «SPEC → oráculo → reintentar». Úsalo para cualquier trabajo con varios agentes (rondas de jueces, informes, podcast).

1. **Antes de tocar nada**: define «terminado» (checks) y mide la línea base (`red.mjs areas` → `.cache/expertos/areas-rondaN-base/`).
2. **graph.md** en `.cache/grafos/<trabajo>/`: nodos (una entrada, una salida, un check), aristas (sólo si un nodo usa la salida de otro) y **los ficheros que toca cada nodo**. Dos nodos nunca editan el mismo fichero (el 07/11 dos agentes chocaron en `components/abp/ComparativaPartido.tsx` y `components/ui/DatosEstado.tsx`); si es compartido, se asigna a uno y el otro le deja la petición.
3. **Lo determinista, en código** (unir, contar, comparar): `checks-exportables.mjs`, `vuelca.cjs`, oráculos; el modelo sólo juzga.
4. **Puertas**: primero el check determinista (tsc, eslint, build, capturas sin errores de JS, oráculo), luego los jueces. `checks.md`: nodo | requisito | veredicto | evidencia.
5. **Vueltas**: lo que falla vuelve SÓLO al nodo que lo hizo, con motivo y evidencia; máximo tres intentos. Nunca se rebaja una puerta para aprobar.
6. **Relevo**: `progress.md` tras cada fase (hecho, en curso, bloqueado, rutas de salida, decisiones, siguiente nodo). Al retomar, se lee graph.md + progress.md.
7. **Aprendizaje**: lo que confirma una ejecución va a la memoria del proyecto (y al mapa `mapa.canvas`, `node scripts/agentes/mapa-memoria.mjs`).
