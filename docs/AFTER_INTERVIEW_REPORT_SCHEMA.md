# After-Interview Report Schema

`POST /api/after-interview/ingest` returns:

```text
source: "sample" | "vtt" | "graph"
transcript:
  segments: Array<{
    speaker: string
    start: number
    end: number
    text: string
  }>
report:
  reportId: string
  generatedAt: ISO-8601 string
  summary: string
  signals: Array<{
    id: string
    type: string
    description: string
  }>
  evidencePackets: Array<{
    id: string
    quoteId: string
    quote: string
    speaker: string
    timestamp: number
    context: string
  }>
```

`signals` may be empty. Every signal is descriptive context for human review, not a candidate score, factual misconduct label, or hiring recommendation. Evidence packets preserve transcript provenance but do not establish a conclusion.
