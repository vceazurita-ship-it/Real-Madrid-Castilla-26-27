@echo off
rem ===================================================================
rem  ENTRAR EN WYSCOUT CON OTRA CUENTA (04/10/2026)
rem ===================================================================
rem  Doble clic. Borra la sesion guardada del Chrome de Wyscout (la del
rem  juvenil, sin el layout ALL), abre la ventana para que entres con la
rem  cuenta del Castilla y, con ella, baja la liga como actualizar-wys.cmd.
rem  La contrasena la escribes tu en esa ventana: el script no la ve.
rem  Desde ahi, el boton de Ajustes y la tarea de los martes usan esa sesion.

call "%~dp0actualizar-wys.cmd" --cambiar-cuenta
