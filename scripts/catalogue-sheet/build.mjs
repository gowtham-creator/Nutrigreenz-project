/**
 * Build the client catalogue questionnaire (.xlsx).
 *
 * Run:  node scripts/catalogue-sheet/build.mjs
 *
 * The sheet is PRE-FILLED from the live storefront so the client corrects and
 * completes rather than starting from a blank grid — a blank sheet comes back
 * half-finished, a pre-filled one comes back corrected.
 *
 * Columns the client fills are tinted; columns we already know are left plain
 * and locked visually by wording ("on site today"). One row per SKU, because
 * MRP and GST are per-pack facts and a per-product row cannot carry them.
 */
import ExcelJS from "exceljs";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* Brand palette, so the sheet looks like it came from Nutri Greenz. */
const FOREST = "FF14331F";
const CREAM = "FFF5F2E0";
const SAGE = "FFE4EDE4";
const CLAY = "FFB5862F";
const AMBER_FILL = "FFFDF6E3";
const RED = "FFC74D33";

const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = { style: "thin", color: { argb: "FFD8D8CE" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

async function main() {
  const data = JSON.parse(await readFile(path.join(HERE, "catalogue.json"), "utf8"));
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nutri Greenz";
  wb.created = new Date();

  /* ── Sheet 1 · the questionnaire ──────────────────────────────────── */
  const ws = wb.addWorksheet("Products", {
    views: [{ state: "frozen", ySplit: 3 }],
    properties: { defaultRowHeight: 18 },
    /*
     * Landscape, scaled to one page WIDE.
     *
     * Left on defaults this printed across 12 pages, splitting the columns so a
     * product's price landed on a different sheet of paper from its name.
     * Clients print questionnaires and fill them by hand; a sheet that cannot
     * be printed comes back empty.
     */
    pageSetup: {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      printTitlesRow: "1:3",
    },
  });

  ws.columns = [
    { key: "category", width: 20 },
    { key: "product", width: 30 },
    { key: "size", width: 11 },
    { key: "descSite", width: 52 },
    { key: "descClient", width: 52 },
    { key: "mrpSite", width: 17 },
    { key: "mrpClient", width: 17 },
    { key: "gstSuggested", width: 15 },
    { key: "gstClient", width: 15 },
    { key: "hsn", width: 14 },
    { key: "notes", width: 34 },
  ];

  /* Title band. */
  ws.mergeCells("A1:K1");
  const title = ws.getCell("A1");
  title.value = "Nutri Greenz — product master  ·  please review and complete the shaded columns";
  title.font = { name: "Calibri", size: 14, bold: true, color: { argb: CREAM } };
  title.fill = fill(FOREST);
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells("A2:K2");
  const sub = ws.getCell("A2");
  sub.value =
    `Pre-filled from the live storefront on ${data.capturedOn}. Plain columns are what the website shows today — correct them if wrong. ` +
    `Shaded columns are for you to fill. One row per pack size, because price and tax differ per pack.`;
  sub.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF4A5850" } };
  sub.fill = fill(CREAM);
  sub.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
  ws.getRow(2).height = 30;

  /* Header row. */
  const header = ws.addRow({
    category: "Category",
    product: "Product name",
    size: "Pack size",
    descSite: "Description on site today",
    descClient: "Your description  ←  please fill",
    mrpSite: "MRP incl. GST (₹) on site",
    mrpClient: "Correct MRP incl. GST (₹)  ←",
    gstSuggested: "GST % (standard)",
    gstClient: "GST % confirmed  ←",
    hsn: "HSN code  ←",
    notes: "Notes / anything we should know",
  });
  header.height = 40;
  header.eachCell((cell, col) => {
    cell.font = { bold: true, size: 10, color: { argb: col >= 5 ? FOREST : CREAM } };
    cell.fill = fill(col === 5 || col === 7 || col === 9 || col === 10 || col === 11 ? AMBER_FILL : FOREST);
    cell.alignment = { vertical: "middle", wrapText: true, horizontal: "left", indent: 1 };
    cell.border = border;
  });

  /* Data rows — one per SKU. */
  let zebra = false;
  for (const p of data.products) {
    const cat = data.categories[p.category];
    zebra = !zebra;
    for (const [i, v] of p.variants.entries()) {
      const row = ws.addRow({
        category: i === 0 ? cat.name : "",
        product: i === 0 ? p.name : "",
        size: v.size,
        // Repeating the same paragraph on every SKU would imply it is per-SKU.
        descSite: i === 0 ? p.descriptionOnSite : "",
        descClient: "",
        mrpSite: v.mrpInclGst ?? "not priced on site",
        mrpClient: "",
        gstSuggested: `${cat.gstPercent}%`,
        gstClient: "",
        hsn: "",
        notes: "",
      });
      row.height = i === 0 ? 46 : 20;

      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.border = border;
        cell.font = { size: 10 };
        cell.alignment = { vertical: "top", wrapText: col === 4 || col === 5 || col === 11, indent: 1 };
        // Shade the columns the client is being asked to complete.
        if (col === 5 || col === 7 || col === 9 || col === 10 || col === 11) {
          cell.fill = fill(AMBER_FILL);
        } else if (zebra) {
          cell.fill = fill("FFFBFBF7");
        }
        if (col === 6 && typeof cell.value === "number") {
          cell.numFmt = '₹#,##0';
          cell.alignment = { vertical: "top", horizontal: "right" };
        }
        if (col === 6 && typeof cell.value === "string") {
          cell.font = { size: 9, italic: true, color: { argb: RED } };
        }
        if (col === 7) cell.numFmt = '₹#,##0';
        if (col === 1 || col === 2) cell.font = { size: 10, bold: i === 0 };
      });
    }
  }

  /* Dropdown so the GST answer is a rate, not free text. */
  const firstData = 4;
  const lastData = ws.rowCount;
  for (let r = firstData; r <= lastData; r++) {
    ws.getCell(`I${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"0%,5%,12%,18%"'],
      showErrorMessage: true,
      errorTitle: "Pick a GST rate",
      error: "Choose 0%, 5%, 12% or 18%.",
    };
  }

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: lastData, column: 11 } };

  /* ── Sheet 2 · why we are asking ──────────────────────────────────── */
  const notes = wb.addWorksheet("Please read", {
    properties: { defaultRowHeight: 18 },
    pageSetup: { orientation: "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  notes.columns = [{ width: 4 }, { width: 30 }, { width: 96 }];

  const h = (text) => {
    const r = notes.addRow(["", text, ""]);
    r.getCell(2).font = { bold: true, size: 12, color: { argb: FOREST } };
    r.height = 26;
    return r;
  };
  const line = (label, text, tone) => {
    const r = notes.addRow(["", label, text]);
    r.getCell(2).font = { bold: true, size: 10, color: { argb: tone === "warn" ? RED : FOREST } };
    r.getCell(2).alignment = { vertical: "top", wrapText: true };
    r.getCell(3).font = { size: 10 };
    r.getCell(3).alignment = { vertical: "top", wrapText: true };
    r.height = Math.max(20, Math.ceil(text.length / 95) * 15 + 8);
    return r;
  };
  const gap = () => notes.addRow([]);

  notes.mergeCells("B1:C1");
  const nt = notes.getCell("B1");
  nt.value = "What we need, and why";
  nt.font = { bold: true, size: 15, color: { argb: CREAM } };
  nt.fill = fill(FOREST);
  nt.alignment = { vertical: "middle", indent: 1 };
  notes.getRow(1).height = 32;
  gap();

  h("The two things that block us");
  line(
    "GST rate per category",
    "The website currently charges a flat 18% on everything, including on the invoices and receipts customers download. " +
      "That looks wrong for all three categories — the standard rates are 5% on edible oils, 12% on ghee and 5% on branded packaged honey. " +
      "If 18% is indeed wrong, customers are being over-charged tax on documents they may submit for expense claims. " +
      "Please have your CA confirm the rate for each category and fill the 'GST % confirmed' column.",
    "warn",
  );
  line(
    "HSN code per product",
    "Required on a GST invoice. We cannot print a compliant invoice without it. Suggested codes are on the 'GST reference' tab — " +
      "please confirm or correct them.",
    "warn",
  );
  gap();

  h("The biggest content gap");
  line(
    "Product descriptions",
    "No product in the catalogue has its own description. The website falls back to one paragraph per CATEGORY, so all three ghees " +
      "currently show word-for-word identical text, as do all three honeys and both oils. Customers comparing two of your products " +
      "see the same sentences. Please write one or two sentences per product in the shaded column.",
  );
  gap();

  h("Prices");
  line(
    "MRP incl. GST",
    "The figures shown are what the storefront charges today, and are treated as GST-INCLUSIVE — i.e. the tax is inside the number, " +
      "not added at checkout. Please confirm each one, or write the correct figure in the shaded column.",
  );
  line(
    "Missing prices",
    "The 3L, 5L, 10L and 15L oil packs are listed on the site with no price. They cannot be sold until priced.",
    "warn",
  );
  line(
    "Worth a look",
    "Groundnut and Coconut 1L are both ₹250 with identical pack ladders. If that is a coincidence, fine — but it reads like " +
      "one product was duplicated to create the other.",
  );
  gap();

  h("Also outstanding, if you have them to hand");
  line("FSSAI licence number", "Needed on packaging artwork and labels.");
  line("GSTIN", "Needed on invoices and receipts. Until it is set, the GSTIN line is left off entirely rather than filled with a placeholder.");
  line("Lab COA", "Fatty-acid split and Vitamin E per oil, and the ghee figures. The nutrition panel currently prints standard published values marked 'typical values'.");
  line("Sourcing districts", "Which districts each product actually comes from. 'Telangana' is our placeholder and it is now printed on bottle label artwork.");

  /* ── Sheet 3 · GST reference ──────────────────────────────────────── */
  const ref = wb.addWorksheet("GST reference", {
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ref.columns = [
    { key: "cat", width: 22 },
    { key: "hsn", width: 16 },
    { key: "rate", width: 12 },
    { key: "basis", width: 86 },
  ];
  const rh = ref.addRow({ cat: "Category", hsn: "HSN", rate: "Rate", basis: "Basis" });
  rh.eachCell((c) => {
    c.font = { bold: true, size: 10, color: { argb: CREAM } };
    c.fill = fill(FOREST);
    c.border = border;
    c.alignment = { indent: 1 };
  });
  rh.height = 24;
  for (const c of Object.values(data.categories)) {
    const r = ref.addRow({ cat: c.name, hsn: c.hsn, rate: `${c.gstPercent}%`, basis: c.gstBasis });
    r.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = border;
      cell.font = { size: 10 };
      cell.alignment = { vertical: "top", wrapText: true, indent: 1 };
    });
    r.height = 32;
  }
  ref.addRow([]);
  const warn = ref.addRow({
    cat: "Currently charged",
    hsn: "—",
    rate: "18%",
    basis:
      "The site applies a flat 18% to every product. These rates are our reading of the standard schedule and are NOT tax advice — " +
      "your CA should confirm before this is corrected.",
  });
  warn.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = border;
    cell.font = { size: 10, bold: true, color: { argb: RED } };
    cell.fill = fill("FFFDF3F1");
    cell.alignment = { vertical: "top", wrapText: true, indent: 1 };
  });
  warn.height = 34;

  const out = path.join(process.env.HOME ?? HERE, "Downloads", "NutriGreenz-Product-Master.xlsx");
  await mkdir(path.dirname(out), { recursive: true });
  await wb.xlsx.writeFile(out);

  const skus = data.products.reduce((n, p) => n + p.variants.length, 0);
  console.log(`✓ ${out}`);
  console.log(`  ${data.products.length} products · ${skus} SKUs · ${Object.keys(data.categories).length} categories`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
