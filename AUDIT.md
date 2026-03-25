# ClaimTracker v2 vs v1 — Comprehensive Feature Parity Audit

**Date:** 2026-03-24  
**Auditor:** Automated deep-read comparison  
**v1 source:** `~/ClaimTracker/index.html` (~20,175 lines)  
**v2 source:** `~/clawd/ClaimTracker-v2/client/src/`

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Matches v1 behavior |
| ⚠️ | Partially implemented — needs work |
| ❌ | Missing entirely from v2 |

---

## 1. WIZARD — Step-by-Step Comparison

v1 has **12 steps**, v2 has **10 steps**. v2 is missing the **Contractor Report** step entirely and merges the **Contents Review** + **Done/Summary** steps.

### Step mapping

| v1 Step | v1 Title | v2 Step | v2 Title | Status |
|---------|----------|---------|----------|--------|
| 1 | What happened? | 1 | Claim Type | ⚠️ |
| 2 | Upload your insurance policy | 2 | Claim Info | ⚠️ |
| 3 | Confirm your claim details | 2 | (merged into Claim Info) | ⚠️ |
| 4 | What rooms were damaged? | 3 | Rooms | ⚠️ |
| 5 | Floor plan (dimensions + layout) | 6 | Floor Plan | ⚠️ |
| 6 | Upload photos of each room | 4 | Photos | ✅ |
| 7 | Upload damaged item photos + AI prescreen | 5 + 9 | Pre-Screen + AI Launch | ⚠️ |
| 8 | Receipts | 7 | Receipts | ✅ |
| 9 | Contractor reports | — | **MISSING** | ❌ |
| 10 | Expenses | 8 | Expenses | ⚠️ |
| 11 | Review contents list | — | **MISSING** | ❌ |
| 12 | Done / summary checklist | 10 | Completion | ⚠️ |

### Step-by-step detail

#### Step 1: Claim Type

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Incident type selector | `water_damage`, `fire`, `wind_hail`, `theft`, `vandalism`, `sewage`, `other` | `category3_sewage`, `water`, `fire`, `storm`, `other` | ⚠️ |
| **Wind/Hail option** | ✅ `wind_hail` | ❌ Missing — closest is `storm` | ❌ |
| **Theft option** | ✅ `theft` | ❌ Missing entirely | ❌ |
| **Vandalism option** | ✅ `vandalism` | ❌ Missing entirely | ❌ |
| Date of loss field | ✅ On step 1 | Moved to step 2 | ⚠️ |
| **Brief description textarea** | ✅ `wizardDescription` | ❌ Missing entirely — no free-text description | ❌ |

#### Step 2: Policy Upload + Claim Info

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Policy upload zone | ✅ | ✅ | ✅ |
| Auto-fill from policy | ✅ | ✅ | ✅ |
| Progress bar during upload | ✅ Animated | ❌ Only text status | ⚠️ |
| Skip link | ✅ "Skip — I'll enter it manually →" | ❌ No explicit skip link | ❌ |
| **Separate step for confirm fields** | ✅ Step 3 is dedicated to reviewing/editing parsed fields | ❌ Merged — upload + manual fields on same step | ⚠️ |

#### Step 2/3: Claim Details Fields

| Field | v1 | v2 | Status |
|-------|----|----|--------|
| Property address | ✅ | ✅ | ✅ |
| **City** | ✅ Separate field | ❌ Missing — only combined address | ❌ |
| **State** | ✅ Separate field | ❌ Missing | ❌ |
| **Zip** | ✅ Separate field | ❌ Missing | ❌ |
| Insurance company | ✅ | ✅ | ✅ |
| Policy number | ✅ | ✅ | ✅ |
| Claim number | ✅ | ✅ | ✅ |
| Insured name | ✅ | ✅ | ✅ |
| Date of loss | ✅ Step 1 | ✅ Step 2 | ✅ |
| Deductible | ❌ Not in wizard step 3 | ✅ In step 2 | ✅ |
| **Adjuster name** | ✅ | ❌ Missing from wizard | ❌ |
| **Adjuster phone** | ✅ | ❌ Missing from wizard | ❌ |
| **Adjuster email** | ✅ | ❌ Missing from wizard | ❌ |
| Policy banner ("✅ details filled") | ✅ | ❌ | ❌ |

#### Step 3/4: Rooms

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Room name input | ✅ | ✅ | ✅ |
| **Room type dropdown** | ✅ (Bedroom, Bathroom, Kitchen, etc.) | ❌ Missing from wizard | ❌ |
| Room name presets | ❌ Not in v1 wizard (only dropdown) | ❌ Not in v2 wizard either (only in RoomModal tab) | ⚠️ |
| Room chips display | ✅ Inline chips | ✅ Card list | ✅ |
| Feet + inches inputs | ✅ Length ft/in, Width ft/in | ✅ | ✅ |
| Notes textarea | ❌ Not in v1 wizard | ✅ In v2 wizard | ✅ |
| Remove room button | ❌ Not in v1 wizard (v1 has chips you can click) | ✅ | ✅ |
| Skip link | ✅ "Skip — add rooms later →" | ❌ No dedicated skip | ❌ |

#### Step 5: Floor Plan (v1) / Step 6 (v2)

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Two-phase: dimensions THEN layout | ✅ wizardFPPhase = "dimensions" then "layout" | ❌ Only canvas shown, no dimension entry phase | ⚠️ |
| **Konva.js interactive stage** | ✅ Full Konva with drag, right-click rotate | ❌ Custom Canvas2D — no rotate, no right-click popover | ⚠️ |
| **Right-click to rotate room** | ✅ | ❌ Missing entirely | ❌ |
| **Edit popover on right-click** | ✅ wizardFPEditPopover | ❌ Missing | ❌ |
| Snap toggle | ✅ | ✅ | ✅ |
| Room dragging | ✅ | ✅ | ✅ |

#### Step 6: Room Photos (v1) / Step 4 (v2)

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Per-room photo upload | ✅ Cycles through rooms 1-of-N | ✅ Select room from dropdown | ✅ |
| Room name shown as "Kitchen — 1 of 5" | ✅ | ❌ Just a dropdown selector | ⚠️ |
| Photo thumbnails per room | ✅ | ⚠️ Shows count only, no thumbnails | ⚠️ |

#### Step 7: AI Damaged Item Photos + Prescreen (v1) / Steps 5+9 (v2)

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Upload damaged item photos | ✅ wizardAIPacketInput | ⚠️ Not in wizard — redirects to AI Builder tab | ⚠️ |
| **Upload progress bar** | ✅ Animated progress | ❌ Missing | ❌ |
| **Prescreen grid with mode cycling** | ✅ Full grid, click to cycle ITEM/ROOM/FOCUSED | ✅ Step 5 has similar prescreen | ✅ |
| **Drag to stack photos** | ✅ Sortable drag-to-stack | ❌ Missing — no photo stacking in wizard | ❌ |
| **"Run AI on these photos" button** | ✅ applyWizardPrescreenAndRun() | ❌ Only "Apply to AI Builder" — doesn't auto-run | ⚠️ |
| Mode tip with dismiss | ✅ | ❌ | ❌ |
| "+ Add more" button | ✅ | ❌ | ❌ |

#### Step 8: Receipts (v1) / Step 7 (v2)

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Drag & drop upload | ✅ | ✅ | ✅ |
| Upload progress bar | ✅ | ❌ | ❌ |
| Thumbnail previews | ✅ | ❌ Shows card list, no thumbnails | ⚠️ |
| Skip link | ✅ | ❌ | ❌ |

#### Step 9: Contractor Reports (v1) — **ENTIRELY MISSING FROM v2**

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| **Contractor report upload** | ✅ Full upload flow | ❌ No wizard step for this | ❌ |
| **AI analysis of contractor docs** | ✅ Extracts findings, equipment, amounts | ❌ | ❌ |
| **Review extracted data** | ✅ Two-phase: upload then review | ❌ | ❌ |
| **Thumbnail + remove buttons** | ✅ | ❌ | ❌ |

#### Step 10: Expenses (v1) / Step 8 (v2)

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Quick-add buttons | ✅ 5 categories: labor, utility, disposal, living, misc | ⚠️ 4 categories: Cleanup Labor, Utilities, Disposal, Lodging — **no Misc** | ⚠️ |
| **"Misc / Other" category button** | ✅ | ❌ Missing | ❌ |
| Descriptive text per button | ✅ Rich descriptions with examples | ❌ Just category labels | ⚠️ |
| **Running total display** | ✅ Shows "$X.XX" running total after adding | ❌ Missing | ❌ |
| **Weather note on utility button** | ✅ wizardUtilityWeatherNote | ❌ | ❌ |
| WeatherCard | ✅ (in expenses tab) | ✅ (shown in wizard step 8) | ✅ |
| **Coverage D pitch text** | ✅ "$500-$2,000+ most homeowners miss" | ❌ Missing | ❌ |
| Skip link | ✅ | ❌ | ❌ |

#### Step 11: Review Contents List (v1) — **MISSING FROM v2**

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| **Contents inventory review** | ✅ Shows what AI found, lets user add more | ❌ | ❌ |
| **"Review Contents Inventory" button** | ✅ | ❌ | ❌ |
| **"View Claim Maximizer" link** | ✅ | ❌ | ❌ |

#### Step 12: Done / Summary Checklist (v1) / Step 10 (v2)

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Checklist of completed items | ✅ Dynamic ✅/○ checklist | ❌ Only "Workspace ready" message | ❌ |
| **PPM teaser (claim improvements found)** | ✅ Shows count + estimated dollar value | ❌ Missing entirely | ❌ |
| **"Preview My Opportunities" button** | ✅ | ❌ | ❌ |
| Go to Contents button | ✅ | ✅ | ✅ |
| Go to Maximizer button | ✅ | ✅ | ✅ |
| **"Finish" button** | ✅ Dedicated finish button | ❌ Goes directly to contents/maximizer | ⚠️ |

---

## 2. TABS — Feature Comparison

### Dashboard

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Claim summary header | ✅ | ✅ | ✅ |
| Metric cards (rooms, photos, items, expenses) | ✅ | ✅ | ✅ |
| Readiness checks panel | ✅ | ✅ | ✅ |
| Next step suggestion | ✅ | ✅ | ✅ |
| **Promise tracker (adjuster commitments)** | ✅ Tracks promises from communications | ❌ Missing | ❌ |
| Generate PDF button | ✅ | ✅ | ✅ |
| AI Builder shortcut | ✅ | ✅ | ✅ |
| Mobile progress milestones | ❌ | ✅ (new in v2) | ✅ |

### Claim Info

| Field | v1 | v2 | Status |
|-------|----|----|--------|
| Claim number | ✅ | ✅ | ✅ |
| Policy number | ✅ | ✅ | ✅ |
| Insured name | ✅ | ✅ | ✅ |
| Insured address | ✅ | ✅ | ✅ |
| Insurer name | ✅ | ✅ | ✅ |
| Date of loss | ✅ | ✅ | ✅ |
| **Date reported** | ✅ | ❌ Missing | ❌ |
| Adjuster name | ✅ | ✅ | ✅ |
| Adjuster email | ✅ | ⚠️ Combined as "Adjuster contact" — email or phone | ⚠️ |
| **Adjuster phone** | ✅ Separate field | ❌ Missing as separate field | ❌ |
| **Deductible** | ✅ | ❌ Missing from Claim Info tab | ❌ |
| **Coverage type** | ✅ (Dwelling/Personal Property/Both) | ❌ Missing | ❌ |
| **Water backup endorsement limit** | ✅ | ❌ Missing | ❌ |
| **Claim status** | ✅ (Open/Estimate Received/Partial Paid/Closed) | ❌ Missing | ❌ |
| Claim type dropdown | ✅ | ✅ | ✅ |
| Policy doc uploader | ✅ | ✅ | ✅ |

### Rooms

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Add/edit/delete rooms | ✅ | ✅ | ✅ |
| Room photos | ✅ | ✅ | ✅ |
| Feet + inches dimensions | ✅ | ✅ | ✅ |
| **Direct sqft entry** | ✅ `roomSqftDirect` input | ❌ Missing | ❌ |
| **Price per sqft** | ✅ `roomPricePerSqFt` | ❌ Missing | ❌ |
| Room name presets | ❌ v1 doesn't have presets in room modal | ✅ v2 RoomModal has ROOM_NAME_PRESETS | ✅ |
| Room type dropdown | ✅ | ❌ Missing from RoomModal | ❌ |

### Floor Plan

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Interactive canvas | ✅ Konva.js | ⚠️ Native Canvas2D | ⚠️ |
| Room dragging | ✅ | ✅ | ✅ |
| **Room rotation (right-click)** | ✅ | ❌ Missing | ❌ |
| **Right-click popover** | ✅ Edit options | ❌ Missing | ❌ |
| Snap to grid | ✅ | ✅ | ✅ |
| Connection lines toggle | ❌ | ✅ (new in v2) | ✅ |
| Room labels toggle | ❌ | ✅ (new in v2) | ✅ |
| Dimension labels toggle | ❌ | ✅ (new in v2) | ✅ |
| Union sqft display | ❌ | ✅ (new in v2) | ✅ |

### Photo Library

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Gallery grid view | ✅ | ✅ | ✅ |
| **Photo library picker modal** | ✅ Used when choosing photos for content items | ❌ Not found in v2 | ❌ |

### AI Builder

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Photo upload / drop zone | ✅ | ✅ | ✅ |
| Analysis modes (Item/Room/Focused) | ✅ | ✅ | ✅ |
| Mode selector per photo | ✅ | ✅ | ✅ |
| Batch processing | ✅ | ✅ | ✅ |
| **Photo stacking** | ✅ Drag photos into stacks | ❌ Missing from AI Builder | ❌ |
| Analysis progress display | ✅ | ✅ | ✅ |
| Analysis results | ✅ | ✅ | ✅ |

### Contents

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Inventory table | ✅ | ✅ | ✅ |
| Add/edit items | ✅ | ✅ | ✅ |
| Enrich modal | ✅ | ✅ | ✅ |
| Bulk actions | ✅ | ✅ (BulkActions.tsx) | ✅ |
| Justify prices | ✅ | ✅ | ✅ |
| **Content quantity field** | ✅ | Need to verify in ContentModal | ⚠️ |
| **Age override** | ✅ `contentAgeOverride` | Need to verify | ⚠️ |
| **Original purchase price** | ✅ | Need to verify | ⚠️ |
| **Disposal status tracking** | ✅ (discard date, reason) | Need to verify | ⚠️ |
| **Enrich override value** | ✅ Manual override in enrich modal | ✅ EnrichModal.tsx exists | ⚠️ |
| Contents summary | ❌ | ✅ (ContentsSummary.tsx) | ✅ |

### Receipts

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Upload + parse | ✅ | ✅ | ✅ |
| Add to inventory | ✅ `addReceiptToInventory()` | ✅ | ✅ |
| **Edit receipt total** | ✅ `editReceiptTotal` | Need to verify in ReceiptModal | ⚠️ |
| Receipt thumbnails | ✅ | ✅ | ✅ |

### Expenses

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| 5 ALE categories (labor, utility, disposal, living, misc) | ✅ | ✅ All 5 in types | ✅ |
| Category breakdown display | ✅ Disclosure sections | ✅ Category breakdown cards | ✅ |
| Weather card integration | ✅ | ✅ WeatherCard.tsx | ✅ |
| Utility estimator | ✅ Fuel-based calculator | ✅ UtilityEstimator.tsx | ✅ |
| **Buffer/contingency toggle** | ❌ Not in v1 | ✅ (new in v2) | ✅ |
| **Hourly rate for labor** | ✅ `expenseLaborHourlyRate` | Need to verify in ExpenseModal | ⚠️ |
| **Fuel usage/price calculator** | ✅ `utilityFuelUsage`, `utilityFuelPrice` | ⚠️ UtilityEstimator.tsx exists | ⚠️ |

### Communications

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Log calls/emails | ✅ | ✅ | ✅ |
| Date, person, summary | ✅ | ✅ | ✅ |
| Follow-up tracking | ✅ | ✅ | ✅ |
| **Phone/email contact field** | ✅ `commContact` | ❌ Missing | ❌ |
| **Promise made checkbox** | ✅ `commPromiseMade` | ❌ Missing | ❌ |
| **Promise fulfilled checkbox** | ✅ `commPromiseFulfilled` | ❌ Missing | ❌ |
| **Promised amount** | ✅ `commPromisedAmount` | ❌ Missing | ❌ |
| **Promised by date** | ✅ `commPromisedByDate` | ❌ Missing | ❌ |
| **Commitments textarea** | ✅ `commPromises` | ❌ Missing | ❌ |
| **Attach files** | ✅ `commFilesInput` | ❌ Missing | ❌ |
| Email draft modal | ✅ | ✅ EmailDraftModal.tsx | ✅ |
| Party (adjuster/contractor/etc) | ✅ | ✅ | ✅ |
| Type (phone/email/in-person) | ✅ | ✅ | ✅ |

### Timeline

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Auto-generated events | ✅ | ✅ | ✅ |
| Event cards | ✅ | ✅ | ✅ |

### Contractors

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| CRUD contractors | ✅ | ✅ | ✅ |
| Report upload | ✅ | ✅ | ✅ |
| AI analysis of reports | ✅ | ✅ | ✅ |
| **Estimate amount field** | ✅ `contractorEstimate` | Need to verify in ContractorModal | ⚠️ |
| **Invoice amount field** | ✅ `contractorInvoice` | Need to verify | ⚠️ |

### Payments

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Add/edit payments | ✅ | ✅ | ✅ |
| Date, amount, type | ✅ | ✅ | ✅ |
| Total received | ✅ | ✅ | ✅ |
| **"What it covered" field** | ✅ (Dwelling/Contents/Mitigation/Multiple) | ❌ Missing | ❌ |
| **Check number / confirmation** | ✅ `paymentCheckNumber` | ❌ Missing | ❌ |
| **Depreciation portion** | ✅ `paymentDepreciation` | ❌ Missing | ❌ |

### Maximizer

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Chat interface | ✅ | ✅ ChatInterface.tsx | ✅ |
| Claim summary cards | ✅ | ✅ | ✅ |
| **PPM cards (Post-Print Maximizer)** | ✅ Grid of improvement opportunities | ❌ Missing | ❌ |
| **Upsell/premium features** | ✅ Accordion lanes | ❌ Missing | ❌ |

---

## 3. PDF GENERATION

| Section | v1 | v2 | Status |
|---------|----|----|--------|
| Cover page | ✅ | ✅ `renderCoverPage` | ✅ |
| Claim overview | ✅ | ✅ `renderClaimOverview` | ✅ |
| Executive summary | ✅ | ✅ `renderExecutiveSummary` | ✅ |
| Cause of loss | ✅ | ✅ `renderCauseOfLoss` | ✅ |
| Statement of claim basis | ✅ | ✅ `renderClaimBasisStatement` | ✅ |
| **Evaluation method section** | ✅ Separate section | ❌ Not found as separate section | ❌ |
| Rooms summary / documentation | ✅ | ✅ `renderRoomDocumentation` | ✅ |
| Floor plan | ✅ | ✅ `renderFloorPlan` | ✅ |
| Contents inventory | ✅ | ✅ `renderContentsInventory` | ✅ |
| **Photo evidence pages** | ✅ Grid of photos with captions | ✅ `renderPhotoEvidence` | ✅ |
| Damage assessment | ✅ | ✅ `renderDamageAssessment` | ✅ |
| Expenses + weather | ✅ | ✅ `renderExpenses` | ✅ |
| **Policy coverage summary** | ✅ | ✅ `renderPolicyCoverage` | ✅ |
| Contractor reports | ✅ With report thumbnails | ✅ `renderContractorReports` | ⚠️ |
| Receipts | ✅ | ✅ `renderReceipts` | ✅ |
| Communications log | ✅ | ✅ `renderCommunicationsLog` | ✅ |
| Payments | ✅ | ✅ `renderPayments` | ✅ |
| Source links | ✅ | ✅ `renderSourceLinks` | ✅ |
| Claim summary (final) | ✅ | ✅ `renderClaimSummary` | ✅ |
| Page footers | ✅ | ✅ `addPageFooters` | ✅ |
| **Incident timeline in PDF** | ✅ | ✅ `renderTimeline` | ✅ |
| Progress overlay during generation | ✅ Custom overlay | ✅ PDFProgress.tsx with zustand store | ✅ |

---

## 4. CORE LOGIC

### Sanitizer

| Rule | v1 | v2 | Status |
|------|----|----|--------|
| Disposition normalization (discard→discarded) | ✅ | ✅ | ✅ |
| surfaceContact "elevated" → "unknown" | ✅ | ✅ | ✅ |
| Undermining pattern detection | ✅ | ✅ Same regex | ✅ |
| Rationale rebuilding | ✅ | ✅ | ✅ |
| **Double-year artifact fix** | ✅ `doubleYearPattern` regex + `fixDoubleYear()` | ❌ Missing — only checks `\d{4},\s*\d{4}` in aiJustification but doesn't fix other fields | ❌ |
| **enrichment.revised.contaminationJustification** | ✅ Checks + fixes | ❌ Missing — v2 sanitizer doesn't check this field | ❌ |
| **Policy re-analysis on sanitize** | ✅ Re-parses policy text with latest regex | ❌ Missing | ❌ |
| **One-time execution guard** | ✅ `sanitizeAIRationale._done` | ❌ No guard — runs on every load | ⚠️ |
| Analysis mode normalization | ✅ | ✅ | ✅ |
| Photo metadata normalization | ✅ | ✅ | ✅ |

### Autosave / Persistence

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Firebase save/load | ✅ | ✅ | ✅ |
| LocalStorage cache | ✅ | ✅ | ✅ |
| Strip large local data for storage | ✅ | ✅ | ✅ |
| Retry on load failure | ✅ | ✅ `loadClaimWithRetry` | ✅ |
| Save status indicator | ✅ | ✅ SaveStatus.tsx | ✅ |

### Auth

| Feature | v1 | v2 | Status |
|---------|----|----|--------|
| Login | ✅ | ✅ | ✅ |
| Logout | ✅ | ✅ | ✅ |
| Create account | ✅ | ✅ | ✅ |
| Auth state persistence | ✅ Firebase onAuthStateChanged | ✅ subscribeToAuth | ✅ |
| Auth guard | ✅ | ✅ AuthGuard.tsx | ✅ |

---

## 5. PRIORITIZED FIX LIST

### P0 — Critical Missing Features (blocks usage)

| # | Issue | File to Change | What to Do |
|---|-------|----------------|------------|
| 1 | **Wizard: Missing contractor report step** | `wizard/WizardSteps.tsx` | Add step between Receipts and Expenses. Upload contractor reports, AI analyze, show review. Port v1's `renderWizardContractorReportStep()` logic. |
| 2 | **Wizard: Missing contents review step** | `wizard/WizardSteps.tsx` | Add step 11 equivalent before completion. Show AI-found items, let user add missed items. |
| 3 | **Wizard: Missing incident types** | `lib/claimWorkflow.ts` | Add `wind_hail`, `theft`, `vandalism` to `CLAIM_TYPE_OPTIONS`. |
| 4 | **Wizard: Missing description field** | `wizard/WizardSteps.tsx` | Add textarea for brief incident description in step 1. |
| 5 | **Wizard: Missing adjuster fields** | `wizard/WizardSteps.tsx` | Add adjuster name, phone, email to step 2 (claim info). |
| 6 | **Communications: Missing promise tracking** | `tabs/Communications/CommunicationModal.tsx` | Add promisedAmount, promisedByDate, promiseMade, promiseFulfilled, commPromises textarea, file attachments. |
| 7 | **Payments: Missing depreciation/coverage/check#** | `tabs/Payments/PaymentModal.tsx` | Add coverage type dropdown, check number input, depreciation portion input. |

### P1 — Important Missing Features (degrades claim quality)

| # | Issue | File to Change | What to Do |
|---|-------|----------------|------------|
| 8 | **Claim Info: Missing fields** | `tabs/ClaimInfo/ClaimInfo.tsx` | Add: dateReported, deductible, adjuster phone (separate), coverage type, water backup limit, claim status. |
| 9 | **Claim Info: City/State/Zip** | `tabs/ClaimInfo/ClaimInfo.tsx` + `wizard/WizardSteps.tsx` | Add separate city/state/zip fields (v1 has them separate for address parsing). |
| 10 | **Sanitizer: Double-year fix missing** | `lib/sanitizer.ts` | Port v1's `fixDoubleYear()` regex and apply to all rationale fields including enrichment.revised.contaminationJustification. |
| 11 | **Sanitizer: Policy re-analysis missing** | `lib/sanitizer.ts` | Add policy re-analysis step from v1 that re-parses policyInsights.rawPolicyText with latest patterns. |
| 12 | **Floor Plan: No room rotation** | `tabs/FloorPlan/FloorPlanCanvas.tsx` | Add right-click context menu with rotate option. Consider migrating to Konva for parity. |
| 13 | **Wizard: Done step missing checklist** | `wizard/WizardSteps.tsx` step 10 | Replace simple "Workspace ready" with dynamic ✅/○ checklist of what's been captured. |
| 14 | **Wizard: Done step missing PPM teaser** | `wizard/WizardSteps.tsx` step 10 | Port v1's PPM teaser showing "N improvement opportunities found" with estimated value. |
| 15 | **Dashboard: Promise tracker missing** | `tabs/Dashboard/Dashboard.tsx` | Add promise tracker section that shows unfulfilled adjuster commitments from communications. |
| 16 | **Rooms: Missing sqft direct entry** | `tabs/Rooms/RoomModal.tsx` | Add direct sqft input option alongside feet+inches. |
| 17 | **Rooms: Missing price per sqft** | `tabs/Rooms/RoomModal.tsx` | Add pricePerSqFt input. |
| 18 | **Rooms: Missing room type dropdown** | `tabs/Rooms/RoomModal.tsx` + `wizard/WizardSteps.tsx` | Add room type selector (Bedroom, Bathroom, Kitchen, etc.). |

### P2 — UX Polish / Minor Gaps

| # | Issue | File to Change | What to Do |
|---|-------|----------------|------------|
| 19 | **Wizard: No skip links** | `wizard/WizardSteps.tsx` | Add "Skip for now →" links on steps that v1 has them (rooms, receipts, expenses). |
| 20 | **Wizard: No upload progress bars** | `wizard/WizardSteps.tsx` | Add animated progress indicators during file uploads (policy, receipts, AI photos). |
| 21 | **Wizard: Expenses missing misc button** | `wizard/WizardSteps.tsx` step 8 | Add 5th quick-add button for "Misc / Other" expenses. |
| 22 | **Wizard: Expenses missing running total** | `wizard/WizardSteps.tsx` step 8 | Show running total of expenses added so far. |
| 23 | **Wizard: Expenses missing Coverage D pitch** | `wizard/WizardSteps.tsx` step 8 | Add "$500-$2,000+ most homeowners miss" educational text. |
| 24 | **Wizard: Expenses quick-add buttons need descriptions** | `wizard/WizardSteps.tsx` step 8 | Add rich descriptions like v1 ("Track your hours — homeowner labor is reimbursable at $25-$40/hr"). |
| 25 | **Wizard: Room photo step lacks "N of M" indicator** | `wizard/WizardSteps.tsx` step 4 | Show "Kitchen — 1 of 5" instead of dropdown. |
| 26 | **Wizard: Receipt thumbnails missing** | `wizard/WizardSteps.tsx` step 7 | Show uploaded receipt thumbnails instead of just card list. |
| 27 | **Wizard: Policy upload missing skip link** | `wizard/WizardSteps.tsx` step 2 | Add "Skip — I'll enter it manually →". |
| 28 | **AI Builder: Missing photo stacking** | `tabs/AIBuilder/AIBuilder.tsx` | Port drag-to-stack photo grouping from v1. |
| 29 | **Photo Library: Missing picker modal** | `tabs/PhotoLibrary/` | Add modal for picking photos when editing content items (used in v1 for evidence linking). |
| 30 | **Maximizer: Missing PPM cards** | `tabs/Maximizer/Maximizer.tsx` | Port PPM opportunity cards grid showing claim improvement suggestions. |
| 31 | **PDF: Missing evaluation method section** | `components/pdf/PDFSections.ts` | Add dedicated "Evaluation Method" section between rooms and contents (v1 has it). |
| 32 | **Communications: Missing contact phone/email field** | `tabs/Communications/CommunicationModal.tsx` | Add `commContact` field for phone/email of the person spoken to. |

---

## 6. SUMMARY

**Total features audited:** ~130  
**Matching v1:** ~75 (✅)  
**Partially implemented:** ~20 (⚠️)  
**Missing entirely:** ~35 (❌)

**Feature parity estimate:** ~65-70%

### Top 3 biggest gaps:
1. **Wizard is missing 2 entire steps** (contractor reports + contents review) and several critical fields (adjuster info, incident description, 3 claim types)
2. **Communications promise tracking** is completely absent — this is core to the adjuster accountability workflow
3. **Payments** is missing depreciation tracking, coverage categorization, and check numbers — key financial tracking fields

### What v2 does BETTER than v1:
- ✅ Floor plan has connection lines, labels, dimension toggles
- ✅ Expenses has buffer/contingency feature  
- ✅ Room modal has name presets
- ✅ Contents has dedicated summary component
- ✅ Clean component architecture vs monolithic HTML
- ✅ Proper React state management with Zustand
- ✅ TypeScript type safety
