# Design Guidelines for Electoral Campaign Management System

## Design Approach

**Selected Framework:** Material Design System
**Rationale:** This is a data-intensive political campaign management platform requiring clear information hierarchy, robust data visualization, and trustworthy professional aesthetics. Material Design provides excellent patterns for enterprise dashboards with strong RTL support for Arabic content.

**Core Principles:**
- Clarity and efficiency for field representatives with varying technical skills
- Professional, trustworthy visual language appropriate for political campaigns
- Information-dense displays with excellent readability
- Mobile-first approach for field workers

---

## Layout System

**RTL Configuration:**
- All layouts must support right-to-left text direction for Arabic
- Navigation, forms, and data tables flow RTL
- Icons and directional indicators mirror appropriately

**Spacing Primitives:**
- Use Tailwind units: 2, 4, 6, 8, 12, 16, 20 for consistent rhythm
- Standard section padding: p-6 (mobile), p-8 (tablet), p-12 (desktop)
- Card spacing: p-6 internal padding, gap-6 between cards
- Form field spacing: mb-6 between fields, gap-4 for inline elements

**Container Widths:**
- Dashboard content: max-w-7xl centered
- Forms and data entry: max-w-2xl for optimal reading
- Full-width tables: w-full with horizontal scroll on mobile
- Sidebar navigation: w-64 (desktop), full-width drawer (mobile)

**Grid Systems:**
- Statistics cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Data tables: Single column with horizontal scroll
- Form layouts: grid-cols-1 md:grid-cols-2 for paired fields

---

## Typography Hierarchy

**Font Selection:**
- Primary: 'Cairo' (Google Fonts) - excellent Arabic display font with multiple weights
- Fallback: system Arabic fonts

**Type Scale:**
```
Page Headers: text-3xl md:text-4xl font-bold
Section Headers: text-2xl font-semibold
Card Titles: text-xl font-semibold
Data Labels: text-sm font-medium uppercase tracking-wide
Body Text: text-base font-normal leading-relaxed
Small Text/Captions: text-sm font-normal
Table Headers: text-sm font-semibold
Stats Numbers: text-4xl md:text-5xl font-bold
```

**Line Height:**
- Headers: leading-tight
- Body content: leading-relaxed
- Data tables: leading-normal

---

## Component Library

### A. Authentication & Access Control

**Login Page:**
- Centered card layout (max-w-md)
- Campaign logo/candidate name at top
- Single input field for User ID
- Primary action button (full-width)
- Minimal, focused design without distractions

### B. Dashboard Navigation

**Top Navigation Bar:**
- Fixed header with h-16
- Campaign branding on right (RTL)
- User profile dropdown on left
- Representative ID display
- Logout option

**Sidebar Navigation (Desktop):**
- Fixed sidebar w-64
- Navigation items with icons from Material Icons
- Active state with subtle background treatment
- Collapsible on tablet

**Mobile Navigation:**
- Bottom navigation bar (fixed)
- 4 primary actions with icons
- Hamburger menu for secondary options

### C. Dashboard Statistics

**Stats Cards Grid:**
- Four-column layout (desktop): Total Voters, Supporters, Opponents, Neutral
- Each card contains:
  - Large number display (text-5xl font-bold)
  - Descriptive label (text-sm)
  - Small trend indicator if applicable
  - Icon representing category
- Elevated cards with shadow-md, rounded-lg corners
- Padding: p-6

**Charts & Visualizations:**
- Bar chart showing daily collection progress
- Pie chart for stance distribution
- Map view showing voter locations (using Leaflet.js)
- Timeline of recent submissions

### D. Data Tables

**Voter List Table:**
- Responsive table with horizontal scroll on mobile
- Sticky header row
- Columns: Photo thumbnail, Name, National ID, Family Name, Phone, Location link, Stance, Representative, Timestamp
- Row actions: View details, Edit, Delete
- Pagination: 25 entries per page
- Search and filter controls above table
- Sort by any column header

**Table Styling:**
- Header: bg-treatment with text-sm font-semibold
- Rows: Alternating subtle background (even rows)
- Borders: border-b on rows for separation
- Cell padding: px-6 py-4
- Hover state on rows

### E. Forms & Data Entry (Telegram Bot Interface)

**Step-by-step Flow Design:**

**Step 1: Welcome & ID Verification**
- Greeting message with candidate name
- Representative ID confirmation
- "Start Collection" button

**Step 2: ID Card Upload**
- Clear instruction: "Upload voter's national ID card"
- Camera button (Telegram native)
- Preview uploaded image
- Processing indicator during OCR
- Auto-extracted data displayed for confirmation

**Step 3: Location Collection**
- "Share Voter Location" message
- Telegram location share button
- Map preview after sharing

**Step 4: Additional Information**
- Family name input field
- Phone number input (with validation message: "11 digits starting with 0 or 1")
- Real-time validation feedback

**Step 5: Stance Selection**
- Question: "What is the voter's political stance?"
- Three button options in grid:
  - "Supporter" button
  - "Opponent" button  
  - "Neutral" button
- Large touch targets (min-h-12)

**Step 6: Confirmation**
- Summary of all collected data
- "Submit" and "Cancel" buttons
- Success message with next action

**Input Field Styling:**
- Labels: text-sm font-medium mb-2
- Input fields: border rounded-lg px-4 py-3 text-base
- Focus state: border enhancement
- Error state: border treatment with error message below
- Helper text: text-sm opacity-70

**Button Styling:**
- Primary action: Full-width rounded-lg px-6 py-3 font-semibold
- Secondary action: Similar size with outline variant
- Telegram inline buttons: 3-column grid with gap-2
- Touch targets: min-h-12 for mobile accessibility

### F. Detail Views

**Voter Detail Modal:**
- Modal overlay with max-w-3xl container
- ID card image on right (RTL), details on left
- Information grid:
  - National ID
  - Full name
  - Family name
  - Phone number
  - Political stance (with visual indicator)
  - Location (embedded map)
  - Collection date/time
  - Representative name
- Edit and Delete action buttons at bottom

**Representative Performance View:**
- Individual rep statistics
- Daily collection chart
- Recent submissions list
- Average processing time

### G. Feedback & Status Indicators

**Loading States:**
- Skeleton screens for tables (shimmer effect)
- Spinner for OCR processing
- Progress bar for data uploads

**Success/Error Messages:**
- Toast notifications (top-right for LTR, top-left for RTL)
- Auto-dismiss after 4 seconds
- Icons indicating status
- Clear, concise messaging in Arabic

**Data Validation:**
- Inline validation as user types
- Clear error messages below fields
- Success checkmark when valid

---

## Responsive Breakpoints

- Mobile: < 768px (single column, bottom nav, full-width cards)
- Tablet: 768px - 1023px (2-column grids, drawer nav)
- Desktop: ≥ 1024px (multi-column, sidebar nav, 4-column stats)

---

## Icons

**Icon Library:** Material Icons (via CDN)

**Usage:**
- Navigation: home, people, analytics, settings, logout
- Statistics: trending_up, person_add, how_to_vote
- Actions: add, edit, delete, search, filter, download
- Status: check_circle, error, warning, info
- Forms: camera, location_on, phone, person

**Icon Sizes:**
- Navigation: text-2xl (24px)
- Cards/buttons: text-xl (20px)
- Table actions: text-lg (18px)
- Inline text: text-base (16px)

---

## Accessibility Standards

- WCAG 2.1 AA compliance
- Keyboard navigation throughout
- ARIA labels on all interactive elements (Arabic)
- Focus indicators clearly visible
- Sufficient contrast ratios
- Touch targets minimum 44x44px
- Screen reader friendly (RTL aware)
- Form validation with clear error messaging

---

## Images

**Dashboard:**
- No hero image required
- Candidate logo/photo in header (150x150px, circular crop)
- Voter ID card thumbnails in table (80x80px)
- Full ID card images in detail view (max 800px width)

**Telegram Bot:**
- Welcome image: Candidate photo with campaign branding (800x400px)
- Success confirmation: Checkmark graphic or candidate thank you image