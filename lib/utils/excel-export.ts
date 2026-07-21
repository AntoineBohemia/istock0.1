import type { StockAtDateRow } from "@/lib/supabase/queries/stock-at-date";
import type { StockMovement } from "@/lib/supabase/queries/stock-movements";
import { MOVEMENT_TYPE_LABELS } from "@/lib/supabase/queries/stock-movements";
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

// ─── Export des mouvements ────────────────────────────────

/** Types qui augmentent le stock — le signe change la lecture de la ligne */
const POSITIVE_TYPES = new Set(["entry", "unassign_equipment"]);

interface MovementsExportOptions {
  movements: StockMovement[];
  /** Libelle de la periode filtree, ou « Tout l'historique » */
  periodLabel: string;
  /** Resume des filtres actifs, affiche en clair dans le fichier */
  filtersLabel: string;
  /** Nombre total correspondant aux filtres, pour signaler une troncature */
  totalMatching: number;
}

/**
 * Export Excel du journal des mouvements.
 *
 * Reprend la mise en forme de l'etat de stock (titre, rappel des filtres,
 * indicateurs, tableau filtrable, notes) pour que les deux fichiers se
 * ressemblent une fois ouverts.
 */
export async function exportMovementsExcel({
  movements,
  periodLabel,
  filtersLabel,
  totalMatching,
}: MovementsExportOptions): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "iStock";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Mouvements");

  const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

  // ─── Indicateurs ───────────────────────────────────────
  // Les corrections s'excluent des indicateurs : une annulation d'entree est
  // techniquement une sortie, mais rien n'est reellement sorti du stock. Les
  // compter gonflerait les totaux des deux cotes.
  const real = movements.filter((m) => !m.reverses_movement_id);
  const entries = real.filter((m) => m.movement_type === "entry");
  const exits = real.filter((m) => m.movement_type.startsWith("exit"));
  const unitsIn = entries.reduce((s, m) => s + m.quantity, 0);
  const unitsOut = exits.reduce((s, m) => s + m.quantity, 0);
  const valueIn = entries.reduce(
    (s, m) => s + (m.unit_price ? m.quantity * Number(m.unit_price) : 0),
    0
  );
  const noPriceCount = entries.filter((m) => !m.unit_price).length;

  // ─── Lignes 1 a 4 : titre et contexte ──────────────────
  sheet.mergeCells("A1:J1");
  sheet.getCell("A1").value = "MOUVEMENTS DE STOCK";
  sheet.getCell("A1").font = { ...FONT, bold: true, size: 18, color: { argb: COLORS.black } };
  sheet.getCell("A1").alignment = { vertical: "middle" };
  sheet.getRow(1).height = 30;

  sheet.mergeCells("A2:J2");
  sheet.getCell("A2").value = `Période : ${periodLabel}`;
  sheet.getCell("A2").font = { ...FONT, size: 10, color: { argb: COLORS.darkGray } };
  sheet.getRow(2).height = 18;

  sheet.mergeCells("A3:J3");
  sheet.getCell("A3").value = `Filtres : ${filtersLabel}`;
  sheet.getCell("A3").font = { ...FONT, size: 10, color: { argb: COLORS.darkGray } };
  sheet.getRow(3).height = 18;

  sheet.mergeCells("A4:J4");
  sheet.getCell("A4").value =
    movements.length < totalMatching
      ? `Attention : export limité à ${fmt(movements.length)} lignes sur ${fmt(totalMatching)} correspondantes.`
      : `${fmt(movements.length)} mouvement${movements.length > 1 ? "s" : ""} exporté${movements.length > 1 ? "s" : ""}.`;
  sheet.getCell("A4").font = {
    ...FONT,
    size: 9,
    italic: true,
    // Une troncature doit se voir : en rouge, pas en gris parmi les notes
    color: { argb: movements.length < totalMatching ? COLORS.critique : COLORS.midGray },
  };
  sheet.getRow(4).height = 16;

  sheet.getRow(5).height = 6;

  // ─── Lignes 6-7 : indicateurs ──────────────────────────
  const kpiCols = [1, 3, 5, 7];
  const kpiLabels = ["Mouvements", "Unités entrées", "Unités sorties", "Valeur entrées HT"];
  kpiLabels.forEach((label, i) => {
    const cell = sheet.getCell(6, kpiCols[i]);
    cell.value = label;
    cell.font = { ...FONT, size: 9, color: { argb: COLORS.midGray } };
  });
  sheet.getRow(6).height = 16;

  const kpiValues: { value: string; color: string }[] = [
    { value: fmt(movements.length), color: COLORS.black },
    { value: `+${fmt(unitsIn)}`, color: COLORS.bon },
    { value: `−${fmt(unitsOut)}`, color: COLORS.critique },
    { value: `${fmt(valueIn)} € HT`, color: COLORS.black },
  ];
  kpiValues.forEach((kpi, i) => {
    const cell = sheet.getCell(7, kpiCols[i]);
    cell.value = kpi.value;
    cell.font = { ...FONT, bold: true, size: 13, color: { argb: kpi.color } };
  });
  sheet.getRow(7).height = 24;

  sheet.getRow(8).height = 12;

  // ─── Ligne 9 : en-tetes ────────────────────────────────
  const headers = [
    "Date",
    "Type",
    "Produit",
    "Référence",
    "Quantité",
    "Prix unit. HT",
    "Montant HT",
    "Technicien",
    "Fournisseur",
    "Société",
  ];
  const headerRow = sheet.getRow(9);
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
  [1, 2, 3, 4, 8, 9, 10].forEach((col) => {
    headerRow.getCell(col).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });

  // ─── Lignes de donnees ─────────────────────────────────
  movements.forEach((m) => {
    const isPositive = POSITIVE_TYPES.has(m.movement_type);
    const price = m.unit_price ? Number(m.unit_price) : null;
    const amount = price ? m.quantity * price : null;

    const row = sheet.addRow([
      // Date reelle : Excel peut alors trier et filtrer par periode
      m.created_at ? new Date(m.created_at) : "—",
      MOVEMENT_TYPE_LABELS[m.movement_type] ?? m.movement_type,
      m.product?.name ?? "—",
      dash(m.product?.sku),
      isPositive ? m.quantity : -m.quantity,
      price ?? "—",
      amount ?? "—",
      m.technician ? `${m.technician.first_name} ${m.technician.last_name}` : "—",
      m.supplier?.name ?? "—",
      m.organization?.name ?? "—",
    ]);

    row.height = 22;
    row.eachCell((cell) => {
      cell.font = { ...FONT };
      cell.fill = NO_FILL;
      cell.border = { bottom: BORDER_THIN };
      cell.alignment = { vertical: "middle" };
    });
    [1, 2, 3, 4, 8, 9, 10].forEach((col) => {
      row.getCell(col).alignment = { vertical: "middle", horizontal: "left" };
    });
    [5, 6, 7].forEach((col) => {
      row.getCell(col).alignment = { vertical: "middle", horizontal: "right" };
    });

    // Le sens du mouvement se lit a la couleur de la quantite
    row.getCell(5).font = {
      ...FONT,
      bold: true,
      color: { argb: isPositive ? COLORS.bon : COLORS.critique },
    };
  });

  // ─── Total ─────────────────────────────────────────────
  sheet.addRow([]);
  const totalRow = sheet.addRow([
    `Total (${movements.length} mouvement${movements.length > 1 ? "s" : ""})`,
    "",
    "",
    "",
    unitsIn - unitsOut,
    "",
    valueIn,
    "",
    "",
    "",
  ]);
  totalRow.height = 28;
  totalRow.eachCell((cell) => {
    cell.font = { ...FONT, bold: true, size: 11 };
    cell.border = { top: BORDER_MEDIUM };
    cell.alignment = { vertical: "middle" };
  });
  [5, 7].forEach((col) => {
    totalRow.getCell(col).alignment = { vertical: "middle", horizontal: "right" };
  });

  // ─── Notes ─────────────────────────────────────────────
  sheet.addRow([]);
  const noteStartRow = sheet.lastRow!.number + 1;
  const notes = [
    "Quantité : positive pour une entrée ou une restitution d'outil, négative pour une sortie ou une assignation.",
    "Seules les entrées portent un prix unitaire ; les sorties n'ont donc pas de montant.",
    noPriceCount > 0
      ? `${noPriceCount} entrée${noPriceCount > 1 ? "s" : ""} sans prix unitaire renseigné (montant non calculé, indiqué "—").`
      : null,
  ].filter(Boolean) as string[];

  notes.forEach((note, i) => {
    const r = sheet.getRow(noteStartRow + i);
    sheet.mergeCells(`A${noteStartRow + i}:J${noteStartRow + i}`);
    r.getCell(1).value = note;
    r.getCell(1).font = { ...FONT, size: 8, italic: true, color: { argb: COLORS.midGray } };
    r.height = 14;
  });

  const footerRowNum = noteStartRow + notes.length + 1;
  sheet.mergeCells(`A${footerRowNum}:J${footerRowNum}`);
  const footerCell = sheet.getCell(footerRowNum, 1);
  footerCell.value = `Généré par iStock le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  footerCell.font = { ...FONT, size: 8, italic: true, color: { argb: COLORS.midGray } };

  // ─── Largeurs et formats ───────────────────────────────
  [18, 20, 34, 18, 12, 16, 18, 22, 22, 18].forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
  sheet.getColumn(1).numFmt = "dd/mm/yyyy hh:mm";
  sheet.getColumn(5).numFmt = "#,##0";
  sheet.getColumn(6).numFmt = '#,##0.00\\ "€"';
  sheet.getColumn(7).numFmt = '#,##0.00\\ "€"';

  sheet.autoFilter = {
    from: { row: 9, column: 1 },
    to: { row: 9 + movements.length, column: 10 },
  };

  sheet.views = [{ state: "frozen", ySplit: 9 }];

  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
  };

  // ─── Generation ────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mouvements-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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

  // ─── ROW 8: spacer ────────────────────────────────────
  sheet.getRow(8).height = 12;

  // ─── ROW 9: Table headers ────────────────────────────
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

  const headerRow = sheet.getRow(9);
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

  // ─── Data rows (starting row 10) ──────────────────────
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
    from: { row: 9, column: 1 },
    to: { row: 9 + data.length, column: 11 },
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
