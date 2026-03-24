# Constitution — ClaimTracker v2

## Purpose
ClaimTracker is a professional insurance claim management tool for property damage claims. It helps claimants document, organize, and maximize their insurance claims through AI-powered photo analysis, automated item inventories, PDF report generation, and strategic claim building.

## Core Principles

### 1. Accuracy Over Persuasion
All AI-generated content must be factual and defensible. Never fabricate details ("elevated surface", "internal ventilation pathways"). State facts, cite IICRC S500 standards. The insurance adjuster knows what Category 3 contamination means — don't insult their intelligence.

### 2. Data Integrity
- Firebase/Firestore is the source of truth for all claim data
- Local storage serves as offline cache only
- Cloud saves take priority; local is fallback
- No data loss on tab close, refresh, or network interruption

### 3. Professional Output
The PDF report is the product. Everything else exists to feed it. The report must be:
- Comprehensive (42+ pages covering all claim aspects)
- Properly formatted (US date formats, proper currency formatting)
- Legally defensible (source links, photo evidence, IICRC references)
- Print-ready with professional typography and layout

### 4. User Agency
The tool empowers the claimant, not replaces them. AI suggestions are suggestions. Users can override any AI determination. The "Justify My Price" feature defends the user's chosen price — it never changes it.

## Technical Boundaries

### Must Keep
- Firebase Authentication (email/password)
- Firestore as data store (existing data schema, no migration)
- OpenAI API for photo analysis and enrichment (via Express backend)
- jsPDF for PDF generation (client-side)
- Render.com deployment target

### Must Change
- Monolithic 20K-line index.html → modular React + Vite application
- Inline styles → CSS modules or Tailwind
- Global state mutations → proper state management
- 559 global functions → organized component architecture

### Must Not Change
- Firestore document schema (existing claims must load in v2)
- API endpoint contracts (server.js routes stay compatible)
- PDF output format and content structure
- Firebase project configuration

## Users
- **Primary:** Property damage claimants (homeowners) managing insurance claims
- **Secondary:** Public adjusters using the tool on behalf of clients
- **Context:** Users are often stressed, dealing with property damage. The tool must be intuitive and not add cognitive load.

## Success Criteria
v2 is done when:
1. All 14 tabs render and function identically to v1
2. Existing Firestore claims load without modification
3. PDF report output is pixel-comparable to v1
4. AI analysis endpoints work unchanged
5. Performance is equal or better (especially initial load)
6. The codebase is maintainable by a single developer
