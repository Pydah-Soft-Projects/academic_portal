export type PrintOptions = {
  title: string;
  subtitle?: string;
  hideHeader?: boolean;
};

export function printElement(element: HTMLElement, options: PrintOptions) {
  printHtml(element.innerHTML, options);
}

export function printHtml(content: string, options: PrintOptions) {
  const styles = Array.from(document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
    'link[rel="stylesheet"], style',
  ))
    .map((node) => node.outerHTML)
    .join("\n");

  const frame = document.createElement("iframe");
  frame.setAttribute("title", "Print report");
  frame.style.position = "fixed";
  frame.style.left = "0";
  frame.style.top = "0";
  frame.style.width = "100vw";
  frame.style.height = "auto";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) {
    frame.remove();
    return;
  }

  frameDocument.open();
  frameDocument.write(`<!doctype html><html><head><title>${escapeHtml(options.title || "Timetable Report")}</title>${styles}<style>
@page {
  size: landscape;
  margin: 0 !important;
}
html, body {
  background: white !important;
  margin: 0 !important;
  padding: 0 !important;
  font-family: Arial, Helvetica, sans-serif;
  color: #0f172a;
  overflow: visible !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
.print-layout-table {
  width: 100% !important;
  border: none !important;
  border-collapse: collapse !important;
  margin: 0 !important;
  padding: 0 !important;
  table-layout: fixed !important;
}
.print-layout-table > thead {
  display: table-header-group !important;
}
.print-layout-table > tfoot {
  display: table-footer-group !important;
}
.print-layout-table > thead > tr > th.print-page-top-spacer {
  height: 12mm !important;
  min-height: 12mm !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
  background: transparent !important;
  font-weight: normal !important;
}
.print-layout-table > tfoot > tr > td.print-page-bottom-spacer {
  height: 12mm !important;
  min-height: 12mm !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
  background: transparent !important;
}
.print-layout-table > tbody > tr > td.print-page-body-cell {
  border: none !important;
  padding: 0 14mm !important;
  margin: 0 !important;
  background: transparent !important;
  vertical-align: top !important;
}
.print-report-content {
  width: 100% !important;
  height: auto;
  overflow: visible;
  padding: 0 !important;
  margin: 0 !important;
  box-sizing: border-box !important;
}
.print-report-content table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin: 0 0 18px;
  page-break-inside: avoid;
  break-inside: avoid;
}
.print-report-content thead {
  display: table-header-group;
}
.print-report-content th, .print-report-content td {
  border: 1px solid #94a3b8 !important;
  border-radius: 0 !important;
  padding: 5px;
  font-size: 9px;
  vertical-align: top;
  word-break: break-word;
  box-shadow: none !important;
}
.print-report-content th {
  background: #f1f5f9 !important;
  color: #0f172a !important;
  font-weight: 700;
}
.print-report-content .batch-title {
  font-size: 12px;
  font-weight: 700;
  margin: 10px 0 5px;
  border-bottom: 1px solid #cbd5e1;
  padding-bottom: 3px;
  break-after: avoid;
}
.print-report-content .batch-table + .batch-table {
  break-before: page;
  page-break-before: always;
}
.print-report-content .empty-cell {
  color: #94a3b8;
  text-align: center;
}
.print-report-content .special-cell {
  background: #f5f3ff !important;
}
.print-report-content .break-cell {
  background: #f8fafc !important;
  text-align: center;
}
.print-report-content .subject-cell {
  background: #eff6ff !important;
}
.print-report-content .rounded-lg, .print-report-content .rounded-md, .print-report-content .rounded, .print-report-content .shadow-sm {
  border-radius: 0 !important;
  box-shadow: none !important;
}
.print-report-content table td>div {
  min-height: 0 !important;
  height: auto !important;
  border-radius: 0 !important;
  border: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
  padding: 0 !important;
}
.print-report-content table td>div>div {
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
  padding: 0 !important;
  margin: 0 !important;
}
.print-report-content button, .print-report-content [role="button"] {
  display: none !important;
}
.print-hidden {
  display: none !important;
}
@media print {
  @page {
    size: landscape;
    margin: 0 !important;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
  }
  .print-hidden {
    display: none !important;
  }
}
</style></head><body>
<table class="print-layout-table">
  <thead>
    <tr>
      <th class="print-page-top-spacer"></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="print-page-body-cell">
        ${options.title && !options.hideHeader ? `<header class="print-report-title"><h1>${escapeHtml(options.title)}</h1>${options.subtitle ? `<p>${escapeHtml(options.subtitle)}</p>` : ""}</header>` : ""}
        <main class="print-report-content">${content}</main>
      </td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <td class="print-page-bottom-spacer"></td>
    </tr>
  </tfoot>
</table>
</body></html>`);
  frameDocument.close();

  let printed = false;
  const print = async () => {
    if (printed) return;
    printed = true;
    try {
      if (frameDocument.fonts?.ready) await frameDocument.fonts.ready;
    } catch {
      // Continue even if fonts.ready fails
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      frameWindow.focus();
      frameWindow.print();
    } catch (err) {
      console.warn("Print trigger failed:", err);
    }
    window.setTimeout(() => frame.remove(), 1000);
  };

  frame.onload = () => void print();
  // Fallback: If document.write already finished synchronously, frame.onload may not fire in Chromium
  window.setTimeout(() => void print(), 250);
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}
