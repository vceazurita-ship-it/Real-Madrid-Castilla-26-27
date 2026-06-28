const API =
  process.env.NEXT_PUBLIC_GAS_URL!;

export async function saveLineup(data: {
  id?: string;
  nombre: string;
  fecha: string;
  rival: string;
  sistema: string;
  alineacion: any;
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

  return await res.json();

}