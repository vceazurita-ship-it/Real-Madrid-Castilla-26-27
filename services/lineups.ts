const API =
  process.env.NEXT_PUBLIC_API_URL!;

export interface SavedLineup {
  ID: string;
  Nombre: string;
  Fecha: string;
  Rival: string;
  Sistema: string;
  Alineacion: string;
  Observaciones: string;
}

export async function getLineups() {
  const res = await fetch(
    `${API}?action=alineaciones`,
    {
      cache: "no-store",
    }
  );

  if (!res.ok)
    throw new Error("Error cargando alineaciones");

  return res.json();
}

export async function saveLineup(data: {
  nombre: string;
  fecha: string;
  rival: string;
  sistema: string;
  alineacion: string;
  observaciones: string;
}) {
  const body = new URLSearchParams();

  body.append("action", "guardarAlineacion");
  body.append("Nombre", data.nombre);
  body.append("Fecha", data.fecha);
  body.append("Rival", data.rival);
  body.append("Sistema", data.sistema);
  body.append("Alineacion", data.alineacion);
  body.append(
    "Observaciones",
    data.observaciones
  );

  const res = await fetch(API, {
    method: "POST",
    body,
  });

  return res.json();
}

export async function deleteLineup(
  id: string
) {
  const body = new URLSearchParams();

  body.append(
    "action",
    "eliminarAlineacion"
  );

  body.append("ID", id);

  const res = await fetch(API, {
    method: "POST",
    body,
  });

  return res.json();
}