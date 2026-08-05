# Ghost UI Specification

## Product Shell

Ghost is designed as a standalone-style GUI that can be launched from the Microsoft ecosystem, but the MVP mockup avoids depending on the Teams tab rail.

The shell uses a fixed-height desktop-style window with a scrollable content area and a persistent bottom dock. The dock remains available on every user-facing screen, including nested archive folders and the interview workflow.

## Frontend Organization

- `src/main.jsx` only mounts React and imports the style entry point.
- `src/app/App.jsx` owns application-level state, screen selection, and navigation state.
- `src/screens/<feature>/` gives every user-facing screen or archive level its own path.
- `src/components/<component>/` gives each reusable control an isolated implementation path.
- `src/components/workflow/<component>/` contains focused interview-workflow primitives.
- `src/components/navigation/BottomNavigation.jsx` owns the navigation drawer and destination configuration.
- `src/assets/icons/<category>/<asset>/` contains one component per visual asset; screen modules do not define inline icons.
- `src/data/mock/` isolates prototype-only fixtures from production data access.
- `src/styles.css` is import-only; `src/styles/<category>/` separates core, layout, screen, workflow, navigation, and responsive rules.
- Screen-specific behavior must not be added back to `src/main.jsx` or `src/app/App.jsx` unless it coordinates multiple screens.

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
| Bottom Dock Gray | `#55585D` |
| Navigation Graphite | `#26292D` |
| Raised Graphite | `#383C42` |

## Global Navigation

- A 64-pixel gray dock occupies the bottom edge of the app window.
- A centered pull tab opens and closes the navigation drawer.
- The drawer is approximately 20 percent smaller than the original prototype, slides upward over the content, and remains flush to the application bottom with a flat lower edge.
- The open drawer centers the `Navigation` heading, applies a light scrim over the user-facing content, and closes on outside click or `Escape`.
- Destinations are Home, Archive, and Settings.
- Home uses a traditional house icon, Archive uses an archive-box icon, and Settings uses a gear icon.
- Nested archive screens keep Archive active; the new-interview workflow keeps Home active.
- The drawer uses dark gray surfaces, graphite borders, and the existing gold accent for the current destination.
- Navigation remains touch-friendly and usable on narrow screens.

## Top Bar

- Left: Ghost brand mark and product name.
- Right: the active profile name and profile icon.
- The profile menu shows the active owner boundary, permits local demo-profile switching, and supports sign-out.
- Switching profiles immediately returns Home and clears any selected job or candidate from the prior profile.
- Sign-in uses a verified Supabase Auth email/password account; no tenant field or local profile switcher is present.
- Profile data and archive visibility come from the authenticated user's RLS-protected workspace.
- Authentication uses a server-managed HttpOnly cookie; the frontend does not store tokens.
- Theme controls do not appear in the top bar.

## Primary Screens

### Home

- Welcome to Ghost
- Primary CTA: Start New Interview
- Secondary pills: Archive, Settings
- Recent workspace preview

### Settings

- Profile card with display name, email, role, user partition, and tenant.
- Appearance card with Dark and Light theme controls.
- Workspace defaults for export and review-only signal language.
- Archive scope is always the current tenant and profile.
- Password-authenticated profiles can change their passphrase; success revokes all sessions and returns to sign-in.

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
- `GhostBottomNavigation`
- `GhostNavigationDrawer`
- `GhostNavigationIcon`
- `GhostProfileButton`

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
