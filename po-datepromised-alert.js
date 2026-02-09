require("dotenv").config();

const sql = require("mssql");
const nodemailer = require("nodemailer");
const cron = require("node-cron");

// -------------------- config helpers --------------------
function envInt(name, def) {
  const v = process.env[name];
  if (v == null || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function envBool(name, def) {
  const v = (process.env[name] || "").toLowerCase().trim();
  if (!v) return def;
  return ["1", "true", "yes", "y", "on"].includes(v);
}
function splitEmails(v) {
  return String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const THRESHOLD_DAYS = envInt("THRESHOLD_DAYS", 3);
const INCLUDE_OVERDUE = envBool("INCLUDE_OVERDUE", true);

const RECIPIENTS = splitEmails(process.env.ALERT_RECIPIENTS);
if (!RECIPIENTS.length) {
  console.error("No ALERT_RECIPIENTS configured. Exiting.");
  process.exit(1);
}

// DB source name
function getPoSourceName() {
  const src = (process.env.PO_SOURCE || "").trim();
  if (!src) throw new Error("PO_SOURCE is required (table or view name).");

  const fullyQualified = envBool("PO_SOURCE_IS_FULLY_QUALIFIED", false);
  if (fullyQualified) return src;

  const schema = (process.env.DB_SCHEMA || "dbo").trim();
  return `${schema}.${src}`;
}

// -------------------- db config --------------------
const dbConfig = {
  server: process.env.DB_SERVER,
  port: envInt("DB_PORT", 1433),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: envBool("DB_ENCRYPT", false),
    trustServerCertificate: envBool("DB_TRUST_SERVER_CERT", true),
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30_000,
  },
};

// -------------------- mail config --------------------
function createMailer() {
  const host = process.env.SMTP_HOST;
  const port = envInt("SMTP_PORT", 587);
  const secure = envBool("SMTP_SECURE", false);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error("SMTP config missing: SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

// -------------------- query + grouping --------------------
function startOfTodayLocal() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  // YYYY-MM-DD
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fetchDueSoonLines(pool) {
  const poSource = getPoSourceName();

  const req = pool.request();
  req.input("thresholdDays", sql.Int, THRESHOLD_DAYS);
  req.input("includeOverdue", sql.Bit, INCLUDE_OVERDUE ? 1 : 0);

  const query = `
WITH src AS (
  SELECT
    PurchaseOrderNumber,
    PurchaseOrderItem,
    LTRIM(RTRIM(SupplierCode))          AS SupplierCodeTrim,
    LTRIM(RTRIM(PartNumber))            AS PartNumberTrim,
    DatePromised,
    QtyOrderedOrderUOM,
    OrderUOM,
    OpNumber,
    LineStatus,
    ReferenceNumber,
    OrderItemComments,
    LTRIM(RTRIM(OrderLineComplete))     AS OrderLineCompleteTrim
  FROM ${poSource}
  WHERE
    DatePromised IS NOT NULL
    AND LOWER(LTRIM(RTRIM(OrderLineComplete))) = 'no'
),
calc AS (
  SELECT
    s.*,
    DATEDIFF(
      DAY,
      CONVERT(date, GETDATE()),
      CONVERT(date, s.DatePromised)
    ) AS DaysUntilPromised
  FROM src s
)
SELECT
  c.PurchaseOrderNumber,
  c.PurchaseOrderItem,
  c.SupplierCodeTrim AS SupplierCode,
  sup.Supplier_Name  AS SupplierName,
  c.PartNumberTrim   AS PartNumber,
  sp.ProductDescription,
  c.DatePromised,
  c.DaysUntilPromised,
  c.QtyOrderedOrderUOM,
  c.OrderUOM,
  c.OpNumber,
  c.LineStatus,
  c.ReferenceNumber,
  c.OrderItemComments,
  c.OrderLineCompleteTrim AS OrderLineComplete
FROM calc c
LEFT JOIN SUPPLIER sup
  ON LTRIM(RTRIM(sup.Supplier_Code)) = c.SupplierCodeTrim
LEFT JOIN vFM_STOCKED_PART_DETAILS sp
  ON LTRIM(RTRIM(sp.PartNumber)) = c.PartNumberTrim
WHERE
  (
    (c.DaysUntilPromised BETWEEN 0 AND @thresholdDays)
    OR (@includeOverdue = 1 AND c.DaysUntilPromised BETWEEN -@thresholdDays AND -1)
  )
ORDER BY
  c.PurchaseOrderNumber,
  c.DaysUntilPromised ASC,
  c.PurchaseOrderItem;
`;

  const { recordset } = await req.query(query);
  return recordset || [];
}

function groupByPO(lines) {
  /** @type {Map<string, any>} */
  const map = new Map();

  for (const r of lines) {
    const po = String(r.PurchaseOrderNumber).trim();
    if (!map.has(po)) {
      map.set(po, {
        purchaseOrderNumber: po,
        supplierCode: r.SupplierCode ? String(r.SupplierCode).trim() : "",
        supplierName: r.SupplierName ? String(r.SupplierName).trim() : "",
        lines: [],
      });
    }
    map.get(po).lines.push({
      item: r.PurchaseOrderItem,
      partNumber: r.PartNumber || "",
      description: r.ProductDescription || "",
      datePromised: r.DatePromised,
      daysUntil: Number(r.DaysUntilPromised),
      qty: r.QtyOrderedOrderUOM,
      uom: r.OrderUOM,
      opNumber: r.OpNumber,
      lineStatus: r.LineStatus,
      referenceNumber: r.ReferenceNumber,
      comments: r.OrderItemComments || "",
    });
  }

  return [...map.values()];
}

function buildEmail({ groups }) {
  const today = startOfTodayLocal();
  const todayStr = fmtDate(today);

  const subjectPrefix = (process.env.MAIL_SUBJECT_PREFIX || "[HATÁRIDŐ KÖZEL / LEJÁRT]").trim();
  const subject = `${subjectPrefix} ${todayStr}`;

  // TEXT
  const textLines = [];
  textLines.push(`Beszerzési rendelések (PO) figyelmeztetés`);
  textLines.push(`Dátum: ${todayStr}`);
  textLines.push(`Küszöb: ${THRESHOLD_DAYS} nap`);
  textLines.push("");

  // HTML
  const html = [];
  html.push(`<div style="font-family:Arial, sans-serif; font-size:14px;">`);
  html.push(`<h2 style="margin:0 0 8px 0;">PO – Határidő figyelmeztetés</h2>`);
  html.push(
    `<div style="margin:0 0 14px 0;">` +
      `<b>Dátum:</b> ${escapeHtml(todayStr)} &nbsp; | &nbsp; ` +
      `<b>Küszöb:</b> ${THRESHOLD_DAYS} nap` +
    `</div>`
  );

  for (const g of groups) {
    const supplierLabel = g.supplierName
      ? `${g.supplierName} (${g.supplierCode || "n/a"})`
      : (g.supplierCode || "n/a");

    const notOverdue = g.lines.filter((l) => Number(l.daysUntil) >= 0);
    const overdue = g.lines.filter((l) => Number(l.daysUntil) < 0);

    // ---- TEXT block per PO ----
    textLines.push(`PO #${g.purchaseOrderNumber} | Beszállító: ${supplierLabel}`);
    if (notOverdue.length) {
      textLines.push(`  Közeli határidő (${notOverdue.length}):`);
      for (const l of notOverdue) {
        textLines.push(
          `   - Tétel ${l.item} | ${l.partNumber} | ${l.description || ""} | Menny.: ${l.qty ?? ""} ${l.uom ?? ""} | Ígért: ${fmtDate(l.datePromised)} | Napok: ${l.daysUntil}`
        );
      }
    } else {
      textLines.push(`  Közeli határidő: nincs`);
    }

    if (overdue.length) {
      textLines.push(`  LEJÁRT (${overdue.length}):`);
      for (const l of overdue) {
        textLines.push(
          `   - Tétel ${l.item} | ${l.partNumber} | ${l.description || ""} | Menny.: ${l.qty ?? ""} ${l.uom ?? ""} | Ígért: ${fmtDate(l.datePromised)} | Késés (nap): ${Math.abs(l.daysUntil)}`
        );
      }
    } else {
      textLines.push(`  LEJÁRT: nincs`);
    }
    textLines.push("");

    // ---- HTML block per PO ----
    html.push(`<hr style="border:none; border-top:1px solid #ddd; margin:16px 0;" />`);
    html.push(`<h3 style="margin:0 0 6px 0;">PO #${escapeHtml(g.purchaseOrderNumber)}</h3>`);
    html.push(`<h4 style="margin:0 0 10px 0;"><b>Beszállító:</b> ${escapeHtml(supplierLabel)}</h4>`);

    // Summary badges
    html.push(
      `<div style="margin:0 0 12px 0;">` +
        `<span style="display:inline-block; padding:4px 8px; border:1px solid #ddd; border-radius:999px; margin-right:8px;">` +
          `Közeli határidő: <b>${notOverdue.length}</b>` +
        `</span>` +
        `<span style="display:inline-block; padding:4px 8px; border:1px solid #ddd; border-radius:999px;">` +
          `Lejárt: <b>${overdue.length}</b>` +
        `</span>` +
      `</div>`
    );

    // Section 1: due soon / within threshold
    if (notOverdue.length) {
        html.push(`<h4 style="margin:12px 0 6px 0;">Közeli határidő</h4>`);
        html.push(renderLinesTable(notOverdue, { overdue: false }));
    }

    // Section 2: overdue
    if (overdue.length) {
        html.push(`<h4 style="margin:14px 0 6px 0;">Lejárt</h4>`);
        html.push(
            `<div style="margin:0 0 10px 0; padding:8px 10px; border:1px solid #f0c36d; background:#fff3cd; border-radius:6px;">` +
            `A következő tételek <b>lejártak</b>.` +
            `</div>`
        );
        html.push(renderLinesTable(overdue, { overdue: true }));
    }
  }

  html.push(`<div style="margin-top:16px; color:#777; font-size:12px;">Automatikus értesítés – po-datepromised-alert microservice - POLIOL Kft.</div>`);
  html.push(`</div>`);

  return {
    subject,
    text: textLines.join("\n"),
    html: html.join("\n"),
  };
}

// Helper: render a table for a list of lines
function renderLinesTable(lines, { overdue }) {
  const rows = lines
    .map((l) => {
      const daysCell = overdue
        ? `Késés: ${escapeHtml(String(Math.abs(Number(l.daysUntil))))}`
        : escapeHtml(String(l.daysUntil));

      return (
        `<tr>` +
          `<td style="border:1px solid #ddd;">${escapeHtml(l.item)}</td>` +
          `<td style="border:1px solid #ddd;">${escapeHtml(l.partNumber)}</td>` +
          `<td style="border:1px solid #ddd;">${escapeHtml(l.description)}</td>` +
          `<td style="border:1px solid #ddd;">${escapeHtml(`${l.qty ?? ""} ${l.uom ?? ""}`.trim())}</td>` +
          `<td style="border:1px solid #ddd;">${escapeHtml(fmtDate(l.datePromised))}</td>` +
          `<td style="border:1px solid #ddd;">${daysCell}</td>` +
        `</tr>`
      );
    })
    .join("\n");

  return (
    `<table cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%;">` +
      `<thead>` +
        `<tr style="background:#f6f6f6;">` +
          `<th align="left" style="border:1px solid #ddd;">Tétel</th>` +
          `<th align="left" style="border:1px solid #ddd;">Cikkszám</th>` +
          `<th align="left" style="border:1px solid #ddd;">Megnevezés</th>` +
          `<th align="left" style="border:1px solid #ddd;">Mennyiség</th>` +
          `<th align="left" style="border:1px solid #ddd;">Határidő</th>` +
          `<th align="left" style="border:1px solid #ddd;">Napok</th>` +
        `</tr>` +
      `</thead>` +
      `<tbody>` +
        rows +
      `</tbody>` +
    `</table>`
  );
}


// -------------------- runner --------------------
async function runOnce() {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] Running PO DatePromised check...`);

  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const lines = await fetchDueSoonLines(pool);
    if (!lines.length) {
      console.log("No lines within threshold. Nothing to email.");
      return;
    }

    const groups = groupByPO(lines);

    const mailer = createMailer();
    const { subject, text, html } = buildEmail({ groups });

    const from = process.env.MAIL_FROM || process.env.SMTP_USER;
    const info = await mailer.sendMail({
      from,
      to: RECIPIENTS, // or use bcc if you prefer: bcc: RECIPIENTS
      subject,
      text,
      html,
    });

    console.log(`Email sent. messageId=${info.messageId} recipients=${RECIPIENTS.join(", ")}`);
    console.log(`Found lines: ${lines.length}, POs: ${groups.length}`);
  } catch (err) {
    console.error("FAILED:", err && err.stack ? err.stack : err);
    // If you want non-zero exit for external schedulers:
    // process.exitCode = 1;
  } finally {
    try {
      if (pool) await pool.close();
    } catch {}
    const ms = Date.now() - start;
    console.log(`Done in ${ms} ms.`);
  }
}

// -------------------- scheduling options --------------------
async function main() {
  const cronExpr = (process.env.CRON_SCHEDULE || "").trim();

  // Option A: run once and exit (best with OS cron)
  // node po-datepromised-alert.js --once
  if (process.argv.includes("--once")) {
    await runOnce();
    return;
  }

  // Option B: long-running scheduler using node-cron
  if (!cronExpr) {
    console.error("CRON_SCHEDULE missing. Either provide it, or run with --once using OS cron.");
    process.exit(1);
  }

  const runOnStartup = envBool("RUN_ON_STARTUP", true);
  console.log(`Scheduler enabled. CRON_SCHEDULE="${cronExpr}" (run_on_startup=${runOnStartup})`);

  if (runOnStartup) {
    await runOnce();
  }

  cron.schedule(cronExpr, () => {
    runOnce().catch((e) => console.error("Scheduled run error:", e));
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
