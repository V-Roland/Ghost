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
- `src/domain/` contains pure view-model transformations; `src/services/` owns Supabase, Auth, and API access.
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

- A slim 50-pixel dock occupies the bottom edge of the app window.
- A centered 24-pixel pull tab opens and closes the navigation drawer; its lower edge is flush with the dock when closed and with the drawer top when open.
- The drawer is approximately 20 percent smaller than the original prototype, slides upward over the content, and remains flush to the application bottom with a flat lower edge.
- The open drawer centers the `Navigation` heading, applies a light scrim over the user-facing content, and closes on outside click or `Escape`.
- Destinations are Home, Archive, and Settings.
- Home uses a traditional house icon, Archive uses an archive-box icon, and Settings uses a gear icon.
- Nested archive screens keep Archive active; the new-interview workflow keeps Home active.
- The dock and drawer blend with the navy application shell through translucent charcoal surfaces, restrained borders, and the existing gold accent for the current destination.
- Navigation remains touch-friendly and usable on narrow screens.

## Top Bar

- Left: Ghost brand mark and product name.
- Right: the active profile name and profile icon.
- The profile menu shows the active owner boundary and supports sign-out.
- Sign-in uses a verified Supabase Auth email/password account; no tenant field or local profile switcher is present.
- Sign-up mirrors sign-in and collects only account name, email, password, and password confirmation. It requires the project password minimum, supports email-confirmation projects, and sends the account name as Auth metadata for the profile-creation trigger.
- Profile data and archive visibility come from the authenticated user's RLS-protected workspace.
- Authentication uses the Supabase client session; API requests forward the active bearer token to the Express verification middleware.
- Theme controls do not appear in the top bar.

## Primary Screens

### Home

- Welcome to Ghost
- Primary CTA: Start New Interview
- Secondary pills: Archive, Settings
- Recent workspace preview

### Settings

- Profile card with display name, email, role, account ID, and RLS status.
- Appearance card with Dark and Light theme controls.
- Workspace defaults for export and review-only signal language.
- Archive scope is always the current authenticated Supabase user.
- Password-authenticated profiles can change their passphrase; success requests global sign-out and returns to sign-in.

### Start New Interview Workflow

Progress:

```text
1 Job Posting -> 2 Candidate -> 3 Resume -> 4 Processing -> 5 Supplements -> 6 Review
```

- Position and candidate rows correspond to persisted `job_postings` and `interviews`, not UI-only folder objects.
- `+ Folder` creates an RLS-protected `archive_folders` row at the current root, position, interview, or nested-folder scope.
- Custom folders open as navigable archive screens and support additional nested folders.
- File names and `Open` actions request short-lived private access; `Download` saves the selected object.
- `Download ZIP` reconstructs the selected database folder scope and downloads one ZIP archive containing its nested directories, empty folders, and private files.
- Existing interview files are draggable onto visible folders. A valid drop moves only database metadata and is rejected unless the folder belongs to the same owner and interview.

- Job Posting accepts either a real source-file upload or manual position details. An upload fills a blank title from its filename and remains the authoritative private source until extraction exists; manual-only positions are explicitly stored as manual-backed.
- Position title and location use Ghost-owned React autocomplete controls rather than browser-native datalists. Work arrangement uses the same Ghost-owned centered overlay pattern while restricting values to `Hybrid`, `Remote`, and `In-Person`. These menus support keyboard selection and do not move surrounding content.
- Position title suggestions come from the authenticated user's owned archive. Location suggestions combine saved owned locations with a local city list while still accepting any typed value.
- Department, location, the `Hybrid` / `Remote` / `In-Person` selector, and posting details remain manually editable regardless of source.
- Candidate captures name, interview date, email, current title, and interviewer-entered context.
- Resume accepts multiple private uploads and manual background details.
- Processing clearly remains manual until a model integration exists and captures editable preparation notes.
- Supplements accepts multiple files, HTTP(S) links, manual questions, and usage notes.
- Review renders every prior control again; users can add, change, or remove all fields, uploads, links, and questions before saving.
- Review ends with an optional archive-directory selector. It lists owned root directories and directories scoped to the selected existing position, while the default keeps the interview in its normal position folder.
- Files are not public and remain scoped to the authenticated profile's interview workspace.
- Moving between workflow steps scrolls the content shell to the top and focuses the new section.

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
| Archive root | Download one archive ZIP to a user-selected location |
| Job posting folder | Download one position ZIP to a user-selected location |
| Candidate folder | Download one interview ZIP to a user-selected location |
| Custom folder | Download one folder-subtree ZIP to a user-selected location |

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
