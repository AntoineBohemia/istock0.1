import type { StockAtDateRow } from "@/lib/supabase/queries/stock-at-date";
import type { StockMovement } from "@/lib/supabase/queries/stock-movements";
import { MOVEMENT_TYPE_LABELS, isPositiveMovement } from "@/lib/supabase/queries/stock-movements";
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
  // Regle metier : l'outillage figure dans les lignes mais jamais dans la
  // valeur d'achats. Il est un investissement, pas une consommation.
  const valueIn = entries.reduce(
    (s, m) =>
      m.unit_price && m.product?.product_type !== "equipment"
        ? s + m.quantity * Number(m.unit_price)
        : s,
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
  const kpiLabels = [
    "Mouvements",
    "Unités entrées",
    "Unités sorties",
    "Valeur entrées HT (hors outillage)",
  ];
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
    const isPositive = isPositiveMovement(m.movement_type);
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
    "L'outillage figure dans les lignes mais n'entre pas dans la valeur d'achats : c'est un investissement, pas une consommation.",
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
  /** Jour arrete, deja formate : « 30 juin 2026 » */
  dateLabel: string;
  /** Jour arrete, pour le nom du fichier : « 2026-06-30 » */
  dateSlug: string;
  orgScope: string; // "SMPR, SEIREN" or "SMPR"
  isFiltered: boolean; // true if single org selected
}

/**
 * Etat de stock a un jour donne.
 *
 * Le fichier ne porte qu'un seul chiffre de stock : celui du jour demande. Il
 * en affichait deux — le stock reconstitue a la date et le stock d'aujourd'hui,
 * plus leur ecart — ce qui obligeait a se demander, colonne par colonne, lequel
 * repondait a la question posee. Les totaux, la valeur et les statuts se lisent
 * desormais tous sur la meme date.
 */
export async function exportStockAtDateExcel({
  data,
  dateLabel,
  dateSlug,
  orgScope,
  isFiltered,
}: ExportOptions): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "iStock";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Stock au ${dateSlug}`);

  // ─── Computed KPIs ─────────────────────────────────────
  const totalRefs = data.length;
  const critiqueCount = data.filter((r) => r.stock_at_date < r.stock_min).length;
  const attentionCount = data.filter(
    (r) => r.stock_at_date >= r.stock_min && r.stock_at_date <= Math.ceil(r.stock_min * 1.25)
  ).length;
  const bonCount = totalRefs - critiqueCount - attentionCount;
  const totalValueAtDate = data.reduce((s, r) => s + r.stock_at_date * (r.price_at_date ?? 0), 0);
  const totalUnitsAtDate = data.reduce((s, r) => s + r.stock_at_date, 0);
  const noPriceCount = data.filter((r) => !r.price_at_date || r.price_at_date <= 0).length;

  const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

  // ─── ROW 1: Title ─────────────────────────────────────
  sheet.mergeCells("A1:I1");
  sheet.getCell("A1").value = "ÉTAT DE STOCK";
  sheet.getCell("A1").font = { ...FONT, bold: true, size: 18, color: { argb: COLORS.black } };
  sheet.getCell("A1").alignment = { vertical: "middle" };
  sheet.getRow(1).height = 30;

  // ─── ROW 2: Date arretee ──────────────────────────────
  // Un jour, pas une periode : le fichier photographie un etat, il ne resume
  // pas un intervalle.
  sheet.mergeCells("A2:I2");
  sheet.getCell("A2").value = `Stock arrêté au ${dateLabel}`;
  sheet.getCell("A2").font = { ...FONT, size: 10, color: { argb: COLORS.darkGray } };
  sheet.getRow(2).height = 18;

  // ─── ROW 3: Org scope ─────────────────────────────────
  sheet.mergeCells("A3:I3");
  const orgLabel = isFiltered ? "Société" : "Sociétés";
  sheet.getCell("A3").value = `${orgLabel} : ${orgScope}`;
  sheet.getCell("A3").font = { ...FONT, size: 10, color: { argb: COLORS.darkGray } };
  sheet.getRow(3).height = 18;

  // ─── ROW 4: Scope ─────────────────────────────────────
  sheet.mergeCells("A4:I4");
  sheet.getCell("A4").value =
    "Périmètre : produits consommables actifs (hors outillage et archives)";
  sheet.getCell("A4").font = { ...FONT, size: 9, italic: true, color: { argb: COLORS.midGray } };
  sheet.getRow(4).height = 16;

  // ─── ROW 5: Spacer ────────────────────────────────────
  sheet.getRow(5).height = 6;

  // ─── ROWS 6–7: KPI labels + values ────────────────────
  const kpiCols = [1, 3, 5, 7, 8, 9];
  const kpiLabels = ["Références", "Unités", "Valeur stock HT", "Critique", "Attention", "Bon"];
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
  // Une seule colonne de stock : celle du jour demande. La date est deja dite
  // en en-tete, la repeter dans l'intitule de colonne n'ajoutait rien.
  const headers = [
    "Produit",
    "Référence",
    "Catégorie",
    "Fournisseur",
    "Stock",
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
    const status = getStatus(row.stock_at_date, row.stock_min);
    const price = row.price_at_date && row.price_at_date > 0 ? row.price_at_date : null;
    const value = price ? row.stock_at_date * price : null;

    const dataRow = sheet.addRow([
      row.product_name,
      dash(row.product_sku),
      dash(row.category_name),
      dash(row.supplier_name),
      row.stock_at_date,
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
    [5, 6, 8, 9].forEach((col) => {
      dataRow.getCell(col).alignment = { vertical: "middle", horizontal: "right" };
    });

    // Status
    const sc = statusStyles[status];
    if (sc) {
      const statusCell = dataRow.getCell(7);
      statusCell.font = { ...FONT, bold: true, size: 9, color: { argb: sc.fg } };
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: sc.bg } };
      statusCell.alignment = { horizontal: "center", vertical: "middle" };
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
  [5, 9].forEach((col) => {
    totalRow.getCell(col).alignment = { vertical: "middle", horizontal: "right" };
  });

  // ─── Notes ─────────────────────────────────────────────
  sheet.addRow([]);
  const noteStartRow = sheet.lastRow!.number + 1;

  const notes = [
    `Méthode de calcul : stock reconstitué par cumul de tous les mouvements (entrées − sorties) enregistrés jusqu'au ${dateLabel} inclus.`,
    `Seuils : Critique = stock < stock min | Attention = stock min ≤ stock ≤ stock min × 1,25 | Bon = stock > stock min × 1,25.`,
    noPriceCount > 0
      ? `${noPriceCount} produit${noPriceCount > 1 ? "s" : ""} sans prix unitaire renseigné (valeur non calculée, indiquée "—").`
      : null,
  ].filter(Boolean) as string[];

  notes.forEach((note, i) => {
    const r = sheet.getRow(noteStartRow + i);
    sheet.mergeCells(`A${noteStartRow + i}:I${noteStartRow + i}`);
    r.getCell(1).value = note;
    r.getCell(1).font = { ...FONT, size: 8, italic: true, color: { argb: COLORS.midGray } };
    r.height = 14;
  });

  // ─── Footer ────────────────────────────────────────────
  const footerRowNum = noteStartRow + notes.length + 1;
  sheet.mergeCells(`A${footerRowNum}:I${footerRowNum}`);
  const footerCell = sheet.getCell(footerRowNum, 1);
  footerCell.value = `Généré par iStock le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  footerCell.font = { ...FONT, size: 8, italic: true, color: { argb: COLORS.midGray } };

  // ─── Column widths ────────────────────────────────────
  const widths = [32, 18, 20, 22, 12, 12, 14, 16, 20];
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  // ─── Number formats ───────────────────────────────────
  sheet.getColumn(5).numFmt = "#,##0";
  sheet.getColumn(6).numFmt = "#,##0";
  sheet.getColumn(8).numFmt = '#,##0.00\\ "€"';
  sheet.getColumn(9).numFmt = '#,##0.00\\ "€"';

  // ─── Auto-filter ──────────────────────────────────────
  sheet.autoFilter = {
    from: { row: 9, column: 1 },
    to: { row: 9 + data.length, column: 9 },
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
  link.download = `etat-stock-${dateSlug}-${safeOrg}.xlsx`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
