# ClaimTracker v2 — CRUD Audit Report

**Generated:** 2026-03-25  
**Scope:** All tab components + all 12 wizard steps  
**Criteria:** Add / Edit / Delete for every user-created list; empty states; modal wiring; button handlers

---

## Summary

| Area | Add | Edit | Delete | Notes |
|------|-----|------|--------|-------|
| Rooms Tab | ✅ | ✅ | ✅ | Fully wired |
| Contents Tab | ✅ | ✅ | ✅ | Fully wired |
| Receipts Tab | ✅ | ✅ | ✅ | Fully wired |
| Expenses Tab | ✅ | ✅ | ✅ | Fully wired |
| Communications Tab | ✅ | ✅ | ❌ | **No delete** |
| Contractors Tab | ✅ | ✅ | ❌ | **No delete for contractors** |
| Payments Tab | ✅ | ✅ | ❌ | **No delete** |
| Timeline Tab | ✅ | ✅ (manual only) | ❌ | **No delete for manual events** |
| Photo Library Tab | ✅ | N/A | ❌ | **No delete for library photos** |
| AI Builder Tab | ✅ | ✅ (mode) | ✅ | Fully wired |
| ClaimInfo Tab | ✅ (upload) | ✅ (fields) | ✅ (docs) | Fully wired |
| Dashboard Tab | N/A | N/A | N/A | Read-only display |
| Floor Plan Tab | N/A | ✅ (drag) | N/A | Layout tool, not CRUD |
| Maximizer Tab | N/A | N/A | N/A | Chat interface |
| Wizard Step 3 (Rooms) | ✅ | ❌ | ✅ | **No edit for wizard rooms** |
| Wizard Step 4 (Photos) | ✅ | N/A | ✅ | OK |
| Wizard Step 5 (Photo Review) | N/A | ✅ (move) | ✅ | OK |
| Wizard Step 7 (Receipts) | ✅ | ❌ | ✅ | **No edit for wizard receipts** |
| Wizard Step 8 (Contractors) | ✅ | ❌ | ✅ | **No edit for wizard reports** |
| Wizard Step 9 (Expenses) | ✅ | ❌ | ❌ | **No edit or delete for wizard expenses** |

---

## Tab Components — Detailed Findings

---

### Rooms — Tab

#### Items displayed: Rooms (name, dimensions, photos, notes)
- **Add:** ✅ "Add Room" button opens `RoomModal` in create mode
- **Edit:** ✅ Each `RoomCard` has an "Edit" button → opens `RoomModal` with room data
- **Delete:** ✅ Each `RoomCard` has a "Delete" button → confirmation modal → removes room and unassigns contents
- **Empty state:** ✅ "No rooms added yet. Start with the first affected area."
- **Other issues:** None — fully wired

---

### Contents — Tab

#### Items displayed: Content items (inventory items with name, room, price, quantity, etc.)
- **Add:** ✅ "Add Item" button opens `ContentModal` in create mode
- **Edit:** ✅ Each row/card has "Edit" button → opens `ContentModal` with item data
- **Delete:** ✅ Each row/card has "Delete" button → confirmation modal → removes item
- **Empty state:** ✅ "No contents items match the current search." (for filtered view)
- **Other issues:** None — bulk actions, enrichment, search, sort, pagination all wired

---

### Receipts — Tab

#### Items displayed: Receipts (store, date, line items, total, preview image)
- **Add:** ✅ "Upload Receipt" button + drag-and-drop zone → AI parsing → stored
- **Edit:** ✅ Each receipt has "Edit" button → opens `ReceiptModal` with receipt data (line items editable, add/remove line items)
- **Delete:** ✅ Each receipt has "Delete" button → inline delete (no confirmation modal)
- **Empty state:** ✅ "No receipts uploaded yet."
- **Other issues:** None

---

### Expenses — Tab

#### Items displayed: Expense entries (category, description, amount, date range, line items)
- **Add:** ✅ "Add Expense" button opens `ExpenseModal` in create mode
- **Edit:** ✅ Each `ExpenseCard` has "Edit" button → opens `ExpenseModal` with expense data
- **Delete:** ✅ Each `ExpenseCard` has "Delete" button → inline delete via `removeExpenseEntry`
- **Empty state:** ✅ `EmptyState` component: "No Expenses Yet"
- **Other issues:** None

---

### Communications — Tab

#### Items displayed: Communication log entries (date, type, person, party, summary, follow-ups)
- **Add:** ✅ "Add Entry" button opens `CommunicationModal` in create mode
- **Edit:** ✅ Each `CommunicationCard` has "Edit" button → opens `CommunicationModal` with entry data
- **Delete:** ❌ **MISSING.** No delete button on `CommunicationCard`. Users cannot remove erroneous or duplicate communication entries.
- **Empty state:** ✅ `EmptyState` component: "No Communications Yet"
- **Other issues:**
  - "Draft Email" button is wired and functional (opens `EmailDraftModal`)
  - Follow-up tasks have "Mark Done" but no edit/delete

---

### Contractors — Tab

#### Items displayed: Contractors (name, trade, contact info) + Contractor Reports (findings, recommendations)
- **Add (Contractors):** ✅ "Add Contractor" button opens `ContractorModal` in create mode
- **Edit (Contractors):** ✅ Each contractor card has "Edit" button → opens `ContractorModal`
- **Delete (Contractors):** ❌ **MISSING.** No delete button on contractor cards. Users cannot remove incorrectly added contractors.
- **Add (Reports):** ✅ "Upload Report" button → file upload → AI analysis → stored
- **Edit (Reports):** ❌ **MISSING.** No edit capability for uploaded reports.
- **Delete (Reports):** ❌ **MISSING.** No delete button on report cards. Users cannot remove incorrectly uploaded or duplicate reports.
- **Empty state:** ✅ `EmptyState` for both contractors and reports
- **Other issues:** None

---

### Payments — Tab

#### Items displayed: Payment records (amount, date, payer, type, notes)
- **Add:** ✅ "Add Payment" button opens `PaymentModal` in create mode
- **Edit:** ✅ Each payment card has "Edit" button → opens `PaymentModal` with data
- **Delete:** ❌ **MISSING.** No delete button on payment cards. Users cannot remove duplicate or erroneous payment entries.
- **Empty state:** ✅ `EmptyState`: "No Payments Yet"
- **Other issues:** None

---

### Timeline — Tab

#### Items displayed: Timeline events (auto-generated + manual)
- **Add:** ✅ "Add Event" button opens `EventModal` in create mode
- **Edit:** ✅ Manual events show "Edit Manual Event" button → opens `EventModal`
- **Delete:** ❌ **MISSING.** No delete button for manual timeline events. Auto-generated events correctly lack delete (they're derived), but user-created manual events should be deletable.
- **Empty state:** ✅ `EmptyState`: "No Timeline Events Yet"
- **Other issues:** None

---

### Photo Library — Tab

#### Items displayed: Photos aggregated from rooms, uploads, and AI Builder
- **Add:** ✅ `PhotoUploader` component for uploading to photo library
- **Edit:** N/A (photos don't have editable metadata in this view)
- **Delete:** ❌ **MISSING.** No delete button on photo grid items or preview modal. Users cannot remove individual photos from the library. The only action is "Send to AI Builder" or filtering.
- **Empty state:** ✅ "No photos match the current filter."
- **Other issues:**
  - Preview modal has no delete action either
  - No way to reassign photos to different rooms from this view

---

### AI Builder — Tab

#### Items displayed: AI photos (uploaded/imported for analysis)
- **Add:** ✅ Photo drop zone for uploads + "Import Photo Library" button
- **Edit:** ✅ Per-photo analysis mode dropdown + global mode selector
- **Delete:** ✅ Each `PhotoStack` has delete handler → removes photo and associated results
- **Empty state:** ✅ "No AI Builder photos yet."
- **Other issues:** None — stacking, unstacking, pre-screen, batch analysis all wired

---

### ClaimInfo — Tab

#### Items displayed: Claim detail fields (form) + Policy documents (uploaded files)
- **Add (Fields):** ✅ Form fields auto-save on change
- **Edit (Fields):** ✅ All fields are editable inputs
- **Delete (Fields):** N/A (form fields, not list items)
- **Add (Policy Docs):** ✅ "Upload Documents" button
- **Edit (Policy Docs):** ❌ No edit for document metadata/type classification
- **Delete (Policy Docs):** ✅ Each doc has "Delete" button → removes doc and recomputes insights
- **Empty state:** ✅ "No policy documents uploaded yet."
- **Other issues:** None

---

### Dashboard — Tab

#### Items displayed: Summary cards, readiness checks, milestones (all read-only/derived)
- **Add/Edit/Delete:** N/A — Display-only tab
- **Other issues:** None — all buttons navigate to other tabs or open report modal

---

### Floor Plan — Tab

#### Items displayed: Room layout visualization (drag-and-drop canvas)
- **Add/Edit/Delete:** N/A — Visual layout tool, rooms managed in Rooms tab
- **Other issues:** Room visibility checkboxes work correctly

---

### Maximizer — Tab

#### Items displayed: Chat messages (AI strategy conversation)
- **Add/Edit/Delete:** N/A — Chat interface, messages are conversation flow
- **Other issues:** None

---

## Wizard Steps — Detailed Findings

---

### Wizard Step 1 — Claim Type

#### Items displayed: Claim type selection (radio-style buttons) + description textarea
- **Add/Edit/Delete:** N/A — Single-value selection, not a list
- **Other issues:** None

---

### Wizard Step 2 — Claim Info

#### Items displayed: Form fields (claim number, policy, address, etc.) + policy document upload zone
- **Add/Edit/Delete:** N/A — Form fields auto-save, not list items
- **Other issues:**
  - Policy upload zone works with drag-and-drop and file picker
  - Auto-fills dashboard fields from parsed policy ✅
  - "Skip" link present ✅

---

### Wizard Step 3 — Rooms

#### Items displayed: List of added rooms
- **Add:** ✅ Room name/dimensions form + "Add Room" button
- **Edit:** ❌ **MISSING.** Once a room is added in the wizard, there's no way to edit its name, dimensions, or notes. The room cards only show a "Remove" button. Users must delete and re-add to fix a typo.
- **Delete:** ✅ "Remove" button on each room card
- **Empty state:** ✅ "No rooms added yet."
- **Other issues:** None

---

### Wizard Step 4 — Photos

#### Items displayed: Room photos (per-room upload grid)
- **Add:** ✅ `PhotoUploader` per room + room navigation (←/→)
- **Edit:** N/A (photos don't have editable fields here)
- **Delete:** ✅ Hover "✕" button on each photo thumbnail
- **Empty state:** ✅ "Add rooms in the previous step first"
- **Other issues:** None — room selector grid, upload count, all work

---

### Wizard Step 5 — Photo Review

#### Items displayed: All photos organized by room, with dupe detection
- **Add:** N/A (review step, not upload step)
- **Edit:** ✅ Move-to-room dropdown on each photo (hover)
- **Delete:** ✅ "✕" delete button on each photo (hover)
- **Empty state:** ✅ Per-room "No photos" message with link back to Step 4
- **Other issues:** None — duplicate detection with red DUPE badges works

---

### Wizard Step 6 — Floor Plan

#### Items displayed: Floor plan canvas (same as Floor Plan tab)
- **Add/Edit/Delete:** N/A — Visual tool
- **Other issues:** None

---

### Wizard Step 7 — Receipts

#### Items displayed: Uploaded receipts (parsed cards with thumbnails)
- **Add:** ✅ `PhotoUploader` for receipt upload → AI parsing
- **Edit:** ❌ **MISSING.** No edit capability for receipts in wizard view. Users can't correct parsed store names, dates, or line items until they reach the full Receipts tab.
- **Delete:** ✅ "✕ Delete" button on each receipt card
- **Empty state:** ✅ "No receipts uploaded yet."
- **Other issues:** Parsing status indicator present ✅

---

### Wizard Step 8 — Contractors

#### Items displayed: Uploaded contractor reports (file list)
- **Add:** ✅ `PhotoUploader` for report upload → stored to Firebase
- **Edit:** ❌ **MISSING.** No edit capability for uploaded reports in wizard.
- **Delete:** ✅ "Remove" button on each report entry
- **Empty state:** ✅ "No reports uploaded yet."
- **Other issues:** "Skip" link present ✅

---

### Wizard Step 9 — Expenses

#### Items displayed: Quick-add expense buttons (Cleanup, Utility, Disposal, Living, Other)
- **Add:** ✅ Quick-add category buttons create seeded expense entries
- **Edit:** ❌ **MISSING.** Quick-added expenses cannot be edited from the wizard. Users must navigate to the full Expenses tab.
- **Delete:** ❌ **MISSING.** Quick-added expenses cannot be removed from the wizard. No list of added expenses is shown — only a running total.
- **Empty state:** N/A (buttons always visible)
- **Other issues:**
  - No feedback showing which expenses have been added (only total amount)
  - "Skip" link present ✅

---

### Wizard Step 10 — AI Launch

#### Items displayed: Summary stats (photos ready, AI queue, receipts, expenses)
- **Add/Edit/Delete:** N/A — Launcher step with "Open AI Builder" button
- **Other issues:** None

---

### Wizard Step 11 — Review

#### Items displayed: Contents inventory summary (item count, total value, enriched count)
- **Add/Edit/Delete:** N/A — Summary view with navigation buttons
- **Other issues:** None

---

### Wizard Step 12 — Done

#### Items displayed: Completion checklist + navigation buttons
- **Add/Edit/Delete:** N/A — Checklist display
- **Other issues:** None

---

## Critical Missing CRUD — Priority List

### 🔴 High Priority (Tab-level, affects core workflows)

1. **Communications Tab — No Delete**
   - File: `client/src/tabs/Communications/Communications.tsx`
   - Fix: Add delete button to `CommunicationCard` with confirmation modal

2. **Contractors Tab — No Delete (Contractors)**
   - File: `client/src/tabs/Contractors/Contractors.tsx`
   - Fix: Add delete button to contractor cards

3. **Contractors Tab — No Delete (Reports)**
   - File: `client/src/tabs/Contractors/Contractors.tsx`
   - Fix: Add delete button to report cards

4. **Payments Tab — No Delete**
   - File: `client/src/tabs/Payments/Payments.tsx`
   - Fix: Add delete button to payment cards with confirmation modal

5. **Timeline Tab — No Delete (Manual Events)**
   - File: `client/src/tabs/Timeline/Timeline.tsx`
   - Fix: Add delete button next to "Edit Manual Event" for user-created events

6. **Photo Library Tab — No Delete**
   - File: `client/src/tabs/PhotoLibrary/PhotoLibrary.tsx`
   - Fix: Add delete button on photo cards and/or in preview modal

### 🟡 Medium Priority (Wizard UX gaps)

7. **Wizard Step 3 — No Edit for Rooms**
   - File: `client/src/wizard/WizardSteps.tsx` (case 3)
   - Fix: Add inline edit or edit modal for wizard room cards

8. **Wizard Step 7 — No Edit for Receipts**
   - File: `client/src/wizard/WizardSteps.tsx` (case 7)
   - Fix: Add edit button that opens `ReceiptModal`

9. **Wizard Step 9 — No Edit/Delete for Expenses + No List**
   - File: `client/src/wizard/WizardSteps.tsx` (case 9)
   - Fix: Show list of added expenses below quick-add buttons with edit/delete

### 🟢 Low Priority (Nice-to-have)

10. **Contractor Reports — No Edit (Tab)**
    - File: `client/src/tabs/Contractors/Contractors.tsx`
    - Fix: Add ability to edit report metadata (company name, trade, findings)

11. **Policy Docs — No Edit (ClaimInfo Tab)**
    - File: `client/src/tabs/ClaimInfo/PolicyDocUploader.tsx`
    - Fix: Add ability to reclassify document type

12. **Wizard Step 8 — No Edit for Contractor Reports**
    - File: `client/src/wizard/WizardSteps.tsx` (case 8)
    - Fix: Add edit capability (or note to edit later in Contractors tab)

---

## Other Issues Found

| Issue | Location | Severity |
|-------|----------|----------|
| Receipt delete has no confirmation modal | `Receipts.tsx` line ~108 | Low |
| Expense delete has no confirmation modal | `Expenses.tsx` via `removeExpenseEntry` | Low |
| Wizard Step 9 doesn't show list of added expenses | `WizardSteps.tsx` case 9 | Medium |
| Follow-up tasks (Communications) have no edit/delete | `Communications.tsx` | Low |
| Photo Library preview modal has no management actions | `PhotoLibrary.tsx` | Low |

---

*End of audit.*
