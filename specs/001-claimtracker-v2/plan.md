# Technical Plan — ClaimTracker v2

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│              React 19 + Vite                 │
│                                             │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐ │
│  │  Auth    │ │  Layout  │ │  State Mgmt  │ │
│  │  Guard   │ │  Shell   │ │  (Zustand)   │ │
│  └─────────┘ └──────────┘ └──────────────┘ │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │          14 Tab Components           │   │
│  │  Dashboard | ClaimInfo | Rooms | ... │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │          Shared Components           │   │
│  │  Modal | Toast | PhotoUploader | ... │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │          PDF Generator               │   │
│  │  jsPDF + AutoTable (client-side)     │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │          Firebase SDK                │   │
│  │  Auth + Firestore + Storage          │   │
│  └──────────────────────────────────────┘   │
└─────────────────┬───────────────────────────┘
                  │ HTTP
┌─────────────────▼───────────────────────────┐
│               Backend (Express)              │
│                                              │
│  /api/analyze-photo     → OpenAI Vision      │
│  /api/enrich-item       → OpenAI + eBay      │
│  /api/analyze-receipt   → OpenAI Vision      │
│  /api/analyze-contractor-report → OpenAI     │
│  /api/maximizer/chat    → OpenAI             │
│  /api/storage-proxy     → Firebase Storage   │
│  /api/ping              → Health check       │
└──────────────────────────────────────────────┘
```

## Stack Decision

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React 19 | Industry standard, Codex knows it cold, large ecosystem |
| Build | Vite 6 | Fast HMR, simple config, ESM-native |
| State | Zustand | Minimal boilerplate, works like the global `data` object but reactive |
| Styling | Tailwind CSS 4 | Matches the existing dark theme aesthetic, utility-first, fast |
| PDF | jsPDF + AutoTable | Keep existing — rewriting PDF gen is high risk, low reward |
| Forms | React Hook Form | Reduces form boilerplate across 10+ modals |
| Routing | React Router 7 | Tab-based navigation + `/maximizer` route |
| Backend | Express (unchanged) | server.js stays as-is, only frontend is rebuilt |
| Testing | Vitest + React Testing Library | Vite-native, fast |
| Type System | TypeScript | Catch data shape bugs that plague the current codebase |

## Project Structure

```
ClaimTracker-v2/
├── specs/                          # SDD artifacts
│   └── 001-claimtracker-v2/
├── client/                         # Frontend (React + Vite)
│   ├── public/
│   ├── src/
│   │   ├── main.tsx                # Entry point
│   │   ├── App.tsx                 # Root component + router
│   │   ├── types/
│   │   │   ├── claim.ts            # Full Firestore document type
│   │   │   └── api.ts              # API request/response types
│   │   ├── store/
│   │   │   ├── claimStore.ts       # Zustand store (replaces global `data`)
│   │   │   ├── authStore.ts        # Auth state
│   │   │   └── uiStore.ts          # UI state (active tab, modals, toasts)
│   │   ├── lib/
│   │   │   ├── firebase.ts         # Firebase init + helpers
│   │   │   ├── persistence.ts      # Cloud save + local fallback logic
│   │   │   ├── sanitizer.ts        # Data sanitization pipeline
│   │   │   ├── api.ts              # API client (analyze, enrich, etc.)
│   │   │   ├── dates.ts            # Date formatting (fmtUSDate, toDatePdf)
│   │   │   └── utils.ts            # Shared utilities
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── TabBar.tsx
│   │   │   │   ├── MobileQuickActions.tsx
│   │   │   │   └── AuthGuard.tsx
│   │   │   ├── shared/
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Toast.tsx
│   │   │   │   ├── PhotoUploader.tsx
│   │   │   │   ├── ConfirmDialog.tsx
│   │   │   │   ├── ProgressBar.tsx
│   │   │   │   ├── SaveStatus.tsx
│   │   │   │   └── EmptyState.tsx
│   │   │   └── pdf/
│   │   │       ├── PDFGenerator.ts         # Main PDF build logic
│   │   │       ├── PDFSections.ts          # Per-section renderers
│   │   │       ├── PrePrintModal.tsx        # Quality check UI
│   │   │       └── PDFProgress.tsx          # Generation overlay
│   │   ├── tabs/
│   │   │   ├── Dashboard/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── CompletenessMetrics.tsx
│   │   │   │   ├── NextStepCard.tsx
│   │   │   │   └── ReadinessPanel.tsx
│   │   │   ├── ClaimInfo/
│   │   │   │   ├── ClaimInfo.tsx
│   │   │   │   └── PolicyDocUploader.tsx
│   │   │   ├── Rooms/
│   │   │   │   ├── Rooms.tsx
│   │   │   │   ├── RoomCard.tsx
│   │   │   │   └── RoomModal.tsx
│   │   │   ├── FloorPlan/
│   │   │   │   ├── FloorPlan.tsx
│   │   │   │   └── FloorPlanCanvas.tsx
│   │   │   ├── PhotoLibrary/
│   │   │   │   ├── PhotoLibrary.tsx
│   │   │   │   └── PhotoGrid.tsx
│   │   │   ├── AIBuilder/
│   │   │   │   ├── AIBuilder.tsx
│   │   │   │   ├── PhotoDropZone.tsx
│   │   │   │   ├── PhotoStack.tsx
│   │   │   │   ├── AnalysisResults.tsx
│   │   │   │   └── AnalysisProgress.tsx
│   │   │   ├── Contents/
│   │   │   │   ├── Contents.tsx
│   │   │   │   ├── ContentItem.tsx
│   │   │   │   ├── ContentModal.tsx
│   │   │   │   ├── EnrichModal.tsx
│   │   │   │   ├── BulkActions.tsx
│   │   │   │   └── ContentsSummary.tsx
│   │   │   ├── Receipts/
│   │   │   │   ├── Receipts.tsx
│   │   │   │   └── ReceiptModal.tsx
│   │   │   ├── Expenses/
│   │   │   │   ├── Expenses.tsx
│   │   │   │   ├── ExpenseModal.tsx
│   │   │   │   ├── WeatherCard.tsx
│   │   │   │   └── UtilityEstimator.tsx
│   │   │   ├── Communications/
│   │   │   │   ├── Communications.tsx
│   │   │   │   ├── CommunicationModal.tsx
│   │   │   │   └── EmailDraftModal.tsx
│   │   │   ├── Timeline/
│   │   │   │   └── Timeline.tsx
│   │   │   ├── Contractors/
│   │   │   │   ├── Contractors.tsx
│   │   │   │   └── ContractorModal.tsx
│   │   │   ├── Payments/
│   │   │   │   ├── Payments.tsx
│   │   │   │   └── PaymentModal.tsx
│   │   │   └── Maximizer/
│   │   │       ├── Maximizer.tsx
│   │   │       └── ChatInterface.tsx
│   │   └── wizard/
│   │       ├── OnboardingWizard.tsx
│   │       └── WizardSteps.tsx
│   ├── index.html
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── server/                         # Backend (Express — mostly unchanged)
│   ├── server.js                   # Copy from v1, minimal modifications
│   ├── package.json
│   └── firebase-config.js
├── package.json                    # Root workspace
├── render.yaml                     # Render deployment config
└── README.md
```

## Key Technical Decisions

### 1. State Management: Zustand
The current app uses a global `data` object mutated everywhere. Zustand provides:
- A single store that mirrors the `data` structure
- Reactive updates (components re-render on changes)
- Middleware for persistence (localStorage sync)
- Immer integration for immutable updates
- DevTools for debugging

```typescript
// Example: claimStore.ts
interface ClaimStore {
  data: ClaimData;
  saveStatus: 'saved' | 'saving' | 'error' | 'offline';
  updateContents: (id: string, updates: Partial<ContentItem>) => void;
  addRoom: (room: Room) => void;
  // ...
}
```

### 2. Persistence Layer
Port the existing save logic into a clean module:
- `persistence.ts` handles Firestore read/write + localStorage fallback
- Zustand `subscribe()` triggers debounced cloud saves
- Same merge strategy: cloud wins, local fills gaps
- Same retry logic with exponential backoff
- Same `stripLargeLocalData()` for localStorage size management

### 3. PDF Generation Strategy
The PDF generator is 1,860 lines of jsPDF calls. Strategy:
- Port as a standalone module (`PDFGenerator.ts`) — NOT a React component
- It receives the claim data as input, returns a jsPDF doc
- Break into section renderers for maintainability
- Keep exact same output format (pixel-comparable to v1)
- Same color constants, margins, fonts
- Same date formatting functions

### 4. Firebase Integration
- `firebase.ts` initializes the app with existing config
- Auth state managed via `onAuthStateChanged` → Zustand auth store
- Firestore operations via modular SDK (v9+ syntax)
- Storage operations for photo/doc uploads
- Same document path: `claims/{uid}`

### 5. Server Changes
Minimal — the Express backend stays almost identical:
- Add Vite dev server proxy in development
- In production, serve the Vite build output from `client/dist/`
- All `/api/*` routes unchanged
- Same rate limiting, same OpenAI integration

### 6. Sanitizer Pipeline
Port `sanitizeAIRationale()` and all normalization to `sanitizer.ts`:
- Runs on every data load (in the Zustand store hydration)
- Same rules: past-tense dispositions, factual rationale, aerosolization mentions
- Same Category 3 logic for sewage claims
- TypeScript ensures the sanitizer handles all fields

### 7. Onboarding Wizard
Port as a multi-step React component:
- Each step is a sub-component
- Wizard state in Zustand (current step, collected data)
- Same flow: claim type → info → rooms → photos → prescreen → floor plan → receipts → expenses → AI → done
- Can be re-opened from any state

## Build & Deploy

### Development
```bash
cd client && npm run dev    # Vite dev server on :5173
cd server && npm run dev    # Express on :3000 (with nodemon)
# Vite proxies /api/* to Express
```

### Production Build
```bash
cd client && npm run build  # Outputs to client/dist/
# Express serves client/dist/ as static files
```

### Render Deployment
- Build command: `cd client && npm install && npm run build && cd ../server && npm install`
- Start command: `cd server && node server.js`
- Express serves `../client/dist/` for static files
- Same env vars as v1

### GSD Sync Compatibility
Two options:
1. **Single-file build:** Vite plugin to inline all JS/CSS into one HTML file
2. **Update sync script:** Modify `sync-to-gsd.sh` to copy the dist folder

Option 1 is preferred for backward compatibility.

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| PDF regression | Side-by-side comparison of v1 vs v2 PDF output |
| Data incompatibility | TypeScript types derived directly from v1's `defaultData()` |
| Feature gaps | Checklist against v1's 559 functions |
| Performance regression | Lighthouse benchmarks before/after |
| Auth issues | Same Firebase config, same auth flow |
| GSD sync breaks | Test sync script early in development |

## Implementation Phases

1. **Foundation** — Project scaffold, types, stores, Firebase, auth, layout shell
2. **Core tabs** — Dashboard, Claim Info, Rooms, Contents (the most-used tabs)
3. **AI features** — AI Builder, Enrichment, Receipts, Maximizer
4. **Supporting tabs** — Expenses, Comms, Timeline, Contractors, Payments
5. **Advanced features** — Floor Plan, Photo Library, Onboarding Wizard
6. **PDF generation** — Port the full PDF generator
7. **Polish** — Pre-print modal, premium gate, mobile optimization, sanitizer
8. **Testing & verification** — Side-by-side testing, data compatibility, deploy to staging
