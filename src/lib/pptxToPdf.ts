import JSZip from 'jszip';
import jsPDF from 'jspdf';

const EMU_PER_INCH = 914400;
const toIn = (emu: number) => emu / EMU_PER_INCH;

// XML namespace URIs used in PPTX
const NS = {
  p:   'http://schemas.openxmlformats.org/presentationml/2006/main',
  a:   'http://schemas.openxmlformats.org/drawingml/2006/main',
  r:   'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
};

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function first(el: Element | Document, ns: string, local: string): Element | null {
  return el.getElementsByTagNameNS(ns, local).item(0);
}

function all(el: Element | Document, ns: string, local: string): Element[] {
  return Array.from(el.getElementsByTagNameNS(ns, local));
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt((hex ?? 'ffffff').replace(/[^0-9a-fA-F]/g, '').padEnd(6, '0').slice(0, 6), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function parseRels(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!xml) return map;
  all(parseXml(xml), NS.rel, 'Relationship').forEach(r => {
    const id = r.getAttribute('Id');
    const target = r.getAttribute('Target');
    if (id && target) map.set(id, target);
  });
  return map;
}

function resolveMediaPath(target: string): string {
  if (target.startsWith('../media/')) return 'ppt/media/' + target.slice('../media/'.length);
  if (target.startsWith('../')) return 'ppt/' + target.slice(3);
  return 'ppt/slides/' + target;
}

async function renderSlide(
  pdf: jsPDF,
  slideXml: string,
  zip: JSZip,
  rels: Map<string, string>,
  slideW: number,
  slideH: number,
): Promise<void> {
  const doc = parseXml(slideXml);

  // Default white background
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, slideW, slideH, 'F');

  // Slide background solid fill
  const bg = first(doc, NS.p, 'bg');
  if (bg) {
    const srgb = bg.getElementsByTagNameNS(NS.a, 'srgbClr').item(0);
    if (srgb) {
      const [r, g, b] = hexToRgb(srgb.getAttribute('val') ?? 'ffffff');
      pdf.setFillColor(r, g, b);
      pdf.rect(0, 0, slideW, slideH, 'F');
    }
  }

  const spTree = first(doc, NS.p, 'spTree');
  if (!spTree) return;

  // ── Text shapes ──────────────────────────────────────────────────────────
  for (const sp of all(spTree, NS.p, 'sp')) {
    const xfrm = first(sp, NS.a, 'xfrm');
    if (!xfrm) continue;
    const off = first(xfrm, NS.a, 'off');
    const ext = first(xfrm, NS.a, 'ext');
    if (!off || !ext) continue;

    const x = toIn(parseInt(off.getAttribute('x') ?? '0'));
    const y = toIn(parseInt(off.getAttribute('y') ?? '0'));
    const w = toIn(parseInt(ext.getAttribute('cx') ?? '0'));

    const txBody = first(sp, NS.p, 'txBody');
    if (!txBody) continue;

    let curY = y + 0.06;

    for (const para of all(txBody, NS.a, 'p')) {
      const runs = all(para, NS.a, 'r');
      if (runs.length === 0) { curY += 0.12; continue; }

      let lineH = 0.18;

      for (const run of runs) {
        const rPr = first(run, NS.a, 'rPr');
        const t = first(run, NS.a, 't');
        const text = t?.textContent ?? '';
        if (!text) continue;

        const szHundredths = rPr?.getAttribute('sz');
        const fontPt = szHundredths ? parseInt(szHundredths) / 100 : 16;
        lineH = Math.max(lineH, (fontPt / 72) * 1.4);

        const bold = rPr?.getAttribute('b') === '1';
        const italic = rPr?.getAttribute('i') === '1';
        const style = bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';

        // Text colour
        let tr = 0, tg = 0, tb = 0;
        const solidFill = rPr ? first(rPr, NS.a, 'solidFill') : null;
        const srgb = solidFill ? first(solidFill, NS.a, 'srgbClr') : null;
        if (srgb) [tr, tg, tb] = hexToRgb(srgb.getAttribute('val') ?? '000000');

        pdf.setFontSize(fontPt);
        pdf.setTextColor(tr, tg, tb);
        pdf.setFont('helvetica', style);
        pdf.text(text, x, curY + fontPt / 72, { maxWidth: w > 0 ? w : slideW });
      }

      curY += lineH;
    }
  }

  // ── Pictures ─────────────────────────────────────────────────────────────
  for (const pic of all(spTree, NS.p, 'pic')) {
    const xfrm = first(pic, NS.a, 'xfrm');
    if (!xfrm) continue;
    const off = first(xfrm, NS.a, 'off');
    const ext = first(xfrm, NS.a, 'ext');
    if (!off || !ext) continue;

    const x = toIn(parseInt(off.getAttribute('x') ?? '0'));
    const y = toIn(parseInt(off.getAttribute('y') ?? '0'));
    const w = toIn(parseInt(ext.getAttribute('cx') ?? '0'));
    const h = toIn(parseInt(ext.getAttribute('cy') ?? '0'));

    const blip = first(pic, NS.a, 'blip');
    const embedId = blip?.getAttributeNS(NS.r, 'embed');
    if (!embedId) continue;

    const relTarget = rels.get(embedId);
    if (!relTarget) continue;

    const imgPath = resolveMediaPath(relTarget);
    const imgFile = zip.file(imgPath);
    if (!imgFile) continue;

    try {
      const b64 = await imgFile.async('base64');
      const ext_ = imgPath.split('.').pop()?.toLowerCase() ?? 'png';
      const fmt = ext_ === 'jpg' || ext_ === 'jpeg' ? 'JPEG'
                : ext_ === 'gif' ? 'GIF'
                : 'PNG';
      pdf.addImage(`data:image/${ext_};base64,${b64}`, fmt, x, y, w, h);
    } catch {
      // skip unrenderable images
    }
  }
}

export async function convertPptxToPdf(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const slideFiles = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/(\d+)\.xml$/)?.[1] ?? '0');
      const nb = parseInt(b.match(/(\d+)\.xml$/)?.[1] ?? '0');
      return na - nb;
    });

  if (slideFiles.length === 0) throw new Error('No slides found in PPTX file.');

  // Slide dimensions from presentation.xml
  let slideW = 10, slideH = 5.625;
  const presXml = await zip.file('ppt/presentation.xml')?.async('string') ?? '';
  if (presXml) {
    const sldSz = parseXml(presXml).getElementsByTagNameNS(NS.p, 'sldSz').item(0);
    if (sldSz) {
      const cx = parseInt(sldSz.getAttribute('cx') ?? '0');
      const cy = parseInt(sldSz.getAttribute('cy') ?? '0');
      if (cx && cy) { slideW = cx / EMU_PER_INCH; slideH = cy / EMU_PER_INCH; }
    }
  }

  const orient = slideW >= slideH ? 'l' : 'p';
  const pdf = new jsPDF({ orientation: orient, unit: 'in', format: [slideW, slideH] });

  for (let i = 0; i < slideFiles.length; i++) {
    if (i > 0) pdf.addPage([slideW, slideH], orient);

    const slideName = slideFiles[i].split('/').pop()!;
    const slideXml  = await zip.file(slideFiles[i])!.async('string');
    const relsXml   = await zip.file(`ppt/slides/_rels/${slideName}.rels`)?.async('string') ?? '';
    const rels      = parseRels(relsXml);

    await renderSlide(pdf, slideXml, zip, rels, slideW, slideH);
  }

  return pdf.output('datauristring');
}
