export async function deleteFile(
  url: string,
  bucket: "performance" | "general"
) {
  const marker = `/storage/v1/object/public/${bucket}/`;

  const index = url.indexOf(marker);

  // Si no está en Supabase (imagen local), no hacemos nada
  if (index === -1) {
    return;
  }

  const path = url.substring(index + marker.length);

  const response = await fetch(`/api/${bucket}/delete`, {
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