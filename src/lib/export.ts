// Client-side export helpers: real file downloads for the prototype.

export function downloadFile(
  filename: string,
  content: string,
  mime = "text/plain;charset=utf-8"
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function toCsv(headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
}

function tableToMarkdown(table: HTMLTableElement): string {
  const rows = [...table.querySelectorAll("tr")].map((tr) =>
    [...tr.querySelectorAll("th, td")].map((cell) =>
      (cell.textContent ?? "").trim().replace(/\s+/g, " ").replace(/\|/g, "\\|")
    )
  );
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")];
  const lines = [
    `| ${pad(rows[0]).join(" | ")} |`,
    `| ${Array(width).fill("---").join(" | ")} |`,
    ...rows.slice(1).map((r) => `| ${pad(r).join(" | ")} |`),
  ];
  return lines.join("\n");
}

/**
 * Convert a rendered document <article> into Markdown by walking its
 * headings, paragraphs, lists, and tables.
 */
export function articleToMarkdown(article: HTMLElement): string {
  const out: string[] = [];
  const walk = (el: Element) => {
    for (const child of [...el.children]) {
      const tag = child.tagName.toLowerCase();
      const text = (child.textContent ?? "").trim().replace(/\s+/g, " ");
      if (!text && tag !== "table") continue;
      if (tag === "h2") out.push(`# ${text}`);
      else if (tag === "h3") out.push(`## ${text}`);
      else if (tag === "h4") out.push(`### ${text}`);
      else if (tag === "p") out.push(text);
      else if (tag === "ul" || tag === "ol") {
        out.push(
          [...child.querySelectorAll(":scope > li")]
            .map((li) =>
              `- ${(li.textContent ?? "").trim().replace(/\s+/g, " ").replace(/^—\s*/, "")}`
            )
            .join("\n")
        );
      } else if (tag === "table") {
        out.push(tableToMarkdown(child as HTMLTableElement));
      } else if (tag === "button") {
        continue; // skip action buttons inside documents
      } else {
        walk(child);
      }
    }
  };
  walk(article);
  return out.filter(Boolean).join("\n\n") + "\n";
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "document";
