"use client";

/** Text of a PDF, page by page, read in the browser so the file never has to pass through the server. */
export async function pdfText(file: File, onPage?: (n: number, total: number) => void): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      } else line += " ";
    }
    if (line.trim()) lines.push(line);
    parts.push(`--- page ${i} ---\n${lines.join("\n")}`);
    onPage?.(i, doc.numPages);
  }
  const pages = doc.numPages;
  await task.destroy();
  return { text: parts.join("\n\n"), pages };
}

/** Storage-safe file name, keeping the extension. */
export function safeName(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80) || "file";
}
