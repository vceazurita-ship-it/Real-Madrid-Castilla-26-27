export async function saveSeason(data: any) {
  const response = await fetch("/api/performance/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      season: "2026-2027",
      data,
    }),
  });

  if (!response.ok) {
    throw new Error("No se pudo guardar la temporada");
  }

  return response.json();
}