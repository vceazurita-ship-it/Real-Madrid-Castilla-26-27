/**
 * Convierte las fotos originales de la plantilla en los recortes que sirve la
 * web (`/public/players`). Los originales pesan ~380 MB en PNG; la salida son
 * WebP con transparencia de ~35 KB.
 *
 *   node scripts/optimize-player-photos.mjs
 *
 * Entrada (no se versionan, ver .gitignore):
 *   public/images/Recorte cerca/NOMBRE APELLIDO.png
 *   public/images/Recorte lejos/Fondo de “NOMBRE APELLIDO_JT19542” eliminado_resultado.png
 *
 * Salida:
 *   public/players/cerca/nombre-apellido.webp   (400px de ancho)
 *   public/players/lejos/nombre-apellido.webp   (620px de ancho)
 *
 * Si añades gente nueva, acuérdate de meter su slug en PLAYER_IMAGE_SLUGS
 * (lib/playerImages.ts); el script lo imprime al terminar.
 *
 * sharp llega como dependencia de Next, no hace falta instalar nada.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const VARIANTS = {
  cerca: { dir: "public/images/Recorte cerca", width: 400 },
  lejos: { dir: "public/images/Recorte lejos", width: 620 },
};

const OUT = "public/players";

/**
 * Misma persona con nombre distinto en cada carpeta -> un único slug.
 * La clave es el slug "malo"; el valor, el que se queda.
 */
const CANON = {
  "javier-padilla-delegado": "javier-padilla",
  "joan-mascaro": "joan-martinez",
  "leo-maitre": "leo-lemaitre",
  "manex-rezonla": "manex-rezola",
  "manuel-angel-moran": "manuel-angel",
};

const slugify = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9ñÑ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/ /g, "-");

/** Saca el nombre de la persona del nombre de archivo. */
function personName(file) {
  let name = file.replace(/\.png$/i, "");

  // Los "lejos" vienen del quitafondos: Fondo de “X_JT19542” eliminado_resultado
  const quoted = name.match(/[“"](.+)[”"]/);
  if (quoted) name = quoted[1];

  name = name.replace(/_[A-Z]{2}\d+\s*$/i, "");            // _JT19542
  name = name.replace(/\s*[-–]\s*[A-ZÁÉÍÓÚÑ0-9º ]+$/u, ""); // " - FISIO"
  name = name.replace(/\s{2,}[A-ZÁÉÍÓÚÑ]+$/u, "");          // "  DELEGADO"

  return name.trim();
}

/** Ignora los sidecar `._` que deja macOS al copiar. */
const pngsIn = (dir) =>
  fs.readdirSync(dir).filter((f) => !f.startsWith("._") && /\.png$/i.test(f));

const slugs = new Set();

for (const [variant, { dir, width }] of Object.entries(VARIANTS)) {
  if (!fs.existsSync(dir)) {
    console.error(`Falta la carpeta de originales: ${dir}`);
    process.exit(1);
  }

  const outDir = path.join(OUT, variant);
  fs.mkdirSync(outDir, { recursive: true });

  for (const file of pngsIn(dir)) {
    const raw = slugify(personName(file));
    const slug = CANON[raw] ?? raw;
    slugs.add(slug);

    await sharp(path.join(dir, file))
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 90, effort: 6 })
      .toFile(path.join(outDir, `${slug}.webp`));
  }

  console.log(`${variant}: ${pngsIn(dir).length} fotos -> ${outDir}`);
}

// Aviso si alguien se ha quedado con un solo recorte.
const sueltos = [...slugs].filter((slug) =>
  Object.keys(VARIANTS).some(
    (v) => !fs.existsSync(path.join(OUT, v, `${slug}.webp`))
  )
);
if (sueltos.length) console.warn("Sin las dos versiones:", sueltos.join(", "));

console.log(`\n${slugs.size} personas. Slugs para lib/playerImages.ts:\n`);
console.log([...slugs].sort().map((s) => `  "${s}",`).join("\n"));
