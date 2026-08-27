# Tareas con alerta · instalación en Apps Script

El botón de **Tarea y alerta** de la app guarda y envía a través del Apps
Script de la hoja. Mientras no se peguen estos pasos, la pantalla funciona pero
avisa de que el motor de envío no responde: no se pierde nada, simplemente no
sale ningún correo.

Son cinco minutos y se hace **una sola vez**.

## 1. Pegar el archivo

1. Abre la hoja de cálculo → **Extensiones ▸ Apps Script**.
2. Añade un archivo nuevo (`+` ▸ *Secuencia de comandos*) y llámalo `alertas`.
3. Copia dentro el contenido de [`alertas.gs`](./alertas.gs) y guarda.

## 2. Engancharlo al `doPost`

El proyecto ya tiene un `doPost` que reparte por `action`. Hay que darle una
primera oportunidad a las alertas, **antes** del resto de acciones:

```js
function doPost(e) {
  const datos = JSON.parse(e.postData.contents);

  //  ↓↓↓  las dos líneas nuevas  ↓↓↓
  const deAlertas = manejaAlertas(datos.action, datos);
  if (deAlertas) return ContentService
    .createTextOutput(JSON.stringify(deAlertas))
    .setMimeType(ContentService.MimeType.JSON);
  //  ↑↑↑

  // ...aquí sigue todo lo que ya había, sin tocar nada...
}
```

`manejaAlertas` devuelve `null` cuando la acción no es suya, así que el resto
de la hoja sigue funcionando exactamente igual.

## 3. Instalar el disparador

En el editor, elige la función `instalarDisparadorDeAlertas` y pulsa
**Ejecutar**. Google pedirá permiso para enviar correo en tu nombre: hay que
aceptarlo, es lo que permite que las alarmas suenen con la app cerrada.

A partir de ahí, cada 15 minutos el script mira qué toca y lo manda.

Para comprobar que quedó puesto: **Activadores** (el reloj de la izquierda)
debe mostrar una entrada `revisarAlertas · Basado en tiempo`.

## 4. Volver a publicar

**Implementar ▸ Gestionar implementaciones ▸ editar ▸ Nueva versión.** Si te
saltas este paso la app sigue hablando con la versión antigua del script y las
alertas no aparecen.

---

## Cosas que conviene saber

**Cupo diario.** Gmail gratuito permite 100 destinatarios al día; Workspace,
1.500. Si se agota, el envío no se pierde: el script lo deja pendiente y lo
reintenta en la siguiente pasada.

**Los adjuntos viajan como enlace.** El fichero se sube al bucket de Supabase y
al correo va el enlace (las fotos, además, incrustadas). Es a propósito: Gmail
rechaza los adjuntos de más de 25 MB y casi cualquier vídeo de entrenamiento
los pasa. El enlace es público para quien lo tenga, así que no metas ahí nada
confidencial.

**Si el script estuvo parado.** Al volver, una alerta repetida no manda un
correo por cada día perdido: adelanta la fecha hasta la próxima que toque y
manda uno solo.

**Dos pestañas nuevas.** El script crea `ALERTAS` (las tareas) y `AGENDA` (los
correos que la app ha aprendido) la primera vez que las necesita. Se pueden
mirar y editar a mano, pero las columnas de fecha están en formato texto a
propósito: si las cambias a fecha, la hora se corre.
