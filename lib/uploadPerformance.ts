export async function uploadPerformanceFile(
  file: File,
  folder: string
): Promise<string> {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("folder", folder);

  const response = await fetch("/api/performance/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Error subiendo archivo");
  }

  const data = await response.json();

  return data.url;
}