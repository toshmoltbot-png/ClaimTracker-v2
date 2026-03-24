# Functional Specification — ClaimTracker v2

## Overview
ClaimTracker is a full-featured insurance claim management SaaS for property damage claims (primarily water/sewage/fire). It enables claimants to document damage, inventory contents, analyze photos with AI, track expenses, and generate comprehensive PDF reports for insurance adjusters.

**Current state:** 20,175-line monolithic `index.html` + 1,703-line Express `server.js`.
**Target state:** Modular React + Vite application with the same Express backend.

---

## 1. Authentication & Data Layer

### 1.1 Firebase Authentication
- Email/password auth via Firebase JS SDK (client-side)
- Login screen with email + password fields
- "Create Account" option
- Persistent session (Firebase handles token refresh)
- Logout button in header
- Auth state gates all app content

### 1.2 Firestore Data Model
Single document per claim: `claims/{uid}` containing:
```
{
  claimInfo: { claimNumber, policyNumber, dateOfLoss, claimType, ... },
  rooms: [{ id, name, sqft, width, length, photos, ... }],
  contents: [{ id, name, room, category, quantity, price, replacementLink, aiRationale, disposition, contaminated, enriched, ... }],
  aiPhotos: [{ id, file/data/url, name, analysisResult, analysisMode, room, ... }],
  receipts: [{ id, storeName, items, total, ... }],
  expenses: [{ id, category, description, amount, date, vendor, ... }],
  communications: [{ id, date, type, party, summary, followUp, ... }],
  contractors: [{ id, company, contact, trade, ... }],
  contractorReports: [{ id, contractor, findings, ... }],
  payments: [{ id, date, from, amount, type, ... }],
  timeline: [{ id, date, event, category, ... }],
  floorPlan: { rooms: [...], connections: [...] },
  policyDocs: [{ id, name, docType, data/url, ... }],
  dashboard: { insuredName, propertyAddress, ... },
  settings: { claimType, premiumUnlocked, ... }
}
```

### 1.3 Persistence Strategy
- **Primary:** Firestore cloud save (auto-save on data change with debounce)
- **Fallback:** localStorage cache for offline resilience
- **Merge strategy:** Cloud data wins on conflict; local data fills gaps
- **Save status indicator:** Shows "Saved", "Saving...", "Offline — changes saved locally", "Save failed — retry"
- **Retry logic:** Exponential backoff on cloud save failure (max 3 attempts)

---

## 2. Application Shell

### 2.1 Header
- App title: "Insurance Claim Tracker"
- Subtitle: claim number + property address (dynamic)
- Save status indicator (top-right)
- Logout button
- Storage usage indicator

### 2.2 Navigation
14 tabs in a sticky horizontal scrollable tab bar:
1. **Dashboard** — Overview + completeness metrics
2. **Claim Info** — Policyholder and claim details
3. **🏠 Rooms** — Room inventory with dimensions
4. **Floor Plan** — Visual room layout editor
5. **📸 Photos** — Photo library browser
6. **AI Builder** — AI-powered photo analysis + item extraction
7. **📦 Contents** — Item inventory with pricing + enrichment
8. **📄 Receipts** — Receipt upload + parsing
9. **💼 Expenses** — Additional loss expenses (ALE)
10. **💬 Comms** — Communication log
11. **📅 Timeline** — Incident timeline
12. **🔧 Contractors** — Contractor/vendor management
13. **💳 Payments** — Payment tracking
14. **🎯 Maximizer** — AI-powered claim optimization chat

Plus a "⟲ Wizard" button that reopens the onboarding flow.

### 2.3 Mobile Quick Actions
On mobile, a floating action bar with:
- 📸 Add Photos → AI Builder tab
- 🏠 Add Room → Rooms tab
- 📋 Items → Contents tab

### 2.4 Onboarding Wizard
Multi-step guided setup for new claims:
1. Welcome + claim type selection (water/sewage/fire/storm/other)
2. Claim info entry (claim #, policy #, date of loss, address)
3. Room setup (add rooms with names)
4. Room photos upload (per room)
5. Photo pre-screening (AI quick scan)
6. Floor plan sketch
7. Receipt upload
8. Expense quick-add (with weather card for ALE)
9. AI analysis launch
10. Completion → redirect to Maximizer or Contents

The wizard can be re-opened at any time. Progress persists.

---

## 3. Tab Features (Detailed)

### 3.1 Dashboard
**Purpose:** At-a-glance claim health and completeness.

**Components:**
- **Claim summary card:** Insured name, address, claim #, date of loss, claim type
- **Completeness metrics** with progress bars:
  - Rooms documented (count)
  - Photos uploaded (count)
  - Items identified (count + enriched %)
  - AI analysis status
  - Expenses tracked
- **Next step card:** Smart suggestion for what to do next
- **Quick action buttons:** Jump to AI Builder, generate report
- **Readiness panel:** Expandable checklist of what's needed for a complete claim
- **Mobile progress indicators**

**Data flow:** Reads from all data arrays, computes percentages, updates on any data change.

### 3.2 Claim Info
**Purpose:** Core claim metadata.

**Fields:**
- Claim number, policy number
- Date of loss
- Claim type (dropdown: Water Damage, Sewage Backup, Fire, Storm, Other)
- Insured name, property address
- Insurance company, adjuster name, adjuster contact
- Policy documents upload area (PDF/image, classified by type)

**Policy document classification:** Auto-classifies uploaded docs as declarations page, policy, endorsement, correspondence, etc.

### 3.3 Rooms
**Purpose:** Document every affected room.

**Features:**
- Room list with cards showing: name, dimensions (LxW), sqft, photo count
- Add/edit room modal:
  - Room name (text or preset: Kitchen, Bathroom, Bedroom, etc.)
  - Dimensions (length × width in feet)
  - Auto-calculated sqft
  - Photo upload (room-level photos)
  - Notes
- Delete room (with confirmation)
- Room photos displayed as thumbnails
- Badge counts on nav tab

### 3.4 Floor Plan
**Purpose:** Visual spatial layout of affected rooms.

**Features:**
- Canvas-based room placement
- Drag rooms to position
- Snap-to-grid toggle
- Auto-computed union sqft (total affected area)
- Room dimensions displayed
- Connection lines between rooms
- Scale indicator
- Visibility toggles

### 3.5 Photo Library
**Purpose:** Browse all photos across rooms and AI analysis.

**Features:**
- Grid view of all photos
- Filter by room
- Photo preview modal (full-size view)
- Photo metadata display (filename, room, analysis mode)
- Link to associated AI analysis results

### 3.6 AI Builder (AI Packet)
**Purpose:** Upload photos for AI-powered damage analysis and item extraction.

**Features:**
- **Drop zone:** Drag-and-drop or click-to-upload photos
- **Analysis modes per photo:**
  - ITEM_VIEW — Focus on individual items (default)
  - ROOM_VIEW — Broad room assessment
  - FOCUSED_VIEW — Detailed single-item analysis
- **Photo stack management:** Group related photos, expand/collapse stacks
- **Batch analysis:** "Analyze All" button processes all unanalyzed photos
- **Per-photo analysis:** Individual analyze buttons
- **Stop button:** Cancel in-progress analysis
- **Analysis results display:**
  - Identified items with names, quantities, estimated values
  - Room assignment
  - Contamination assessment
  - Disposition recommendation (discarded/inspected)
- **Draft items:** AI suggestions become draft content items
- **Auto-import to Contents:** Analyzed items flow to Contents tab
- **Claim type affects analysis:** Sewage (Category 3) triggers specific contamination rules
- **Photo pre-screening:** Quick scan to classify photo content before full analysis
- **Progress indicators:** Per-photo and batch progress bars
- **Failure recovery:** Retry failed analyses, skip already-completed

**Server endpoint:** `POST /api/analyze-photo` — sends photo + context to OpenAI Vision API.

### 3.7 Contents (Inventory)
**Purpose:** Master inventory of all claimed items.

**Features:**
- **Item list** with columns: name, room, category, quantity, unit price, total, disposition, status
- **Add/edit item modal:**
  - Item name
  - Room assignment (dropdown from rooms list)
  - Category (dropdown: Electronics, Furniture, Clothing, Kitchenware, etc.)
  - Quantity, unit price → auto-calculated line total
  - Replacement link (URL)
  - AI rationale (auto-generated or editable)
  - Disposition: discarded / inspected (past tense only, auto-normalized)
  - Contaminated flag
  - Include/exclude from claim toggle
- **Bulk actions:**
  - Select all / deselect all
  - Bulk set category
  - Bulk set contaminated
  - Bulk set disposed
  - Bulk mark cardboard as discard
- **AI Enrichment:**
  - Per-item "Enrich" button → calls `/api/enrich-item` for pricing + details
  - Batch "Enrich All Unenriched" 
  - Enrichment modal shows: current vs. enriched price, replacement link, eBay comps, AI rationale
  - Apply/reject enrichment per item
  - Undo enrichment
  - Enrichment audit trail
- **Justify My Price:**
  - Per-item button: generates AI justification for the user's FIXED price (never changes price)
  - Batch "📋 Justify Prices" for all items
  - Server: `justifyMode: true` + `fixedPrice` in request
- **Contents summary:** Total items, total value, enriched count
- **Contents checklist:** Printable PDF checklist of all items
- **Source filtering:** Receipt-sourced items excluded from contents (they're in Expenses)
- **Search/filter** items
- **Deduplication:** Detect and merge duplicate items from AI analysis

**Server endpoint:** `POST /api/enrich-item` — enriches item with pricing, comps, rationale.

### 3.8 Receipts
**Purpose:** Upload and parse purchase receipts.

**Features:**
- Receipt list with: store name, date, items, total
- Upload receipt (image/PDF)
- AI receipt parsing → extracts store, items, prices
- Edit receipt modal: modify parsed data
- Add receipt items to inventory or expenses
- Receipt item detail rows

**Server endpoint:** `POST /api/analyze-receipt`

### 3.9 Expenses (Additional Living Expenses)
**Purpose:** Track ALE and incidental costs.

**Features:**
- Expense list with: category, description, amount, date, vendor
- Add/edit expense modal:
  - Category: Lodging, Food, Transportation, Utilities, Storage, Laundry, Pet Care, Other
  - Description, amount, date, vendor
  - Line items with individual amounts
  - Auto-calculated totals
- **Weather card:** Shows weather data for claim location/date (supports ALE justification)
- **Utility/fuel estimator:** Calculate displaced utility costs
- Expense summary with category breakdowns
- Day-count calculator (displacement duration)
- Buffer days calculation

### 3.10 Communications
**Purpose:** Log all claim-related communications.

**Features:**
- Communication log with: date, type, party, summary
- Add/edit communication modal:
  - Date, type (phone, email, in-person, letter)
  - With whom (adjuster, contractor, attorney, etc.)
  - Summary text
  - Follow-up toggle + follow-up date/task
- **Email draft generator:** AI-powered email drafts based on communication context
- **Email draft modal:** Preview, edit, copy to clipboard

### 3.11 Timeline
**Purpose:** Chronological incident timeline.

**Features:**
- Visual timeline of events
- Add timeline event: date, event description, category
- Auto-populated from key data points (date of loss, communications, contractor visits)
- Categories: Incident, Insurance, Remediation, Repair, Legal, Other

### 3.12 Contractors
**Purpose:** Track remediation/repair companies.

**Features:**
- Contractor list with: company, contact, trade
- Add/edit contractor modal:
  - Company name, contact person, phone, email
  - Trade/specialty
  - Notes
- **Contractor report analysis:** Upload contractor reports for AI parsing
- Report findings display

**Server endpoint:** `POST /api/analyze-contractor-report`

### 3.13 Payments
**Purpose:** Track insurance payments received.

**Features:**
- Payment list with: date, from, amount, type
- Add/edit payment modal:
  - Date, payer (insurance company), amount
  - Type: advance, partial, final, supplement
  - Notes
- Payment summary total

### 3.14 Maximizer
**Purpose:** AI-powered claim strategy advisor.

**Features:**
- Chat interface for claim optimization questions
- Context-aware: knows all claim data
- Suggests overlooked items, categories, strategies
- Follow-up question generation
- Conversation history within session
- Separate page route (`/maximizer`)
- Metrics tracking for usage analytics

**Server endpoint:** `POST /api/maximizer/chat`, `POST /api/maximizer/metrics`

---

## 4. PDF Report Generation

### 4.1 Pre-Print Modal (PPM)
Before generating, shows a quality check:
- **4 check cards:**
  1. Completeness — unenriched items, missing data
  2. Overlooked categories — room types without items
  3. Evidence gaps — items without photos
  4. Strategy tips — claim optimization suggestions
- **Dollar estimate:** Potential additional recovery amount
- **Premium unlock gate:** Some guidance behind paywall (currently free beta)
- **Generate anyway** or **fix issues first** options

### 4.2 PDF Structure (jsPDF, client-side)
The report is ~42 pages and includes:

1. **Cover page:** Claim title, insured name, address, date, claim number
2. **Executive Summary:** High-level claim overview with key metrics
3. **Statement of Claim Basis and Evaluation Method:** "Inspected and determined non-restorable"
4. **Incident Timeline:** Chronological events with categories
5. **Room Documentation:** Per-room pages with dimensions, photos, descriptions
6. **Floor Plan:** Visual layout diagram
7. **Contents Inventory:** Full item table with:
   - Name, room, quantity, unit price, total
   - Disposition label
   - AI rationale for each item (FACTUAL ONLY, supports replacement)
   - Source links as clickable blue "Source:" text
8. **Photo Evidence:** Organized by room with captions
9. **Expenses Section:** ALE breakdown with weather data
10. **Contractor Reports:** Findings and assessments
11. **Receipts:** Parsed receipt summaries
12. **Communications Log**
13. **Payments Received**
14. **Source Links Index:** All 33+ replacement links

### 4.3 PDF Rules (Non-Negotiable)
- All dates in US format (MM/DD/YYYY) via `fmtUSDate()`
- `toDatePdf()` parses YYYY-MM-DD as local date (avoids timezone off-by-one)
- No "Baseline >> Enriched" — just show final value
- AI Rationale on ALL items (not just non-enriched)
- Statement of Claim Basis: "inspected and determined non-restorable"
- Evaluation Method: "inspected and determined non-restorable"
- Source links: `doc.text()` + `doc.link()` (not `textWithLink`)
- Contents checklist shows "Replacement Cost" not "Baseline AI Estimate"
- Receipt-sourced items excluded from contents section
- Items with `includedInClaim === false` excluded
- Disposition labels: past tense only ("discarded"/"inspected")
- Non-porous contamination: "Inspected and determined non-restorable"
- Porous contamination: "Item is non-restorable"
- All rationales mention aerosolization for sewage claims
- Auto-sanitizer (`sanitizeAIRationale()`) runs on load to normalize all items
- Disposition pill width auto-sized with `getTextWidth()`

### 4.4 Contents Checklist PDF
Separate printable PDF with just the item inventory table. Uses jsPDF autoTable.

### 4.5 PDF Progress
- Overlay with progress messages during generation
- Status updates per section being rendered
- Download triggers automatically on completion

---

## 5. AI Integration

### 5.1 Photo Analysis (`/api/analyze-photo`)
- Accepts base64 photo + claim context
- Sends to OpenAI Vision API (GPT-4o)
- Returns: identified items, quantities, estimated values, room, contamination status
- Supports analysis modes: ITEM_VIEW, ROOM_VIEW, FOCUSED_VIEW
- Rate limited: 200 requests/minute
- 10MB max body size
- Upstream timeout: 60s
- Concurrency limit: 2 simultaneous requests
- Photo annotation markers support

### 5.2 Item Enrichment (`/api/enrich-item`)
- Accepts item name + context
- Returns: verified price, replacement link, eBay comparables, AI rationale
- Justify mode: `justifyMode: true` + `fixedPrice` — generates justification for fixed price, never changes it
- Rate limited: 10 requests/minute
- eBay API integration for comparable sales
- Idempotency: Firestore-backed or in-memory cache

### 5.3 Receipt Analysis (`/api/analyze-receipt`)
- Accepts receipt image
- Returns: store name, date, line items with prices, total

### 5.4 Contractor Report Analysis (`/api/analyze-contractor-report`)
- Accepts report document
- Returns: structured findings, recommendations

### 5.5 Maximizer Chat (`/api/maximizer/chat`)
- Accepts message + claim context
- Returns: AI response with claim optimization advice
- Follow-up question generation

### 5.6 Storage Proxy (`GET /api/storage-proxy`)
- Proxies Firebase Storage URLs to avoid CORS issues

---

## 6. Data Sanitization Pipeline

On every app load, the sanitizer runs across all items:
- `sanitizeAIRationale()`: Normalizes disposition labels to past tense, ensures factual language, fixes formatting
- Disposition auto-normalization: "discard" → "discarded", "inspect" → "inspected"
- Category 3 rules applied for sewage claims
- This runs in CODE, not just on data — prevents Firestore race conditions where manual data fixes get overwritten

---

## 7. Premium / Monetization

- `PREMIUM_ENABLED` flag controls Stripe integration
- `isPremiumUnlocked()` / `setPremiumUnlocked()` for session state
- Currently in free beta (all features accessible)
- Stripe checkout integration ready but gated
- Pre-print modal shows premium unlock for guidance features

---

## 8. Non-Functional Requirements

### 8.1 Performance
- Initial load < 3s on broadband
- Tab switching < 100ms (no page reload)
- PDF generation < 30s for 42-page report
- Photo analysis < 15s per photo (server-side)
- Debounced auto-save (500ms after last change)

### 8.2 Browser Support
- Chrome 90+, Safari 15+, Firefox 90+, Edge 90+
- Mobile responsive (iOS Safari, Chrome Android)
- Works offline with localStorage fallback

### 8.3 Security
- Firebase Auth handles all authentication
- No sensitive data in localStorage (auth tokens managed by Firebase SDK)
- API rate limiting on all server endpoints
- Input sanitization on all user inputs
- CORS configured for production domain

### 8.4 Deployment
- **Frontend:** Static files served by Express or separate CDN
- **Backend:** Express server on Render.com (Node.js 18+)
- **Database:** Firebase Firestore
- **Storage:** Firebase Storage (photos, documents)
- **AI:** OpenAI API (server-side only, key never exposed to client)
- **Keep-alive:** Cron ping every 14 min to prevent Render cold starts

---

## 9. External Dependencies

### 9.1 Client-Side Libraries
- jsPDF + jsPDF-AutoTable (PDF generation)
- Firebase JS SDK (auth + Firestore + Storage)
- Chart.js or similar (dashboard charts, if any)

### 9.2 Server-Side Dependencies
- Express.js
- OpenAI SDK
- Firebase Admin SDK (for Firestore REST auth / idempotency)
- eBay API client (for comparable sales in enrichment)

### 9.3 Environment Variables (Server)
- `OPENAI_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `PORT` (default 3000)

---

## 10. Migration Compatibility

### 10.1 Data Compatibility
- v2 MUST read existing Firestore documents created by v1 without any migration
- Field names, data types, and nesting must match exactly
- The `mergeData()` function's defaults and normalization must be preserved

### 10.2 URL Compatibility
- `/` serves the main app
- `/maximizer` serves the Maximizer standalone page
- `/api/*` endpoints maintain exact same request/response contracts

### 10.3 GSD Sync
- v2 must be syncable to GSD template system via `sync-to-gsd.sh`
- Build output must be a single HTML file OR the sync script must be updated
