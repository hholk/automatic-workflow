"""Test suite for the Ultrawork SQLite ledger CLI (ledger.py).

Pins down the approved Task-2 contract:

  ledger.py --db <path> init
  ledger.py --db <path> start-run --project <p> --category <c> --phase <ph>
  ledger.py --db <path> start-package --run-id <id> --package-id <pid>
                                  --category <c> --files <f> --acs <a>
  ledger.py --db <path> log-event --run-id <id> [--package-row <row>]
                                   --kind <k> --summary <s>
  ledger.py --db <path> run-log --run-id <id> --limit <n>
  ledger.py --db <path> record-attempt --package-row <row> --kind <k>
                                  --artifact <a> --verify-exit <n>
                                  --outcome <o> --summary <s>
  ledger.py --db <path> finish-package --package-row <row> --status <st>
  ledger.py --db <path> finish-run --run-id <id> --status <st>
  ledger.py --db <path> similar --category <c> --limit <n>
  ledger.py --db <path> stats
  ledger.py --help

Enums: kind initial/fix1/fix2/fix3; artifact missing/unchanged/changed;
outcome worked/failed/no_op/flaky/blocked; status running/success/failed/blocked.
Summary is capped at 240 characters; a longer summary is a structured JSON
error on stderr with exit code 2. start-package with a missing run and
record-attempt with a missing package-row are structured JSON errors too.
"""

import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LEDGER = os.path.join(SCRIPT_DIR, "ledger.py")

KINDS = ("initial", "fix1", "fix2", "fix3")
ARTIFACTS = ("missing", "unchanged", "changed")
OUTCOMES = ("worked", "failed", "no_op", "flaky", "blocked")
STATUSES = ("running", "success", "failed", "blocked")
EVENT_KINDS = ("dispatch", "artifact", "verify", "review", "integration", "blocker")
TABLES = ("runs", "packages", "attempts", "observations", "patterns", "traces")
SUMMARY_MAX = 240
EVIDENCE_MAX = 4000
FORBIDDEN_COLUMNS = ("prompt", "source", "code", "log", "secret")


def run_cli(db_path, *args):
    """Run ledger.py against db_path with the given args; return CompletedProcess."""
    return subprocess.run(
        [sys.executable, LEDGER, "--db", db_path, *args],
        capture_output=True,
        text=True,
    )


def run_cli_json(db_path, *args):
    """Run ledger.py and parse its single JSON object from stdout.

    Asserts the command succeeded; raises AssertionError otherwise.
    """
    proc = run_cli(db_path, *args)
    if proc.returncode != 0:
        raise AssertionError(
            "CLI failed (rc=%d): %s"
            % (proc.returncode, (proc.stderr or proc.stdout).strip())
        )
    return proc.returncode, json.loads(proc.stdout)


def error_json(proc):
    """Parse the structured JSON error from a failed command's stderr."""
    return json.loads(proc.stderr)


class LedgerCLITest(unittest.TestCase):
    """Base: each test gets a fresh temp dir and a fresh --db path."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = os.path.join(self.tmp.name, "ledger.sqlite")

    # ---- helpers ----------------------------------------------------------

    def init(self):
        return run_cli_json(self.db, "init")

    def start_run(self, project="proj", category="alpha", phase="build"):
        _, data = run_cli_json(
            self.db, "start-run",
            "--project", project,
            "--category", category,
            "--phase", phase,
        )
        return data["run_id"]

    def start_package(self, run_id, package_id="pkg", category="alpha"):
        _, data = run_cli_json(
            self.db, "start-package",
            "--run-id", str(run_id),
            "--package-id", package_id,
            "--category", category,
            "--files", "a.py",
            "--acs", "1",
        )
        return data["package_row"]

    def attempt(self, package_row, kind="initial", artifact="changed",
                verify_exit=0, outcome="worked", summary="ok"):
        args = [
            "record-attempt",
            "--package-row", str(package_row),
            "--kind", kind,
            "--artifact", artifact,
            "--verify-exit", str(verify_exit),
            "--outcome", outcome,
            "--summary", summary,
        ]
        _, data = run_cli_json(self.db, *args)
        return data["attempt_id"]

    def log_event(self, run_id, kind="dispatch", summary="started", package_row=None):
        args = [
            "log-event",
            "--run-id", str(run_id),
            "--kind", kind,
            "--summary", summary,
        ]
        if package_row is not None:
            args.extend(["--package-row", str(package_row)])
        _, data = run_cli_json(self.db, *args)
        return data["event_id"]

    def db_columns(self):
        conn = sqlite3.connect(self.db)
        try:
            cols = {}
            for table in TABLES:
                cols[table] = [
                    row[1]
                    for row in conn.execute(
                        "PRAGMA table_info(%s)" % table
                    ).fetchall()
                ]
            return cols
        finally:
            conn.close()

    # ---- help -------------------------------------------------------------

    def test_help_exits_zero(self):
        proc = subprocess.run(
            [sys.executable, LEDGER, "--help"],
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0)
        self.assertIn("record-attempt", proc.stdout)
        self.assertIn("log-event", proc.stdout)
        self.assertIn("run-log", proc.stdout)

    # ---- structured event log --------------------------------------------

    def test_log_event_and_run_log_are_compact_and_ordered(self):
        self.init()
        run_id = self.start_run()
        package_row = self.start_package(run_id)
        first = self.log_event(run_id, "dispatch", "worker dispatched", package_row)
        second = self.log_event(run_id, "verify", "target test exit 0", package_row)
        self.assertLess(first, second)

        _, data = run_cli_json(
            self.db, "run-log", "--run-id", str(run_id), "--limit", "10"
        )
        self.assertEqual([event["kind"] for event in data["events"]], ["dispatch", "verify"])
        self.assertEqual(data["events"][0]["package_row"], package_row)
        self.assertEqual(data["events"][1]["summary"], "target test exit 0")

    def test_log_event_rejects_mismatched_package_and_run(self):
        self.init()
        first_run = self.start_run(project="one")
        second_run = self.start_run(project="two")
        package_row = self.start_package(first_run)
        proc = run_cli(
            self.db,
            "log-event",
            "--run-id", str(second_run),
            "--package-row", str(package_row),
            "--kind", "dispatch",
            "--summary", "wrong run",
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("does not belong to run", error_json(proc)["error"])

    def test_log_event_validates_kind_and_summary_length(self):
        self.init()
        run_id = self.start_run()
        bad_kind = run_cli(
            self.db,
            "log-event",
            "--run-id", str(run_id),
            "--kind", "noise",
            "--summary", "bad",
        )
        self.assertEqual(bad_kind.returncode, 2)
        self.assertIn("invalid event kind", error_json(bad_kind)["error"])

        too_long = run_cli(
            self.db,
            "log-event",
            "--run-id", str(run_id),
            "--kind", "dispatch",
            "--summary", "x" * (SUMMARY_MAX + 1),
        )
        self.assertEqual(too_long.returncode, 2)
        self.assertIn("summary exceeds", error_json(too_long)["error"])

    # ---- init / schema ----------------------------------------------------

    def test_init_creates_six_tables(self):
        _, data = self.init()
        self.assertIn("tables", data)
        for table in TABLES:
            self.assertIn(table, data["tables"])

    def test_schema_has_no_sensitive_columns(self):
        self.init()
        columns = [
            col
            for cols in self.db_columns().values()
            for col in cols
        ]
        self.assertIn("id", columns)
        for forbidden in FORBIDDEN_COLUMNS:
            self.assertNotIn(forbidden, columns)

    def test_init_is_idempotent(self):
        self.init()
        _, data = self.init()
        for table in TABLES:
            self.assertIn(table, data["tables"])

    def test_init_migrates_legacy_schema_and_preserves_data(self):
        conn = sqlite3.connect(self.db)
        conn.executescript(
            """
            CREATE TABLE runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                status TEXT NOT NULL DEFAULT 'running',
                started_at TEXT NOT NULL,
                finished_at TEXT
            );
            CREATE TABLE packages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL REFERENCES runs(id),
                name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'running',
                started_at TEXT NOT NULL,
                finished_at TEXT
            );
            CREATE TABLE attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL REFERENCES runs(id),
                package_id INTEGER NOT NULL REFERENCES packages(id),
                kind TEXT NOT NULL,
                outcome TEXT NOT NULL,
                artifact TEXT NOT NULL,
                text TEXT,
                created_at TEXT NOT NULL
            );
            INSERT INTO runs (status, started_at) VALUES ('success', '2026-01-01T00:00:00Z');
            INSERT INTO packages (run_id, name, status, started_at)
                VALUES (1, 'legacy-package', 'success', '2026-01-01T00:00:01Z');
            INSERT INTO attempts (run_id, package_id, kind, outcome, artifact, text, created_at)
                VALUES (1, 1, 'initial', 'worked', 'changed', 'legacy summary', '2026-01-01T00:00:02Z');
            """
        )
        conn.commit()
        conn.close()

        self.init()

        columns = self.db_columns()
        self.assertEqual(
            columns["runs"],
            ["id", "project", "category", "phase", "status", "started_at", "finished_at"],
        )
        self.assertIn("package_id", columns["packages"])
        self.assertIn("risk", columns["packages"])
        self.assertIn("review_mode", columns["packages"])
        self.assertNotIn("name", columns["packages"])
        self.assertIn("package_row", columns["attempts"])
        self.assertIn("verify_exit", columns["attempts"])
        self.assertIn("summary", columns["attempts"])
        self.assertIn("error_class", columns["attempts"])
        self.assertNotIn("text", columns["attempts"])
        self.assertIn("traces", columns)
        self.assertIn("evidence", columns["traces"])

        conn = sqlite3.connect(self.db)
        try:
            package = conn.execute(
                "SELECT package_id, status FROM packages WHERE id = 1"
            ).fetchone()
            attempt = conn.execute(
                "SELECT package_row, summary FROM attempts WHERE id = 1"
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(package, ("legacy-package", "success"))
        self.assertEqual(attempt, (1, "legacy summary"))

    def test_failed_legacy_migration_rolls_back_every_table(self):
        conn = sqlite3.connect(self.db)
        conn.executescript(
            """
            CREATE TABLE runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                status TEXT NOT NULL DEFAULT 'running',
                started_at TEXT NOT NULL,
                finished_at TEXT
            );
            CREATE TABLE packages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL REFERENCES runs(id),
                unsupported_name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'running',
                started_at TEXT NOT NULL,
                finished_at TEXT
            );
            INSERT INTO runs (status, started_at) VALUES ('success', '2026-01-01T00:00:00Z');
            INSERT INTO packages (run_id, unsupported_name, status, started_at)
                VALUES (1, 'cannot-map', 'success', '2026-01-01T00:00:01Z');
            """
        )
        conn.commit()
        conn.close()

        proc = run_cli(self.db, "init")
        self.assertEqual(proc.returncode, 2)
        self.assertIn("error", error_json(proc))

        conn = sqlite3.connect(self.db)
        try:
            runs_columns = [
                row[1] for row in conn.execute("PRAGMA table_info(runs)")
            ]
            packages_columns = [
                row[1] for row in conn.execute("PRAGMA table_info(packages)")
            ]
            run = conn.execute("SELECT status, started_at FROM runs WHERE id = 1").fetchone()
            package = conn.execute(
                "SELECT unsupported_name, status FROM packages WHERE id = 1"
            ).fetchone()
        finally:
            conn.close()

        self.assertEqual(
            runs_columns,
            ["id", "status", "started_at", "finished_at"],
        )
        self.assertIn("unsupported_name", packages_columns)
        self.assertEqual(run, ("success", "2026-01-01T00:00:00Z"))
        self.assertEqual(package, ("cannot-map", "success"))

    def test_tables_have_utc_timestamps_and_fks(self):
        self.init()
        cols = self.db_columns()
        # runs/packages track started_at/finished_at; attempts/observations/
        # patterns track created_at — all UTC timestamps.
        for table in ("runs", "packages"):
            self.assertIn("started_at", cols[table])
            self.assertIn("finished_at", cols[table])
        for table in ("attempts", "observations", "patterns"):
            self.assertIn("created_at", cols[table])
        self.assertIn("run_id", cols["packages"])
        self.assertIn("run_id", cols["attempts"])
        self.assertIn("package_row", cols["attempts"])

    # ---- runs -------------------------------------------------------------

    def test_start_run(self):
        self.init()
        _, data = run_cli_json(self.db, "start-run")
        self.assertIsInstance(data["run_id"], int)
        self.assertGreater(data["run_id"], 0)

    def test_start_run_with_metadata(self):
        self.init()
        run_id = self.start_run(project="p1", category="beta", phase="test")
        conn = sqlite3.connect(self.db)
        try:
            row = conn.execute(
                "SELECT project, category, phase, status FROM runs WHERE id = ?",
                (run_id,),
            ).fetchone()
        finally:
            conn.close()
        self.assertEqual(row, ("p1", "beta", "test", "running"))

    def test_finish_run_success(self):
        self.init()
        run_id = self.start_run()
        _, data = run_cli_json(
            self.db, "finish-run", "--run-id", str(run_id), "--status", "success"
        )
        self.assertEqual(data["run_id"], run_id)
        self.assertEqual(data["status"], "success")

    def test_finish_run_missing_is_structured_error(self):
        self.init()
        proc = run_cli(
            self.db, "finish-run", "--run-id", "999999", "--status", "success"
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("error", error_json(proc))

    def test_finish_run_invalid_status_exit2(self):
        self.init()
        run_id = self.start_run()
        proc = run_cli(
            self.db, "finish-run", "--run-id", str(run_id), "--status", "bogus"
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("error", error_json(proc))

    # ---- packages ---------------------------------------------------------

    def test_start_package(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id, "pkgA")
        self.assertIsInstance(pkg_row, int)
        self.assertGreater(pkg_row, 0)

    def test_start_package_missing_run_exit2(self):
        self.init()
        proc = run_cli(
            self.db, "start-package",
            "--run-id", "999999",
            "--package-id", "pkgX",
            "--category", "alpha",
        )
        self.assertEqual(proc.returncode, 2)
        data = error_json(proc)
        self.assertIn("error", data)

    def test_finish_package_success(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id, "pkgA")
        _, data = run_cli_json(
            self.db, "finish-package",
            "--package-row", str(pkg_row),
            "--status", "failed",
        )
        self.assertEqual(data["package_row"], pkg_row)
        self.assertEqual(data["status"], "failed")

    def test_finish_package_missing_is_structured_error(self):
        self.init()
        proc = run_cli(
            self.db, "finish-package",
            "--package-row", "999999", "--status", "success",
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("error", error_json(proc))

    # ---- record-attempt enums ---------------------------------------------

    def test_record_attempt_all_kinds(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id)
        for kind in KINDS:
            self.attempt(pkg_row, kind=kind)

    def test_record_attempt_all_artifacts(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id)
        for artifact in ARTIFACTS:
            self.attempt(pkg_row, artifact=artifact)

    def test_record_attempt_all_outcomes(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id)
        for outcome in OUTCOMES:
            self.attempt(pkg_row, outcome=outcome)

    def test_invalid_kind_exit2(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id)
        proc = run_cli(
            self.db, "record-attempt",
            "--package-row", str(pkg_row),
            "--kind", "bogus",
            "--artifact", "changed",
            "--verify-exit", "0",
            "--outcome", "worked",
            "--summary", "x",
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("error", error_json(proc))

    def test_invalid_artifact_exit2(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id)
        proc = run_cli(
            self.db, "record-attempt",
            "--package-row", str(pkg_row),
            "--kind", "initial",
            "--artifact", "bogus",
            "--verify-exit", "0",
            "--outcome", "worked",
            "--summary", "x",
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("error", error_json(proc))

    def test_invalid_outcome_exit2(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id)
        proc = run_cli(
            self.db, "record-attempt",
            "--package-row", str(pkg_row),
            "--kind", "initial",
            "--artifact", "changed",
            "--verify-exit", "0",
            "--outcome", "bogus",
            "--summary", "x",
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("error", error_json(proc))

    def test_record_attempt_missing_package_exit2(self):
        self.init()
        run_id = self.start_run()
        proc = run_cli(
            self.db, "record-attempt",
            "--package-row", "999999",
            "--kind", "initial",
            "--artifact", "changed",
            "--verify-exit", "0",
            "--outcome", "worked",
            "--summary", "x",
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("error", error_json(proc))

    # ---- summary 240/241 bound --------------------------------------------

    def test_summary_240_chars_accepted(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id)
        summary = "x" * SUMMARY_MAX
        self.attempt(pkg_row, summary=summary)

    def test_summary_241_chars_exit2(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id)
        proc = run_cli(
            self.db, "record-attempt",
            "--package-row", str(pkg_row),
            "--kind", "initial",
            "--artifact", "changed",
            "--verify-exit", "0",
            "--outcome", "worked",
            "--summary", "y" * (SUMMARY_MAX + 1),
        )
        self.assertEqual(proc.returncode, 2)
        data = error_json(proc)
        self.assertIn("error", data)

    # ---- similar ----------------------------------------------------------

    def test_similar_newest_first_with_limit(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id, "pkgS", category="alpha")
        older = self.attempt(pkg_row, summary="first attempt")
        newer = self.attempt(pkg_row, summary="second attempt")
        _, data = run_cli_json(
            self.db, "similar", "--category", "alpha", "--limit", "1"
        )
        similar = data["similar"]
        self.assertEqual(len(similar), 1)
        self.assertEqual(similar[0]["attempt_id"], newer)
        self.assertNotEqual(newer, older)

    def test_similar_filters_by_category(self):
        self.init()
        run_id = self.start_run()
        alpha_row = self.start_package(run_id, "pkgA", category="alpha")
        beta_row = self.start_package(run_id, "pkgB", category="beta")
        self.attempt(alpha_row, summary="alpha note")
        self.attempt(beta_row, summary="beta note")
        _, data = run_cli_json(
            self.db, "similar", "--category", "beta", "--limit", "10"
        )
        self.assertEqual(len(data["similar"]), 1)
        self.assertEqual(data["similar"][0]["package_id"], "pkgB")

    # ---- stats ------------------------------------------------------------

    def test_stats_by_category(self):
        self.init()
        run_id = self.start_run()
        alpha_row = self.start_package(run_id, "pkgA", category="alpha")
        beta_row = self.start_package(run_id, "pkgB", category="beta")
        self.attempt(alpha_row)
        self.attempt(alpha_row)
        self.attempt(beta_row)
        _, data = run_cli_json(self.db, "stats")
        self.assertEqual(data["stats"]["by_category"]["alpha"], 2)
        self.assertEqual(data["stats"]["by_category"]["beta"], 1)

    def test_stats_by_outcome(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id)
        self.attempt(pkg_row, outcome="worked")
        self.attempt(pkg_row, outcome="failed")
        self.attempt(pkg_row, outcome="failed")
        _, data = run_cli_json(self.db, "stats")
        self.assertEqual(data["stats"]["by_outcome"]["worked"], 1)
        self.assertEqual(data["stats"]["by_outcome"]["failed"], 2)

    def test_stats_package_rates(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id, "pkgR", category="alpha")
        self.attempt(pkg_row, outcome="worked")
        self.attempt(pkg_row, outcome="failed")
        _, data = run_cli_json(self.db, "stats")
        rates = data["stats"]["package_rates"]
        self.assertIn("pkgR", rates)
        self.assertEqual(rates["pkgR"]["attempts"], 2)
        self.assertEqual(rates["pkgR"]["outcomes"]["worked"], 1)
        self.assertEqual(rates["pkgR"]["outcomes"]["failed"], 1)

    # ---- Meta-Harness: classify, traces, lessons, diagnose, reap ----------

    def test_record_attempt_auto_classifies_and_patterns(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id, category="alpha")
        _, data = run_cli_json(
            self.db,
            "record-attempt",
            "--package-row", str(pkg_row),
            "--kind", "initial",
            "--artifact", "missing",
            "--verify-exit", "1",
            "--outcome", "failed",
            "--summary", "Empty report and no artifact; plan missing",
            "--trace-evidence", "probe: ls plan.md → missing",
        )
        self.assertEqual(data["error_class"], "empty_report")
        self.assertIsNotNone(data["pattern_id"])
        self.assertIsNotNone(data["trace_id"])
        self.assertIn("report schema", data["fix_hint"])

        _, similar = run_cli_json(
            self.db, "similar", "--category", "alpha", "--limit", "5"
        )
        self.assertEqual(similar["similar"][0]["error_class"], "empty_report")
        self.assertTrue(any(p["pattern"] == "empty_report" for p in similar["patterns"]))

    def test_log_trace_and_diagnose(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id)
        self.attempt(
            pkg_row,
            outcome="failed",
            artifact="unchanged",
            summary="Worker hit step limit before writing the plan",
        )
        _, tr = run_cli_json(
            self.db,
            "log-trace",
            "--run-id", str(run_id),
            "--package-row", str(pkg_row),
            "--kind", "stderr",
            "--evidence", "step budget exhausted after 50 tools",
        )
        self.assertIn("trace_id", tr)

        _, diag = run_cli_json(
            self.db, "diagnose", "--package-row", str(pkg_row)
        )
        self.assertEqual(diag["error_class"], "step_limit")
        self.assertEqual(diag["next_kind"], "fix1")
        self.assertTrue(diag["traces"])

    def test_lessons_and_reap_stale(self):
        self.init()
        run_id = self.start_run()
        pkg_row = self.start_package(run_id, category="beta")
        for _ in range(2):
            run_cli_json(
                self.db,
                "record-attempt",
                "--package-row", str(pkg_row),
                "--kind", "initial",
                "--artifact", "missing",
                "--verify-exit", "1",
                "--outcome", "failed",
                "--summary", "QUALITY rejected duplicate Vec2 arithmetic",
            )
        _, lessons = run_cli_json(
            self.db, "lessons", "--category", "beta", "--limit", "3"
        )
        self.assertTrue(lessons["lessons"])
        self.assertEqual(lessons["lessons"][0]["pattern"], "quality_nit")

        # Force stale timestamp then reap
        conn = sqlite3.connect(self.db)
        conn.execute(
            "UPDATE packages SET started_at = '2020-01-01T00:00:00Z' WHERE id = ?",
            (pkg_row,),
        )
        conn.execute(
            "UPDATE runs SET started_at = '2020-01-01T00:00:00Z' WHERE id = ?",
            (run_id,),
        )
        conn.commit()
        conn.close()

        _, reap = run_cli_json(self.db, "reap-stale", "--hours", "1")
        self.assertEqual(len(reap["reaped_packages"]), 1)
        self.assertEqual(reap["reaped_packages"][0]["package_row"], pkg_row)

        conn = sqlite3.connect(self.db)
        status = conn.execute(
            "SELECT status FROM packages WHERE id = ?", (pkg_row,)
        ).fetchone()[0]
        conn.close()
        self.assertEqual(status, "failed")

    def test_start_package_risk_and_review_mode(self):
        self.init()
        run_id = self.start_run()
        _, data = run_cli_json(
            self.db,
            "start-package",
            "--run-id", str(run_id),
            "--package-id", "pkg-risk",
            "--category", "alpha",
            "--files", "a.py",
            "--acs", "2",
            "--risk", "high",
            "--review-mode", "dual",
        )
        self.assertEqual(data["risk"], "high")
        self.assertEqual(data["review_mode"], "dual")


if __name__ == "__main__":
    unittest.main(verbosity=2)
