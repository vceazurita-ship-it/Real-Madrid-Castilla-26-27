# Análisis de vídeo de un partido del Castilla

Lo lee Claude Code cuando alguien pulsa **Ajustes → Actualizar análisis del
partido**. Trabajas solo, sin nadie delante: no preguntes, decide con este
manual y apunta las dudas en `informe.md`. Es lo mismo que se hizo a mano con
el J5 (Alcorcón, `Downloads/RMCF CASTILLA/HUDL ALCORCON`), convertido en receta.

`<carpeta>` es la carpeta de trabajo del partido (te la dan al llamarte) y
`<repo>` es `C:/Users/Usuario/Downloads/RMCF CASTILLA/RMCF/Real-Madrid-Castilla-26-27`.

## Lo que ya está hecho cuando llegas

- `partido.json`: jornada (`etiqueta` = «LIGA 06»), rival (`rivalHoja` es como
  lo escribe la hoja), marcador final (`gf`, `gc`), `slug`, `videoTactico`.
- `timeline-hudl.json`, `video-hudl.json`, `hls.json`: el etiquetado de
  Sportscode y la retransmisión de TV en Hudl.
- `conteo.json`: lo que hubo según Hudl. **Es la vara**: al final tiene que
  cuadrar todo con ella.
- `base/bandaOf.tsv`, `base/bandaDef.tsv`: un saque de banda por fila con lo
  que sale del dato. `base/piezas.json`: córners, penaltis y faltas candidatas.
  `faltas/of-hudl.csv`, `faltas/def-hudl.csv`: todas las faltas.
- `jugadas/<id>/ficha.txt`: lo que registró Hudl de cada jugada (apoyo, no
  verdad: **manda la imagen**). `trabajos.json`: el tramo de TV de cada una.
- Los robos ya están contados desde el timeline (no hay que mirarlos).

## Lo que TIENES que dejar (el script que te llamó lo escribe y lo publica)

| Fichero | Qué |
|---|---|
| `<carpeta>/hoja/bandaOf.tsv` | Todos los saques de banda del Castilla, uno por fila, **con todas las columnas de criterio puestas** |
| `<carpeta>/hoja/bandaDef.tsv` | Todos los del rival, igual |
| `<carpeta>/hoja/piezasOf.tsv` | Todos los córners del Castilla + su penalti si lo hubo + las faltas a balón parado que van (ver abajo) |
| `<carpeta>/hoja/piezasDef.tsv` | Lo mismo del rival |
| `<carpeta>/hoja/decision-faltas.tsv` | `id⇥va⇥motivo` para **cada** candidata `abp-*` de `base/piezas.json`: `sí`/`no` y por qué |
| `C:/Users/Usuario/Downloads/RMCF CASTILLA/ANALISIS FALTAS/<slug>/of-partido.csv` y `def-partido.csv` | Todas las faltas (mismos `id` que `faltas/*-hudl.csv`), con zona, carril, distancia, **entre** y nota revisados con la imagen |
| `C:/Users/Usuario/Downloads/RMCF CASTILLA/ANALISIS TRANSICIONES/<slug>/tramos.json` | El desfase cámara táctica − Hudl por tramos: `[{"hasta": <seg Hudl>, "d": <seg>}, …, {"hasta": 1000000000, "d": …}]`. Sin vídeo táctico: `[]` |
| `C:/Users/Usuario/Downloads/RMCF CASTILLA/ANALISIS TRANSICIONES/<slug>/partido.json` | Rellena `goles` (`[{seg, de: "castilla"|"rival", texto}]`, `seg` = segundo de la táctica) y añade a `notas` lo raro del vídeo (cortes, pausas, hacia dónde ataca cada uno) |
| `<carpeta>/informe.md` | Qué has hecho, qué no se ha podido ver y por qué, y las dudas |

Las cabeceras de `hoja/*.tsv` son **las columnas de la hoja** (lista exacta en
`COLUMNAS.md`), más `id` y `hudl_ms` si quieres (se quedan fuera al escribir).
Un valor que no se puede ver es `?` (se escribe vacío). Nunca inventes.

**No escribas en las hojas ni hagas git**: lo hace el script al acabar. Sí
puedes (y debes) validar con
`node <repo>/scripts/partido/escribir.cjs --carpeta "<carpeta>"` (sin `--hoja`
no escribe nada): avisa de columnas que no existen y de valores que la hoja no
ha visto nunca. Corrígelos salvo que de verdad sean nuevos.

Ve apuntando cada avance en `<carpeta>/progreso.txt` (una línea: «córners 6/11»).

## Orden de trabajo

### 1. Imágenes de la TV (minutos)
```
node <repo>/scripts/hudl-fotogramas.mjs --partido "<carpeta>" --trabajos "<carpeta>/trabajos.json"
```
Deja `s_01.jpg…` en cada `jugadas/<id>/` (1 fotograma por segundo, dos apilados
por imagen). La TV lleva marcador y **reloj del partido** arriba a la izquierda
y dorsales legibles. Mira una imagen de las primeras jugadas y apunta en
`informe.md` **de qué color va cada equipo** (el marcador dice qué siglas son
las del Castilla) y el sentido de ataque de cada parte.

Si un trozo de Hudl no baja (pasa: hay tramos rotos), esa jugada se mira sólo
en la táctica y se dice en la nota.

### 2. El desfase de la cámara táctica (antes que nada de la táctica)
La táctica (`videoTactico`) no va al tiempo de Hudl: tiene cortes y el desfase
**cambia** a lo largo del partido (J5: +5,5 s, luego −26, luego +71, luego
+35). Mídelo con anclas repartidas: el saque inicial, cada gol, el inicio de la
2ª parte y un córner o falta cada ~10 minutos.
```
node <repo>/scripts/partido/tactica.cjs dura  "<carpeta>"
node <repo>/scripts/partido/tactica.cjs busca "<carpeta>" ancla-<n> <desde> <hasta> 2
node <repo>/scripts/partido/tactica.cjs corta "<carpeta>" ancla-<n> <segundo>
```
`busca` hace una rejilla de miniaturas (6 por fila, la k-ésima es
`desde + k·paso`): un córner es un racimo en un área y uno solo en la esquina;
el saque inicial, los dos equipos en su campo. Cuando cambia el desfase entre
dos anclas hay un corte: acótalo con otra ancla en medio. Escribe
`tramos.json` y apunta los cortes en la nota del partido.

**ffmpeg sobre la táctica, de uno en uno, nunca en paralelo** (es HEVC de
varios gigas: dos a la vez revientan la memoria). Por eso **los cortes de la
táctica los haces tú**, jugada a jugada, antes de repartir el trabajo; los
agentes sólo miran imágenes.

### 3. Cortar la táctica de cada jugada
Para cada `jugadas/<id>` (banda, córners, candidatas a ABP, faltas), con el
desfase de su tramo: `busca` ±15 s alrededor de `hudl + d`, encuentra el
instante del saque/golpeo/falta y `corta`. Deja `tacticas/<id>/s_*.jpg`.
Orientación en la táctica: la portería de abajo es la más cercana a la cámara;
comprueba en cada parte hacia dónde ataca el Castilla mirando a los porteros.

### 4. Mirar las jugadas: agentes en tandas
Reparte las jugadas entre agentes (herramienta Agent), **4-5 jugadas por
agente y tandas de 6-8 agentes a la vez** — 20 a la vez agota el límite y los
corta a media faena. Cada agente recibe: la ruta de `COLUMNAS.md` (las listas
cerradas), las carpetas `jugadas/<id>` y `tacticas/<id>`, los colores de cada
equipo y el sentido de ataque, y devuelve una fila TSV por jugada con la
cabecera de su hoja **más una columna `nota`** (2-4 frases: qué pasa, quién,
cómo acaba). Que escriba su resultado en `<carpeta>/revision/<tanda>.tsv`
(lo que está en disco se salva si se corta).

Reparto que funciona: TV para minuto (reloj), sacador, dorsales, remate y
resultado; **táctica para ocupación (Oc_*), atacantes, bloqueadores, defensa,
debilidad y los defensores «entre» de las faltas**. Las faltas se ven en la TV
4-12 s DESPUÉS de la marca de Hudl.

Coste: el J5 llevó unos 170 k tokens por agente de 5 jugadas. Un partido son
~100 jugadas: si el límite de sesión corta, **termina lo que esté en disco**,
deja las filas que falten con las columnas del dato (de `base/`) y dilo en
`informe.md`. Mejor todas las filas con huecos que filas de menos.

### 5. Juntar, cuadrar y validar
- `hoja/bandaOf.tsv` y `bandaDef.tsv`: **exactamente** tantas filas como
  `conteo.json → banda` (nuestro / rival). Parte de `base/`, conserva `id` y
  `hudl_ms`, y pon encima lo de las tandas.
- Córners: **exactamente** `conteo.json → corners`. Hudl a veces marca un
  «Shot» que no fue (J5, córner del 17): manda la imagen.
- Penaltis: `conteo.json → penaltis`, con `Tipo_Accion` = `Penalti`.
- Faltas a balón parado: decide **todas** las `abp-*` en
  `decision-faltas.tsv`. Van sólo las sacadas como ABP de ataque (se busca el
  área o el tiro) desde Z1-Z6; las que Hudl marca con «Free kicks» de equipo
  van casi siempre. Una falta en corto para seguir jugando NO va.
- `Resultado RMC` / `Resultado RIVAL` = el **marcador final** en todas las
  filas (`gf`, `gc`), no el del momento.
- Perfil_Golpeo que no se vea: sale del pie del sacador en filas anteriores de
  la hoja (J5: Fortuny zurdo: izquierda → Abierto, derecha → Cerrado).
- En «piezas defensivo», `Segundo_Balon` va **desde el Castilla**.
- Valida con `escribir.cjs` sin `--hoja` y corrige los avisos.

### 6. Faltas (pantalla de Faltas)
Copia `faltas/of-hudl.csv` y `def-hudl.csv` a
`ANALISIS FALTAS/<slug>/of-partido.csv` y `def-partido.csv` (ya hay una copia
del dato: sobrescríbela) con zona, carril, distancia, **entre** (defensores
del que cometió la falta entre el balón y su portería, portero incluido,
contados en la táctica; si no se ven todos, `?`) y la nota revisados. Formato:
`id;zona;carril;distancia;entre;nota`, sin punto y coma dentro de la nota.

### 7. Informe
`informe.md`: lo hecho, lo que no se pudo ver y por qué, lo raro del vídeo, y
cuántas filas lleva cada fichero contra `conteo.json`.
