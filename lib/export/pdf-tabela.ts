/**
 * PDF de tabela (A4) com jsPDF — desenho manual. Usado pelo espelho de ponto.
 * jsPDF é carregado sob demanda (dynamic import) para não entrar no bundle
 * principal.
 */

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const ROW_H = 7;

export interface PdfTabela {
  titulo: string;
  subtitulo?: string;
  colunas: string[];
  linhas: (string | number)[][];
  /** Linha de totais destacada no fim (opcional). */
  totais?: (string | number)[];
  /** Larguras relativas por coluna (mesma quantidade das colunas). */
  pesos?: number[];
}

/** Gera e dispara o download do PDF da tabela. */
export async function baixarPDFTabela(
  nomeArquivo: string,
  opts: PdfTabela,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = MARGIN;
  const right = PAGE_W - MARGIN;
  const usableW = right - left;

  const n = opts.colunas.length;
  const pesos =
    opts.pesos && opts.pesos.length === n ? opts.pesos : opts.colunas.map(() => 1);
  const somaPesos = pesos.reduce((a, b) => a + b, 0);
  const larguras = pesos.map((p) => (p / somaPesos) * usableW);
  const x = (col: number) =>
    left + larguras.slice(0, col).reduce((a, b) => a + b, 0);

  let y = MARGIN;

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

  function cabecalho() {
    doc.setFillColor(15, 35, 72);
    doc.rect(left, y, usableW, ROW_H, "F");
    doc.setTextColor(255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    opts.colunas.forEach((c, i) => doc.text(String(c), x(i) + 2, y + 5));
    doc.setFont("helvetica", "normal");
    y += ROW_H;
  }

  function linha(valores: (string | number)[], bold = false) {
    if (y + ROW_H > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
      cabecalho();
    }
    doc.setTextColor(30);
    doc.setFontSize(8);
    if (bold) doc.setFont("helvetica", "bold");
    valores.forEach((cel, i) => {
      const txt = cel === "" || cel == null ? "—" : String(cel);
      doc.text(txt, x(i) + 2, y + 5);
    });
    if (bold) doc.setFont("helvetica", "normal");
    doc.setDrawColor(220);
    doc.line(left, y + ROW_H, right, y + ROW_H);
    y += ROW_H;
  }

  cabecalho();
  for (const l of opts.linhas) linha(l);
  if (opts.totais) linha(opts.totais, true);

  doc.save(`${nomeArquivo}.pdf`);
}
