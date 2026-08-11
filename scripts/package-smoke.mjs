import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workspace = mkdtempSync(join(tmpdir(), "agent-context-pruner-package-"));

try {
  const output = execFileSync(
    "npm",
    ["pack", "--json", "--pack-destination", workspace],
    { encoding: "utf8" }
  );
  const [pack] = JSON.parse(output);
  const files = new Set(pack.files.map((file) => file.path));
  const required = [
    "bin/agent-context-pruner.js",
    "src/parser.js",
    "src/pruner.js",
    "src/redaction.js",
    "src/reporters.js",
    "examples/transcript.md",
    "docs/PRD.md",
    "docs/EXAMPLE_REPORT.md",
    "docs/RELEASE_CANDIDATE.md",
    "SKILL.md",
    "README.md",
    "LICENSE",
    "SECURITY.md",
    "CHANGELOG.md"
  ];
  const missing = required.filter((file) => !files.has(file));

  if (missing.length > 0) {
    throw new Error(`Package smoke failed; missing: ${missing.join(", ")}`);
  }

  execFileSync("tar", ["-xzf", join(workspace, pack.filename), "-C", workspace]);
  const packageRoot = join(workspace, "package");
  const skill = readFileSync(join(packageRoot, "SKILL.md"), "utf8");
  const documentedCommand =
    "node bin/agent-context-pruner.js examples/transcript.md --format markdown";

  if (!skill.includes(documentedCommand)) {
    throw new Error(`SKILL.md must document: ${documentedCommand}`);
  }

  const report = execFileSync(
    "node",
    ["bin/agent-context-pruner.js", "examples/transcript.md", "--format", "markdown"],
    { cwd: packageRoot, encoding: "utf8" }
  );

  if (!report.includes("# Agent Context Pruning Report")) {
    throw new Error("Documented package command did not produce a markdown report");
  }

  console.log(
    `package smoke ok: ${pack.filename} includes ${pack.files.length} files and its documented command exits 0`
  );
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
