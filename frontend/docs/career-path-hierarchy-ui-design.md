# Career Path Hierarchy Browser - UI Design Explanation

## Overview

This document explains the UI design for the hierarchical competency browser feature on the career-path page. This is an **HR-only page** that allows HR personnel to customize career paths for users by selecting which competencies/topics the user should learn. Instead of a simple search bar, HR will see a structured tree view of competencies organized by hierarchical layers, making it easier to understand and select relevant competencies for the user's career path.

---

## Problem Statement

Currently, the career-path page uses a simple search bar. For broad career paths like "Full Stack Development", this creates several issues for HR when selecting competencies for users:

- **Too many options**: Full Stack Development has dozens of sub-competencies and topics
- **No structure**: HR can't see how competencies relate to each other
- **Overwhelming**: HR doesn't know which competencies to select for the user
- **No context**: HR can't see the full scope of the career path hierarchy

## Solution: Hierarchical Tree Browser

Replace the search bar with an **expandable tree view** that shows competencies organized by their hierarchical layers, allowing HR to:

1. **See the full structure** of the user's career path
2. **Browse by layers** (Level 1 → Level 2 → Level 3 → Core Competencies)
3. **Understand relationships** between parent and child competencies
4. **Make informed decisions** about which competencies/topics the user should learn
5. **Track selections** with visual indicators showing what's already been added

---

## UI Layout Structure

### Page Header Section

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                        │
│                                                             │
│  Customize Career Path                                     │
│  Select competencies and topics for the user to learn.     │
└─────────────────────────────────────────────────────────────┘
```

### Hierarchy Browser Section (NEW)

```
┌─────────────────────────────────────────────────────────────┐
│  Browse Competencies by Hierarchy                           │
│  User: John Doe | Target Role: Full Stack Development       │
└─────────────────────────────────────────────────────────────┘
```

### Tree View Structure

```
┌─────────────────────────────────────────────────────────────┐
│  ▶ 📁 Full Stack Development                    [Add]       │
│     Complete web development covering both frontend and     │
│     backend technologies                                     │
│                                                             │
│     ├─ ▶ 📁 Frontend Development                [Add]       │
│     │    Client-side development and user interface         │
│     │    3 sub-competencies                                  │
│     │                                                       │
│     │    ├─ 📄 React Framework                  [Add]       │
│     │    │   Modern JavaScript library for building UIs     │
│     │    │   [✓ Added]                                      │
│     │    │                                                   │
│     │    ├─ 📄 Vue.js                          [Add]       │
│     │    │   Progressive JavaScript framework               │
│     │    │                                                   │
│     │    └─ 📄 Angular                        [Add]       │
│     │       TypeScript-based web application framework      │
│     │                                                       │
│     ├─ ▶ 📁 Backend Development                 [Add]       │
│     │    Server-side development and API creation            │
│     │    3 sub-competencies                                  │
│     │                                                       │
│     │    ├─ 📄 Node.js                        [Add]       │
│     │    │   JavaScript runtime for server-side             │
│     │    │   [✓ Added]                                      │
│     │    │                                                   │
│     │    ├─ 📄 Python Backend                  [Add]       │
│     │    │   Python-based server development                │
│     │    │                                                   │
│     │    └─ 📄 RESTful API Design              [Add]       │
│     │       Designing and implementing REST APIs            │
│     │                                                       │
│     ├─ 📁 Database Management                   [Add]       │
│     │   Database design, implementation, and optimization   │
│     │   2 sub-competencies                                   │
│     │                                                       │
│     └─ 📁 DevOps & Deployment                  [Add]       │
│        CI/CD, containerization, and cloud deployment        │
│        2 sub-competencies                                   │
│                                                             │
│  ────────────────────────────────────────────────────────  │
│  Legend:                                                     │
│  📁 Parent Competency  |  📄 Core Competency  |  ✓ Added    │
└─────────────────────────────────────────────────────────────┘
```

### Topics in User Career Path (Below Tree)

This section displays all the competencies/topics that have been assigned to the user's career path. HR can see what's already been selected and remove any if needed.

```
┌─────────────────────────────────────────────────────────────┐
│  Topics in User Career Path (2 topics)                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ React Framework                          [🗑️ Remove] │   │
│  │ Assigned: Jan 15, 2024                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Node.js                                 [🗑️ Remove] │   │
│  │ Assigned: Jan 15, 2024                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ────────────────────────────────────────────────────────  │
│  [Calculate Gap & Send to Learner AI]                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Visual Design Elements

### 1. **Hierarchy Levels**

Each level has visual distinction:

- **Level 0 (Root)**: Bold, larger text, top-level background
- **Level 1**: Medium weight, slightly indented
- **Level 2+**: Regular weight, progressively more indented
- **Core Competencies**: Blue icon, "Core" badge

### 2. **Icons**

- **📁 Folder Icon**: Parent competency (has children)
- **📄 Document Icon**: Core competency (leaf node, no children)
- **▶ Arrow**: Expand/collapse indicator (rotates 90° when expanded)
- **✓ Checkmark**: Already added to career path

### 3. **Color Coding**

- **Default State**: White/Slate background, gray border
- **Added State**: Emerald background (emerald-50/emerald-900), emerald border
- **Hover State**: Border changes to emerald color
- **Core Badge**: Blue background (blue-100/blue-900)
- **Added Badge**: Emerald background with checkmark

### 4. **Indentation**

- Each level indented by **24px**
- Visual tree structure with connecting lines (optional, can be CSS borders)

### 5. **Buttons**

- **Add Button**: Emerald color, "+" icon, appears when not added
- **Remove Button**: Red color, trash icon, appears when added
- **Expand/Collapse**: Small arrow button, rotates on click

---

## Component Structure

### Main Component: `CareerPathHierarchyBrowser`

**Props:**
- `targetRole` (string): User's career path name (e.g., "Full Stack Development")
- `userId` (string): User ID for API calls (the user whose career path is being customized)
- `onAdd` (function): Callback when HR adds a competency for the user
- `onRemove` (function): Callback when HR removes a competency for the user

**State:**
- `hierarchy` (object): Full competency tree structure
- `expandedNodes` (Set): IDs of expanded nodes
- `addedPaths` (Set): IDs of competencies already in career path
- `loading` (boolean): Loading state

### Sub-Component: `CompetencyNode` (Recursive)

**Props:**
- `competency` (object): Competency data with children
- `level` (number): Current hierarchy level (0, 1, 2, ...)
- `isAdded` (boolean): Whether this competency is in career path
- `onToggle` (function): Expand/collapse handler
- `onAdd` (function): Add to career path handler
- `onRemove` (function): Remove from career path handler
- `expandedNodes` (Set): Currently expanded nodes

**Renders:**
- Expand/collapse button (if has children)
- Competency icon (folder or document)
- Competency name and description
- Badges (Core, Added, sub-competency count)
- Add/Remove button
- Recursively renders children if expanded

---

## User Interactions

### 1. **Expand/Collapse**

- Click the arrow button to expand/collapse a node
- Arrow rotates 90° when expanded
- Children appear with animation (optional)

### 2. **Add Competency** (HR Action)

- HR clicks "Add" button on any competency
- Button changes to "Remove" immediately
- Competency card gets emerald background
- "Added" badge appears
- API call to add competency to user's career path
- Career paths list updates
- This competency is now assigned to the user for learning

### 3. **Remove Competency** (HR Action)

- HR clicks "Remove" button on added competency
- Confirmation dialog (optional): "Remove this competency from the user's career path?"
- Background returns to default
- "Added" badge disappears
- API call to remove from user's career path
- Career paths list updates
- This competency is no longer assigned to the user

### 4. **Bulk Actions**

- **Expand All**: Expands entire tree
- **Collapse All**: Collapses to root only
- **Filter by Level**: Show only Level 1, Level 2, etc. (future enhancement)

### 5. **Search Integration** (Optional)

- Toggle between "Hierarchy View" and "Search View"
- Search bar appears when toggled
- Search results can highlight matching nodes in hierarchy

---

## Data Storage

### Database Table: `user_career_path`

When HR selects competencies from the hierarchy browser for a user, each selected competency is saved as a **separate row** in the `user_career_path` table.

**Current Table Schema:**
```sql
CREATE TABLE user_career_path (
    user_id VARCHAR(255) NOT NULL,
    competency_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id, competency_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (competency_id) REFERENCES competencies(competency_id) ON DELETE CASCADE
);
```

**Current Fields:**
- `user_id`: The user for whom the competency was selected (by HR)
- `competency_id`: The competency ID from the hierarchy (can be any level: root, intermediate, or core)
- `created_at`: Timestamp when HR added the competency to the user's career path

**Key Points:**
- **Many-to-Many Relationship**: One user can have multiple career path competencies, and each competency can be selected by multiple users
- **Composite Primary Key**: The combination of `(user_id, competency_id)` ensures a user can't add the same competency twice
- **Any Level Can Be Added**: HR can select competencies at any hierarchy level:
  - Root level (e.g., "Full Stack Development")
  - Intermediate levels (e.g., "Frontend Development", "Backend Development")
  - **Core competencies** (e.g., "React Framework", "Node.js") - These are leaf nodes marked with `core-competency: true`
- **Core Competencies Are Linked**: Yes, core-competencies are linked to `user_career_path` just like any other competency level. There's no special handling - they're stored the same way: `user_id` + `competency_id`
- **Independent Selections**: Adding a parent competency does NOT automatically add its children, and vice versa. Each competency must be explicitly selected by HR.

---

### ⚠️ Important Question: Should Core-Competencies Link to Root Career Path?

**The Question:** When HR selects a **core-competency** (last level competency, e.g., "React Framework"), should we also store a link to the **root competency** (career path, e.g., "Full Stack Development") in the `user_career_path` table?

**Example Scenario:**
```
Hierarchy:
Full Stack Development (root/career path)
  └── Frontend Development (intermediate)
      └── React Framework (core-competency, last level) ← HR selects this

Should user_career_path store:
Option 1: Only competency_id (React Framework)
Option 2: competency_id (React Framework) + root_career_path_competency_id (Full Stack Development)
```

**Current Answer (Option 1):** No explicit root link is stored. The `user_career_path` table only stores:
- `user_id` + `competency_id` (the competency HR selected - can be root, intermediate, or core)
- The root can be derived by traversing up the hierarchy using `competency_subCompetency` table

#### Option 1: **Current Approach - No Explicit Root Link** ✅ (Recommended for MVP)

**How it works:**
- Only store `user_id` + `competency_id`
- Root relationship can be **derived** by traversing up the `competency_subCompetency` hierarchy
- Use `competencyRepository.getParentCompetencies()` to find the root

**Pros:**
- ✅ Simpler schema (no additional field needed)
- ✅ Works for single career path per user
- ✅ No data redundancy
- ✅ Root can be derived when needed

**Cons:**
- ❌ Requires traversal query (less efficient)
- ❌ Doesn't handle multiple career paths well
- ❌ If a competency belongs to multiple root paths, we can't distinguish

**When to use:**
- User has **one primary career path** (stored in `users.path_career`)
- Competencies are clearly organized in single-root hierarchies
- Performance is acceptable for occasional queries

---

#### Option 2: **Add `root_career_path_competency_id` Field** ✅ (Recommended for Core-Competencies)

**Enhanced Schema:**
```sql
CREATE TABLE user_career_path (
    user_id VARCHAR(255) NOT NULL,
    competency_id VARCHAR(255) NOT NULL,
    root_career_path_competency_id VARCHAR(255) NULL,  -- NEW FIELD: Links to root career path
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id, competency_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (competency_id) REFERENCES competencies(competency_id) ON DELETE CASCADE,
    FOREIGN KEY (root_career_path_competency_id) REFERENCES competencies(competency_id) ON DELETE SET NULL
);
```

**When to Populate `root_career_path_competency_id`:**
- **Always populated** when HR selects a core-competency (last level)
- **Optional** when HR selects intermediate or root level competencies
- **Purpose**: Directly link core-competencies to their root career path for fast queries

**Implementation Logic:**
```javascript
// When HR adds a competency:
if (competency.core_competency === true) {
  // For core-competencies, find and store the root
  const rootCompetency = await findRootCareerPath(competency_id);
  await userCareerPathRepository.create({
    user_id: userId,
    competency_id: competency_id,
    root_career_path_competency_id: rootCompetency.competency_id  // Store root link
  });
} else {
  // For non-core competencies, root link is optional
  await userCareerPathRepository.create({
    user_id: userId,
    competency_id: competency_id,
    root_career_path_competency_id: null  // Can be derived later if needed
  });
}
```

**Pros:**
- ✅ **Fast queries**: "Show all core-competencies for Full Stack Development" (no traversal needed)
- ✅ **Multiple career paths**: User can have selections from different root career paths
- ✅ **Clear context**: Always know which root career path a core-competency belongs to
- ✅ **Better analytics**: Track which root paths are most popular
- ✅ **Filtering**: Easy to filter by root career path
- ✅ **Efficient**: No need to traverse hierarchy for core-competencies (most common selections)

**Cons:**
- ❌ Additional field to maintain
- ❌ Need to find root competency ID when adding core-competencies
- ❌ Slight data redundancy (can be derived, but stored for performance)

**When to use:**
- **Recommended**: When HR primarily selects core-competencies (last level)
- User can have **multiple career paths** (e.g., "Full Stack Development" AND "DevOps")
- Need to **filter/group** selections by root career path
- **Performance** is critical (frequent queries by root path)
- Competencies can belong to **multiple root paths**

---

### Recommendation

**For Core-Competencies: Use Option 2 (Add Root Link)** ✅

**Reasoning:**
1. **HR primarily selects core-competencies**: These are the actual learning topics (last level)
2. **Performance**: Core-competencies are the most frequently queried, so storing root link avoids traversal
3. **Clear relationship**: Direct link between core-competency and root career path
4. **Future-proof**: Supports multiple career paths per user

**Implementation:**
- When HR selects a **core-competency** (last level):
  1. Find the root career path competency by traversing up the hierarchy
  2. Store both `competency_id` (core-competency) AND `root_career_path_competency_id` (root)
- When HR selects **intermediate or root** competencies:
  - Store `competency_id` only (root link can be null or same as competency_id for root)

**Example:**
```javascript
// HR selects "React Framework" (core-competency) for user
// Hierarchy: Full Stack Dev → Frontend Dev → React Framework

await userCareerPathRepository.create({
  user_id: "user-123",
  competency_id: "comp-react-001",           // Core-competency
  root_career_path_competency_id: "comp-fullstack-001"  // Root career path
});
```

**Benefits:**
- Fast query: "Get all core-competencies for Full Stack Development career path"
- No traversal needed for core-competencies
- Clear relationship between learning topics and career path

---

### Example: How Root Linking Works

**Scenario:** User's career path is "Full Stack Development", and HR selects a core-competency "React Framework" for the user.

**Option 1 (Current - No Explicit Root Link):**
```
user_career_path table:
user_id | competency_id (React Framework - core-competency) | created_at
--------|---------------------------------------------------|------------
user-1  | comp-react-001                                   | 2024-01-15

To find root:
1. Get user's path_career = "Full Stack Development" from users table
2. OR traverse hierarchy: React (core) → Frontend Dev → Full Stack Dev (root)
   Using competency_subCompetency table to walk up the tree
```

**Option 2 (With Root Link - Future Enhancement):**
```
user_career_path table:
user_id | competency_id (React - core) | root_career_path_competency_id (Full Stack) | created_at
--------|------------------------------|----------------------------------------------|------------
user-1  | comp-react-001               | comp-fullstack-001                          | 2024-01-15

To find root: Direct lookup, no traversal needed!
```

**Important:** For core-competencies (last level), we **recommend storing the root link** (`root_career_path_competency_id`) because:
1. HR primarily selects core-competencies as learning topics
2. These need to be linked back to the root career path for efficient queries
3. The root relationship is critical for understanding which career path the competency belongs to

The `core-competency: true` flag is stored in the `competencies` table, and when a core-competency is added to `user_career_path`, we should also store its root career path competency ID.

**Example Data:**
```
user_id                              | competency_id        | created_at
-------------------------------------|---------------------|-------------------
550e8400-e29b-41d4-a716-446655440000| comp-react-001      | 2024-01-15 10:30:00
550e8400-e29b-41d4-a716-446655440000| comp-nodejs-001     | 2024-01-15 10:31:00
550e8400-e29b-41d4-a716-446655440000| comp-frontend-001   | 2024-01-15 10:32:00
```

---

## Data Flow

### Initial Load

```
1. HR opens career-path page for a specific user
2. System gets targetRole from user profile ("Full Stack Development")
3. API call: GET /api/competencies/search?q=Full Stack Development
4. Find matching competency (or closest match)
5. API call: GET /api/competencies/{competencyId}/complete-hierarchy
6. Display hierarchy tree
7. API call: GET /api/user-career-path/{userId}/all
   Returns: Array of { user_id, competency_id, created_at, competency_name, competency_description }
8. Mark already-added competencies in tree (check if competency_id exists in returned array)
```

### Add Competency (HR Action)

```
1. HR clicks "Add" on a competency node (e.g., "React Framework") for the user
2. Optimistic UI update (mark as added immediately, show "Added" badge)
3. API call: POST /api/user-career-path
   Body: { 
     user_id: "550e8400-e29b-41d4-a716-446655440000",  // The user's ID
     competency_id: "comp-react-001"                    // Competency HR is assigning
   }
4. Backend inserts into user_career_path table:
   INSERT INTO user_career_path (user_id, competency_id) 
   VALUES ('550e8400...', 'comp-react-001')
5. On success: 
   - Update career paths list (refresh from API)
   - Keep UI state in sync
   - User now has "React Framework" assigned to their learning path
6. On error (e.g., duplicate): 
   - Revert UI (remove "Added" badge)
   - Show error message: "Failed to add. It may already exist."
```

### Remove Competency (HR Action)

```
1. HR clicks "Remove" on added competency for the user
2. Confirmation dialog: "Remove this competency from the user's career path?"
3. If confirmed:
   - Optimistic UI update (mark as removed immediately)
   - API call: DELETE /api/user-career-path/{userId}/{competencyId}
   - Backend deletes from user_career_path table:
     DELETE FROM user_career_path 
     WHERE user_id = '...' AND competency_id = '...'
4. On success: 
   - Update career paths list (refresh from API)
   - Remove "Added" badge from tree
   - User no longer has this competency in their learning path
5. On error: 
   - Revert UI (restore "Added" badge)
   - Show error message: "Failed to remove career path."
```

---

## Responsive Design

### Desktop (> 1024px)
- Full tree view with all details
- Side-by-side layout possible
- Hover effects enabled

### Tablet (768px - 1024px)
- Tree view with adjusted spacing
- Touch-friendly buttons (larger)
- Collapsed by default, expand on demand

### Mobile (< 768px)
- Simplified view
- Accordion-style (only one branch expanded at a time)
- Stacked layout
- Larger touch targets

---

## Accessibility Features

1. **Keyboard Navigation**
   - Tab through nodes
   - Enter/Space to expand/collapse
   - Arrow keys to navigate tree (future)

2. **Screen Readers**
   - ARIA labels for expand/collapse
   - Role="tree" and role="treeitem"
   - Announcements for add/remove actions

3. **Visual Indicators**
   - High contrast for added items
   - Clear focus states
   - Icon + text labels (not icon-only)

---

## Statistics Display

At the top of the hierarchy browser:

- **Total Competencies**: Count of all nodes in tree
- **Added to Career Path**: Count of selected competencies
- **Progress**: Percentage (Added / Total)

Example: `Total: 12 | Added: 2 | Progress: 17%`

---

## Legend Section

At the bottom of the tree view, show a legend explaining:

- 📁 **Parent Competency**: Has sub-competencies
- 📄 **Core Competency**: Leaf node, no children
- ✓ **Added**: Already in your career path

---

## Example: Full Stack Development Hierarchy

```
Full Stack Development (Level 0)
├── Frontend Development (Level 1)
│   ├── React Framework (Core)
│   ├── Vue.js (Core)
│   └── Angular (Core)
├── Backend Development (Level 1)
│   ├── Node.js (Core)
│   ├── Python Backend (Core)
│   └── RESTful API Design (Core)
├── Database Management (Level 1)
│   ├── SQL Databases (Core)
│   └── MongoDB (Core)
└── DevOps & Deployment (Level 1)
    ├── Docker (Core)
    └── AWS Cloud Services (Core)
```

---

## Benefits of This Design

1. **Structured View**: Users see the complete hierarchy, not just a flat list
2. **Context**: Understand relationships between competencies
3. **Progressive Disclosure**: Expand only what's relevant
4. **Visual Feedback**: Clear indication of what's added
5. **Easy Navigation**: Intuitive expand/collapse
6. **Progress Tracking**: See how much of the career path is covered
7. **Informed Decisions**: Users can see all options before choosing

---

## Future Enhancements

1. **Search Integration**: Toggle between hierarchy and search views
2. **Level Filtering**: Show only specific hierarchy levels
3. **Bulk Selection**: Select multiple competencies before adding
4. **Drag & Drop**: Reorder competencies (if order matters)
5. **Competency Details Modal**: Click to see full details, skills, MGS
6. **Recommendations**: Highlight recommended competencies based on user profile
7. **Progress Visualization**: Show coverage percentage per branch
8. **Export/Share**: Export selected career path structure

---

## Technical Implementation Notes

### API Endpoints Needed

1. **Find Competency by Name**
   - `GET /api/competencies/search?q={careerPathName}&exact=true`
   - Returns closest matching competency

2. **Get Complete Hierarchy** (Already exists)
   - `GET /api/competencies/{competencyId}/complete-hierarchy`
   - Returns full tree with all children recursively

3. **Get User Career Paths** (Already exists)
   - `GET /api/user-career-path/{userId}/all`
   - Returns list of added competencies

### Component Dependencies

- React hooks: `useState`, `useEffect`, `useCallback`
- Next.js: `useRouter` for navigation
- API client: Existing `@/lib/api`
- Styling: Tailwind CSS (existing setup)

### Performance Considerations

- **Lazy Loading**: Load children only when expanded (if tree is very large)
- **Memoization**: Memoize recursive node components
- **Virtual Scrolling**: For very large trees (future optimization)

---

## Conclusion

This hierarchical browser provides a much better experience for HR than a simple search bar when customizing career paths for users. It gives HR:

- **Structure**: See how competencies relate in the hierarchy
- **Context**: Understand the full scope of the career path
- **Control**: Choose which competencies/topics the user should learn
- **Visibility**: Track which competencies have been assigned to the user

The design is intuitive, accessible, and scalable for career paths of any complexity. **Note: This page is HR-only access** - regular users cannot access this page to modify their own career paths.

