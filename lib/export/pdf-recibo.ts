/**
 * PDF de recibo (documento rótulo:valor, A4) com jsPDF — ex.: CRPT da
 * Portaria 671. O jsPDF é carregado sob demanda (dynamic import) para não
 * entrar no bundle principal do app.
 */

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;

export interface PdfReciboSecao {
  titulo?: string;
  itens: { rotulo: string; valor: string }[];
}

export interface PdfRecibo {
  titulo: string;
  subtitulo?: string;
  secoes: PdfReciboSecao[];
  rodape?: string[];
}

/** Gera e dispara o download do recibo em PDF. */
export async function baixarPDFRecibo(
  nomeArquivo: string,
  opts: PdfRecibo,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = MARGIN;
  const right = PAGE_W - MARGIN;
  const valorX = left + 42;
  const valorW = right - valorX;
  let y = MARGIN;

  const quebra = (y2: number) => {
    if (y2 > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text("Hora Útil 360", left, y);
  y += 6;
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.text(opts.titulo, left, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  if (opts.subtitulo) {
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(opts.subtitulo, left, y);
    y += 6;
  }
  y += 2;

  for (const secao of opts.secoes) {
    if (secao.titulo) {
      quebra(y + 7);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 35, 72);
      doc.text(secao.titulo.toUpperCase(), left, y + 4);
      doc.setDrawColor(220);
      doc.line(left, y + 6, right, y + 6);
      doc.setFont("helvetica", "normal");
      y += 9;
    }
    for (const item of secao.itens) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(item.rotulo, left, y + 4);
      doc.setTextColor(30);
      const linhas = doc.splitTextToSize(item.valor || "—", valorW) as string[];
      linhas.forEach((ln, i) => {
        if (i > 0) y += 5;
        quebra(y + 5);
        doc.text(ln, valorX, y + 4);
      });
      y += 7;
    }
    y += 1;
  }

  if (opts.rodape?.length) {
    y += 2;
    doc.setDrawColor(220);
    doc.line(left, y, right, y);
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(130);
    for (const ln of opts.rodape) {
      const wrapped = doc.splitTextToSize(ln, right - left) as string[];
      for (const w of wrapped) {
        quebra(y + 4);
        doc.text(w, left, y + 3);
        y += 4;
      }
    }
  }

  doc.save(`${nomeArquivo}.pdf`);
}
