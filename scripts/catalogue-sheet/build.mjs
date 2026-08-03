/**
 * Build the client catalogue questionnaire (.xlsx).
 *
 * Run:  node scripts/catalogue-sheet/build.mjs
 *
 * Deliberately plain: no fills, no colour, no banding. The first version was
 * brand-styled and the colour made it harder to read, not easier — on a data
 * sheet the shading competes with the data.
 *
 * Pre-filled from the live storefront so the client corrects and completes
 * rather than starting from a blank grid.
 *
 * Split across two sheets because the facts sit at two different levels.
 * Price and tax are PER PACK, so those get one row per SKU. A description is
 * PER PRODUCT — repeating the same paragraph down five pack rows buried the
 * numbers and made the sheet unreadable, which is the opposite of the point.
 */
import ExcelJS from "exceljs";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const data = JSON.parse(await readFile(path.join(HERE, "catalogue.json"), "utf8"));
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nutri Greenz";
  wb.created = new Date();

  const page = {
    orientation: "landscape",
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  /* ── Sheet 1 · the questionnaire ──────────────────────────────────── */
  const ws = wb.addWorksheet("Products", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { ...page, printTitlesRow: "1:1" },
  });

  ws.columns = [
    { header: "Category", key: "category", width: 18 },
    { header: "Product name", key: "product", width: 28 },
    { header: "Pack size", key: "size", width: 10 },
    { header: "MRP incl. GST (on site)", key: "mrpSite", width: 16 },
    { header: "MRP incl. GST (please confirm)", key: "mrpClient", width: 18 },
    { header: "GST % (standard rate)", key: "gstSuggested", width: 14 },
    { header: "GST % (please confirm)", key: "gstClient", width: 14 },
    { header: "HSN code (please fill)", key: "hsn", width: 14 },
    { header: "Notes", key: "notes", width: 34 },
  ];

  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: "middle", wrapText: true };
  head.height = 32;

  for (const p of data.products) {
    const cat = data.categories[p.category];
    for (const v of p.variants) {
      const row = ws.addRow({
        category: cat.name,
        product: p.name,
        size: v.size,
        // Blank rather than a note, so the column stays numeric and sortable;
        // the missing prices are called out on the "Please read" tab instead.
        mrpSite: v.mrpInclGst ?? "",
        mrpClient: "",
        gstSuggested: cat.gstPercent / 100,
        gstClient: "",
        hsn: "",
        notes: v.mrpInclGst == null ? "No price set on the website" : "",
      });
      row.alignment = { vertical: "top", wrapText: true };
      row.getCell("mrpSite").numFmt = "#,##0";
      row.getCell("mrpClient").numFmt = "#,##0";
      row.getCell("gstSuggested").numFmt = "0%";
      row.getCell("gstClient").numFmt = "0%";
    }
  }

  /* Dropdown so the GST answer comes back as a rate, not free text. */
  for (let r = 2; r <= ws.rowCount; r++) {
    ws.getCell(`G${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"0%,5%,12%,18%"'],
      showErrorMessage: true,
      errorTitle: "Pick a GST rate",
      error: "Choose 0%, 5%, 12% or 18%.",
    };
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws.rowCount, column: 9 } };

  /* ── Sheet 2 · descriptions, one row per product ──────────────────── */
  /*
   * Separate from the pricing grid, and one row per PRODUCT rather than per
   * pack. Side by side like this, the fact that all three ghees carry
   * identical copy is obvious at a glance — which is the point of asking.
   */
  const desc = wb.addWorksheet("Descriptions", { pageSetup: { ...page } });
  desc.columns = [
    { header: "Category", key: "category", width: 18 },
    { header: "Product name", key: "product", width: 28 },
    { header: "Description on the website today", key: "current", width: 70 },
    { header: "Your description (please fill)", key: "yours", width: 70 },
  ];
  desc.getRow(1).font = { bold: true };
  desc.getRow(1).alignment = { vertical: "middle", wrapText: true };
  for (const p of data.products) {
    const r = desc.addRow({
      category: data.categories[p.category].name,
      product: p.name,
      current: p.descriptionOnSite,
      yours: "",
    });
    r.alignment = { vertical: "top", wrapText: true };
  }
  desc.views = [{ state: "frozen", ySplit: 1 }];

  /* ── Sheet 3 · what we need and why ───────────────────────────────── */
  const notes = wb.addWorksheet("Please read", {
    pageSetup: { ...page, orientation: "portrait" },
  });
  notes.columns = [
    { header: "Item", key: "item", width: 28 },
    { header: "What we need", key: "need", width: 96 },
  ];
  notes.getRow(1).font = { bold: true };

  const say = (item, need) => {
    const r = notes.addRow({ item, need });
    r.alignment = { vertical: "top", wrapText: true };
    r.getCell("item").font = { bold: true };
    return r;
  };

  say(
    "GST rate per category",
    "The website charges a flat 18% on everything today, including on the invoices and receipts customers download. " +
      "That looks wrong for all three categories: the standard rates are 5% on edible oils, 12% on ghee and 5% on branded packaged honey. " +
      "If 18% is wrong, customers are being over-charged tax on documents they may submit for expense claims. " +
      "Please have your CA confirm each rate and fill the 'GST % (please confirm)' column.",
  );
  say(
    "HSN code per product",
    "Required on a GST invoice. We cannot print a compliant invoice without it. Suggested codes are on the 'GST reference' tab — please confirm or correct.",
  );
  say(
    "Product descriptions",
    "No product currently has its own description. The website falls back to one paragraph per CATEGORY, so all three ghees show " +
      "word-for-word identical text, as do all three honeys and both oils. A customer comparing two of your products reads the same " +
      "sentences twice. Please write one or two sentences per product.",
  );
  say(
    "MRP confirmation",
    "The prices shown are what the storefront charges today and are treated as GST-INCLUSIVE — the tax is inside the number, not added " +
      "at checkout. Please confirm each one or write the correct figure.",
  );
  say(
    "Missing prices",
    "The 3L, 5L, 10L and 15L oil packs are listed on the website with no price. They cannot be sold until priced.",
  );
  say(
    "Possible duplicate",
    "Groundnut and Coconut 1L are both ₹250 with identical pack ladders. If that is intended, fine — but it reads like one product was " +
      "duplicated to create the other.",
  );
  say("FSSAI licence number", "Needed on packaging artwork and labels.");
  say(
    "GSTIN",
    "Needed on invoices and receipts. Until it is set, the GSTIN line is left off the invoice entirely rather than filled with a placeholder.",
  );
  say(
    "Lab COA",
    "Fatty-acid split and Vitamin E per oil, and the ghee figures. The nutrition panel currently prints standard published values, marked 'typical values'.",
  );
  say(
    "Sourcing districts",
    "Which districts each product actually comes from. 'Telangana' is our placeholder and it is now printed on bottle label artwork.",
  );

  /* ── Sheet 3 · GST reference ──────────────────────────────────────── */
  const ref = wb.addWorksheet("GST reference", { pageSetup: page });
  ref.columns = [
    { header: "Category", key: "cat", width: 22 },
    { header: "HSN", key: "hsn", width: 16 },
    { header: "Standard rate", key: "rate", width: 14 },
    { header: "Basis", key: "basis", width: 86 },
  ];
  ref.getRow(1).font = { bold: true };

  for (const c of Object.values(data.categories)) {
    const r = ref.addRow({ cat: c.name, hsn: c.hsn, rate: c.gstPercent / 100, basis: c.gstBasis });
    r.alignment = { vertical: "top", wrapText: true };
    r.getCell("rate").numFmt = "0%";
  }
  ref.addRow({});
  const w = ref.addRow({
    cat: "Currently charged",
    hsn: "—",
    rate: 0.18,
    basis:
      "The site applies a flat 18% to every product. The rates above are our reading of the standard schedule and are NOT tax advice — " +
      "your CA should confirm before anything is changed.",
  });
  w.alignment = { vertical: "top", wrapText: true };
  w.font = { bold: true };
  w.getCell("rate").numFmt = "0%";

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
