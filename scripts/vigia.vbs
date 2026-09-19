' Arranca el vigia de los encargos SIN VENTANA.
'
' El Programador de tareas abre una consola negra para cualquier cmd o node
' que lance con la sesion abierta, y el vigia se pasa el dia despierto: con
' esto no se ve. Espera a que node termine (el True del final) para que la
' tarea siga "en ejecucion" mientras el vigia vive y no se lance otro encima.
'
' Lo registra scripts\instalar-vigia.ps1; no hace falta abrirlo a mano.

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

raiz = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
shell.CurrentDirectory = raiz

codigo = shell.Run("node """ & raiz & "\scripts\vigia.cjs""", 0, True)
WScript.Quit codigo
