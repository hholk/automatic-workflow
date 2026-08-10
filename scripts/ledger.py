#!/usr/bin/env python3
"""Ultrawork SQLite ledger CLI (Meta-Harness-aware).

Tracks orchestration runs, packages, attempts, observations, patterns, and
structured traces. Commands:

  init
  start-run      --project --category --phase
  start-package  --run-id --package-id --category --files --acs [--risk] [--review-mode]
  log-event      --run-id [--package-row] --kind --summary
  log-trace      --run-id [--package-row] [--attempt-id] --kind --evidence
  run-log        --run-id --limit
  record-attempt --package-row --kind --artifact --verify-exit --outcome
                 --summary [--error-class] [--review-mode] [--risk] [--trace-evidence]
  finish-package --package-row --status
  finish-run     --run-id --status
  similar        --category --limit
  lessons        --category --limit
  diagnose       --text | --package-row
  reap-stale     --hours
  stats

Enums:
  kind         initial | fix1 | fix2 | fix3
  artifact     missing | unchanged | changed
  outcome      worked | failed | no_op | flaky | blocked
  status       running | success | failed | blocked
  risk         low | medium | high
  review_mode  none | single | dual
  event kind   dispatch | artifact | verify | review | integration | blocker | diagnose | lesson | reap
  trace kind   probe | verify | report | stderr | dispatch | diagnose | other
  error_class  empty_report | step_limit | quality_nit | spec_fail | scope_too_big
               | provider_error | test_fail | no_op | path_blocked | report_invalid | unknown

Every command except --help prints exactly one compact JSON object on stdout.
On error it prints a structured JSON object to stderr and exits with code 2.
"""

import argparse
import json
import re
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

DEFAULT_DB = Path.home() / ".local" / "share" / "opencode" / "ultrawork" / "ledger.sqlite"

KINDS = ("initial", "fix1", "fix2", "fix3")
ARTIFACTS = ("missing", "unchanged", "changed")
OUTCOMES = ("worked", "failed", "no_op", "flaky", "blocked")
STATUSES = ("running", "success", "failed", "blocked")
RISKS = ("low", "medium", "high")
REVIEW_MODES = ("none", "single", "dual")
EVENT_KINDS = (
    "dispatch",
    "artifact",
    "verify",
    "review",
    "integration",
    "blocker",
    "diagnose",
    "lesson",
    "reap",
)
TRACE_KINDS = ("probe", "verify", "report", "stderr", "dispatch", "diagnose", "other")
ERROR_CLASSES = (
    "empty_report",
    "step_limit",
    "quality_nit",
    "spec_fail",
    "scope_too_big",
    "provider_error",
    "test_fail",
    "no_op",
    "path_blocked",
    "report_invalid",
    "unknown",
)
SUMMARY_MAX = 240
EVIDENCE_MAX = 4000
TABLES = ("runs", "packages", "attempts", "observations", "patterns", "traces")

# Keyword → error_class (first match wins). Meta-Harness: map failures to
# harness decisions, not vague "it failed".
ERROR_RULES = (
    ("empty_report", re.compile(
        r"empty\s*(report|task|result)|no\s*artifact|missing\s*report|"
        r"intro-only|malformed\s*report|no\s*task\s*result",
        re.I,
    )),
    ("step_limit", re.compile(
        r"step\s*limit|tool\s*call\s*limit|out\s*of\s*steps|budget\s*exhaust",
        re.I,
    )),
    ("provider_error", re.compile(
        r"-32603|server\s*error|provider\s*error|rate\s*limit|timeout|"
        r"5\d\d\s*error|connection\s*(reset|refused)",
        re.I,
    )),
    ("quality_nit", re.compile(
        r"quality\s*(reject|fail|found)|QUALITY\s*reject",
        re.I,
    )),
    ("spec_fail", re.compile(
        r"spec\s*(reject|fail|found)|SPEC\s*reject|AC\s*fail",
        re.I,
    )),
    ("scope_too_big", re.compile(
        r"monolithic|exceeded\s*workable\s*scope|scope\s*too\s*(big|large)|"
        r"split\s*before|too\s*many\s*files",
        re.I,
    )),
    ("report_invalid", re.compile(
        r"report\s*invalid|invalid\s*report|schema\s*(fail|invalid)",
        re.I,
    )),
    ("test_fail", re.compile(
        r"test\s*fail|verify\s*(exit\s*)?[1-9]|failed\s*AC|assertion|"
        r"clippy|typecheck|lint\s*fail",
        re.I,
    )),
    ("path_blocked", re.compile(
        r"path\s*(lock|overlap|blocked)|outside\s*allowed|forbidden\s*path",
        re.I,
    )),
    ("no_op", re.compile(
        r"\bno[_\s-]?op\b|unchanged\s*artifact|no\s*edits|did\s*not\s*change",
        re.I,
    )),
)

FIX_HINTS = {
    "empty_report": (
        "Re-dispatch fresh worker; append report schema verbatim; require "
        "artifact write before report; one report-only resume only if artifact changed."
    ),
    "step_limit": (
        "Split package or raise effective tool budget; narrow FIRST ACTION; "
        "defer non-essential reads; reserve final steps for verify+report."
    ),
    "provider_error": (
        "Retry once with identical brief; if repeat, log blocker and switch "
        "timing/path; do not burn Fix budget on infra flakes."
    ),
    "quality_nit": (
        "Feed QUALITY required_fixes as FixN; keep paths same; mechanical patch only."
    ),
    "spec_fail": (
        "Feed failed AC + SPEC required_fixes; do not expand scope; re-probe AC."
    ),
    "scope_too_big": (
        "Split into path-disjoint packages; use medium tier or sequential deps."
    ),
    "report_invalid": (
        "If artifact changed: judge evidence only. If not: one report-only resume, then Fix."
    ),
    "test_fail": (
        "Fix1 with failed command+stderr tail; narrow verify; no architecture rewrite."
    ),
    "path_blocked": (
        "Wait for path lock or reassign package; never parallel-write shared paths."
    ),
    "no_op": (
        "Treat as failed pass; next brief must name exact file/symbol before/after."
    ),
    "unknown": (
        "Probe artifacts independently; classify from evidence; prefer split over retry."
    ),
}

CREATE_DDL = {
    "runs": """
        CREATE TABLE IF NOT EXISTS runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project TEXT,
            category TEXT,
            phase TEXT,
            status TEXT NOT NULL DEFAULT 'running',
            started_at TEXT NOT NULL,
            finished_at TEXT
        )
    """,
    "packages": """
        CREATE TABLE IF NOT EXISTS packages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL REFERENCES runs(id),
            package_id TEXT NOT NULL,
            category TEXT,
            files TEXT,
            acs TEXT,
            risk TEXT,
            review_mode TEXT,
            status TEXT NOT NULL DEFAULT 'running',
            started_at TEXT NOT NULL,
            finished_at TEXT
        )
    """,
    "attempts": """
        CREATE TABLE IF NOT EXISTS attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL REFERENCES runs(id),
            package_row INTEGER NOT NULL REFERENCES packages(id),
            kind TEXT,
            artifact TEXT,
            verify_exit INTEGER,
            outcome TEXT,
            summary TEXT,
            error_class TEXT,
            review_mode TEXT,
            risk TEXT,
            created_at TEXT NOT NULL
        )
    """,
    "observations": """
        CREATE TABLE IF NOT EXISTS observations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL REFERENCES runs(id),
            package_row INTEGER REFERENCES packages(id),
            text TEXT,
            kind TEXT,
            created_at TEXT NOT NULL
        )
    """,
    "patterns": """
        CREATE TABLE IF NOT EXISTS patterns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL REFERENCES runs(id),
            package_row INTEGER REFERENCES packages(id),
            pattern TEXT,
            category TEXT,
            count INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """,
    "traces": """
        CREATE TABLE IF NOT EXISTS traces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL REFERENCES runs(id),
            package_row INTEGER REFERENCES packages(id),
            attempt_id INTEGER,
            kind TEXT NOT NULL,
            evidence TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """,
}

INDEXES = """
CREATE INDEX IF NOT EXISTS idx_packages_run ON packages(run_id);
CREATE INDEX IF NOT EXISTS idx_packages_category ON packages(category);
CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);
CREATE INDEX IF NOT EXISTS idx_attempts_run ON attempts(run_id);
CREATE INDEX IF NOT EXISTS idx_attempts_package ON attempts(package_row);
CREATE INDEX IF NOT EXISTS idx_attempts_outcome ON attempts(outcome);
CREATE INDEX IF NOT EXISTS idx_attempts_error ON attempts(error_class);
CREATE INDEX IF NOT EXISTS idx_attempts_time ON attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_observations_time ON observations(created_at);
CREATE INDEX IF NOT EXISTS idx_patterns_category ON patterns(category);
CREATE INDEX IF NOT EXISTS idx_patterns_time ON patterns(created_at);
CREATE INDEX IF NOT EXISTS idx_traces_run ON traces(run_id);
CREATE INDEX IF NOT EXISTS idx_traces_package ON traces(package_row);
CREATE INDEX IF NOT EXISTS idx_traces_attempt ON traces(attempt_id);
"""

DESIRED = {
    "runs": ["id", "project", "category", "phase", "status", "started_at", "finished_at"],
    "packages": [
        "id", "run_id", "package_id", "category", "files", "acs",
        "risk", "review_mode", "status", "started_at", "finished_at",
    ],
    "attempts": [
        "id", "run_id", "package_row", "kind", "artifact", "verify_exit",
        "outcome", "summary", "error_class", "review_mode", "risk", "created_at",
    ],
    "observations": ["id", "run_id", "package_row", "text", "kind", "created_at"],
    "patterns": [
        "id", "run_id", "package_row", "pattern", "category", "count", "created_at",
    ],
    "traces": [
        "id", "run_id", "package_row", "attempt_id", "kind", "evidence", "created_at",
    ],
}

LEGACY_TRANSFORMS = {
    "runs": {
        "id": "id", "project": "NULL", "category": "NULL", "phase": "NULL",
        "status": "status", "started_at": "started_at", "finished_at": "finished_at",
    },
    "packages": {
        "id": "id", "run_id": "run_id", "package_id": "name",
        "category": "NULL", "files": "NULL", "acs": "NULL",
        "risk": "NULL", "review_mode": "NULL",
        "status": "status", "started_at": "started_at", "finished_at": "finished_at",
    },
    "attempts": {
        "id": "id", "run_id": "run_id", "package_row": "package_id",
        "kind": "kind", "artifact": "artifact", "verify_exit": "NULL",
        "outcome": "outcome", "summary": "text",
        "error_class": "NULL", "review_mode": "NULL", "risk": "NULL",
        "created_at": "created_at",
    },
}


def utcnow():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def connect(db_path):
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def table_columns(conn, table):
    return [row[1] for row in conn.execute("PRAGMA table_info(%s)" % table)]


def emit(obj):
    print(json.dumps(obj, separators=(",", ":")))


def fail(msg):
    print(json.dumps({"error": msg}, separators=(",", ":")), file=sys.stderr)
    sys.exit(2)


def check_enum(value, choices, label):
    if value not in choices:
        fail("invalid %s: %s" % (label, value))


def classify_error(text, outcome=None, artifact=None):
    """Map free-text evidence to a harness-level error_class."""
    if outcome == "no_op" or artifact in ("missing", "unchanged") and outcome in (
        "failed",
        "no_op",
        None,
    ):
        if outcome == "no_op":
            return "no_op"
    blob = text or ""
    if not blob and artifact == "missing":
        return "empty_report"
    if not blob and artifact == "unchanged":
        return "no_op"
    for name, pattern in ERROR_RULES:
        if pattern.search(blob):
            return name
    if outcome in ("failed", "blocked", "flaky", "no_op"):
        if outcome == "no_op":
            return "no_op"
        if outcome == "blocked":
            return "path_blocked" if "path" in blob.lower() else "unknown"
        return "unknown"
    return None


def migrate_table(conn, table, cur_cols, desired_cols):
    """Rebuild an incompatible table to the current schema, preserving rows."""
    new = table + "_new"
    transforms = LEGACY_TRANSFORMS.get(table, {})
    columns = ", ".join(desired_cols)
    select = []
    for col in desired_cols:
        # Prefer existing columns (additive migrations). Legacy transforms
        # only apply when the desired column is missing from the old table.
        if col in cur_cols:
            expr = col
        else:
            expr = transforms.get(col, "NULL")
            # Transform may name a source column (e.g. package_id <- name).
            if expr != "NULL" and expr not in cur_cols:
                if table == "packages" and col == "package_id" and "name" not in cur_cols:
                    raise RuntimeError(
                        "cannot map packages schema: missing package_id/name"
                    )
                expr = "NULL"
        select.append("%s AS %s" % (expr, col))
    conn.execute("DROP TABLE IF EXISTS %s" % new)
    conn.execute(
        CREATE_DDL[table].replace(
            "CREATE TABLE IF NOT EXISTS %s" % table, "CREATE TABLE %s" % new
        )
    )
    conn.execute(
        "INSERT INTO %s (%s) SELECT %s FROM %s"
        % (new, columns, ", ".join(select), table)
    )
    conn.execute("DROP TABLE %s" % table)
    conn.execute("ALTER TABLE %s RENAME TO %s" % (new, table))


def upsert_pattern(conn, run_id, package_row, category, error_class):
    if not error_class or error_class == "unknown":
        # still record unknown lightly
        if not error_class:
            return None
    pattern = error_class
    row = conn.execute(
        "SELECT id, count FROM patterns WHERE category IS ? AND pattern = ? "
        "ORDER BY id DESC LIMIT 1",
        (category, pattern),
    ).fetchone()
    if row:
        conn.execute(
            "UPDATE patterns SET count = ?, run_id = ?, package_row = ? WHERE id = ?",
            (row[1] + 1, run_id, package_row, row[0]),
        )
        return row[0]
    cur = conn.execute(
        "INSERT INTO patterns (run_id, package_row, pattern, category, count, created_at) "
        "VALUES (?, ?, ?, ?, 1, ?)",
        (run_id, package_row, pattern, category, utcnow()),
    )
    return cur.lastrowid


def insert_trace(conn, run_id, package_row, attempt_id, kind, evidence):
    if evidence is None:
        return None
    if len(evidence) > EVIDENCE_MAX:
        fail(
            "evidence exceeds %d characters (%d)"
            % (EVIDENCE_MAX, len(evidence))
        )
    check_enum(kind, TRACE_KINDS, "trace kind")
    cur = conn.execute(
        "INSERT INTO traces (run_id, package_row, attempt_id, kind, evidence, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (run_id, package_row, attempt_id, kind, evidence, utcnow()),
    )
    return cur.lastrowid


def cmd_init(conn, args):
    """Create/migrate every table and its indexes in one atomic transaction."""
    prev_isolation = conn.isolation_level
    had_txn = conn.in_transaction
    if had_txn:
        conn.commit()
    conn.isolation_level = None
    conn.execute("PRAGMA foreign_keys = OFF")
    try:
        conn.execute("BEGIN IMMEDIATE")
        try:
            for table in TABLES:
                cur = table_columns(conn, table)
                if cur:
                    if cur != DESIRED[table]:
                        migrate_table(conn, table, cur, DESIRED[table])
                else:
                    conn.execute(CREATE_DDL[table])
            for stmt in INDEXES.strip().splitlines():
                if stmt.strip():
                    conn.execute(stmt)
            violations = conn.execute("PRAGMA foreign_key_check").fetchall()
            if violations:
                raise RuntimeError(
                    "foreign key violations after init/schema rebuild: %r"
                    % (violations,)
                )
            conn.commit()
        except BaseException:
            if conn.in_transaction:
                conn.rollback()
            raise
    finally:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.isolation_level = prev_isolation
    emit({"tables": {t: table_columns(conn, t) for t in TABLES}})


def cmd_start_run(conn, args):
    cur = conn.execute(
        "INSERT INTO runs (project, category, phase, status, started_at) "
        "VALUES (?, ?, ?, 'running', ?)",
        (args.project, args.category, args.phase, utcnow()),
    )
    conn.commit()
    emit({"run_id": cur.lastrowid})


def cmd_start_package(conn, args):
    row = conn.execute("SELECT id FROM runs WHERE id = ?", (args.run_id,)).fetchone()
    if row is None:
        fail("run %d not found" % args.run_id)
    risk = args.risk
    review_mode = args.review_mode
    if risk is not None:
        check_enum(risk, RISKS, "risk")
    if review_mode is not None:
        check_enum(review_mode, REVIEW_MODES, "review_mode")
    cur = conn.execute(
        "INSERT INTO packages (run_id, package_id, category, files, acs, "
        "risk, review_mode, status, started_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?)",
        (
            args.run_id,
            args.package_id,
            args.category,
            args.files,
            args.acs,
            risk,
            review_mode,
            utcnow(),
        ),
    )
    conn.commit()
    emit({
        "package_row": cur.lastrowid,
        "package_id": args.package_id,
        "risk": risk,
        "review_mode": review_mode,
    })


def cmd_record_attempt(conn, args):
    check_enum(args.kind, KINDS, "kind")
    check_enum(args.artifact, ARTIFACTS, "artifact")
    check_enum(args.outcome, OUTCOMES, "outcome")
    if args.summary is not None and len(args.summary) > SUMMARY_MAX:
        fail(
            "summary exceeds %d characters (%d)"
            % (SUMMARY_MAX, len(args.summary))
        )
    if args.review_mode is not None:
        check_enum(args.review_mode, REVIEW_MODES, "review_mode")
    if args.risk is not None:
        check_enum(args.risk, RISKS, "risk")
    if args.error_class is not None:
        check_enum(args.error_class, ERROR_CLASSES, "error_class")

    row = conn.execute(
        "SELECT id, run_id, category, risk, review_mode FROM packages WHERE id = ?",
        (args.package_row,),
    ).fetchone()
    if row is None:
        fail("package %d not found" % args.package_row)
    package_row, run_id, category, pkg_risk, pkg_review = row

    error_class = args.error_class
    if error_class is None and args.outcome in (
        "failed", "no_op", "flaky", "blocked",
    ):
        error_class = classify_error(
            args.summary, outcome=args.outcome, artifact=args.artifact
        ) or "unknown"
    elif error_class is None and args.outcome == "worked" and args.artifact in (
        "missing", "unchanged",
    ):
        # false DONE signal
        error_class = classify_error(
            args.summary, outcome="failed", artifact=args.artifact
        ) or "no_op"

    risk = args.risk if args.risk is not None else pkg_risk
    review_mode = (
        args.review_mode if args.review_mode is not None else pkg_review
    )

    cur = conn.execute(
        "INSERT INTO attempts (run_id, package_row, kind, artifact, "
        "verify_exit, outcome, summary, error_class, review_mode, risk, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            run_id,
            package_row,
            args.kind,
            args.artifact,
            args.verify_exit,
            args.outcome,
            args.summary,
            error_class,
            review_mode,
            risk,
            utcnow(),
        ),
    )
    attempt_id = cur.lastrowid

    pattern_id = None
    if error_class and args.outcome in ("failed", "no_op", "flaky", "blocked"):
        pattern_id = upsert_pattern(
            conn, run_id, package_row, category, error_class
        )

    trace_id = None
    if args.trace_evidence:
        tkind = "report"
        if args.outcome in ("failed", "no_op", "flaky", "blocked"):
            tkind = "diagnose"
        if args.verify_exit not in (None, 0):
            tkind = "verify"
        trace_id = insert_trace(
            conn, run_id, package_row, attempt_id, tkind, args.trace_evidence
        )

    conn.commit()
    emit({
        "attempt_id": attempt_id,
        "error_class": error_class,
        "pattern_id": pattern_id,
        "trace_id": trace_id,
        "fix_hint": FIX_HINTS.get(error_class) if error_class else None,
    })


def cmd_log_event(conn, args):
    check_enum(args.kind, EVENT_KINDS, "event kind")
    if len(args.summary) > SUMMARY_MAX:
        fail(
            "summary exceeds %d characters (%d)"
            % (SUMMARY_MAX, len(args.summary))
        )
    run = conn.execute("SELECT id FROM runs WHERE id = ?", (args.run_id,)).fetchone()
    if run is None:
        fail("run %d not found" % args.run_id)
    if args.package_row is not None:
        package = conn.execute(
            "SELECT run_id FROM packages WHERE id = ?", (args.package_row,)
        ).fetchone()
        if package is None:
            fail("package %d not found" % args.package_row)
        if package[0] != args.run_id:
            fail(
                "package %d does not belong to run %d"
                % (args.package_row, args.run_id)
            )
    cur = conn.execute(
        "INSERT INTO observations (run_id, package_row, text, kind, created_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (args.run_id, args.package_row, args.summary, args.kind, utcnow()),
    )
    conn.commit()
    emit({"event_id": cur.lastrowid})


def cmd_log_trace(conn, args):
    """Store denser diagnostic evidence (Meta-Harness: avoid score-only feedback)."""
    check_enum(args.kind, TRACE_KINDS, "trace kind")
    if not args.evidence:
        fail("evidence is required")
    if len(args.evidence) > EVIDENCE_MAX:
        fail(
            "evidence exceeds %d characters (%d)"
            % (EVIDENCE_MAX, len(args.evidence))
        )
    run = conn.execute("SELECT id FROM runs WHERE id = ?", (args.run_id,)).fetchone()
    if run is None:
        fail("run %d not found" % args.run_id)
    if args.package_row is not None:
        package = conn.execute(
            "SELECT run_id FROM packages WHERE id = ?", (args.package_row,)
        ).fetchone()
        if package is None:
            fail("package %d not found" % args.package_row)
        if package[0] != args.run_id:
            fail(
                "package %d does not belong to run %d"
                % (args.package_row, args.run_id)
            )
    trace_id = insert_trace(
        conn,
        args.run_id,
        args.package_row,
        args.attempt_id,
        args.kind,
        args.evidence,
    )
    conn.commit()
    emit({"trace_id": trace_id})


def cmd_run_log(conn, args):
    run = conn.execute("SELECT id FROM runs WHERE id = ?", (args.run_id,)).fetchone()
    if run is None:
        fail("run %d not found" % args.run_id)
    rows = conn.execute(
        "SELECT id, package_row, kind, text, created_at FROM observations "
        "WHERE run_id = ? ORDER BY id DESC LIMIT ?",
        (args.run_id, args.limit),
    ).fetchall()
    events = [
        {
            "event_id": row[0],
            "package_row": row[1],
            "kind": row[2],
            "summary": row[3],
            "created_at": row[4],
        }
        for row in reversed(rows)
    ]
    emit({"run_id": args.run_id, "events": events})


def cmd_finish_package(conn, args):
    check_enum(args.status, STATUSES, "status")
    cur = conn.execute(
        "UPDATE packages SET status = ?, finished_at = ? WHERE id = ?",
        (args.status, utcnow(), args.package_row),
    )
    conn.commit()
    if cur.rowcount == 0:
        fail("package %d not found" % args.package_row)
    emit({"package_row": args.package_row, "status": args.status})


def cmd_finish_run(conn, args):
    check_enum(args.status, STATUSES, "status")
    cur = conn.execute(
        "UPDATE runs SET status = ?, finished_at = ? WHERE id = ?",
        (args.status, utcnow(), args.run_id),
    )
    conn.commit()
    if cur.rowcount == 0:
        fail("run %d not found" % args.run_id)
    emit({"run_id": args.run_id, "status": args.status})


def cmd_similar(conn, args):
    rows = conn.execute(
        "SELECT a.id, a.run_id, a.package_row, a.kind, a.artifact, a.outcome, "
        "a.summary, a.created_at, p.package_id, a.error_class, a.review_mode, a.risk "
        "FROM attempts a JOIN packages p ON p.id = a.package_row "
        "WHERE p.category = ? "
        "ORDER BY a.created_at DESC, a.id DESC LIMIT ?",
        (args.category, args.limit),
    ).fetchall()
    similar = [
        {
            "attempt_id": r[0],
            "run_id": r[1],
            "package_row": r[2],
            "package_id": r[8],
            "kind": r[3],
            "artifact": r[4],
            "outcome": r[5],
            "summary": r[6],
            "created_at": r[7],
            "error_class": r[9],
            "review_mode": r[10],
            "risk": r[11],
            "fix_hint": FIX_HINTS.get(r[9]) if r[9] else None,
        }
        for r in rows
    ]
    patterns = conn.execute(
        "SELECT pattern, category, count FROM patterns "
        "WHERE category = ? ORDER BY count DESC, id DESC LIMIT 5",
        (args.category,),
    ).fetchall()
    top_patterns = [
        {
            "pattern": p[0],
            "category": p[1],
            "count": p[2],
            "fix_hint": FIX_HINTS.get(p[0]),
            "lesson": "Avoid %s: %s" % (p[0], FIX_HINTS.get(p[0], "")),
        }
        for p in patterns
    ]
    emit({"similar": similar, "patterns": top_patterns})


def cmd_lessons(conn, args):
    """Brief-injection lessons from pattern counts (Meta-Harness transfer)."""
    rows = conn.execute(
        "SELECT pattern, category, count FROM patterns "
        "WHERE (? IS NULL OR category = ?) "
        "ORDER BY count DESC, id DESC LIMIT ?",
        (args.category, args.category, args.limit),
    ).fetchall()
    lessons = [
        {
            "pattern": r[0],
            "category": r[1],
            "count": r[2],
            "lesson": "Avoid %s (seen %dx): %s"
            % (r[0], r[2], FIX_HINTS.get(r[0], "")),
            "fix_hint": FIX_HINTS.get(r[0]),
        }
        for r in rows
    ]
    emit({"lessons": lessons})


def cmd_diagnose(conn, args):
    """Classify failure text / latest package attempts for the next Fix brief."""
    text = args.text or ""
    package_row = args.package_row
    latest = None
    if package_row is not None:
        row = conn.execute(
            "SELECT a.summary, a.outcome, a.artifact, a.error_class, a.kind, a.id "
            "FROM attempts a WHERE a.package_row = ? ORDER BY a.id DESC LIMIT 1",
            (package_row,),
        ).fetchone()
        if row is None and not text:
            fail("package %d has no attempts" % package_row)
        if row:
            latest = {
                "summary": row[0],
                "outcome": row[1],
                "artifact": row[2],
                "error_class": row[3],
                "kind": row[4],
                "attempt_id": row[5],
            }
            if not text:
                text = row[0] or ""
        traces = conn.execute(
            "SELECT kind, evidence, created_at FROM traces "
            "WHERE package_row = ? ORDER BY id DESC LIMIT 3",
            (package_row,),
        ).fetchall()
    else:
        traces = []
        if not text:
            fail("provide --text or --package-row")

    outcome = latest["outcome"] if latest else args.outcome
    artifact = latest["artifact"] if latest else args.artifact
    error_class = classify_error(text, outcome=outcome, artifact=artifact) or "unknown"

    # Related patterns across ledger
    related = conn.execute(
        "SELECT pattern, category, count FROM patterns "
        "WHERE pattern = ? ORDER BY count DESC LIMIT 5",
        (error_class,),
    ).fetchall()

    result = {
        "error_class": error_class,
        "fix_hint": FIX_HINTS.get(error_class),
        "next_kind": _next_fix_kind(latest["kind"] if latest else None),
        "latest": latest,
        "traces": [
            {"kind": t[0], "evidence": t[1], "created_at": t[2]} for t in traces
        ],
        "related_patterns": [
            {"pattern": r[0], "category": r[1], "count": r[2]} for r in related
        ],
    }
    emit(result)


def _next_fix_kind(last_kind):
    order = ["initial", "fix1", "fix2", "fix3"]
    if last_kind not in order:
        return "fix1"
    idx = order.index(last_kind)
    if idx >= len(order) - 1:
        return "orchestrator"
    return order[idx + 1]


def cmd_reap_stale(conn, args):
    """Close packages/runs stuck in running past --hours (Meta-Harness hygiene)."""
    hours = args.hours
    if hours is None or hours <= 0:
        fail("hours must be positive")
    cutoff = (
        datetime.now(timezone.utc) - timedelta(hours=hours)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")
    pkgs = conn.execute(
        "SELECT id, run_id, package_id, started_at FROM packages "
        "WHERE status = 'running' AND started_at < ?",
        (cutoff,),
    ).fetchall()
    reaped_packages = []
    for pid, run_id, package_id, started_at in pkgs:
        conn.execute(
            "UPDATE packages SET status = 'failed', finished_at = ? WHERE id = ?",
            (utcnow(), pid),
        )
        conn.execute(
            "INSERT INTO observations (run_id, package_row, text, kind, created_at) "
            "VALUES (?, ?, ?, 'reap', ?)",
            (
                run_id,
                pid,
                "stale package %s started %s" % (package_id, started_at)[:SUMMARY_MAX],
                utcnow(),
            ),
        )
        reaped_packages.append({
            "package_row": pid,
            "package_id": package_id,
            "run_id": run_id,
            "started_at": started_at,
        })

    runs = conn.execute(
        "SELECT id, started_at FROM runs "
        "WHERE status = 'running' AND started_at < ?",
        (cutoff,),
    ).fetchall()
    reaped_runs = []
    for rid, started_at in runs:
        # only finish if no still-running packages remain
        open_pkgs = conn.execute(
            "SELECT COUNT(*) FROM packages WHERE run_id = ? AND status = 'running'",
            (rid,),
        ).fetchone()[0]
        if open_pkgs == 0:
            conn.execute(
                "UPDATE runs SET status = 'failed', finished_at = ? WHERE id = ?",
                (utcnow(), rid),
            )
            reaped_runs.append({"run_id": rid, "started_at": started_at})
    conn.commit()
    emit({
        "cutoff": cutoff,
        "reaped_packages": reaped_packages,
        "reaped_runs": reaped_runs,
    })


def cmd_stats(conn, args):
    by_category = {
        r[0] or "": r[1]
        for r in conn.execute(
            "SELECT p.category, COUNT(*) FROM attempts a "
            "JOIN packages p ON p.id = a.package_row "
            "GROUP BY p.category"
        ).fetchall()
    }
    by_outcome = {
        r[0]: r[1]
        for r in conn.execute(
            "SELECT outcome, COUNT(*) FROM attempts GROUP BY outcome"
        ).fetchall()
    }
    by_error = {
        r[0] or "": r[1]
        for r in conn.execute(
            "SELECT error_class, COUNT(*) FROM attempts "
            "WHERE error_class IS NOT NULL GROUP BY error_class"
        ).fetchall()
    }
    by_review = {
        r[0] or "": r[1]
        for r in conn.execute(
            "SELECT review_mode, COUNT(*) FROM attempts "
            "WHERE review_mode IS NOT NULL GROUP BY review_mode"
        ).fetchall()
    }
    pkg_rows = conn.execute(
        "SELECT p.package_id, p.category, a.outcome, COUNT(*) "
        "FROM attempts a JOIN packages p ON p.id = a.package_row "
        "GROUP BY p.package_id, p.category, a.outcome"
    ).fetchall()
    package_rates = {}
    for package_id, category, outcome, count in pkg_rows:
        entry = package_rates.setdefault(
            package_id, {"category": category, "attempts": 0, "outcomes": {}}
        )
        entry["attempts"] += count
        entry["outcomes"][outcome] = count

    initial = conn.execute(
        "SELECT outcome, COUNT(*) FROM attempts WHERE kind = 'initial' "
        "GROUP BY outcome"
    ).fetchall()
    initial_map = {r[0]: r[1] for r in initial}
    initial_total = sum(initial_map.values()) or 0
    initial_worked = initial_map.get("worked", 0)
    initial_pass_pct = (
        round(100.0 * initial_worked / initial_total, 1) if initial_total else None
    )

    emit(
        {
            "stats": {
                "by_category": by_category,
                "by_outcome": by_outcome,
                "by_error_class": by_error,
                "by_review_mode": by_review,
                "package_rates": package_rates,
                "initial_pass_pct": initial_pass_pct,
                "initial_total": initial_total,
            }
        }
    )


def build_parser():
    parser = argparse.ArgumentParser(
        prog="ledger", description="Ultrawork SQLite ledger CLI"
    )
    parser.add_argument(
        "--db", default=str(DEFAULT_DB), help="SQLite database path"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init").set_defaults(func=cmd_init)

    p = sub.add_parser("start-run")
    p.add_argument("--project", default=None)
    p.add_argument("--category", default=None)
    p.add_argument("--phase", default=None)
    p.set_defaults(func=cmd_start_run)

    p = sub.add_parser("start-package")
    p.add_argument("--run-id", type=int, required=True)
    p.add_argument("--package-id", required=True)
    p.add_argument("--category", default=None)
    p.add_argument("--files", default=None)
    p.add_argument("--acs", default=None)
    p.add_argument("--risk", default=None)
    p.add_argument("--review-mode", default=None)
    p.set_defaults(func=cmd_start_package)

    p = sub.add_parser("log-event")
    p.add_argument("--run-id", type=int, required=True)
    p.add_argument("--package-row", type=int, default=None)
    p.add_argument("--kind", required=True)
    p.add_argument("--summary", required=True)
    p.set_defaults(func=cmd_log_event)

    p = sub.add_parser("log-trace")
    p.add_argument("--run-id", type=int, required=True)
    p.add_argument("--package-row", type=int, default=None)
    p.add_argument("--attempt-id", type=int, default=None)
    p.add_argument("--kind", required=True)
    p.add_argument("--evidence", required=True)
    p.set_defaults(func=cmd_log_trace)

    p = sub.add_parser("run-log")
    p.add_argument("--run-id", type=int, required=True)
    p.add_argument("--limit", type=int, default=50)
    p.set_defaults(func=cmd_run_log)

    p = sub.add_parser("record-attempt")
    p.add_argument("--package-row", type=int, required=True)
    p.add_argument("--kind", required=True)
    p.add_argument("--artifact", required=True)
    p.add_argument("--verify-exit", type=int, default=None)
    p.add_argument("--outcome", required=True)
    p.add_argument("--summary", default=None)
    p.add_argument("--error-class", default=None)
    p.add_argument("--review-mode", default=None)
    p.add_argument("--risk", default=None)
    p.add_argument("--trace-evidence", default=None)
    p.set_defaults(func=cmd_record_attempt)

    p = sub.add_parser("finish-package")
    p.add_argument("--package-row", type=int, required=True)
    p.add_argument("--status", required=True)
    p.set_defaults(func=cmd_finish_package)

    p = sub.add_parser("finish-run")
    p.add_argument("--run-id", type=int, required=True)
    p.add_argument("--status", required=True)
    p.set_defaults(func=cmd_finish_run)

    p = sub.add_parser("similar")
    p.add_argument("--category", required=True)
    p.add_argument("--limit", type=int, required=True)
    p.set_defaults(func=cmd_similar)

    p = sub.add_parser("lessons")
    p.add_argument("--category", default=None)
    p.add_argument("--limit", type=int, default=5)
    p.set_defaults(func=cmd_lessons)

    p = sub.add_parser("diagnose")
    p.add_argument("--text", default=None)
    p.add_argument("--package-row", type=int, default=None)
    p.add_argument("--outcome", default=None)
    p.add_argument("--artifact", default=None)
    p.set_defaults(func=cmd_diagnose)

    p = sub.add_parser("reap-stale")
    p.add_argument("--hours", type=float, required=True)
    p.set_defaults(func=cmd_reap_stale)

    sub.add_parser("stats").set_defaults(func=cmd_stats)

    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    conn = connect(args.db)
    try:
        try:
            args.func(conn, args)
        except Exception as exc:
            if conn.in_transaction:
                conn.rollback()
            fail(str(exc))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
