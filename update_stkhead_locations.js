require("dotenv").config();

const fs = require("fs");
const path = require("path");
const sql = require("mssql");
const { parse } = require("csv-parse");

function detectDelimiterFromFirstLine(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(4096);
    const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
    const firstChunk = buf.slice(0, bytes).toString("utf8");
    const firstLine = firstChunk.split(/\r?\n/)[0] ?? "";
    const counts = {
      ",": (firstLine.match(/,/g) || []).length,
      ";": (firstLine.match(/;/g) || []).length,
      "\t": (firstLine.match(/\t/g) || []).length,
      "|": (firstLine.match(/\|/g) || []).length,
    };
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ",";
  } finally {
    fs.closeSync(fd);
  }
}

function pickColumn(row, candidates) {
  for (const k of candidates) {
    if (row[k] !== undefined) return row[k];
    // case-insensitive fallback
    const found = Object.keys(row).find(
      (kk) => kk.toLowerCase() === k.toLowerCase(),
    );
    if (found) return row[found];
  }
  return undefined;
}

function normalizeLoc(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

async function main() {
  const args = process.argv.slice(2);
  const fileArgIdx = args.findIndex((a) => a === "--file");
  const filePath = fileArgIdx >= 0 ? args[fileArgIdx + 1] : null;

  const dryRun = args.includes("--dry-run");
  const delimiterArgIdx = args.findIndex((a) => a === "--delimiter");
  const delimiter = delimiterArgIdx >= 0 ? args[delimiterArgIdx + 1] : null;

  if (!filePath) {
    console.error(
      "Usage: node update_stkhead_locations.js --file ./export.csv [--delimiter ';'] [--dry-run]",
    );
    process.exit(1);
  }

  const absFile = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absFile)) {
    console.error("File not found:", absFile);
    process.exit(1);
  }

  const delim = delimiter ?? detectDelimiterFromFirstLine(absFile);

  const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 1433),
    options: {
      encrypt:
        String(process.env.DB_ENCRYPT || "false").toLowerCase() === "true",
      trustServerCertificate:
        String(process.env.DB_TRUST_SERVER_CERT || "true").toLowerCase() ===
        "true",
      enableArithAbort: true,
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    requestTimeout: 120000,
  };

  console.log("CSV:", absFile);
  console.log("Detected delimiter:", JSON.stringify(delim));
  console.log("Dry-run:", dryRun);

  const pool = await sql.connect(config);

  // Prepared statement for speed (still executes one-by-one)
  const ps = new sql.PreparedStatement(pool);
  ps.input("materialId", sql.VarChar(200));
  ps.input("receipt", sql.VarChar(50));
  ps.input("issue", sql.VarChar(50));

  const updateSql = `
    UPDATE h
    SET
      h.Receipt_Location = @receipt,
      h.Issue_Location   = @issue
    FROM STKHEAD h
    WHERE
      h.Stock_Type = 'RM'
      AND dbo.getRMID(
          h.RM_Material_Form,
          h.Part_Number,
          h.RM_Material_Spec,
          h.RM_Dim1,
          h.RM_Dim2,
          h.RM_Dim3
      ) = @materialId;
  `;

  await ps.prepare(updateSql);

  const parser = parse({
    columns: true,
    bom: true,
    delimiter: delim,
    skip_empty_lines: true,
    trim: true,
  });

  const stream = fs.createReadStream(absFile).pipe(parser);

  let i = 0;
  let updated = 0;
  let notFound = 0;
  const notFoundIds = [];

  try {
    for await (const row of stream) {
      i++;

      const materialIdRaw = pickColumn(row, ["MaterialID", "materialId"]);
      const materialId = materialIdRaw ? String(materialIdRaw).trim() : null;

      // Your export uses these aliases:
      const receipt = normalizeLoc(
        pickColumn(row, [
          "DefaultReceiptLocation",
          "Receipt_Location",
          "ReceiptLocation",
          "receipt_location",
        ]),
      );
      const issue = normalizeLoc(
        pickColumn(row, [
          "DefaultIssueLocation",
          "Issue_Location",
          "IssueLocation",
          "issue_location",
        ]),
      );

      if (!materialId) {
        console.warn(`Row ${i}: missing MaterialID, skipping`);
        continue;
      }

      if (dryRun) {
        if (i % 200 === 0) console.log(`Processed ${i} rows (dry-run)`);
        continue;
      }

      const res = await ps.execute({ materialId, receipt, issue });
      const ra = Array.isArray(res.rowsAffected) ? res.rowsAffected[0] : 0;

      if (ra > 0) updated += ra;
      else {
        notFound++;
        notFoundIds.push(materialId);
      }

      if (i % 200 === 0) {
        console.log(
          `Processed ${i} rows | updated=${updated} | notFound=${notFound}`,
        );
      }
    }
  } finally {
    await ps.unprepare();
    await pool.close();
  }

  console.log("DONE");
  console.log("Rows processed:", i);
  console.log("Rows updated:", updated);
  console.log("MaterialID not matched:", notFound);

  if (notFoundIds.length) {
    const out = path.resolve(process.cwd(), "not_found_material_ids.txt");
    fs.writeFileSync(out, notFoundIds.join("\n"), "utf8");
    console.log("Wrote:", out);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
