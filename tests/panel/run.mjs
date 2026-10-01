// Startet den HA-Nachbau und alle Suiten (oder die als Argument genannten),
// nacheinander. Exit-Code 1, sobald eine Prüfung fehlschlägt.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { startServer } from "./server.mjs";

const dir = fileURLToPath(new URL("./suites/", import.meta.url));
const wanted = process.argv.slice(2);
const suites = readdirSync(dir)
  .filter((f) => f.endsWith("-e2e.mjs"))
  .filter((f) => !wanted.length || wanted.some((w) => f.startsWith(w)))
  .sort();
const server = await startServer(8950);
let failed = 0;
for (const suite of suites) {
  const out = await new Promise((ok) => {
    const child = spawn(process.execPath, [dir + suite], { stdio: ["ignore", "pipe", "pipe"] });
    let text = "";
    child.stdout.on("data", (d) => (text += d));
    child.stderr.on("data", (d) => (text += d));
    child.on("close", (code) => ok({ code, text }));
  });
  const pass = (out.text.match(/^PASS/gm) || []).length;
  const fail = (out.text.match(/^FAIL/gm) || []).length;
  const bad = fail > 0 || out.code !== 0 || pass === 0;
  if (bad) failed += 1;
  console.log(`${bad ? "✗" : "✓"} ${suite}: ${pass} bestanden, ${fail} fehlgeschlagen${out.code ? `, Exit ${out.code}` : ""}`);
  if (bad) console.log(out.text.split("\n").filter((l) => !l.startsWith("PASS")).join("\n"));
}
server.close();
console.log(failed ? `${failed} Suite(n) fehlgeschlagen` : `Alle ${suites.length} Suiten bestanden`);
process.exit(failed ? 1 : 0);
