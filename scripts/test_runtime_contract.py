"""Contract tests for Flash Orchestrator configuration and prompts."""

import json
import re
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
OPENCODE_ROOT = SKILL_ROOT.parents[1]


def constant(text, name):
    match = re.search(rf"^{name}=(\d+)$", text, re.MULTILINE)
    if match is None:
        raise AssertionError(f"missing constant {name}")
    return int(match.group(1))


class RuntimeContractTest(unittest.TestCase):
    def test_package_limits_match_tiered_contract(self):
        config = (SKILL_ROOT / "config.md").read_text()
        self.assertEqual(constant(config, "REPORT_MAX_CHARS"), 2500)
        self.assertEqual(constant(config, "EVIDENCE_MAX_CHARS"), 4000)
        self.assertEqual(constant(config, "PACKAGE_MAX_FILES"), 4)
        self.assertEqual(constant(config, "PACKAGE_MAX_AC"), 10)
        self.assertEqual(constant(config, "SPLIT_TARGET_FILES"), 2)
        self.assertEqual(constant(config, "SPLIT_TARGET_AC"), 6)
        self.assertEqual(constant(config, "ARTIFACT_MAX_LINES"), 800)
        self.assertEqual(constant(config, "TOOL_CALL_TARGET"), 20)
        self.assertEqual(constant(config, "WORKER_STEPS"), 80)
        self.assertEqual(constant(config, "EXPLORE_STEPS"), 50)
        self.assertEqual(constant(config, "REVIEW_STEPS"), 40)
        self.assertEqual(constant(config, "MAX_CONCURRENT_PACKAGES"), 3)
        self.assertEqual(constant(config, "MAX_CONCURRENT_PACKAGES_BREADTH"), 5)
        self.assertIn("review_mode = none", config)
        self.assertIn("review_mode = single", config)
        self.assertIn("review_mode = dual", config)
        self.assertIn("venice/openai-gpt-56-luna", config)
        self.assertIn("venice/deepseek-v4-flash-0731", config)
        self.assertIn("session model", config)
        self.assertIn("GPT-5.6 Luna", config)
        self.assertIn("not pin", config.lower())
        self.assertIn("parallelism.md", config)

    def test_agent_step_budgets_leave_room_to_report(self):
        config = json.loads((OPENCODE_ROOT / "opencode.json").read_text())
        luna = "venice/openai-gpt-56-luna"
        review = "venice/deepseek-v4-flash-0731"
        # Orchestrator inherits the session model — must not pin build.model.
        self.assertIsNone(config["agent"]["build"].get("model"))
        self.assertEqual(config["agent"]["flash-worker"]["steps"], 80)
        self.assertEqual(config["agent"]["flash-explore"]["steps"], 50)
        self.assertEqual(config["agent"]["flash-review"]["steps"], 40)
        self.assertEqual(config["agent"]["flash-worker"]["model"], luna)
        self.assertEqual(config["agent"]["flash-explore"]["model"], luna)
        self.assertEqual(config["agent"]["flash-review"]["model"], review)
        # Review is the only agent on the challenger model among leaves.
        for name in ("flash-worker", "flash-explore", "flash-review"):
            mid = config["agent"][name].get("model")
            if name == "flash-review":
                self.assertEqual(mid, review)
            else:
                self.assertEqual(mid, luna, name)
                self.assertNotEqual(mid, review, name)
        # Leaf agents must not nest Task or load skills (anti-recursion / token waste).
        for name in ("flash-worker", "flash-explore", "flash-review"):
            perm = config["agent"][name]["permission"]
            self.assertEqual(perm.get("task"), "deny", name)
            self.assertEqual(perm.get("skill"), "deny", name)
            self.assertEqual(perm.get("question"), "deny", name)
            self.assertEqual(perm.get("todowrite"), "deny", name)
            self.assertEqual(perm.get("webfetch"), "deny", name)
            self.assertEqual(perm.get("context7*"), "deny", name)

        # Worker/review: no graph MCP; explore may keep codebase-memory.
        for name in ("flash-worker", "flash-review"):
            perm = config["agent"][name]["permission"]
            self.assertEqual(perm.get("codebase-memory*"), "deny", name)
            self.assertEqual(perm.get("codebase-memory-mcp*"), "deny", name)
        self.assertNotEqual(
            config["agent"]["flash-explore"]["permission"].get("codebase-memory*"),
            "deny",
        )

        # Orchestrator skill allowlist (deny-by-default).
        build_skill = config["agent"]["build"]["permission"]["skill"]
        self.assertEqual(build_skill.get("*"), "deny")
        for allowed in (
            "flash-orchestrator",
            "grilling",
            "writing-plans",
            "systematic-debugging",
            "codebase-design",
        ):
            self.assertEqual(build_skill.get(allowed), "allow", allowed)
        build_perm = config["agent"]["build"]["permission"]
        for noise in ("penpot*", "open-design*", "node_repl*", "openaiDeveloperDocs*"):
            self.assertEqual(build_perm.get(noise), "deny", noise)

        for folder in ("agent", "agents"):
            for name, steps in (
                ("flash-worker", 80),
                ("flash-explore", 50),
                ("flash-review", 40),
            ):
                body = (OPENCODE_ROOT / folder / f"{name}.md").read_text()
                self.assertIn(f"steps: {steps}", body)
                self.assertIn("task: deny", body, f"{folder}/{name}")
                self.assertIn("skill: deny", body, f"{folder}/{name}")
                self.assertIn("webfetch: deny", body, f"{folder}/{name}")

    def test_every_agent_prompt_has_budget_and_strict_report_rules(self):
        paths = [
            OPENCODE_ROOT / "prompts" / "flash-worker.md",
            OPENCODE_ROOT / "prompts" / "flash-explore.md",
            OPENCODE_ROOT / "prompts" / "flash-review.md",
        ]
        for folder in ("agent", "agents"):
            paths.extend(
                OPENCODE_ROOT / folder / name
                for name in ("flash-worker.md", "flash-explore.md", "flash-review.md")
            )
        for path in paths:
            body = path.read_text()
            self.assertIn("Reserve the final 3 steps", body, str(path))
            self.assertIn("exactly one `<report>`", body, str(path))
            self.assertIn("no text before or after", body, str(path))
            self.assertIn("Do not XML-wrap individual fields", body, str(path))

    def test_canonical_schemas_include_inner_report_envelope(self):
        templates = (SKILL_ROOT / "references" / "brief-templates.md").read_text()
        self.assertIn("<report>\nstatus: DONE|BLOCKED|NEEDS_CONTEXT", templates)
        self.assertIn(
            "<report>\nstatus: DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT",
            templates,
        )
        self.assertIn("<report>\nverdict: APPROVE|REQUEST_CHANGES", templates)
        self.assertIn("PRINCIPLES (inline; no skill loads)", templates)
        self.assertIn("RED→GREEN", templates)
        self.assertIn("EVIDENCE BEFORE DONE", templates)

    def test_skill_requires_learning_loop_and_tiered_gates(self):
        skill = (SKILL_ROOT / "SKILL.md").read_text()
        self.assertIn("log-event", skill)
        self.assertIn("log-trace", skill)
        self.assertIn("diagnose", skill)
        self.assertIn("lessons", skill)
        self.assertIn("Adaptive Gauntlet", skill)
        self.assertIn("risk", skill)
        self.assertIn("openai-gpt-56-luna", skill)
        self.assertIn("Skill root + bootstrap", skill)
        self.assertIn("scripts/ledger.py", skill)
        self.assertIn("task_id", skill)
        self.assertIn("Access tiers", skill)
        self.assertIn("access-tiers.md", skill)
        self.assertIn("Matt principles inline", skill)
        self.assertIn("You (this chat) are the orchestrator", skill)
        self.assertIn("Model flexibility", skill)
        self.assertIn("Parallel waves", skill)
        self.assertIn("parallelism.md", skill)
        para = (SKILL_ROOT / "references" / "parallelism.md").read_text()
        self.assertIn("anthropic.com/engineering/multi-agent-research-system", para)
        self.assertIn("Fan-out", para)
        self.assertIn("MAX_CONCURRENT_PACKAGES", para)
        self.assertIn("path-disjoint", para)

    def test_access_tiers_doc_and_command(self):
        tiers = (SKILL_ROOT / "references" / "access-tiers.md").read_text()
        self.assertIn("flash-orchestrator", tiers)
        self.assertIn("codebase-memory-mcp", tiers)
        self.assertIn("context7", tiers)
        self.assertIn("grilling", tiers)
        self.assertIn("writing-plans", tiers)
        self.assertIn("systematic-debugging", tiers)
        self.assertIn("codebase-design", tiers)
        self.assertIn("RED → GREEN", tiers)
        cmd = (OPENCODE_ROOT / "commands" / "orchestrate.md").read_text()
        self.assertIn("access-tiers.md", cmd)
        self.assertIn("flash-orchestrator", cmd)
        self.assertIn("codebase-memory-mcp", cmd)


if __name__ == "__main__":
    unittest.main()
