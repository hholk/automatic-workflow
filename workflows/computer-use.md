# Computer-use workflow

Use this route whenever the task requires operating a live GUI, app, or device.
Resolve `--route computer-use`; the profile registry pins the worker to the
host-specific worker binding. The current Copilot DeepSeek binding is
unsupported and stops with `BLOCKED_ENVIRONMENT`. State the target app/device,
authorized interactions, visible
success evidence, and a clear stop condition before dispatch. The worker follows
the interactive UI rules in the worker contract. A click is an attempted action,
not proof of the resulting state; verify the visible post-state before reporting
completion. Repeating an external action requires evidence that it did not
already take effect.

The configured DeepSeek binding is text-only. Main supplies permitted textual
UI observations and owns visual acceptance; a model name does not establish
image capability. Missing required modalities remain UNKNOWN.
