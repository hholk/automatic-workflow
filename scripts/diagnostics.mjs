const inferredKinds = new Set([
  "repeated_read",
  "duplicate_probe",
  "duplicate_verification",
  "unchanged_hypothesis",
  "teacher_repeat_request",
  "zero_information_gain",
])

const attestedKinds = new Set([
  "duplicate_context",
  "teacher_called_too_early",
  "teacher_called_too_late",
  "teacher_ask_too_broad",
  "unusable_evidence",
  "main_repair",
  "scope_rework",
  "model_mismatch",
  "fallback",
])

export const wasteKinds = new Set([...inferredKinds, ...attestedKinds])

export const redactExcerpt = (value) => `${value || ""}`
  .replace(/\b(api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
  .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[ID]")
  .replace(/\/Users\/[^/]+/g, "[HOME]")
  .replace(/\/home\/[^/]+/g, "[HOME]")
  .slice(0, 500)

const sameSignature = (left, right) => Boolean(
  left?.signature
  && left.signature === right?.signature
  && left.actor === right.actor,
)

const wasteEvent = (kind, event) => ({
  kind,
  actor: event.actor || "unknown",
  phase: event.phase || "unknown",
  signature: event.signature || null,
  observed_wasted_tokens: Number.isFinite(event.observed_wasted_tokens) ? event.observed_wasted_tokens : null,
  estimated_wasted_tokens: Number.isFinite(event.estimated_wasted_tokens) ? event.estimated_wasted_tokens : null,
  excerpts: (event.excerpts || []).slice(0, 2).map(redactExcerpt),
})

export const detectWaste = (events = []) => {
  const waste = []
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]
    const prior = events[index - 1]
    if (wasteKinds.has(event.kind) && event.attested === true) {
      waste.push(wasteEvent(event.kind, event))
      continue
    }
    if (!sameSignature(prior, event)) continue
    if (event.event === "read" && prior.event === "read" && event.revision === prior.revision) {
      waste.push(wasteEvent("repeated_read", event))
    } else if (event.event === "verify" && prior.event === "verify" && event.changed === false) {
      waste.push(wasteEvent("duplicate_verification", event))
    } else if (event.event === "probe" && prior.event === "probe" && event.changed === false) {
      waste.push(wasteEvent("duplicate_probe", event))
    } else if (event.event === "hypothesis" && prior.event === "hypothesis" && event.changed === false) {
      waste.push(wasteEvent("unchanged_hypothesis", event))
    } else if (event.event === "teacher_ask" && prior.event === "teacher_ask") {
      waste.push(wasteEvent("teacher_repeat_request", event))
    } else if (event.event === "teacher_evidence" && prior.event === "teacher_evidence" && event.information_gain === "none") {
      waste.push(wasteEvent("zero_information_gain", event))
    }
  }
  return waste
}
