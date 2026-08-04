# Ghost UI Specification

## Product Shell

Ghost is designed as a standalone-style GUI that can be launched from the Microsoft ecosystem, but the MVP mockup avoids depending on the Teams tab rail.

## Color Palette

| Role | Hex |
|---|---:|
| Primary Dark Navy | `#0B102F` |
| Secondary Navy | `#11184A` |
| Ghost White | `#F7F8FC` |
| Soft Gray | `#EEF1F7` |
| Gold Accent | `#C8942E` |
| AI Cyan Accent | `#27C7D9` |
| Warning Amber | `#F4A62A` |
| Crimson Risk | `#A6192E` |
| Body Text | `#1F2937` |
| Muted Dashboard Text | `#B8C0D9` |

## Primary Screens

### Home

- Welcome to Ghost
- Primary CTA: Start New Interview
- Secondary pills: Archive, Settings
- Recent workspace preview

### Start New Interview Workflow

Progress:

```text
1 Job Posting -> 2 Candidate -> 3 Resume & Links -> 4 Processing -> 5 Supplements -> 6 Review
```

Each workflow screen should answer:

1. Where am I in the process?
2. What do I need to provide?
3. Why does Ghost need it?

### Archive Flow

```text
Archive Root
└── Job Posting Folder
    └── Candidate Interview Folder
        ├── Interview Summary.pdf
        ├── Job Posting.pdf
        ├── Resume.pdf
        ├── Transcript.txt
        ├── Q&A Log.pdf
        └── Integrity Report.pdf
```

Export rules:

| Level | Export action |
|---|---|
| Archive root | Export All ZIP |
| Job posting folder | Export This Folder ZIP |
| Candidate folder | Export This Folder ZIP |

## Component Names

- `GhostWorkflowShell`
- `GhostProgressTracker`
- `GhostUploadDropzone`
- `GhostTextInput`
- `GhostSelectInput`
- `GhostFileList`
- `GhostLinkList`
- `GhostFolderPreview`
- `GhostProcessingChecklist`
- `GhostQuestionModeSelector`
- `GhostDifficultySlider`
- `GhostQuestionReviewCard`
- `GhostFooterActions`
- `GhostButton`
- `GhostCard`
- `GhostFolderRow`
- `GhostFileRow`
- `GhostBreadcrumb`
- `GhostFilterPanel`
- `GhostSignalBadge`
- `GhostThemeToggle`
- `GhostExportButton`

## Neutral Signal Language

Avoid saying:

- Cheating detected
- Candidate cheated
- Fraud confirmed

Prefer:

- Response latency flagged
- Review recommended
- Signal requires human review
- Evidence packet available
