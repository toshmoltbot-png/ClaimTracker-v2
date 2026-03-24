# ClaimTracker v2 — Agent Instructions

## What This Is
Full SDD rebuild of ClaimTracker. Original app at `/Users/tosh/ClaimTracker/` — DO NOT MODIFY IT.
This is a NEW codebase built from spec.

## Architecture
- **Frontend:** React 19 + Vite + TypeScript + Zustand + Tailwind CSS
- **Backend:** Express (mostly unchanged from v1 — copy and adapt `server.js`)
- **Database:** Firebase Firestore (same schema as v1, NO migration)
- **PDF:** jsPDF + AutoTable (client-side)
- **Deploy target:** Render.com

## Key Files
- `specs/001-claimtracker-v2/constitution.md` — core principles
- `specs/001-claimtracker-v2/spec.md` — full feature spec (MUST READ)
- `specs/001-claimtracker-v2/plan.md` — architecture + project structure
- `specs/001-claimtracker-v2/tasks.md` — engineering checklist

## Critical Rules
1. **Firestore schema MUST match v1 exactly** — existing claims must load without migration
2. **PDF output MUST match v1** — same layout, same formatting, same rules
3. **All dates in US format** (MM/DD/YYYY) via `fmtUSDate()`
4. **Disposition labels: past tense only** — "discarded"/"inspected"
5. **AI Rationale: FACTUAL ONLY** — no fabricated details, cite IICRC S500
6. **Never change `server.js` API contracts** — same routes, same request/response shapes
7. **Reference v1 source** at `/Users/tosh/ClaimTracker/index.html` for exact behavior

## Firebase Config
```js
{
  apiKey: "AIzaSyCCvL7obUcXMQLwLl89NY1SD_X2PHWfHh8",
  authDomain: "claim-tracker-54d78.firebaseapp.com",
  projectId: "claim-tracker-54d78",
  storageBucket: "claim-tracker-54d78.firebasestorage.app",
  messagingSenderId: "670381252396",
  appId: "1:670381252396:web:5d4b219e1747e334de5689",
  measurementId: "G-GP0L9JLJJ4"
}
```

## v1 defaultData() Schema
Reference `/Users/tosh/ClaimTracker/index.html` line 3772 for the full default data structure.
Key fields: version, claimType, claim{}, aiPhotos[], dashboard{}, rooms[], contents[], 
contractors[], contractorReports[], communications[], payments[], policyDocs[], receipts[],
expenses{laborEntries[], utilityEntries[], disposalEntries[], livingEntries[], miscEntries[]},
policyInsights{}, onboarding{}

## Content Categories
Electronics, Furniture, Toys/Games, Tools, Bags/Luggage, Appliances, Kitchen, Decor, 
Clothing, Kids Items, Sports/Outdoors, Office, Storage, Books/Media, Other

## Quantity Units
each, pair, set, box
