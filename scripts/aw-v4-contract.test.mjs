import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (path) => readFileSync(join(root, path), "utf8")

test("ships frozen worker and teacher contracts", () => {
  for (const path of ["contracts/worker.md", "contracts/teacher.md"]) {
    assert.equal(existsSync(join(root, path)), true, path)
  }

  const worker = read("contracts/worker.md")
  assert.match(worker, /TYPE: DONE/)
  assert.match(worker, /TYPE: TEACHER_REQUEST/)
  assert.match(worker, /MISSING_DECISIVE \| CONFLICTING \| EXHAUSTED/)
  assert.doesNotMatch(worker, /HUMAN_REQUEST/)

  const teacher = read("contracts/teacher.md")
  assert.match(teacher, /ASK:/)
  assert.match(teacher, /FINAL:/)
  assert.match(teacher, /TYPE: EVIDENCE/)
  assert.match(teacher, /inspect \| reproduce \| compare \| verify/)
})
