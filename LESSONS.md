# Flash Orchestrator — Lessons (meta-loop capture)

Append one line per noteworthy event; routine runs log nothing.
Format: `- YYYY-MM-DD: what happened → cause → hint (which file to change)`
Noteworthy: fix pass needed · invalid report · brief misled worker · unexpected probe failure · safety near-miss · trick that worked exceptionally well.
Consumed lessons are deleted during optimization sessions (see SKILL.md → Meta-loop).

<!-- lessons -->
- 2026-08-10: skill-Tool lieferte nach SKILL.md-Rewrite mid-session den alten gecachten Inhalt → OpenCode cached Skills pro Session; Restart-Pflicht im neuen SKILL.md ist korrekt, aber Nutzer müssen es wissen → Hint: nach Skill-Edits immer neue Session (SKILL.md sagt es bereits; kein Edit nötig, nur bestätigen)
- 2026-08-10: In-Session-Task-Dispatch an flash-worker hing 2× (11 min, 4+ min) ohne einzigen Tool-Call des Childs, T3-UI zeigt nur "Working"; Abbruch nur manuell → Log: Child-Stream startet, liefert nichts. Aber: `opencode run --agent flash-worker` headless lief schnell + korrekt → Problem liegt im Task/Child-Session-Layer, nicht an Luna/Agent-Config. WICHTIG (nachgeschärft): ein "nach 3 min abbrechen"-Fallback ist nicht ausführbar, solange der Orchestrator im pending Task-Call blockiert ist → Headless-Dispatch ist jetzt DEFAULT in SKILL.md (bounded timeout, kehrt immer zurück), Task-Tool nur noch opt-in
- 2026-08-10: Child-Sessions erben das Session-cwd (hier ~/install), Arbeit lag in ~/projects/game → ohne `external_directory: allow` in den flash-Agenten würden Read/Write-Prompts den Worker blockieren → in allen 3 Agent-Files gesetzt (bash war ohnehin allow = konsistent)
- 2026-08-10: Exakter Plan-Code war nicht 100% rustfmt-clean (item_bit_index in dev_telemetry.rs) → Worker/Orchestrator sollen nach Plan-Paste immer rustfmt auf die eigene Datei laufen lassen (Gauntlet-Schritt 4 ist drin, bewährt)
- 2026-08-10: Headless-Default-Lauf (P4 worker, P5 explore, Fix1 worker) — alle 3 Dispatches kamen sichtbar und pünktlich zurück, kein Hang, Prozess lief durch → Headless-als-Default bestätigt sich; Worker-Reports waren akkurat, Outer Gauntlet fand trotzdem 2 echte Issues (Clippy, fmt-Probe-Design) → Gauntlet bleibt Pflicht
- 2026-08-10: "Exakter Plan-Code" war nicht clippy-clean (new_without_default, useless_vec, unused_mut in dev_telemetry.rs) → Briefs sollen Clippy auf die EIGENE Datei als Gauntlet-Schritt vor DONE verlangen, nicht erst im Verifikations-Paket
- 2026-08-10: `rustfmt --check` auf lib.rs folgt dem Modulbaum und prüft die ganze Crate (inkl. fremder unformatierter Dateien) → fmt-Probes nur auf Blatt-Dateien, nie auf Crate-Roots; außerdem: `grep -c` liefert exit 1 bei 0 Treffern — in Briefs "count 0 bei exit 1 = Erfolg" explizit machen
