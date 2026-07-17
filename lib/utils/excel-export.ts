import type { StockAtDateRow } from "@/lib/supabase/queries/stock-at-date";
import type { Fill, Border } from "exceljs";

// ─── Helpers ──────────────────────────────────────────────

function getStatus(stock: number, min: number): string {
  if (stock < min) return "Critique";
  if (stock <= Math.ceil(min * 1.25)) return "Attention";
  return "Bon";
}

/** Display "—" for empty/null/zero values */
function dash(val: string | null | undefined): string {
  return val?.trim() ? val : "—";
}

function priceOrDash(val: number | null): string | number {
  return val && val > 0 ? val : "—";
}

const COLORS = {
  black: "FF1A1A2E",
  darkGray: "FF374151",
  midGray: "FF6B7280",
  lightGray: "FFE5E7EB",
  lighterGray: "FFF3F4F6",
  white: "FFFFFFFF",
  critique: "FFDC2626",
  critiqueBg: "FFFEE2E2",
  attention: "FFD97706",
  attentionBg: "FFFFFBEB",
  bon: "FF059669",
  bonBg: "FFECFDF5",
} as const;

const FONT = { name: "Calibri" as const, size: 10 };

const BORDER_THIN: Partial<Border> = {
  style: "thin" as const,
  color: { argb: COLORS.lightGray },
};

const BORDER_MEDIUM: Partial<Border> = {
  style: "medium" as const,
  color: { argb: COLORS.darkGray },
};

const NO_FILL: Fill = { type: "pattern", pattern: "none" };

// ─── Main export ──────────────────────────────────────────

interface ExportOptions {
  data: StockAtDateRow[];
  year: number;
  startLabel: string; // "1er janvier 2026"
  endLabel: string; // "17 juillet 2026"
  orgScope: string; // "SMPR, SEIREN" or "SMPR"
  isFiltered: boolean; // true if single org selected
}

export async function exportStockAtDateExcel({
  data,
  year,
  startLabel,
  endLabel,
  orgScope,
  isFiltered,
}: ExportOptions): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "iStock";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Stock ${year}`);

  // ─── Computed KPIs ─────────────────────────────────────
  const totalRefs = data.length;
  const critiqueCount = data.filter((r) => r.stock_at_date < r.stock_min).length;
  const attentionCount = data.filter(
    (r) => r.stock_at_date >= r.stock_min && r.stock_at_date <= Math.ceil(r.stock_min * 1.25)
  ).length;
  const bonCount = totalRefs - critiqueCount - attentionCount;
  const totalValueAtDate = data.reduce((s, r) => s + r.stock_at_date * (r.price_at_date ?? 0), 0);
  const totalUnitsAtDate = data.reduce((s, r) => s + r.stock_at_date, 0);
  const totalUnitsCurrent = data.reduce((s, r) => s + r.stock_current, 0);
  const noPriceCount = data.filter((r) => !r.price_at_date || r.price_at_date <= 0).length;

  const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

  // ─── ROW 1: Title ─────────────────────────────────────
  sheet.mergeCells("A1:K1");
  sheet.getCell("A1").value = "ÉTAT DE STOCK";
  sheet.getCell("A1").font = { ...FONT, bold: true, size: 18, color: { argb: COLORS.black } };
  sheet.getCell("A1").alignment = { vertical: "middle" };
  sheet.getRow(1).height = 30;

  // ─── ROW 2: Date range ────────────────────────────────
  sheet.mergeCells("A2:K2");
  sheet.getCell("A2").value = `Période : du ${startLabel} au ${endLabel}`;
  sheet.getCell("A2").font = { ...FONT, size: 10, color: { argb: COLORS.darkGray } };
  sheet.getRow(2).height = 18;

  // ─── ROW 3: Org scope ─────────────────────────────────
  sheet.mergeCells("A3:K3");
  const orgLabel = isFiltered ? "Société" : "Sociétés";
  sheet.getCell("A3").value = `${orgLabel} : ${orgScope}`;
  sheet.getCell("A3").font = { ...FONT, size: 10, color: { argb: COLORS.darkGray } };
  sheet.getRow(3).height = 18;

  // ─── ROW 4: Scope ─────────────────────────────────────
  sheet.mergeCells("A4:K4");
  sheet.getCell("A4").value =
    "Périmètre : produits consommables actifs (hors outillage et archives)";
  sheet.getCell("A4").font = { ...FONT, size: 9, italic: true, color: { argb: COLORS.midGray } };
  sheet.getRow(4).height = 16;

  // ─── ROW 5: Spacer ────────────────────────────────────
  sheet.getRow(5).height = 6;

  // ─── ROWS 6–7: KPI labels + values ────────────────────
  const kpiCols = [1, 3, 5, 7, 9, 11];
  const kpiLabels = [
    "Références",
    "Unités à date",
    "Valeur stock HT",
    "Critique",
    "Attention",
    "Bon",
  ];
  kpiLabels.forEach((label, i) => {
    const cell = sheet.getCell(6, kpiCols[i]);
    cell.value = label;
    cell.font = { ...FONT, size: 9, color: { argb: COLORS.midGray } };
  });
  sheet.getRow(6).height = 16;

  const kpiValues: { value: string; color: string }[] = [
    { value: totalRefs.toString(), color: COLORS.black },
    { value: fmt(totalUnitsAtDate), color: COLORS.black },
    { value: `${fmt(totalValueAtDate)} \u20AC HT`, color: COLORS.black },
    {
      value: `${critiqueCount} (${totalRefs ? Math.round((critiqueCount / totalRefs) * 100) : 0}%)`,
      color: COLORS.critique,
    },
    {
      value: `${attentionCount} (${totalRefs ? Math.round((attentionCount / totalRefs) * 100) : 0}%)`,
      color: COLORS.attention,
    },
    {
      value: `${bonCount} (${totalRefs ? Math.round((bonCount / totalRefs) * 100) : 0}%)`,
      color: COLORS.bon,
    },
  ];
  kpiValues.forEach((kpi, i) => {
    const cell = sheet.getCell(7, kpiCols[i]);
    cell.value = kpi.value;
    cell.font = { ...FONT, bold: true, size: 13, color: { argb: kpi.color } };
  });
  sheet.getRow(7).height = 24;

  // ─── ROWS 8–9: separator ──────────────────────────────
  sheet.getRow(8).height = 4;
  for (let c = 1; c <= 11; c++) {
    sheet.getCell(9, c).border = { bottom: BORDER_THIN };
  }
  sheet.getRow(9).height = 4;

  // ─── ROW 10: spacer ───────────────────────────────────
  sheet.getRow(10).height = 4;

  // ─── ROW 11: empty (so addRow lands on 12) ────────────
  // Rows 1-11 are manual, row 12 will be the header
  sheet.getRow(11).height = 4;

  // ─── ROW 12: Table headers ────────────────────────────
  const stockColHeader = `Stock au ${endLabel}`;
  const headers = [
    "Produit",
    "Référence",
    "Catégorie",
    "Fournisseur",
    stockColHeader,
    "Stock actuel",
    "Var. vs actuel",
    "Stock min",
    "Statut",
    "Prix unit. HT",
    "Valeur stock HT",
  ];

  // addRow places at next available row
  const headerRow = sheet.getRow(12);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  headerRow.height = 32;

  headerRow.eachCell((cell) => {
    cell.font = { ...FONT, bold: true, size: 9, color: { argb: COLORS.darkGray } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.lighterGray } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: BORDER_MEDIUM };
  });
  // Left-align text columns
  [1, 2, 3, 4].forEach((col) => {
    headerRow.getCell(col).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });

  // ─── Data rows (starting row 13) ──────────────────────
  const statusStyles: Record<string, { fg: string; bg: string }> = {
    Critique: { fg: COLORS.critique, bg: COLORS.critiqueBg },
    Attention: { fg: COLORS.attention, bg: COLORS.attentionBg },
    Bon: { fg: COLORS.bon, bg: COLORS.bonBg },
  };

  data.forEach((row) => {
    const delta = row.stock_current - row.stock_at_date;
    const status = getStatus(row.stock_at_date, row.stock_min);
    const price = row.price_at_date && row.price_at_date > 0 ? row.price_at_date : null;
    const value = price ? row.stock_at_date * price : null;

    const dataRow = sheet.addRow([
      row.product_name,
      dash(row.product_sku),
      dash(row.category_name),
      dash(row.supplier_name),
      row.stock_at_date,
      row.stock_current,
      delta,
      row.stock_min,
      status,
      priceOrDash(price),
      value !== null ? value : "—",
    ]);

    dataRow.height = 22;

    // Base style
    dataRow.eachCell((cell) => {
      cell.font = { ...FONT };
      cell.fill = NO_FILL;
      cell.border = { bottom: BORDER_THIN };
      cell.alignment = { vertical: "middle" };
    });

    // Text left / numbers right
    [1, 2, 3, 4].forEach((col) => {
      dataRow.getCell(col).alignment = { vertical: "middle", horizontal: "left" };
    });
    [5, 6, 7, 8, 10, 11].forEach((col) => {
      dataRow.getCell(col).alignment = { vertical: "middle", horizontal: "right" };
    });

    // Status
    const sc = statusStyles[status];
    if (sc) {
      const statusCell = dataRow.getCell(9);
      statusCell.font = { ...FONT, bold: true, size: 9, color: { argb: sc.fg } };
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: sc.bg } };
      statusCell.alignment = { horizontal: "center", vertical: "middle" };
    }

    // Variation with explicit sign
    const deltaCell = dataRow.getCell(7);
    if (delta > 0) {
      deltaCell.value = `+${delta}`;
      deltaCell.font = { ...FONT, color: { argb: COLORS.bon } };
    } else if (delta < 0) {
      deltaCell.font = { ...FONT, color: { argb: COLORS.critique } };
    } else {
      deltaCell.value = "—";
      deltaCell.font = { ...FONT, color: { argb: COLORS.midGray } };
    }
  });

  // ─── Total row ─────────────────────────────────────────
  sheet.addRow([]); // spacer
  const totalRow = sheet.addRow([
    `Total (${totalRefs} produit${totalRefs > 1 ? "s" : ""})`,
    "",
    "",
    "",
    totalUnitsAtDate,
    totalUnitsCurrent,
    totalUnitsCurrent - totalUnitsAtDate,
    "",
    "",
    "",
    totalValueAtDate,
  ]);
  totalRow.height = 28;
  totalRow.eachCell((cell) => {
    cell.font = { ...FONT, bold: true, size: 11 };
    cell.border = { top: BORDER_MEDIUM };
    cell.alignment = { vertical: "middle" };
  });
  [5, 6, 7, 11].forEach((col) => {
    totalRow.getCell(col).alignment = { vertical: "middle", horizontal: "right" };
  });
  // Delta total with sign
  const totalDelta = totalUnitsCurrent - totalUnitsAtDate;
  const totalDeltaCell = totalRow.getCell(7);
  if (totalDelta > 0) {
    totalDeltaCell.value = `+${totalDelta}`;
    totalDeltaCell.font = { ...FONT, bold: true, size: 11, color: { argb: COLORS.bon } };
  } else if (totalDelta < 0) {
    totalDeltaCell.font = { ...FONT, bold: true, size: 11, color: { argb: COLORS.critique } };
  }

  // ─── Notes ─────────────────────────────────────────────
  sheet.addRow([]);
  const noteStartRow = sheet.lastRow!.number + 1;

  const notes = [
    `Méthode de calcul : stock reconstitué par cumul des mouvements (entrées − sorties) du ${startLabel} au ${endLabel}.`,
    `Seuils : Critique = stock < stock min | Attention = stock min ≤ stock ≤ stock min × 1,25 | Bon = stock > stock min × 1,25.`,
    noPriceCount > 0
      ? `${noPriceCount} produit${noPriceCount > 1 ? "s" : ""} sans prix unitaire renseigné (valeur non calculée, indiquée "—").`
      : null,
  ].filter(Boolean) as string[];

  notes.forEach((note, i) => {
    const r = sheet.getRow(noteStartRow + i);
    sheet.mergeCells(`A${noteStartRow + i}:K${noteStartRow + i}`);
    r.getCell(1).value = note;
    r.getCell(1).font = { ...FONT, size: 8, italic: true, color: { argb: COLORS.midGray } };
    r.height = 14;
  });

  // ─── Footer ────────────────────────────────────────────
  const footerRowNum = noteStartRow + notes.length + 1;
  sheet.mergeCells(`A${footerRowNum}:K${footerRowNum}`);
  const footerCell = sheet.getCell(footerRowNum, 1);
  footerCell.value = `Généré par iStock le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  footerCell.font = { ...FONT, size: 8, italic: true, color: { argb: COLORS.midGray } };

  // ─── Column widths ────────────────────────────────────
  const widths = [32, 18, 20, 22, 20, 14, 14, 12, 12, 16, 20];
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  // ─── Number formats ───────────────────────────────────
  sheet.getColumn(5).numFmt = "#,##0";
  sheet.getColumn(6).numFmt = "#,##0";
  sheet.getColumn(8).numFmt = "#,##0";
  sheet.getColumn(10).numFmt = '#,##0.00\\ "€"';
  sheet.getColumn(11).numFmt = '#,##0.00\\ "€"';

  // ─── Auto-filter ──────────────────────────────────────
  sheet.autoFilter = {
    from: { row: 12, column: 1 },
    to: { row: 12 + data.length, column: 11 },
  };

  // ─── Print setup ──────────────────────────────────────
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
  };

  // ─── Generate & download ──────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;

  const safeOrg = orgScope
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/-$/, "");
  link.download = `etat-stock-${year}-${safeOrg}.xlsx`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
