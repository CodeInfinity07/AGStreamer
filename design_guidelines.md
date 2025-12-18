# Agora Voice Bot - Design Guidelines

## Design Approach

**Selected System**: Material Design 3 with Discord/Slack communication patterns
**Justification**: This real-time voice communication tool requires clear status feedback, information hierarchy, and professional utility focus. Material Design provides robust patterns for forms and status indicators, while Discord/Slack patterns excel at showing live participant states and real-time updates.

**Core Design Principles**:
1. **Clarity First**: Every status, control, and user state must be immediately comprehensible
2. **Real-time Feedback**: Visual indicators that update instantly to reflect connection and audio states
3. **Progressive Disclosure**: Show configuration upfront, reveal controls only when connected
4. **Information Hierarchy**: Critical states (connection status) get prominent treatment

---

## Typography System

**Font Family**: 
- Primary: Inter or System UI stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- Monospace: 'JetBrains Mono' or 'Fira Code' for logs and technical data

**Hierarchy**:
- **Page Title**: 2rem (32px), font-weight 700, letter-spacing -0.02em
- **Section Headers**: 1.25rem (20px), font-weight 600
- **Body Text/Labels**: 0.875rem (14px), font-weight 500
- **Input Text**: 0.9375rem (15px), font-weight 400
- **Status Messages**: 0.9375rem (15px), font-weight 600
- **User List Items**: 0.875rem (14px), font-weight 500
- **Log Entries**: 0.8125rem (13px), font-weight 400, monospace
- **Metadata/Timestamps**: 0.75rem (12px), font-weight 400

---

## Layout System

**Container Structure**:
- Max-width: `max-w-2xl` (672px) for main application container
- Padding: `p-8` on desktop, `p-4` on mobile
- Centered layout with `mx-auto`

**Spacing Primitives** (Tailwind units):
- **Primary spacing**: 4, 6, 8 units for component spacing
- **Micro spacing**: 2, 3 units for internal component elements
- **Section spacing**: 6, 8 units between major sections
- **Form field spacing**: 4 units between fields, 2 units between label and input

**Grid System**:
- Single column layout (this is a focused utility tool)
- Form inputs: Full width `w-full`
- Button groups: Full width stacked, 2 units gap between buttons

---

## Component Library

### 1. Configuration Form Section
- Background treatment: subtle surface elevation
- Padding: `p-6`
- Border radius: `rounded-xl`
- Form groups: `space-y-4` vertical spacing
- Labels: Display block, margin-bottom 2 units
- Inputs:
  - Full width with `h-12` height
  - Border radius: `rounded-lg`
  - Padding: `px-4`
  - Border width: 2px
  - Focus state: prominent border treatment (no color specified)
  - Read-only inputs: distinct background treatment

### 2. Status Display Component
- Prominent positioning below configuration, above actions
- Padding: `py-4 px-6`
- Border radius: `rounded-lg`
- Typography: font-weight 600, centered text
- Icon integration: Leading emoji/icon with 2 unit spacing
- Height: `h-14` for consistent visual weight
- States to design: Disconnected, Connecting (with spinner), Connected, Error

### 3. User List Panel
- Conditional visibility (hidden when no connection)
- Background: surface elevation
- Padding: `p-4`
- Border radius: `rounded-xl`
- Margin: 6 units from surrounding elements
- Header: font-weight 600, margin-bottom 3 units
- User items:
  - Each user: `rounded-lg` container, `p-3` padding
  - Flex layout: space-between for name and status
  - Gap: 2 units between items
  - Speaking indicator: Animated pulse dot (8px diameter, `rounded-full`)
  - User ID: font-weight 600

### 4. Button System
- Primary button (Join):
  - Height: `h-12`
  - Full width
  - Border radius: `rounded-lg`
  - Font-weight: 600
  - Disabled state: reduced opacity, no cursor
  - Loading state: spinner icon with 2 unit margin-right
  
- Secondary buttons (Mute, Leave):
  - Same sizing as primary
  - 2 unit gap between buttons when stacked
  - Icon + text pattern with 2 unit spacing

- Button states:
  - Hover: subtle elevation increase (translate-y by 1px)
  - Active/Pressed: no transform
  - Disabled: reduced opacity (0.5)

### 5. Volume Control Component
- Margin: 6 units top and bottom
- Label: Display block with inline value display
- Slider:
  - Full width `w-full`
  - Height: 6 units for touch-friendly interaction
  - Border radius on track: `rounded-full`
  - Margin-top: 2 units from label

### 6. Logs Console
- Background: dark surface (terminal aesthetic)
- Padding: `p-4`
- Border radius: `rounded-lg`
- Max-height: 200px with overflow-y scroll
- Margin-top: 6 units
- Entry structure:
  - Each log: margin-bottom 1 unit
  - Timestamp: inline, 2 unit margin-right
  - Monospace font throughout
  - Font size: 13px

### 7. Alert Components
- Padding: `py-3 px-4`
- Border radius: `rounded-lg`
- Margin-bottom: 4 units
- Border: 1px solid (matching alert type)
- Icon integration: Leading icon with 2 unit spacing
- Typography: 14px, line-height relaxed for readability
- Types: Info (SDK loading), Warning (configuration hints), Error (SDK failure)

### 8. Loading States
- Spinner: 14px × 14px inline spinner
- Border: 2px
- Border radius: `rounded-full`
- Animation: continuous rotation (1s linear)
- Margin-right: 2 units when paired with text

---

## Responsive Behavior

**Mobile (< 768px)**:
- Container padding: reduce to `p-4`
- Section padding: reduce to `p-4` from `p-6`
- Font sizes: maintain (already optimized)
- Button height: maintain `h-12` for touch

**Desktop (≥ 768px)**:
- Container padding: `p-8`
- Section padding: `p-6`
- Max-width: enforced at `max-w-2xl`

---

## Special Interaction Patterns

### Real-time Updates
- User list: Add new users with subtle fade-in (200ms)
- Status changes: Instant update, no transition delay
- Speaking indicators: Continuous pulse animation (2s cycle)

### Progressive Disclosure
- Controls section: Hidden (`display: none`) until connected
- Users list: Hidden until at least one user joins
- Show/hide transitions: Simple display toggle, no slide animations

### Focus Management
- Form inputs: Clear focus indicators with increased border weight
- Buttons: Visible focus ring for keyboard navigation
- Tab order: Logical top-to-bottom flow through form and controls

---

## Images
**No hero images required** - This is a utility application focused on functionality. All visual feedback comes from status indicators, user lists, and real-time connection states.