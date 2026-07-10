export async function loadSeason() {
  const res = await fetch("/api/performance/load");

  if (!res.ok) {
    throw new Error("No se pudo cargar la temporada");
  }

  const json = await res.json();

  return json.season.data;
}