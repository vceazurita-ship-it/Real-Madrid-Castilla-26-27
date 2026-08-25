const API = "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

export async function saveLineup(data: {
  id?: string;
  nombre: string;
  fecha: string;
  rival: string;
  sistema: string;
  alineacion: unknown;
  observaciones: string;
}) {

  const body = new URLSearchParams();

  body.append(
    "action",
    "guardarAlineacion"
  );

  if (data.id)
    body.append("ID", data.id);

  body.append(
    "Nombre",
    data.nombre
  );

  body.append(
    "Fecha",
    data.fecha
  );

  body.append(
    "Rival",
    data.rival
  );

  body.append(
    "Sistema",
    data.sistema
  );

  body.append(
    "Alineacion",
    JSON.stringify(data.alineacion)
  );

  body.append(
    "Observaciones",
    data.observaciones
  );

  const res = await fetch(API,{
    method:"POST",
    body
  });

  /* La respuesta se normaliza siempre a { success }: antes se devolvía el
     JSON en crudo y quien llamaba lo ignoraba, así que un error del servidor
     acababa con un "guardado" en pantalla y la alineación sin escribir. */
  if (!res.ok) {
    return {
      success: false,
      error: `El servidor respondió ${res.status}`,
    };
  }

  try {
    const cuerpo = await res.json();

    if (cuerpo?.success === false) {
      return {
        success: false,
        error: String(cuerpo?.error ?? "El servidor rechazó la alineación"),
      };
    }

    return { success: true, ...cuerpo };
  } catch {
    return {
      success: false,
      error: "La respuesta del servidor no se ha podido leer",
    };
  }

}