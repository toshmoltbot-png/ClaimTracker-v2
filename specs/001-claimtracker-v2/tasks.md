# Engineering Tasks — ClaimTracker v2

Reference: `spec.md` for feature details, `plan.md` for architecture.
Source reference: `/Users/tosh/ClaimTracker/index.html` (v1 monolith, 20,175 lines)
Source reference: `/Users/tosh/ClaimTracker/server.js` (v1 backend, 1,703 lines)

---

## Phase 1: Foundation

### 1.1 Project Scaffold
- [x] Initialize Vite + React 19 + TypeScript in `client/`
- [x] Install dependencies: zustand, react-router-dom, react-hook-form, jspdf, jspdf-autotable, firebase, tailwindcss
- [x] Configure Tailwind with dark theme matching v1 CSS vars:
  - `--primary: #60a5fa`, `--primary-dark: #3b82f6`, `--secondary: #94a3b8`
  - `--success: #34d399`, `--warning: #fbbf24`, `--danger: #f87171`
  - Background: `linear-gradient(135deg, #0a0f1f 0%, #0d1326 100%)`
  - Border: `#253045`
- [x] Configure Vite proxy: `/api/*` → `http://localhost:3000`
- [x] Set up path aliases (`@/` → `src/`)
- [x] Create `render.yaml` for deployment

### 1.2 TypeScript Types
- [x] Define `ClaimData` interface matching v1's `defaultData()` (line 3772 of v1)
  - All nested types: `Room`, `ContentItem`, `AIPhoto`, `Receipt`, `Expense`, `Communication`, `Contractor`, `ContractorReport`, `Payment`, `TimelineEvent`, `FloorPlan`, `PolicyDoc`
- [x] Define API types: `AnalyzePhotoRequest/Response`, `EnrichItemRequest/Response`, `AnalyzeReceiptRequest/Response`, `MaximizerChatRequest/Response`
- [x] Ensure all optional fields match v1's actual usage (many fields are dynamically added)

### 1.3 Firebase Integration
- [x] Create `lib/firebase.ts` — init Firebase app with existing config from `firebase-config.js`
- [x] Port auth functions: `getUid()`, login, logout, create account
- [x] Port Firestore functions: `loadClaim()`, `saveClaim()`, `stripUndefined()`
- [x] Port Storage functions: `uploadFile()`, `storeMediaFile()`, `storeDataUrl()`
- [x] Maintain same Firestore path: `claims/{uid}`

### 1.4 State Management
- [x] Create `store/claimStore.ts` — Zustand store mirroring v1's global `data` object
  - All data arrays: rooms, contents, aiPhotos, receipts, expenses, communications, contractors, contractorReports, payments, timeline, floorPlan, policyDocs
  - Dashboard fields
  - Settings
- [x] Create `store/authStore.ts` — auth state, user info
- [x] Create `store/uiStore.ts` — active tab, open modals, toasts, save status, wizard state
- [x] Implement `subscribe()` for auto-save with debounce (500ms)

### 1.5 Persistence Layer
- [x] Create `lib/persistence.ts` — port `persistCloud()`, `persistLocal()`, `loadClaimWithRetry()`
- [x] Port `mergeData()` exactly (line 4047 of v1) — default values, normalization
- [x] Port `stripLargeLocalData()` for localStorage size management
- [x] Port `stripFileItemForStorage()`, `listLocalIdsFromFileItem()`, etc.
- [x] Port save status logic: "Saved", "Saving...", "Offline", "Save failed — retry"
- [x] Port retry logic with exponential backoff
- [x] Port `getCloudErrorType()`, `isNetworkError()`, `isQuotaError()`

### 1.6 Utility Libraries
- [x] Create `lib/dates.ts` — port `fmtUSDate()`, `toDatePdf()`, `toDate()`
- [x] Create `lib/utils.ts` — port `formatBytes()`, `escapeHtml()`, `upsertById()`, `csvCell()`, `getTextWidth()`
- [x] Create `lib/sanitizer.ts` — port `sanitizeAIRationale()`, `normalizePhotoMetadata()`, `applyCategory3Rules()`
  - Disposition auto-normalization: "discard" → "discarded", "inspect" → "inspected"
  - Rationale factual checks
  - Aerosolization mentions for sewage
  - Run on every data load
- [x] Create `lib/api.ts` — API client for all `/api/*` endpoints with error handling

### 1.7 Layout Shell
- [x] Create `components/layout/AuthGuard.tsx` — gates app behind Firebase auth
  - Login form: email + password
  - Create account option
  - Loading state during auth check
- [x] Create `components/layout/Header.tsx` — app title, claim info subtitle, save status, logout
- [x] Create `components/layout/TabBar.tsx` — 14 tabs + wizard button, sticky, scrollable, responsive
  - Active tab highlighting
  - Badge counts on tabs (photos, items, etc.)
- [x] Create `components/layout/MobileQuickActions.tsx` — floating action bar (mobile only)
- [x] Create `App.tsx` with React Router:
  - `/` → main app (tab-based)
  - `/maximizer` → standalone Maximizer page
- [x] Wire up tab switching via URL hash or Zustand state

### 1.8 Shared Components
- [x] Create `components/shared/Modal.tsx` — reusable modal with:
  - Open/close animation
  - Backdrop click to close
  - `closeModal()` must handle `overflow:hidden` cleanup (v1 bug fix)
  - ESC key to close
- [x] Create `components/shared/Toast.tsx` — notification toasts (success, error, info, warning)
- [x] Create `components/shared/PhotoUploader.tsx` — drag-and-drop + click-to-upload
  - Image compression via `compressImageToDataUrl()`
  - Preview thumbnails
  - Multiple file support
- [x] Create `components/shared/ConfirmDialog.tsx` — confirmation dialogs for destructive actions
- [x] Create `components/shared/ProgressBar.tsx` — progress indicator
- [x] Create `components/shared/SaveStatus.tsx` — cloud/local save status indicator
- [x] Create `components/shared/EmptyState.tsx` — empty list states

---

## Phase 2: Core Tabs

### 2.1 Dashboard
- [x] Create `tabs/Dashboard/Dashboard.tsx`
- [x] Implement claim summary card (insured name, address, claim #, DOL, claim type)
- [x] Implement completeness metrics with progress bars:
  - Rooms: count of rooms
  - Photos: count of AI photos
  - Items: count + enriched percentage
  - Expenses: total amount
- [x] Implement `NextStepCard.tsx` — smart suggestion based on claim state
- [x] Implement `ReadinessPanel.tsx` — expandable completeness checklist
- [x] Quick action buttons: AI Builder, Generate Report
- [x] Mobile progress indicators
- [x] Port `updateDashboardSummary()`, `populateDashboardFields()`

### 2.2 Claim Info
- [x] Create `tabs/ClaimInfo/ClaimInfo.tsx`
- [x] Form fields: claim number, policy number, DOL, claim type, insured name, address, insurance company, adjuster info
- [x] Auto-save on field change
- [x] Create `tabs/ClaimInfo/PolicyDocUploader.tsx`:
  - Upload PDF/image policy documents
  - Auto-classify document type via `classifyPolicyDoc()`
  - List uploaded docs with view/delete
  - Document type labels

### 2.3 Rooms
- [x] Create `tabs/Rooms/Rooms.tsx` — room card list
- [x] Create `tabs/Rooms/RoomCard.tsx` — room name, dimensions, sqft, photo count, edit/delete buttons
- [x] Create `tabs/Rooms/RoomModal.tsx` — add/edit room form:
  - Room name (text input + presets dropdown)
  - Length × Width (number inputs)
  - Auto-calculated sqft
  - Room photos upload
  - Notes field
- [x] Delete room with confirmation
- [x] Port `clearRoomForm()`, `calcRoomSqft()`, `updateRoomDimensions()`
- [x] Badge count on nav tab

### 2.4 Contents
- [x] Create `tabs/Contents/Contents.tsx` — item inventory table
  - Columns: checkbox, name, room, category, qty, unit price, total, disposition, status
  - Sort by column
  - Search/filter
- [x] Create `tabs/Contents/ContentItem.tsx` — table row with inline actions
- [x] Create `tabs/Contents/ContentModal.tsx` — add/edit item form:
  - Item name, room (dropdown), category (dropdown)
  - Quantity, unit price, auto-calc total
  - Replacement link (URL)
  - AI rationale (textarea)
  - Disposition: discarded/inspected
  - Contaminated toggle
  - Include in claim toggle
- [x] Create `tabs/Contents/EnrichModal.tsx`:
  - Current vs enriched comparison
  - eBay comps display (`buildEbayCompsMarkup()`)
  - Enrichment audit trail (`buildEnrichmentAuditMarkup()`)
  - Apply/reject/undo buttons
  - "Justify My Price" mode display
- [x] Create `tabs/Contents/BulkActions.tsx`:
  - Select all / deselect all
  - Bulk set category, contaminated, disposed
  - Bulk mark cardboard as discard
- [x] Create `tabs/Contents/ContentsSummary.tsx` — total items, total value, enriched count
- [x] Port enrichment pipeline:
  - `submitEnrichItem()` → `/api/enrich-item`
  - `applyEnrichmentToItem()`, `undoEnrichment()`
  - `applyJustificationToItem()` (justify mode)
  - Batch enrich all unenriched
  - Batch justify all prices
- [x] Port deduplication: `deduplicateItemsBySourcePhotos()`, `deduplicateDraftItemsBySourcePhotos()`
- [x] Port `updateContentsSummary()`, `updateContentLineTotal()`
- [x] Contents checklist PDF generation (`generateContentsChecklistPDF()`)

---

## Phase 3: AI Features

### 3.1 AI Builder
- [x] Create `tabs/AIBuilder/AIBuilder.tsx` — main AI analysis interface
- [x] Create `tabs/AIBuilder/PhotoDropZone.tsx`:
  - Drag-and-drop zone with visual feedback
  - Click-to-upload fallback
  - Multiple file support
  - Image compression
- [x] Create `tabs/AIBuilder/PhotoStack.tsx`:
  - Photo grouping and stack management
  - Expand/collapse stacks
  - Per-photo analysis mode selector (ITEM_VIEW, ROOM_VIEW, FOCUSED_VIEW)
  - Analysis status per photo (pending, analyzing, complete, failed)
  - Stack metadata display
- [x] Create `tabs/AIBuilder/AnalysisResults.tsx`:
  - Identified items display
  - Room assignment
  - Contamination status
  - Disposition recommendation
  - "Add to Contents" buttons
- [x] Create `tabs/AIBuilder/AnalysisProgress.tsx`:
  - Per-photo progress
  - Batch progress bar
  - Stop/cancel button
- [x] Port analysis pipeline:
  - `analyzePhotoVisionWithRetry()` → `/api/analyze-photo`
  - `analyzePhotoRequestBody()` — build request with claim context
  - `applyAnnotationMarkersToPayload()` — photo annotation support
  - `updateAIAnalysisMode()`, `updateAIAnalysisModeToggle()`
- [x] Port batch analysis: analyze all, stop analysis, skip completed
- [x] Port draft item flow: AI results → draft items → Contents tab
  - `upsertDraftContentFromAI()`
  - `autoImportPhotosToAIBuilder()`
- [x] Port photo pre-screening: `/api/pre-screen-photos`
- [x] Port failure recovery and retry logic
- [x] Port "AI needs update" banner logic

### 3.2 Receipts
- [x] Create `tabs/Receipts/Receipts.tsx` — receipt list
- [x] Create `tabs/Receipts/ReceiptModal.tsx` — view/edit receipt
  - Store name, date
  - Line items with prices
  - Total
  - Edit line items
- [x] Port receipt upload + AI parsing → `/api/analyze-receipt`
- [x] Port `addReceiptToInventory()`, `addReceiptItemsToInventory()`
- [x] Port `syncClaimReceipts()`

### 3.3 Maximizer
- [x] Create `tabs/Maximizer/Maximizer.tsx` — main container
- [x] Create `tabs/Maximizer/ChatInterface.tsx`:
  - Message input
  - Chat history display
  - AI response streaming/display
  - Follow-up question buttons
  - Context-aware: sends claim data summary with each message
- [x] Port `/api/maximizer/chat` integration
- [x] Port follow-up question generation
- [x] Port metrics tracking (`/api/maximizer/metrics`)
- [x] Standalone `/maximizer` route

---

## Phase 4: Supporting Tabs

### 4.1 Expenses
- [x] Create `tabs/Expenses/Expenses.tsx` — expense list with category breakdown
- [x] Create `tabs/Expenses/ExpenseModal.tsx`:
  - Category dropdown (Lodging, Food, Transportation, etc.)
  - Description, amount, date, vendor
  - Line items with amounts
  - Auto-calculated totals
- [x] Create `tabs/Expenses/WeatherCard.tsx` — weather data for ALE justification
  - Port `updateExpensesWeatherCard()`
- [x] Create `tabs/Expenses/UtilityEstimator.tsx`:
  - Utility cost calculator for displacement
  - Fuel estimate calculator
  - Port `calculateUtilityFuelEstimate()`, `toggleUtilityCalcMode()`
- [x] Port `calcExpenseDays()`, `updateExpenseBuffer()`, `updateExpenseLineTotal()`
- [x] Port expense summary calculations

### 4.2 Communications
- [x] Create `tabs/Communications/Communications.tsx` — communication log
- [x] Create `tabs/Communications/CommunicationModal.tsx`:
  - Date, type (phone/email/in-person/letter)
  - Party (adjuster/contractor/attorney/etc.)
  - Summary text
  - Follow-up toggle with date/task
- [x] Create `tabs/Communications/EmailDraftModal.tsx`:
  - AI-generated email draft
  - Edit capability
  - Copy to clipboard
- [x] Port `createFollowUps()`, `toggleFollowUpTask()`
- [x] Port email draft generation

### 4.3 Timeline
- [x] Create `tabs/Timeline/Timeline.tsx`:
  - Visual timeline display
  - Add event: date, description, category
  - Auto-populated events from claim data
  - Category indicators (Incident, Insurance, Remediation, etc.)

### 4.4 Contractors
- [x] Create `tabs/Contractors/Contractors.tsx` — contractor list
- [x] Create `tabs/Contractors/ContractorModal.tsx`:
  - Company name, contact, phone, email, trade
  - Notes
- [x] Port contractor report upload + AI analysis → `/api/analyze-contractor-report`
- [x] Report findings display

### 4.5 Payments
- [x] Create `tabs/Payments/Payments.tsx` — payment list + total
- [x] Create `tabs/Payments/PaymentModal.tsx`:
  - Date, payer, amount, type (advance/partial/final/supplement)
  - Notes

---

## Phase 5: Advanced Features

### 5.1 Floor Plan
- [x] Create `tabs/FloorPlan/FloorPlan.tsx` — canvas container
- [x] Create `tabs/FloorPlan/FloorPlanCanvas.tsx`:
  - Canvas-based room placement (use HTML Canvas or SVG)
  - Drag rooms to position
  - Snap-to-grid toggle
  - Room dimension labels
  - Connection lines between rooms
  - Auto-computed union sqft
  - Scale indicator
  - Visibility toggles
- [x] Port `buildFloorPlanRooms()`, `computeFloorPlanScale()`, `computeFloorPlanUnionSqft()`, `toggleFloorPlanSnap()`, `updateFloorPlanVisibility()`

### 5.2 Photo Library
- [x] Create `tabs/PhotoLibrary/PhotoLibrary.tsx`
- [x] Create `tabs/PhotoLibrary/PhotoGrid.tsx`:
  - Grid layout of all photos
  - Filter by room
  - Click to preview (image preview modal)
  - Photo metadata overlay
- [x] Port image preview modal functionality
- [x] Link photos to their AI analysis results

### 5.3 Onboarding Wizard
- [x] Create `wizard/OnboardingWizard.tsx` — multi-step wizard container
- [x] Create `wizard/WizardSteps.tsx` — individual step components:
  - Step 1: Welcome + claim type
  - Step 2: Claim info
  - Step 3: Room setup
  - Step 4: Room photos upload
  - Step 5: Photo pre-screening
  - Step 6: Floor plan sketch
  - Step 7: Receipt upload
  - Step 8: Expense quick-add + weather
  - Step 9: AI analysis launch
  - Step 10: Completion → Maximizer or Contents
- [x] Port wizard state management (current step, progress)
- [x] Port wizard tip rendering
- [x] Port `shouldShowOnboarding()` logic — show on first visit
- [x] "⟲ Wizard" button reopens from any state

---

## Phase 6: PDF Generation

### 6.1 PDF Generator Core
- [x] Create `components/pdf/PDFGenerator.ts`:
  - Port `generatePDF()` function (1,860 lines from v1)
  - Input: `ClaimData` object
  - Output: jsPDF document
  - Same constants: NAVY [15,40,80], LIGHT_BLUE [235,242,255], margins ML=14, MR=14
  - Same A4 format, mm units

### 6.2 PDF Sections
- [x] Create `components/pdf/PDFSections.ts` — break into section renderers:
  - `renderCoverPage()`
  - `renderExecutiveSummary()`
  - `renderClaimBasisStatement()` — "inspected and determined non-restorable"
  - `renderTimeline()`
  - `renderRoomDocumentation()` — per-room pages with photos
  - `renderFloorPlan()`
  - `renderContentsInventory()` — full item table with rationale + source links
  - `renderPhotoEvidence()` — organized by room with captions
  - `renderExpenses()` — with weather data
  - `renderContractorReports()`
  - `renderReceipts()`
  - `renderCommunicationsLog()`
  - `renderPayments()`
  - `renderSourceLinks()` — all replacement links index

### 6.3 PDF Rules Implementation
- [x] All dates via `fmtUSDate()` → MM/DD/YYYY
- [x] `toDatePdf()` parses YYYY-MM-DD as LOCAL date (no timezone shift)
- [x] Source links: `doc.text()` + `doc.link()` (NOT `textWithLink`)
- [x] AI Rationale on ALL items
- [x] Disposition labels: past tense only
- [x] Receipt-sourced items excluded
- [x] `includedInClaim === false` items excluded
- [x] No "Baseline >> Enriched" labels
- [x] Disposition pill width via `getTextWidth()`

### 6.4 Pre-Print Modal
- [x] Create `components/pdf/PrePrintModal.tsx`:
  - Port `getPPMSummary()` — compute quality check data
  - 4 cards: Completeness, Overlooked, Evidence gaps, Strategy
  - Dollar estimate (`calcPPMDollarEstimate()`)
  - Premium unlock gate (currently free beta)
  - "Generate anyway" vs "fix issues first"
- [x] Create `components/pdf/PDFProgress.tsx`:
  - Generation overlay with status messages
  - Per-section progress updates
  - Auto-download on completion

### 6.5 Contents Checklist PDF
- [x] Port `generateContentsChecklistPDF()` — separate printable item list
  - Uses jsPDF autoTable
  - Header: "Replacement Cost" (not "Baseline AI Estimate")
  - Claim # and date in header/footer

---

## Phase 7: Polish & Edge Cases

### 7.1 Data Sanitization
- [x] Ensure sanitizer runs on every Firestore load in the Zustand hydration
- [ ] Test disposition normalization end-to-end
- [ ] Test Category 3 rules for sewage claims
- [ ] Test aerosolization mentions in rationale
- [x] Verify no Firestore race conditions (sanitizer in code, not data fixes)

### 7.2 Premium / Monetization
- [x] Port `PREMIUM_ENABLED` flag
- [x] Port `isPremiumUnlocked()` / `setPremiumUnlocked()`
- [ ] Port Stripe checkout integration (currently gated)
- [x] AI upsell overlay in pre-print modal

### 7.3 Mobile Optimization
- [x] Responsive tab bar (horizontal scroll on mobile)
- [x] Mobile quick actions bar
- [ ] Touch-friendly modals
- [ ] Responsive table layouts (card view on mobile)
- [ ] Mobile progress panel

### 7.4 Error Handling
- [x] Network error detection and offline mode
- [ ] Cloud save retry with user notification
- [ ] API error toasts with actionable messages
- [ ] Storage quota detection and warning
- [ ] Graceful degradation when AI endpoints are down

### 7.5 Performance
- [x] Lazy-load tab components (React.lazy + Suspense)
- [x] Image compression before upload (`compressImageToDataUrl()`)
- [x] Debounced saves (500ms)
- [ ] Virtualized lists for large inventories (>100 items)
- [x] Code splitting per tab

---

## Phase 8: Server & Deployment

### 8.1 Server Updates
- [x] Copy `server.js` to `server/` with minimal changes:
  - Serve `../client/dist/` as static files in production
  - Keep all `/api/*` routes exactly as-is
  - Add `vite` dev server proxy config for development
- [x] Copy `firebase-config.js`, `firebaseClient.js` to `server/`
- [x] Verify all env vars work: `OPENAI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`

### 8.2 Build Configuration
- [x] Vite build → `client/dist/`
- [ ] Single-file HTML option (Vite plugin for GSD sync compatibility)
- [x] Source maps for debugging
- [x] Environment variable injection for Firebase config

### 8.3 Deployment
- [x] Create `render.yaml`:
  - Build: `cd client && npm ci && npm run build && cd ../server && npm ci`
  - Start: `cd server && node server.js`
  - Env vars: same as v1
- [x] Test deploy to Render staging
- [x] Verify keep-alive ping works
- [x] Verify all API endpoints accessible

---

## Phase 9: Testing & Verification

### 9.1 Data Compatibility
- [x] Load existing v1 Firestore claim in v2
- [ ] Verify all 14 tabs render correctly with existing data
- [x] Verify no data loss or corruption on save
- [x] Verify merge logic handles partial/missing fields

### 9.2 Feature Parity
- [ ] Walk through every v1 feature in v2
- [ ] Compare tab-by-tab functionality
- [ ] Test all modal flows (add/edit/delete for each data type)
- [ ] Test bulk actions on Contents
- [ ] Test AI analysis flow end-to-end
- [ ] Test enrichment + justify flow

### 9.3 PDF Verification
- [ ] Generate PDF from same claim data in v1 and v2
- [ ] Side-by-side page comparison
- [ ] Verify date formats (US)
- [ ] Verify source links are clickable
- [ ] Verify AI rationale on all items
- [ ] Verify disposition labels
- [ ] Verify contents checklist PDF

### 9.4 Edge Cases
- [ ] New claim (empty data) → wizard triggers
- [ ] Offline mode → local save, reconnect, cloud sync
- [ ] Large claim (50+ items, 100+ photos)
- [ ] Mobile browser testing (iOS Safari, Chrome Android)
- [ ] Concurrent sessions (same claim in two tabs)

### 9.5 Go-Live
- [x] Point Render to `toshmoltbot-png/ClaimTracker-v2`
- [x] Verify production deployment
- [ ] Test with real claim data
- [ ] Monitor for errors (Render logs)
- [ ] Update GSD sync script if needed
- [ ] Update self-healer script for v2 structure
- [ ] Update MEMORY.md with v2 architecture

---

**Total estimated tasks: ~150 discrete items across 9 phases.**
**Estimated effort: 3-5 coding sessions with Codex/Claude Code agents.**
**Critical path: Phase 1 (Foundation) → Phase 2 (Core Tabs) → Phase 6 (PDF) → Phase 9 (Testing)**
