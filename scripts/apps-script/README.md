# Tareas con alerta · instalación en Apps Script

El botón de **Tarea y alerta** de la app guarda y envía a través del Apps
Script de la hoja. Mientras no se peguen estos pasos, la pantalla funciona pero
avisa de que el motor de envío no responde: no se pierde nada, simplemente no
sale ningún correo.

Son cinco minutos y se hace **una sola vez**.

> **Al actualizar `alertas.gs` en el repositorio hay que repetir el paso 1 y el
> paso 5.** La hoja no lee este archivo: tiene su propia copia pegada, y hasta
> que no se sustituye y se vuelve a publicar sigue corriendo la versión vieja.

## 1. Pegar el archivo

1. Abre la hoja de cálculo → **Extensiones ▸ Apps Script**.
2. Añade un archivo nuevo (`+` ▸ *Secuencia de comandos*) y llámalo `alertas`.
3. Copia dentro el contenido de [`alertas.gs`](./alertas.gs) y guarda.

## 2. Engancharlo al `doPost`

El proyecto ya tiene un `doPost` que reparte por `action`. Hay que darle una
primera oportunidad a las alertas, **antes** del resto de acciones. Son dos
líneas, y **`e` es el parámetro del propio `doPost`**, se llame como se llame
el resto de variables del archivo:

```js
function doPost(e) {

  //  ↓↓↓  las dos líneas nuevas, lo primero de todo  ↓↓↓
  const deAlertas = manejaAlertas(e);
  if (deAlertas) return deAlertas;
  //  ↑↑↑

  // ...aquí sigue todo lo que ya había, sin tocar nada...
}
```

`manejaAlertas` devuelve `null` cuando la acción no es suya, así que el resto
de la hoja sigue funcionando exactamente igual.

> Si tu `doPost` recibe el parámetro con otro nombre (`function doPost(peticion)`,
> por ejemplo), pásale ése: `manejaAlertas(peticion)`.

**¿La hoja no tiene ningún `doPost`?** Entonces crea uno de una línea:

```js
function doPost(e) {
  return doPostDeAlertas(e);
}
```

## 3. Instalar el disparador

En el editor, elige la función `instalarDisparadorDeAlertas` y pulsa
**Ejecutar**. Google pedirá permiso para enviar correo en tu nombre: hay que
aceptarlo, es lo que permite que las alarmas suenen con la app cerrada.

A partir de ahí, cada 15 minutos el script mira qué toca y lo manda.

Para comprobar que quedó puesto: **Activadores** (el reloj de la izquierda)
debe mostrar una entrada `revisarAlertas · Basado en tiempo`.

## 4. Comprobar sin salir del editor

Elige la función `comprobarAlertas` y pulsa **Ejecutar**. En el registro
(**Ver ▸ Registro de ejecución**) saldrá una de estas tres:

| Lo que dice | Qué significa |
| --- | --- |
| `BIEN: … el disparador está puesto y el correo está autorizado.` | Todo listo; sigue en el paso 5. |
| `A MEDIAS: … falta ejecutar instalarDisparadorDeAlertas.` | El archivo está bien pegado, pero vuelve al paso 3. |
| `A MEDIAS: Nadie ha aceptado todavía el permiso de enviar correo.` | Ejecuta `autorizarCorreo` y acepta lo que pida. |
| `MAL: …` | El mensaje dice qué ha fallado; casi siempre es un permiso sin aceptar. |

Esto sólo prueba el archivo. Si aquí sale `BIEN` y la app sigue diciendo que el
motor no responde, el problema está en el enganche del `doPost` (paso 2) o en
la publicación (paso 5).

Desde la app también se ve: la pantalla de alertas avisa en ámbar de que
**«nadie está repasando el calendario»** mientras falte el paso 3. Es el fallo
que peor se nota, porque sin disparador todo lo demás funciona —se guarda, se
lista y «Enviar ahora» manda el correo— y lo único que no ocurre es que suenen
las alarmas programadas.

## 5. Volver a publicar

**Implementar ▸ Gestionar implementaciones ▸ editar ▸ Nueva versión.** Si te
saltas este paso la app sigue hablando con la versión antigua del script y las
alertas no aparecen.

---

## Si algo falla

**«ReferenceError: datos is not defined».** Es el enganche del paso 2 escrito a
la manera antigua: las primeras instrucciones decían
`manejaAlertas(datos.action, datos)`, y eso sólo funciona si la variable de tu
`doPost` se llama justo `datos`. Sustituye esas líneas por las dos de arriba
—`manejaAlertas(e)`— y vuelve a publicar (paso 5). El archivo sigue admitiendo
la forma antigua, así que si prefieres dejarla, lo que hay que arreglar es el
nombre de la variable, no el `alertas.gs`.

**«Nadie ha aceptado todavía el permiso de enviar correo».** Enviar correo es
un permiso aparte del de la hoja, y no hace falta para listar ni para guardar:
por eso las alertas se crean y se ven con normalidad y el fallo no aparece
hasta el primer envío. En el editor, elige `autorizarCorreo`, pulsa
**Ejecutar** y acepta la pantalla de Google (dirá que la app quiere «enviar
correo electrónico en tu nombre»). En el registro tiene que salir `BIEN: el
permiso de correo está aceptado`.

**¿Ejecutas `autorizarCorreo` y NO sale ninguna pantalla de permisos?** Entonces
no es que no hayas aceptado: es que nadie te lo ha pedido. Este proyecto lleva
la lista de permisos escrita a mano en el manifiesto, y con esa lista puesta
Apps Script pide sólo lo que ponga ahí en vez de deducirlo del código —da igual
cuánto MailApp pegues—. Se arregla añadiendo las dos líneas que faltan:

1. **⚙ Configuración del proyecto** ▸ marca **«Mostrar el archivo de manifiesto
   appsscript.json en el editor»**.
2. Abre `appsscript.json` y añade a `oauthScopes`:

   ```json
   "https://www.googleapis.com/auth/script.send_mail",
   "https://www.googleapis.com/auth/script.scriptapp"
   ```

   El primero es el correo; el segundo, el disparador —`ScriptApp.newTrigger`
   necesita el suyo, así que si falta éste el paso 3 tampoco funciona nunca.
3. Guarda y vuelve a ejecutar `autorizarCorreo`. Ahora **sí** sale la pantalla
   de Google: acéptala.
4. Ejecuta `instalarDisparadorDeAlertas` y `comprobarAlertas`, y publica una
   versión nueva (paso 5).

Si tu `appsscript.json` no tiene ninguna lista `oauthScopes`, este apartado no
va contigo: los permisos se deducen solos y basta con ejecutar la función.

Si sale BIEN y la app sigue diciendo lo mismo, el permiso que falta no es
el tuyo sino el de la implementación: en **Implementar ▸ Gestionar
implementaciones ▸ editar**, comprueba que **Ejecutar como** sea *yo* —y no
«el usuario que accede», que en una petición desde la app no es nadie— y
publica una **versión nueva**.

**«La hoja no devolvió datos legibles».** Apps Script ha contestado con su
página HTML de error en vez de con JSON. Suele ser un permiso sin aceptar
—ejecuta `comprobarAlertas` desde el editor y acepta lo que pida— o un
despliegue sin actualizar (paso 5).

**«Acción desconocida».** El `doPost` ha llegado al final sin reconocer la
acción: repasa que las dos líneas del paso 2 estén **antes** del resto.

**«Nadie está repasando el calendario».** Falta el disparador: paso 3. Guardar,
listar y «Enviar ahora» seguirán funcionando, pero ninguna alarma programada
va a sonar.

**La app no dice nada pero no llega el correo.** Mira **Ejecuciones** en el
editor: si `revisarAlertas` no aparece cada 15 minutos, falta el disparador
(paso 3). Si aparece y falla, el motivo está en su registro.

**Para probar el archivo sin tocar la hoja**, hay un arnés en el repositorio
que carga `alertas.gs` en Node con una hoja de mentira y comprueba las cuatro
formas de llamar al enganche:

```
node scripts/apps-script/prueba-alertas.cjs
```

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

**El correo lleva la alarma dentro.** Un correo llega en silencio y se lee
cuando alguien mira la bandeja; lo que suena en el bolsillo es el calendario
del teléfono. Por eso el aviso viaja además como **cita adjunta** (`.ics`): en
Gmail sale el botón de «Añadir al calendario» y, de un toque, la alarma queda
puesta en el móvil con las campanadas que se hayan elegido en el formulario
—a la hora, media hora antes, el día antes…— y con la serie completa si la
tarea se repite. **No hace falta ningún permiso nuevo:** `MailApp` ya admite
adjuntos, así que esto no toca el manifiesto ni obliga a volver a aceptar nada.

Una tarea **de una sola vez** no puede avisar por anticipado la primera vez: el
correo con la cita sale a la hora señalada, y para entonces «el día antes» ya
pasó. En las que se repiten sí funciona, porque la cita lleva la serie entera.
El formulario lo avisa en pantalla.

Si no se marca ninguna campanada, el correo sale pelado y sin cita, que es como
se comportaba esto antes.

**Una columna nueva: `AVISOS`.** Guarda los minutos de antelación separados por
comas (`0,60,1440`). Va la última de la pestaña a propósito, para que las hojas
que ya estaban en marcha no se descoloquen: las alertas anteriores se leen como
«sin alarma» y siguen mandando su correo igual. La cabecera la escribe el
propio script la primera vez que abre la pestaña, así que no hay que añadirla a
mano.

**Si el script estuvo parado.** Al volver, una alerta repetida no manda un
correo por cada día perdido: adelanta la fecha hasta la próxima que toque y
manda uno solo.

**Quién manda sobre cada columna.** `ENVIOS` y `ULTIMO_ENVIO` son de la hoja y
la app no los pisa nunca: la pantalla guarda la alerta entera con la copia que
leyó al abrirse, y si entre medias ha pasado el disparador, escribir esa copia
tal cual borraría el envío y devolvería `PROXIMO_ENVIO` al pasado —el mismo
correo saldría dos veces—. Por eso al guardar también se rechaza una fecha de
aviso anterior al último envío. Para repetir un aviso ya mandado está el botón
de «Enviar ahora».

**Dos repasos a la vez no pueden duplicar un correo.** `revisarAlertas` coge un
candado de `LockService`, así que el disparador y una ejecución a mano desde el
editor no leen la misma fila sin marcar.

**Dos pestañas nuevas.** El script crea `ALERTAS` (las tareas) y `AGENDA` (los
correos que la app ha aprendido) la primera vez que las necesita. Se pueden
mirar y editar a mano, pero las columnas de fecha están en formato texto a
propósito: si las cambias a fecha, la hora se corre.
