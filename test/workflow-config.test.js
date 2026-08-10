import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";

const workflowsDirectory = new URL("../.github/workflows/", import.meta.url);

test("one least-privilege release gate covers main and pull requests", async () => {
  const workflowFiles = (await readdir(workflowsDirectory)).filter((file) =>
    /\.ya?ml$/.test(file),
  );
  const workflows = await Promise.all(
    workflowFiles.map(async (file) => ({
      file,
      source: await readFile(new URL(file, workflowsDirectory), "utf8"),
    })),
  );
  const releaseGates = workflows.filter(({ source }) =>
    /run:\s*npm run release:check\s*$/m.test(source),
  );

  assert.equal(
    releaseGates.length,
    1,
    `expected one release-gate workflow, found ${releaseGates.map(({ file }) => file).join(", ") || "none"}`,
  );

  const [{ source }] = releaseGates;
  assert.match(source, /^on:\s*\n\s+pull_request:\s*\n\s+branches:\s*\[main\]\s*\n\s+push:\s*\n\s+branches:\s*\[main\]/m);
  assert.match(source, /^permissions:\s*\n\s+contents:\s*read\s*$/m);
  assert.match(source, /strategy:\s*\n\s+fail-fast:\s*false\s*\n\s+matrix:\s*\n\s+node-version:\s*\[20, 22\]/m);
  assert.equal(
    (source.match(/run:\s*npm run release:check\s*$/gm) ?? []).length,
    1,
    "the matrix job should invoke the release gate once",
  );
});
