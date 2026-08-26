/**
 * El `.pptx` de la pizarra.
 *
 * La pizarra ya se pinta en el lienzo exacto de la plantilla —1920×1080 px,
 * que son los 12192000×6858000 EMU de una diapositiva panorámica—, así que
 * exportar a PowerPoint es meter cada diapositiva capturada a sangre en su
 * hoja: lo que se ve en la sala es lo que se abre en el portátil del cuerpo
 * técnico, sin una sola diferencia de tipografía, de sombra o de recorte.
 *
 * **Cada diapositiva va como imagen, no como cajas de texto editables.** Es a
 * propósito: quien quiera mover a un jugador lo mueve en la pizarra, que es
 * donde están la memoria de puestos y el histórico de la jornada, y vuelve a
 * exportar. Rehacer las chapas como formas de Office daría un fichero que se
 * puede tocar por fuera y que dejaría de parecerse a lo que se enseñó.
 *
 * El paquete se arma con `lib/abp/zip.ts`: un `.pptx` es un ZIP con las partes
 * OOXML mínimas —tipos de contenido, presentación, patrón, diseño, tema y una
 * hoja por diapositiva—, y aquí están todas escritas a mano.
 */

import { bytesDeDataUrl, creaZip, texto, type EntradaZip } from "./zip";

/** El lienzo de la plantilla en EMU: 13,333×7,5 pulgadas, 16:9. */
const SLIDE_CX = 12192000;
const SLIDE_CY = 6858000;

const NS_P =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const CABECERA_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

export function escapaXml(valor: string) {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** El árbol vacío que abre cualquier `spTree`: el grupo raíz de la hoja. */
const GRUPO_RAIZ =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

/* ------------------------------------------------------------------ */
/*  PARTES FIJAS                                                       */
/* ------------------------------------------------------------------ */

function relaciones(lista: { id: string; tipo: string; destino: string }[]) {
  const cuerpo = lista
    .map(
      (rel) =>
        `<Relationship Id="${rel.id}" Type="${REL}/${rel.tipo}" Target="${rel.destino}"/>`,
    )
    .join("");

  return `${CABECERA_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${cuerpo}</Relationships>`;
}

/**
 * El tema.
 *
 * PowerPoint no abre un patrón sin tema aunque la diapositiva no herede de él
 * ni un color: aquí sólo se pinta una imagen a sangre. Se escribe el mínimo
 * que valida —los doce colores, las dos familias y los tres estilos de
 * relleno, línea y efecto— con la paleta de la casa en los acentos.
 */
function tema() {
  const relleno = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';

  const linea = `<a:ln w="9525" cap="flat" cmpd="sng" algn="ctr">${relleno}<a:prstDash val="solid"/></a:ln>`;

  return `${CABECERA_XML}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Castilla ABP"><a:themeElements><a:clrScheme name="Castilla"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="04121F"/></a:dk2><a:lt2><a:srgbClr val="F7F4EC"/></a:lt2><a:accent1><a:srgbClr val="C8A96B"/></a:accent1><a:accent2><a:srgbClr val="00304E"/></a:accent2><a:accent3><a:srgbClr val="1B3A2E"/></a:accent3><a:accent4><a:srgbClr val="F6AFB6"/></a:accent4><a:accent5><a:srgbClr val="E4CE9B"/></a:accent5><a:accent6><a:srgbClr val="0F1E3D"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Castilla"><a:majorFont><a:latin typeface="Barlow Condensed"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Barlow Condensed"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Castilla"><a:fillStyleLst>${relleno}${relleno}${relleno}</a:fillStyleLst><a:lnStyleLst>${linea}${linea}${linea}</a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>${relleno}${relleno}${relleno}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}

function patron() {
  return `${CABECERA_XML}<p:sldMaster ${NS_P}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="04121F"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${GRUPO_RAIZ}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`;
}

function diseno() {
  return `${CABECERA_XML}<p:sldLayout ${NS_P} type="blank" preserve="1"><p:cSld name="Diapositiva de pizarra"><p:spTree>${GRUPO_RAIZ}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

/**
 * Una hoja: la captura a sangre, de esquina a esquina.
 *
 * `noChangeAspect` deja la imagen anclada a la proporción de la diapositiva:
 * si alguien la arrastra sin querer en PowerPoint, se mueve, pero no se
 * deforma el campo.
 */
function hoja(titulo: string) {
  const nombre = escapaXml(titulo);

  return `${CABECERA_XML}<p:sld ${NS_P}><p:cSld><p:spTree>${GRUPO_RAIZ}<p:pic><p:nvPicPr><p:cNvPr id="2" name="${nombre}" descr="${nombre}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_CX}" cy="${SLIDE_CY}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

/* ------------------------------------------------------------------ */
/*  EL PAQUETE                                                         */
/* ------------------------------------------------------------------ */

export type DiapositivaPptx = {
  /** Lo que se lee en la cabecera: "CÓRNER OFENSIVO". */
  titulo: string;
  /** La captura, en `data:image/jpeg;base64,…`. */
  imagen: string;
};

export type DatosPptx = {
  /** Título del documento: "Balón parado · Teruel". */
  titulo: string;
  autor?: string;
  cuando?: Date;
};

/**
 * Arma el `.pptx` con una diapositiva por captura.
 *
 * `[Content_Types].xml` va la primera del ZIP a propósito: es la parte que
 * Office busca antes que ninguna otra para saber qué hay dentro del paquete.
 */
export function creaPptx(
  diapositivas: DiapositivaPptx[],
  datos: DatosPptx,
): Blob {
  const cuando = datos.cuando ?? new Date();

  const iso = cuando.toISOString().replace(/\.\d+Z$/, "Z");

  const autor = datos.autor ?? "RMCF Castilla";

  const numeros = diapositivas.map((_, indice) => indice + 1);

  const overridesHoja = numeros
    .map(
      (numero) =>
        `<Override PartName="/ppt/slides/slide${numero}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
    )
    .join("");

  const tipos = `${CABECERA_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${overridesHoja}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;

  /*
  | Las propiedades básicas cuelgan de otro espacio de nombres —no son del
  | `officeDocument` como el resto—, así que esa relación se escribe entera.
  */
  const raiz = `${CABECERA_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/></Relationships>`;

  /* Las hojas se numeran desde rId2: la rId1 es el patrón. */
  const listaHojas = numeros
    .map((numero) => `<p:sldId id="${255 + numero}" r:id="rId${numero + 1}"/>`)
    .join("");

  const presentacion = `${CABECERA_XML}<p:presentation ${NS_P} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${listaHojas}</p:sldIdLst><p:sldSz cx="${SLIDE_CX}" cy="${SLIDE_CY}"/><p:notesSz cx="${SLIDE_CY}" cy="${SLIDE_CX}"/></p:presentation>`;

  const presentacionRels = relaciones([
    {
      id: "rId1",
      tipo: "slideMaster",
      destino: "slideMasters/slideMaster1.xml",
    },
    ...numeros.map((numero) => ({
      id: `rId${numero + 1}`,
      tipo: "slide",
      destino: `slides/slide${numero}.xml`,
    })),
    {
      id: `rId${numeros.length + 2}`,
      tipo: "theme",
      destino: "theme/theme1.xml",
    },
  ]);

  const core = `${CABECERA_XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapaXml(
    datos.titulo,
  )}</dc:title><dc:creator>${escapaXml(
    autor,
  )}</dc:creator><cp:lastModifiedBy>${escapaXml(
    autor,
  )}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`;

  /*
  | Los títulos de las diapositivas, en las propiedades del fichero: con ellos
  | el panel de PowerPoint y el buscador de Windows dicen qué acción es cada
  | hoja aunque el contenido sea una imagen.
  */
  const titulos = diapositivas
    .map((slide) => `<vt:lpstr>${escapaXml(slide.titulo)}</vt:lpstr>`)
    .join("");

  const app = `${CABECERA_XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>RMCF Castilla · Pizarra de balón parado</Application><Slides>${diapositivas.length}</Slides><TitlesOfParts><vt:vector size="${diapositivas.length}" baseType="lpstr">${titulos}</vt:vector></TitlesOfParts></Properties>`;

  const entradas: EntradaZip[] = [
    { nombre: "[Content_Types].xml", datos: texto(tipos) },
    { nombre: "_rels/.rels", datos: texto(raiz) },
    { nombre: "docProps/core.xml", datos: texto(core) },
    { nombre: "docProps/app.xml", datos: texto(app) },
    { nombre: "ppt/presentation.xml", datos: texto(presentacion) },
    { nombre: "ppt/_rels/presentation.xml.rels", datos: texto(presentacionRels) },
    { nombre: "ppt/theme/theme1.xml", datos: texto(tema()) },
    { nombre: "ppt/slideMasters/slideMaster1.xml", datos: texto(patron()) },
    {
      nombre: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      datos: texto(
        relaciones([
          {
            id: "rId1",
            tipo: "slideLayout",
            destino: "../slideLayouts/slideLayout1.xml",
          },
          { id: "rId2", tipo: "theme", destino: "../theme/theme1.xml" },
        ]),
      ),
    },
    { nombre: "ppt/slideLayouts/slideLayout1.xml", datos: texto(diseno()) },
    {
      nombre: "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      datos: texto(
        relaciones([
          {
            id: "rId1",
            tipo: "slideMaster",
            destino: "../slideMasters/slideMaster1.xml",
          },
        ]),
      ),
    },
  ];

  diapositivas.forEach((slide, indice) => {
    const numero = indice + 1;

    entradas.push(
      {
        nombre: `ppt/slides/slide${numero}.xml`,
        datos: texto(hoja(slide.titulo)),
      },
      {
        nombre: `ppt/slides/_rels/slide${numero}.xml.rels`,
        datos: texto(
          relaciones([
            {
              id: "rId1",
              tipo: "slideLayout",
              destino: "../slideLayouts/slideLayout1.xml",
            },
            {
              id: "rId2",
              tipo: "image",
              destino: `../media/image${numero}.jpeg`,
            },
          ]),
        ),
      },
      {
        nombre: `ppt/media/image${numero}.jpeg`,
        datos: bytesDeDataUrl(slide.imagen),
      },
    );
  });

  return new Blob([creaZip(entradas, cuando)], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}
