interface CSVColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV<T>(
  data: T[],
  filename: string,
  columns: CSVColumn<T>[]
): void {
  const headerRow = columns.map((col) => escapeCSV(col.header)).join(",");
  const rows = data.map((row) =>
    columns.map((col) => escapeCSV(col.accessor(row))).join(",")
  );

  const csvContent = [headerRow, ...rows].join("\r\n");

  // BOM UTF-8 for Excel FR compatibility
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
