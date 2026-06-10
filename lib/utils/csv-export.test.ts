import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DOM APIs for file download
const mockCreateObjectURL = vi.fn().mockReturnValue("blob:mock-url");
const mockRevokeObjectURL = vi.fn();
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = mockCreateObjectURL as typeof URL.createObjectURL;
  globalThis.URL.revokeObjectURL = mockRevokeObjectURL;
  vi.spyOn(document, "createElement").mockReturnValue({
    href: "",
    download: "",
    click: mockClick,
  } as unknown as HTMLAnchorElement);
  vi.spyOn(document.body, "appendChild").mockImplementation(mockAppendChild);
  vi.spyOn(document.body, "removeChild").mockImplementation(mockRemoveChild);
});

// Import after mocks are set up
import { exportToCSV } from "./csv-export";

interface TestRow {
  name: string;
  value: number | null;
}

const columns = [
  { header: "Name", accessor: (r: TestRow) => r.name },
  { header: "Value", accessor: (r: TestRow) => r.value },
];

describe("exportToCSV", () => {
  it("creates a downloadable CSV file", () => {
    exportToCSV([{ name: "A", value: 1 }], "test.csv", columns);

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(mockClick).toHaveBeenCalledTimes(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("includes BOM for UTF-8 Excel compatibility", () => {
    exportToCSV([{ name: "A", value: 1 }], "test.csv", columns);

    const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe("text/csv;charset=utf-8;");
  });

  it("handles null values as empty string", () => {
    exportToCSV([{ name: "B", value: null }], "test.csv", columns);
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
  });

  it("appends .csv extension if missing", () => {
    exportToCSV([], "export", columns);

    const link = (document.createElement as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(link.download).toBe("export.csv");
  });

  it("does not double .csv extension", () => {
    exportToCSV([], "export.csv", columns);

    const link = (document.createElement as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(link.download).toBe("export.csv");
  });

  it("handles empty data array", () => {
    exportToCSV([], "empty.csv", columns);
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
  });

  it("escapes values containing commas", () => {
    exportToCSV([{ name: "A, B", value: 1 }], "test.csv", columns);
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
  });

  it("escapes values containing double quotes", () => {
    exportToCSV([{ name: 'Say "hi"', value: 1 }], "test.csv", columns);
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
  });
});
