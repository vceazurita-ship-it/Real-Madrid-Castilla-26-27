<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# La ayuda de cada pantalla (regla del analista, 12/11/2026)

Todo cambio que se vea en una pantalla actualiza, en el mismo commit, su entrada de `lib/ayuda/paginas.ts` (lo que hay, de dónde sale y cómo se calcula) y su fecha `revisada: "AAAA-MM-DD"`. Si la pantalla no tiene entrada, se crea. Antes de cerrar, `node scripts/ayuda-al-dia.mjs` debe no listar la pantalla tocada como atrasada.
