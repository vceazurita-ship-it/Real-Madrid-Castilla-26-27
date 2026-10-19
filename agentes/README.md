# La red de agentes del Castilla

Montada el 19/10/2026. Prepara los **borradores** de la semana (informe post del partido, previa del rival, balón parado y el mensaje para los jugadores) y vigila la plataforma. **No envía nada**: lo que llega al cuerpo técnico o a los jugadores lo revisa y lo manda el analista desde los diálogos de siempre.

## Cómo está hecha

```
                    ┌────────────── código (siempre igual) ──────────────┐
  datos ──► paquete.mjs ──► .cache/agentes/jNN/ ──► red.mjs (orquestador) ──► informe-*.md
            (sólo lee)        12 ficheros + índice     │                       final-*.json
                                                       ▼                       mensaje-*.json
                      ┌──────────────────── agentes (modelos) ─────────────────────┐
                      │ vigilante-datos ─► analista-partido ─┐                      │
                      │   (haiku)          analista-rival  ──┼─► verificador ──┐    │
                      │                    analista-abp    ──┘    (sonnet)     │    │
                      │                    (opus / sonnet)    ◄── 1 corrección ┘    │
                      │                                       ─► redactor-jugadores │
                      │ lector-cortes (haiku) · revisor-cambios (sonnet) ·          │
                      │ mantenedor (opus)                                           │
                      └─────────────────────────────────────────────────────────────┘
```

**Lo que es código y no agente, a propósito:** juntar los datos (`paquete.mjs`), el orden, los reintentos, juntar las secciones y aplicar las correcciones (`red.mjs`). Lo mecánico no se le deja a un modelo: podría «recordar» un dato en vez de leerlo, y cuesta.

## Los agentes (`.claude/agents/`)

| Agente | Modelo | Lee | Entrega | Cuándo |
|---|---|---|---|---|
| `vigilante-datos` | haiku | frescura e índice del paquete | qué falta, gravedad y cómo arreglarlo | antes de escribir |
| `analista-partido` | opus | goles, Wyscout, plan de partido | borrador del post, cada frase con su fuente | lunes |
| `analista-rival` | opus | ficha, Wyscout, tipología, once, notas | borrador de la previa | miércoles |
| `analista-abp` | sonnet | hojas de ABP, microciclo, tipología | sección de balón parado | post y previa |
| `verificador` | sonnet | borrador + paquete | ok / corregir / quitar por frase, con el valor visto | tras cada analista |
| `redactor-jugadores` | sonnet | el informe YA verificado | mensaje de ≤ 700 caracteres y 3 puntos | al final |
| `lector-cortes` | haiku | 3 fotogramas por corte + datos de Hudl | qué pasa en cada corte, sin nombres | cuando hay cortes |
| `revisor-cambios` | sonnet | git diff | fallos reales con escenario y arreglo | a mano o en GitHub |
| `mantenedor` | opus | registros del vigía | diagnóstico con evidencia y arreglo propuesto | a mano |

Todos **sólo leen** (lo comprueba `scripts/agentes/valida.mjs` en GitHub). Las reglas comunes (`agentes/reglas.md`: sólo lo que está en el paquete, cada frase con fuente, lo que no tiene dato no se nombra, hora de Madrid…) se añaden a todos. La salida de cada uno es un JSON con esquema fijo (`agentes/esquemas/`), que Claude Code garantiza con `--json-schema`.

## Usarla

```bash
node scripts/agentes/red.mjs semana              # post de la última jornada + previa de la siguiente
node scripts/agentes/red.mjs post --jornada 8
node scripts/agentes/red.mjs previa --jornada 9
node scripts/agentes/red.mjs mantenimiento        # diagnóstico del ordenador del club
node scripts/agentes/red.mjs revision --desde HEAD~5
#   --forzar  rehace aunque las entradas no hayan cambiado
```

Deja en `.cache/agentes/jNN/`: `informe-post.md` / `informe-previa.md` (para leer), `final-*.json` (lo verificado), `mensaje-*.json` (para el grupo), y los borradores y verificaciones de cada agente. `.cache/agentes/red.json` apunta qué hizo cada paso, cuánto tardó y cuánto costó.

Los agentes también se pueden usar sueltos en cualquier sesión de Claude Code en este repositorio (son subagentes normales).

## Por qué es eficiente

- **Sólo interpreta un modelo caro.** Opus escribe; Sonnet verifica y redacta; Haiku vigila y lee fotogramas.
- **En paralelo** lo que no depende entre sí (analista principal y de ABP; sus verificaciones).
- **Una sola corrección.** Si el verificador no aprueba, el analista corrige una vez con los reparos delante; si sigue sin aprobar, se para y los reparos van al humano. Sin bucles.
- **No repite.** Cada paso guarda una huella de sus entradas; si no han cambiado, reutiliza su salida sin gastar.
- **Sin equipaje.** Se lanza sin conectores ni habilidades (`--strict-mcp-config`, `--disable-slash-commands`): con ellos, cada llamada cargaba 628.000 tokens y una pregunta de Haiku costaba 0,63 $; sin ellos, 0,003 $.
- **Contexto pequeño.** El paquete va en ficheros de pocos KB con un índice: cada agente lee sólo lo suyo.

## Trampas medidas

- `claude -p --agent X --json-schema …` **no aplica el esquema** (devuelve texto libre). Por eso `red.mjs` lee el fichero del agente y lo pasa como `--model`, `--tools` y `--append-system-prompt`.
- BeSoccer bloquea las IP de GitHub: la red de la semana corre en el ordenador del club, no en Actions.
- La hoja de ABP defensivo no tiene marcador; Wyscout llega los martes (un post del lunes sale sin cifras del partido y el vigilante lo dice).
