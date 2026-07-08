import { describe, expect, it } from "vitest";
import { articleToMarkdown, slugify, toCsv } from "./export";

describe("toCsv", () => {
  it("joins headers and rows", () => {
    expect(toCsv(["a", "b"], [["1", "2"]])).toBe("a,b\n1,2");
  });

  it("escapes commas, quotes, and newlines", () => {
    const csv = toCsv(["name"], [['He said "hi", twice']]);
    expect(csv).toBe('name\n"He said ""hi"", twice"');
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("OEE Intelligence — Sprint 03 Report")).toBe(
      "oee-intelligence-sprint-03-report"
    );
  });

  it("falls back to 'document' for empty input", () => {
    expect(slugify("—–—")).toBe("document");
  });
});

describe("articleToMarkdown", () => {
  it("converts headings, paragraphs, lists, and tables", () => {
    const article = document.createElement("article");
    article.innerHTML = `
      <h2>Report Title</h2>
      <section>
        <h3>1. Summary</h3>
        <p>All good.</p>
        <ul><li>— item one</li><li>item two</li></ul>
        <table>
          <tr><th>Key</th><th>Value</th></tr>
          <tr><td>Velocity</td><td>36</td></tr>
        </table>
      </section>
      <button>Export</button>
    `;
    const md = articleToMarkdown(article);
    expect(md).toContain("# Report Title");
    expect(md).toContain("## 1. Summary");
    expect(md).toContain("All good.");
    expect(md).toContain("- item one");
    expect(md).toContain("| Key | Value |");
    expect(md).toContain("| Velocity | 36 |");
    expect(md).not.toContain("Export");
  });
});
