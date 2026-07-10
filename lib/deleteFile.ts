export async function deleteFile(url: string) {
  const marker = "/storage/v1/object/public/performance/";

  const index = url.indexOf(marker);

  if (index === -1) {
    throw new Error("URL inválida");
  }

  const path = url.substring(index + marker.length);

  const response = await fetch("/api/performance/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  });

  if (!response.ok) {
    throw new Error("Error eliminando archivo");
  }

  return response.json();
}