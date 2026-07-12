export async function uploadFile(
  file: File,
  folder: string
) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("folder", folder);

  const response = await fetch("/api/general/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Error subiendo archivo");
  }

  return response.json();
}