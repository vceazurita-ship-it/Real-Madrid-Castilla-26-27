# Columnas de las hojas de ABP y de faltas — listas cerradas

**Cada valor sale de una lista cerrada**: la app lee las hojas con estos textos
exactos y cualquier otra cosa se cae del recuento. Tildes como están escritas.
Lo que no se vea: `?`. Sin punto y coma ni tabuladores dentro de un campo. Los
equipos por su nombre, nunca por el color.

Comunes a todas: `JORNADA` (de `partido.json → etiqueta`, «LIGA 06») ·
`Rival` (`rivalHoja`) · `Resultado RMC` / `Resultado RIVAL` = el marcador
**final** del partido, igual en todas las filas.

**Minuto**: el del reloj de la TV en el saque/golpeo, minuto que corre
(16:40 → `17`; la 2ª parte sigue desde 45:00 y el añadido pasa de 90:
92:10 → `93`). **Tiempo**: 1ª o 2ª parte (`T1`/`T2` o `1`/`2`: el escritor lo
pone como lo use cada pestaña).

## Saques de banda · `bandaOf` (saca el Castilla) y `bandaDef` (saca el rival)

Cabecera `bandaOf`: `JORNADA Rival Tiempo Minuto Resultado RMC Resultado RIVAL
Sacador Perfil Zona_Saque Tipo_Envio Zona_Caida Calidad_Envio Intencion
N_Bloqueadores Receptor Defensa_Rival Debilidad_Rival Resultado_Final Rutina
Repetir Velocidad_Saque`

Cabecera `bandaDef`: `JORNADA Rival Tiempo Minuto Resultado RMC Resultado
RIVAL Perfil Zona_Saque Tipo_Envio Zona_Caida Calidad_Envio N_Bloqueadores
Receptor Defensa Debilidad_Defensiva Resultado_Final`

**Zona y Perfil se miden SIEMPRE desde el Castilla**, también en los del rival:
- **Zona_Saque**: `Zona 1` tercio de NUESTRA portería · `Zona 2` central · `Zona 3` el de la portería rival.
- **Perfil**: la banda, con el Castilla atacando: `Derecho` · `Izquierdo`.
  (Hudl mide desde el que saca: en los del rival está girado; la base ya lo gira.)
- **Sacador** (sólo of): como lo escribe la hoja (la base ya lo trae así).
- **Tipo_Envio**: `Corto` (a los pies, cerca) · `Bote` (botado o a media altura) · `Largo` (buscando metros).
- **Zona_Caida**, respecto a la portería que ataca **quien saca**:
  `Progresión Carril Exterior` · `Progresión Carril Interior` ·
  `Retroceso Carril Exterior` · `Retroceso Carril Interior` · `Area`.
- **Calidad_Envio**: `1`-`5` (alto si llega limpio y deja seguir; bajo si forzado o a nadie).
- **N_Bloqueadores**: compañeros que hacen bloqueo o pantalla. Casi siempre `0`.
- **Receptor**: `Primera linea` (centrales, laterales, portero) · `Medios` · `Extremo` · `10` · `9`.
- **Resultado_Final**, NOMBRES ABSOLUTOS (sin apellido = Castilla, « Rival» = el rival):
  `Gol` · `Ocasión` · `ABP` (se gana córner o falta) · `Conquista de último tercio` ·
  `Posicional` · `Nada` · `Gol Rival` · `Ocasión Rival` · `ABP Rival` ·
  `Conquista último tercio Rival` · `Posicional Rival`. Por **quién acaba
  mandando**, no por quién sacó.

Sólo `bandaOf`:
- **Intencion**: `Posicional` · `Aceleración exterior` · `Aceleración interior` · `Area`.
- **Velocidad_Saque**: `1x` inmediato · `2x` normal · `3x` se demora.
- **Rutina**: en MAYÚSCULAS (`SAQUE RÁPIDO`, `INTERCAMBIO DE POSICIÓN`,
  `EXTREMO DESCIENDE`, `9 REFERENCIA PARA DESCARGA`, `9 PARA PROLONGACIÓN`,
  `VOLEA DE MEDIOS`…) o `NADA`.
- **Repetir**: `SI` / `NO`.
- **Defensa_Rival** (cómo defiende el rival): `Impedir` (aprieta al receptor) ·
  `Condicionar` (le deja recibir orientado hacia donde quiere) · `Resistir` (replegado).
- **Debilidad_Rival**: `Ninguna` · `Exceso de estrechez` · `Desorden` ·
  `Espacio interior` · `Debilidad en área` · `Espalda defensiva`.

Sólo `bandaDef`:
- **Defensa** (cómo defiende el Castilla): `Impedir` · `Condicionar` · `Resistir`.
- **Debilidad_Defensiva**: `Ninguna` · `Desorden` · `Espacio interior` · `Exceso de estrechez`.

## Córners, faltas a balón parado y penaltis · `piezasOf` y `piezasDef`

Cabecera `piezasOf`: `JORNADA Rival Tiempo Minuto Resultado RMC Resultado
RIVAL Sacador Perfil Tipo_Accion Perfil_Golpeo Tipo_Envio Zona_Caida
Calidad_Envio Intencion N_Atacantes N_Bloqueadores Tipo_Carrera Oc_1P
Oc_Central Oc_2P Oc_Frontal Defensa_Rival Debilidad_Rival Remate Rematador
Tipo_Remate Zona_Remate xG Segundo_Balon Resultado_Final Rutina Repetir`

Cabecera `piezasDef` (el sujeto es el rival, que ataca): `JORNADA Rival Tiempo
Perfil Tipo_Accion Perfil_Golpeo Tipo_Envio Zona_Caida Calidad_Envio
N_Atacantes Tipo_Carrera Oc_1P Oc_Central Oc_2P Oc_Frontal Remate Tipo_Remate
Zona_Remate xG Segundo_Balon Resultado_Final MINUTO` (ojo: `MINUTO` en mayúsculas)

- **Tipo_Accion**: `Córner` · `Penalti` · y en faltas, con la zona al final:
  `Falta lateral exterior Zn` (desde cerca de la banda) · `Falta lateral interior Zn`
  (entre la banda y el lateral del área) · `Falta lateral centrada Zn` (de
  frente, para centrar) · `Falta directa centrada Zn` (de frente, para tirar) ·
  `Falta directa perfilada Zn` (para tirar, escorada) · `Falta indirecta en Zn`
  (lejana, balón al área). Zonas desde la línea de fondo atacada: Z1 dentro del
  área (< ~15 m) · Z2 borde (~16-24) · Z3 ~25-33 · Z4 ~34-42 · Z5 ~43-51 ·
  Z6 ~52-60. Más lejos no va.
- **Sacador** (of): como lo escribe la hoja (`Fortuny`, `Meso`, `Leiva`,
  `Aguado`, `Ciria`, `Pitarch`, `Yañez`, `Fortea`, `Rober`…).
- **Perfil**: banda desde la que se saca, con el que saca atacando: `Izquierdo` · `Derecho` (· `Centro` en faltas).
- **Perfil_Golpeo**: `Cerrado` (se cierra hacia la portería) · `Abierto` · `Neutro`.
- **Tipo_Envio**: `Tenso` · `Bombeado` · `Corto` (y en faltas `Largo`, `Bote`).
- **Zona_Caida**: `Primer Palo` · `Segundo Palo` · `Penalti` · `6m` · en faltas
  también `Fuera` · `Directa P.Barrera` · `Bloqueada Barrera`; jugado en corto,
  la superioridad creada: `2v1` · `3v2` · `3v3`. (En `piezasDef` el primer palo
  se escribe `Primer palo`, con p minúscula.)
- **Calidad_Envio**: `1`-`5` (5 = llega limpio a un rematador en zona de gol).
- **Intencion** (of): `Primer palo` · `Segundo palo` · `Penalti` · `6m` ·
  `Corto + centro` · `Corto + Tiro` · `Directa P.Barrera`.
- **N_Atacantes**: del que saca, dentro o al borde del área en el golpeo.
  **N_Bloqueadores** (of): de ellos, los que bloquean o hacen pantalla.
- **Tipo_Carrera**: `Desde atrás` · `Estático` · `No aplica`.
- **Oc_1P / Oc_Central / Oc_2P / Oc_Frontal**: atacantes en primer palo,
  centro, segundo palo y frontal en el golpeo (con la táctica).
- **Defensa_Rival** (of): `Zonal` · `Mixta` · `Individual` · `No aplica`.
- **Debilidad_Rival** (of): `Ninguna` · `Intervalos de la linea` ·
  `Espalda de la linea` · `Ineficiente Solución a juego corto` · `Segundo palo libre` (u otra breve si se ve clara).
- **Remate**: `Sí` · `No` (· `No aplica`). **Rematador** (of): nombre como en la
  hoja (`Óscar`, `Joan`, `Mario`, `Rachad`, `Yañez`, `Aguado`…); vacío si no hay.
- **Tipo_Remate**: `Limpio` · `Forzado` · `No Remate`.
- **Zona_Remate**: of `1P` · `Central` · `2P` · `Fuera de área` · `No Remate`;
  def `Primer Palo` · `Central` · `Segundo Palo` · `Fuera de área` · `No Remate`.
- **xG**: `0` sin remate; con remate, estimación con punto decimal (córner
  0.04-0.20, falta 0.01-0.10, penalti `0.76`).
- **Segundo_Balon**: `Ganado` · `Perdido` · `No hubo`. **En `piezasDef` va
  desde el Castilla** (`Ganado` = lo recoge el Castilla).
- **Resultado_Final**: of `Gol` · `Ocasión` · `ABP` · `Nada` · `Transición Rival`;
  def (sujeto el rival) `Gol` · `Ocasión` · `ABP` · `Nada` ·
  `Transición Ofensiva` (salimos nosotros con peligro) · `Gol RMCF`.
- **Rutina** (of): MAYÚSCULAS, de las que ya usa el club si encaja
  (`AMPLIAR ESPACIO DE Z2 Y BLOQUEO PARA LIBERAR REMATADOR`,
  `CORTO PARA CENTRO EN MOVIMIENTO`, `BLOQUEO EN CORTA PARA REMATE EN SU ESPALDA`,
  `CORTO PARA GOLPEO DESDE FRONTAL`, `CORTO PARA TIRO`, `DIRECTO PARA BLOQUEO`,
  `DIRECTO AL PALO DE LA BARRERA`) o `NADA`. **Repetir**: `Sí` · `No`.

Para un gol en contra a balón parado, la nota cuenta con precisión cómo fue y
qué falló (quién marcaba al rematador, bloqueo, desde dónde atacó).

## Faltas (pantalla de Faltas) · `ANALISIS FALTAS/<slug>/*-partido.csv`

`id;zona;carril;distancia;entre;nota`, todo **desde el equipo que va a SACAR**:
- **zona**: `campo propio` · `medio campo` · `campo rival`.
- **carril**: `izquierda` · `centro` · `derecha` (atacando).
- **distancia**: `frontal` (dentro o al borde del área, tiro claro) · `media` · `lejana`.
- **entre**: jugadores del equipo que DEFIENDE (el que cometió la falta) entre
  el balón y su portería, **portero incluido**, en el instante de la falta,
  contados en la táctica. En falta lateral junto al área, los que están más
  cerca de su línea de fondo que el balón. Si no se ven todos: `?`.
- **nota**: 1-2 frases: qué pasó, quién sobre quién, cómo se sacó y cómo quedó.
