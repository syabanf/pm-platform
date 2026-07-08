"use client";

import { downloadFile, toCsv } from "@/lib/export";
import { Button } from "@/components/ui";
import { usePrototype } from "@/lib/store";

export function ExportCsvButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  const { showToast } = usePrototype();
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        downloadFile(filename, toCsv(headers, rows), "text/csv;charset=utf-8");
        showToast("CSV file downloaded.", "success");
      }}
    >
      Export CSV
    </Button>
  );
}
