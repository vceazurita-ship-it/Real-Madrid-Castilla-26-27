# Escribir microciclos en el registro de tareas

Desde el 01/10/2026 la lectura y la escritura del registro de tareas
(`registroFilas` y `registroGuardar`) viven en **`scripts/abp-hoja.gs`**, el
script del libro de ABP: la pestaña de registro está en ese libro.

Para ponerlo al día: abre el libro de ABP → Extensiones → Apps Script, pega
`scripts/abp-hoja.gs` entero, guarda y **Implementar → Gestionar
implementaciones → lápiz → Versión: «Nueva versión» → Implementar** (así no
cambia la URL, que está en `lib/abp/sheets.ts` como `ABP_ESCRITURA_URL`).

Para comprobarlo, el `ping` tiene que listar `registroFilas` y
`registroGuardar` en `acciones`.
