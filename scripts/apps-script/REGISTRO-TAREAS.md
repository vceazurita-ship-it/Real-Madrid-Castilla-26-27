# Crear microciclos en la hoja · instalación en Apps Script

La pantalla **En obras ▸ Crear microciclo (hoja)** (`/laboratorio/microciclo`)
arma la semana con el calendario y escribe las filas en la pestaña de
**registro de tareas**. Para que pueda escribir hay que pegar
[`registro-tareas.gs`](./registro-tareas.gs) en el Apps Script de la hoja.

Mientras no se pegue, la pantalla funciona y deja preparar el microciclo, pero
al pulsar «Escribir en la hoja» contesta que la hoja no conoce la acción. No se
pierde nada.

> Al actualizar `registro-tareas.gs` en el repositorio hay que repetir el paso 1
> y el paso 3: la hoja tiene su propia copia pegada.

## 1. Pegar el archivo

1. Abre la hoja de cálculo → **Extensiones ▸ Apps Script**.
2. Añade un archivo nuevo (`+` ▸ *Secuencia de comandos*) y llámalo
   `registro-tareas`.
3. Copia dentro el contenido de `registro-tareas.gs` y guarda.

## 2. Engancharlo al `doPost`

Igual que las alertas: dos líneas al principio del `doPost` que ya existe.

```js
function doPost(e) {

  //  ↓↓↓  las dos líneas nuevas  ↓↓↓
  const deRegistro = manejaRegistro(e);
  if (deRegistro) return deRegistro;
  //  ↑↑↑

  // ...lo que ya había, sin tocar nada...
}
```

`manejaRegistro` devuelve `null` cuando la acción no es suya (`registroGuardar`
y `registroFilas` son las únicas que atiende), así que el resto sigue igual.

## 3. Publicar

**Implementar ▸ Gestionar implementaciones ▸ Nueva versión.** Sin esto la app
sigue hablando con la versión vieja del script.

## Qué hace, y por qué así

- **Clona la última fila** (`insertRowsAfter` + `copyTo`) antes de escribir. La
  pestaña tiene tres columnas que son **fórmulas** —«Carga Ponderada» (Tiempo ×
  Intensidad), «Demanda Cognitiva» (sale del bloque Densidad…Motivación) y
  «Carga cognitiva» (Tiempo × Demanda Cognitiva)— y `appendRow` las dejaría
  vacías. También arrastra el formato y las listas desplegables.
- **No escribe nunca esas tres columnas.** Si las escribiera, machacaría la
  fórmula con un número y la fila dejaría de recalcular.
- **La cabecera no está en la fila 1**: encima hay un título del club. El script
  busca la fila que empieza por «Temporada», como hace `lib/abp/registro.ts`.
- **`Fecha` se escribe como fecha de verdad**, no como texto: en texto, el
  calendario de microciclos deja de ver la fila.
- **Relee lo escrito y lo devuelve**, que es la comprobación que vale: el `ok`
  de una escritura no dice nada por sí solo.
- **Rehacer un microciclo** (`reemplazar`) borra sus filas antes de volver a
  escribirlas. Sin eso quedarían las viejas y las nuevas a la vez.

## Después de escribir

Las pantallas que leen el **CSV publicado** (`/microcycles` y la transferencia
de Data Análisis) tardan unos minutos en ver lo nuevo: es la caché de Google,
no la app. El calendario de microciclos va por el Apps Script y se refresca
antes, pero tiene caché propia en Supabase.
