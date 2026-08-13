import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type FileItem = {
  url: string;
  name: string;
  created_at: string;
  type: "image" | "pdf";
};

async function listFolder(path: string): Promise<FileItem[]> {
  const { data, error } = await supabase.storage
    .from("performance")
    .list(path, {
      limit: 1000,
      sortBy: { column: "created_at", order: "asc" },
    });

  if (error || !data) return [];

  let files: FileItem[] = [];

  for (const item of data) {
    const fullPath = `${path}/${item.name}`;

    if ((item as any).id) {
      const { data: publicUrl } = supabase.storage
        .from("performance")
        .getPublicUrl(fullPath);

      files.push({
        url: publicUrl.publicUrl,
        name: item.name,
        created_at: (item as any).created_at,
        type: item.name.toLowerCase().endsWith(".pdf")
          ? "pdf"
          : "image",
      });
    } else {
      const nested = await listFolder(fullPath);
      files.push(...nested);
    }
  }

  return files;
}

export async function GET() {
  try {
    const files = await listFolder("2026");

    return NextResponse.json(files);
  } catch (e) {
    console.error(e);
    return NextResponse.json([], { status: 500 });
  }
}