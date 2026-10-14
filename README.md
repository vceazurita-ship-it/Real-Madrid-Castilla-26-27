# Real Madrid Castilla · 2026-27

[![Comprobación](https://github.com/vceazurita-ship-it/Real-Madrid-Castilla-26-27/actions/workflows/ci.yml/badge.svg)](https://github.com/vceazurita-ship-it/Real-Madrid-Castilla-26-27/actions/workflows/ci.yml)
[![CodeQL](https://github.com/vceazurita-ship-it/Real-Madrid-Castilla-26-27/actions/workflows/codeql.yml/badge.svg)](https://github.com/vceazurita-ship-it/Real-Madrid-Castilla-26-27/actions/workflows/codeql.yml)
[![Web en pie](https://github.com/vceazurita-ship-it/Real-Madrid-Castilla-26-27/actions/workflows/web-viva.yml/badge.svg)](https://github.com/vceazurita-ship-it/Real-Madrid-Castilla-26-27/actions/workflows/web-viva.yml)
[![Calidad de la web](https://github.com/vceazurita-ship-it/Real-Madrid-Castilla-26-27/actions/workflows/calidad-web.yml/badge.svg)](https://github.com/vceazurita-ship-it/Real-Madrid-Castilla-26-27/actions/workflows/calidad-web.yml)

La app del cuerpo técnico: rival, partido, balón parado, entrenamiento, jugador y datos.

Publicada en <https://real-madrid-castilla-26-27.vercel.app>. Cada subida a `main` la despliega Vercel.

## Cómo está hecha

- **Next.js 16.2.6** con cambios propios. Antes de tocar nada de Next, leer `node_modules/next/dist/docs/` (ver `AGENTS.md`).
- **Datos:** hojas de Google (a través del Apps Script), Supabase (`app_documents`) y los ficheros de Wyscout y Opta en `public/data`.
- **Trabajos de noche:** `scripts/jornada-nocturna.cmd` en el ordenador del club. No va en GitHub porque BeSoccer bloquea sus máquinas.

## Trabajar en local

```bash
npm install
npm run dev
```

Hace falta `.env.local` con las llaves de Supabase y la URL del Apps Script.

Antes de publicar:

```bash
npx tsc --noEmit -p .
npx eslint <ficheros tocados>
```

## Lo que hace GitHub solo

| Qué | Cuándo | Dónde se ve |
| --- | --- | --- |
| **Comprobación:** tipos y lint | En cada subida de código | Actions → Comprobación |
| **CodeQL:** fallos de seguridad del código | En cada subida y los lunes | Security → Code scanning |
| **Dependabot:** librerías al día | Una propuesta al mes; los avisos de seguridad, al momento | Pull requests |
| **Revisión de librerías:** frena una librería con fallo grave | En cada propuesta | La propia propuesta |
| **Web en pie:** las pantallas principales cargan | Cada día a las 7:00 | Actions → Web en pie, y correo si falla |
| **Calidad de la web:** Lighthouse mide velocidad, accesibilidad, buenas prácticas y SEO, y dice qué falla en cada pantalla | Tras cada despliegue (las principales) y los lunes (todas) | Actions → Calidad de la web, en el resumen |
