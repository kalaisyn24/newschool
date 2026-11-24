import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import fontkit from "@pdf-lib/fontkit";
import { PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef, type PDFFont } from "pdf-lib";

/**
 * Certificate generator: takes the bilingual template exported from Canva
 * (page 1 — Russian, page 2 — English) and replaces the student's name.
 *
 * Each page is a single form XObject. The name is a separate text block in it, found by
 * its unique positioning matrix (`cm`). We remove that block's text (BT…ET) and draw the
 * new name in its place with the same font (Montserrat Regular), size, colour and centre line,
 * so the background and all other elements stay untouched.
 */

const DIR = path.join(process.cwd(), "assets", "certificate");
const TEMPLATE = path.join(DIR, "template.pdf");
const FONT = path.join(DIR, "Montserrat-Regular.ttf");
const FONT_KEY = "FCertName";

type NameSlot = {
  page: number;
  /** Positioning matrix of the name block in the template's form XObject. */
  cm: string;
  /** Horizontal centre of the original name, in the block's local units. */
  centerX: number;
  baselineY: number;
  fontSize: number;
  /** If the name is wider, the font is reduced to fit. */
  maxWidth: number;
};

// Values measured from the template: the original names "Исабекова Нейля" / "Nasyrov Bakhrom"
// start at x = 0.015625 and are 395.97 / 382.83 units wide at 42.66 pt.
const SLOTS: { ru: NameSlot; lat: NameSlot } = {
  ru: { page: 0, cm: "3.126178 0 0 3.126178 1129.47009 1039.89404 cm", centerX: 198.0, baselineY: 44, fontSize: 42.66, maxWidth: 760 },
  lat: { page: 1, cm: "3.126178 0 0 3.126178 1187.38586 1151.7074 cm", centerX: 191.43, baselineY: 44, fontSize: 42.66, maxWidth: 760 },
};

let cache: Promise<[Uint8Array, Uint8Array]> | null = null;
function loadAssets() {
  cache ??= Promise.all([readFile(TEMPLATE), readFile(FONT)]).catch((e) => {
    cache = null;
    throw e;
  });
  return cache;
}

export type CertificateNames = { ru: string; lat: string };

export async function generateCertificatePdf(names: CertificateNames): Promise<Uint8Array> {
  const [templateBytes, fontBytes] = await loadAssets();
  const doc = await PDFDocument.load(templateBytes);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });

  replaceName(doc, font, SLOTS.ru, names.ru);
  replaceName(doc, font, SLOTS.lat, names.lat);

  doc.setTitle(`Сертификат — ${names.ru}`);
  doc.setProducer("Online School");
  return doc.save();
}

function replaceName(doc: PDFDocument, font: PDFFont, slot: NameSlot, rawName: string) {
  const name = rawName.replace(/\s+/g, " ").trim();
  const page = doc.getPage(slot.page);
  const xobjects = page.node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
  if (!xobjects) throw new Error("Шаблон сертификата: не найден слой страницы");

  for (const key of xobjects.keys()) {
    const ref = xobjects.get(key);
    if (!(ref instanceof PDFRef)) continue;
    const stream = doc.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) continue;
    const content = decode(stream);
    const at = content.indexOf(slot.cm);
    if (at < 0) continue;

    const bt = content.indexOf("\nBT\n", at);
    const et = content.indexOf("\nET\n", bt);
    if (bt < 0 || et < 0) break;

    // Fit the name: keep the template size unless the name is too long.
    let size = slot.fontSize;
    const width = font.widthOfTextAtSize(name, size);
    if (width > slot.maxWidth) size = (size * slot.maxWidth) / width;
    const x = slot.centerX - font.widthOfTextAtSize(name, size) / 2;
    const text = name ? `BT\n/${FONT_KEY} ${num(size)} Tf\n1 0 0 -1 ${num(x)} ${num(slot.baselineY)} Tm\n${font.encodeText(name).toString()} Tj\nET` : "";

    const updated = content.slice(0, bt + 1) + text + content.slice(et + 3);
    addFontResource(doc, stream.dict, font);
    stream.dict.set(PDFName.of("Filter"), PDFName.of("FlateDecode"));
    stream.dict.delete(PDFName.of("DecodeParms"));
    doc.context.assign(ref, PDFRawStream.of(stream.dict, deflateSync(Buffer.from(updated, "latin1"))));
    return;
  }
  throw new Error(`Шаблон сертификата: не найдено поле имени на странице ${slot.page + 1}`);
}

function decode(stream: PDFRawStream) {
  const filter = stream.dict.get(PDFName.of("Filter"));
  const raw = Buffer.from(stream.getContents());
  const data = filter?.toString() === "/FlateDecode" ? inflateSync(raw) : raw;
  return data.toString("latin1");
}

function addFontResource(doc: PDFDocument, formDict: PDFDict, font: PDFFont) {
  let resources = formDict.lookup(PDFName.of("Resources"));
  if (!(resources instanceof PDFDict)) {
    resources = doc.context.obj({});
    formDict.set(PDFName.of("Resources"), resources as PDFDict);
  }
  const res = resources as PDFDict;
  let fonts = res.lookup(PDFName.of("Font"));
  if (!(fonts instanceof PDFDict)) {
    fonts = doc.context.obj({});
    res.set(PDFName.of("Font"), fonts as PDFDict);
  }
  (fonts as PDFDict).set(PDFName.of(FONT_KEY), font.ref);
}

function num(n: number) {
  return Number(n.toFixed(4)).toString();
}
