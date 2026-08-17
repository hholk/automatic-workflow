# AW quality artifacts

These compact JSONL files are human-readable examples of repair and stall
memory. Each line is an independent record; hosts may validate and persist it.

Repair schema: `symptom`, `hypothesis`, `repair`, `proof`.
Stall schema: `signals`, `ladder_rung`, `outcome`, `information_gain`.
