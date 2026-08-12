# Visual Redesign — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the purple/indigo design-token foundation with the new teal/amber system, load a single Geist typeface, and build the five shared `ui/` components (Button, Card, Badge, Icon, EmptyState, PageHeader) that later redesign phases will consume — with zero visual change to any existing page in this plan, since nothing yet imports the new components.

**Architecture:** This is a "foundation" phase per `docs/superpowers/specs/2026-08-12-visual-redesign-design.md`: it only touches `frontend/src/app/globals.css`, `frontend/src/app/layout.tsx`, and adds a new `frontend/src/components/ui/` directory. No existing page component is modified. A confirmed-by-grep fact backs this scope boundary: none of the tokens being changed (`--gradient-primary`, `--shadow-glow`, `--font-display`) are referenced by any `.tsx` file today — every existing page hardcodes its own hex colors inline rather than consuming the CSS custom properties — so this phase is genuinely risk-free to ship on its own. A new `/style-guide` page is added as the manual verification target, since there are no other consumers yet to check visually.

**Tech Stack:** Next.js 15 App Router (`frontend/src`), plain CSS custom properties (no Tailwind/CSS-in-JS), two new dependencies: `geist` (Vercel's font package, native Next.js integration) and `lucide-react` (icon set). No test framework in this repo — verification is `docker compose exec` TypeScript checks per component plus a final manual browse-skill pass, matching the convention used in the subdomain-multitenancy plan.

## Global Constraints

- Every new UI component lives under `frontend/src/components/ui/`, one file per component, each with a named export matching its filename (e.g. `Button.tsx` exports `Button`).
- Reuse the existing CSS class system (`.btn`, `.btn-primary`, `.card`, `.badge`, etc. in `globals.css`) rather than inventing a parallel inline-style system — components apply class names, `globals.css` owns the actual color/spacing values. This keeps hover/focus states working via real CSS (inline `style` objects can't express `:hover`).
- Do not modify any file outside `frontend/src/app/globals.css`, `frontend/src/app/layout.tsx`, `frontend/src/components/ui/*`, `frontend/src/app/style-guide/page.tsx`, and `frontend/package.json`. Later phases redesign individual pages — this plan does not touch them.
- No new automated test framework. Verify components with `docker compose exec -T frontend npx tsc --noEmit` (type-check only) per task, and a final manual pass via the browse skill against the `/style-guide` page.

---

## Task 1: Install `geist` and `lucide-react`

**Files:**
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `geist` and `lucide-react` available as imports for all later tasks in this plan.

- [ ] **Step 1: Install the packages**

```bash
docker compose up -d frontend
docker compose exec -T frontend npm install geist lucide-react
```

- [ ] **Step 2: Verify they're in package.json**

Run: `grep -E "\"geist\"|\"lucide-react\"" frontend/package.json`
Expected: both lines present under `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): add geist and lucide-react dependencies"
```

---

## Task 2: Replace color, gradient, and font design tokens

**Files:**
- Modify: `frontend/src/app/globals.css:8-19` (primary color scale)
- Modify: `frontend/src/app/globals.css:56-61` (gradients block)
- Modify: `frontend/src/app/globals.css:63-71` (shadows block)
- Modify: `frontend/src/app/globals.css:94-97` (typography tokens)

**Interfaces:**
- Produces: `--primary-50`…`--primary-900` now resolve to a teal scale (anchored at `--primary-500: #14b8a6`); new `--amber-50`…`--amber-600` scale; `--gradient-ticket` replaces `--gradient-primary`; `--shadow-glow` removed; `--font-sans`/`--font-display` both resolve to a single Geist-backed value. Consumed by Task 3 (component classes) and Task 4 (font wiring).

- [ ] **Step 1: Replace the primary color scale and add the amber scale**

Find in `frontend/src/app/globals.css`:
```css
  /* Primary Brand Colors */
  --primary-50: #f0f4ff;
  --primary-100: #e0e9ff;
  --primary-200: #c7d6fe;
  --primary-300: #a4b8fc;
  --primary-400: #8093f8;
  --primary-500: #6366f1;
  --primary-600: #4f46e5;
  --primary-700: #4338ca;
  --primary-800: #3730a3;
  --primary-900: #312e81;

  /* Secondary/Accent Colors */
  --accent-teal: #14b8a6;
  --accent-teal-light: #5eead4;
  --accent-cyan: #06b6d4;
```

Replace with:
```css
  /* Primary Brand Colors (teal) */
  --primary-50: #f0fdfa;
  --primary-100: #ccfbf1;
  --primary-200: #99f6e4;
  --primary-300: #5eead4;
  --primary-400: #2dd4bf;
  --primary-500: #14b8a6;
  --primary-600: #0d9488;
  --primary-700: #0f766e;
  --primary-800: #115e59;
  --primary-900: #134e4a;

  /* Amber accent — reserved for "active/serving now" emphasis only,
     not a general secondary color (queue status, current ticket). */
  --amber-50: #fffbeb;
  --amber-100: #fef3c7;
  --amber-200: #fde68a;
  --amber-300: #fcd34d;
  --amber-400: #fbbf24;
  --amber-500: #f59e0b;
  --amber-600: #d97706;

  /* Secondary/Accent Colors */
  --accent-cyan: #06b6d4;
```

(The `--accent-teal`/`--accent-teal-light` tokens are removed because `--primary-*` now *is* teal — keeping both would be a duplicate source of truth for the same color.)

- [ ] **Step 2: Replace the gradients block**

Find:
```css
  /* Gradients */
  --gradient-primary: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
  --gradient-dark: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  --gradient-hero: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --gradient-success: linear-gradient(135deg, #10b981 0%, #059669 100%);
  --gradient-glass: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
```

Replace with:
```css
  /* Gradients — --gradient-ticket is the ONLY gradient new redesigned
     components may use (reserved for the hero ticket-number display).
     --gradient-hero remains for now; it's removed when the pages that
     still consume it are redesigned in a later phase, not here. */
  --gradient-ticket: linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #f59e0b 100%);
  --gradient-dark: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  --gradient-hero: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --gradient-success: linear-gradient(135deg, #10b981 0%, #059669 100%);
  --gradient-glass: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
```

- [ ] **Step 3: Remove the unused `--shadow-glow` token**

Find:
```css
  --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  --shadow-glow: 0 0 40px rgba(99, 102, 241, 0.3);
  --shadow-glow-success: 0 0 40px rgba(16, 185, 129, 0.3);
```

Replace with:
```css
  --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  --shadow-glow-success: 0 0 40px rgba(16, 185, 129, 0.3);
```

(`--shadow-glow` is confirmed unused anywhere in this file or any `.tsx` file — verified via `grep -rn "shadow-glow)" frontend/src` before writing this plan. `--shadow-glow-success` is left alone; it's a semantic success-state glow, not part of the purple/indigo signature.)

- [ ] **Step 4: Collapse the font tokens to a single Geist-backed family**

Find:
```css
  /* Typography */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-display: 'Plus Jakarta Sans', var(--font-sans);
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

Replace with:
```css
  /* Typography — one family everywhere (Geist, loaded via next/font in
     layout.tsx / Task 4 of this plan); --font-display is now just an
     alias so existing CSS/components that reference it keep working. */
  --font-sans: var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-display: var(--font-sans);
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(frontend): replace purple/indigo tokens with teal/amber, collapse font pairing"
```

---

## Task 3: Update button, badge, and ticket-display CSS classes to the new tokens

**Files:**
- Modify: `frontend/src/app/globals.css` (`.btn-primary` block, `.badge-*` block, `.ticket-number-display` block, `.empty-state-icon` block)

**Interfaces:**
- Consumes: `--primary-*`, `--gradient-ticket` from Task 2.
- Produces: `.btn-primary` (flat teal, no gradient/glow), `.badge-neutral` (new class, consumed by Task 7's `Badge` component), `.ticket-number-display` (uses `--gradient-ticket` instead of the removed `--gradient-primary`), `.empty-state-icon` (color-only, sizing now controlled by the icon component's own `size` prop instead of a fixed CSS width/height — consumed by Task 9's `EmptyState` component).

- [ ] **Step 1: Flatten `.btn-primary`**

Find:
```css
.btn-primary {
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-md), 0 4px 14px rgba(99, 102, 241, 0.4);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg), 0 6px 20px rgba(99, 102, 241, 0.5);
}
```

Replace with:
```css
.btn-primary {
  background: var(--primary-500);
  color: white;
  box-shadow: var(--shadow-sm);
}

.btn-primary:hover {
  background: var(--primary-600);
  box-shadow: var(--shadow-md);
}
```

- [ ] **Step 2: Add a `.badge-neutral` class**

Find:
```css
.badge-error {
  background: var(--error-100);
  color: var(--error-600);
}
```

Replace with:
```css
.badge-error {
  background: var(--error-100);
  color: var(--error-600);
}

.badge-neutral {
  background: var(--gray-100);
  color: var(--gray-700);
}
```

- [ ] **Step 3: Point `.ticket-number-display` at `--gradient-ticket`**

Find:
```css
.ticket-number-display {
  font-family: var(--font-mono);
  font-size: 6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 4px 30px rgba(99, 102, 241, 0.3);
}
```

Replace with:
```css
.ticket-number-display {
  font-family: var(--font-mono);
  font-size: 6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: var(--gradient-ticket);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 4px 30px rgba(20, 184, 166, 0.3);
}
```

- [ ] **Step 4: Let icon components control empty-state icon sizing instead of fixed CSS dimensions**

Find:
```css
.empty-state-icon {
  width: 80px;
  height: 80px;
  margin-bottom: var(--space-6);
  color: var(--gray-300);
}
```

Replace with:
```css
.empty-state-icon {
  margin-bottom: var(--space-6);
  color: var(--gray-300);
}
```

(Task 9's `EmptyState` component passes `size={48}` directly to the Lucide icon component; a fixed CSS `width`/`height` here would override that via CSS specificity over SVG presentation attributes, so it's removed in favor of the component controlling its own size.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(frontend): flatten button/badge/ticket-display classes to teal token system"
```

---

## Task 4: Wire the Geist font into the root layout

**Files:**
- Modify: `frontend/src/app/layout.tsx`

**Interfaces:**
- Consumes: `geist` package from Task 1; `--font-geist-sans` CSS variable name assumed by Task 2 Step 4.
- Produces: `--font-geist-sans` actually defined at runtime (previously just referenced).

- [ ] **Step 1: Import `GeistSans` and apply its CSS variable to `<html>`**

Find in `frontend/src/app/layout.tsx`:
```typescript
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';

export const metadata: Metadata = {
  title: 'Queue Management System',
  description: 'Professional queue management system for healthcare and services',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
```

Replace with:
```typescript
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';

export const metadata: Metadata = {
  title: 'QueueFlow',
  description: 'Professional queue management system for healthcare and services',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
```

(The `<title>` rename to "QueueFlow" is the one small piece of the naming-unification goal that belongs in this foundation phase, since it's a one-line change in the file this task already touches. The rest of the QMS→QueueFlow rename — sidebar branding, `LoginPage.tsx`'s `logoText`, etc. — happens in Phase 2 per the design spec's rollout order, since those are page-level changes outside this plan's file scope.)

- [ ] **Step 2: Verify the app builds and the font variable resolves**

```bash
docker compose exec -T frontend npx tsc --noEmit
```
Expected: no new TypeScript errors (the `geist` package ships its own types).

Then, with the stack running (`docker compose up -d`), open `http://localhost:8003` in the browse skill and inspect computed styles:
```bash
B="/c/Users/harri/.claude/skills/gstack/browse/dist/browse"
$B goto http://localhost:8003
$B eval "getComputedStyle(document.documentElement).getPropertyValue('--font-geist-sans')"
```
Expected: a non-empty font-family string (not empty/undefined) — confirms Geist is actually loaded and the CSS variable resolves.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/layout.tsx
git commit -m "feat(frontend): load Geist font, rename page title to QueueFlow"
```

---

## Task 5: Build the `Button` component

**Files:**
- Create: `frontend/src/components/ui/Button.tsx`

**Interfaces:**
- Consumes: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-sm`, `.btn-lg` CSS classes (already exist in `globals.css`; `.btn-primary` updated by Task 3).
- Produces: `Button` component, `ButtonProps`, `ButtonVariant`, `ButtonSize` — consumed by Task 9 (`EmptyState`) and every page in later redesign phases.

- [ ] **Step 1: Write the component**

`frontend/src/components/ui/Button.tsx`:
```tsx
'use client';

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}) => {
  const classes = ['btn', variantClass[variant], sizeClass[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <button {...rest} className={classes}>
      {children}
    </button>
  );
};

export default Button;
```

- [ ] **Step 2: Type-check**

```bash
docker compose exec -T frontend npx tsc --noEmit
```
Expected: no errors referencing `Button.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/Button.tsx
git commit -m "feat(frontend): add shared Button component"
```

---

## Task 6: Build the `Card` component

**Files:**
- Create: `frontend/src/components/ui/Card.tsx`

**Interfaces:**
- Consumes: `.card`, `.card-hover` CSS classes (already exist in `globals.css`, unchanged by this plan).
- Produces: `Card` component, `CardProps` — consumed by later redesign phases.

- [ ] **Step 1: Write the component**

`frontend/src/components/ui/Card.tsx`:
```tsx
'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  hoverable = false,
  className = '',
  children,
  ...rest
}) => {
  const classes = ['card', hoverable ? 'card-hover' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div {...rest} className={classes}>
      {children}
    </div>
  );
};

export default Card;
```

- [ ] **Step 2: Type-check**

```bash
docker compose exec -T frontend npx tsc --noEmit
```
Expected: no errors referencing `Card.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/Card.tsx
git commit -m "feat(frontend): add shared Card component"
```

---

## Task 7: Build the `Badge` component

**Files:**
- Create: `frontend/src/components/ui/Badge.tsx`

**Interfaces:**
- Consumes: `.badge`, `.badge-primary`, `.badge-success`, `.badge-warning`, `.badge-error`, `.badge-neutral` CSS classes (`.badge-neutral` added by Task 3).
- Produces: `Badge` component, `BadgeProps`, `BadgeTone` — consumed by later redesign phases (queue status, subscription plan tags, superadmin org status).

- [ ] **Step 1: Write the component**

`frontend/src/components/ui/Badge.tsx`:
```tsx
'use client';

import React from 'react';

export type BadgeTone = 'primary' | 'success' | 'warning' | 'error' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClass: Record<BadgeTone, string> = {
  primary: 'badge-primary',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
  neutral: 'badge-neutral',
};

export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  className = '',
  children,
  ...rest
}) => {
  const classes = ['badge', toneClass[tone], className].filter(Boolean).join(' ');

  return (
    <span {...rest} className={classes}>
      {children}
    </span>
  );
};

export default Badge;
```

- [ ] **Step 2: Type-check**

```bash
docker compose exec -T frontend npx tsc --noEmit
```
Expected: no errors referencing `Badge.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/Badge.tsx
git commit -m "feat(frontend): add shared Badge component"
```

---

## Task 8: Build the `Icon` component

**Files:**
- Create: `frontend/src/components/ui/Icon.tsx`

**Interfaces:**
- Consumes: `lucide-react` (`LucideIcon` type) from Task 1.
- Produces: `Icon` component, `IconProps` — standardizes default size/stroke-width so every icon in the app looks consistent regardless of which page renders it. Consumed by later redesign phases wherever a raw emoji is being replaced.

- [ ] **Step 1: Write the component**

`frontend/src/components/ui/Icon.tsx`:
```tsx
'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({
  icon: IconComponent,
  size = 20,
  color,
  strokeWidth = 2,
  className,
}) => {
  return (
    <IconComponent
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
    />
  );
};

export default Icon;
```

- [ ] **Step 2: Type-check**

```bash
docker compose exec -T frontend npx tsc --noEmit
```
Expected: no errors referencing `Icon.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/Icon.tsx
git commit -m "feat(frontend): add shared Icon component wrapping lucide-react"
```

---

## Task 9: Build the `EmptyState` component

**Files:**
- Create: `frontend/src/components/ui/EmptyState.tsx`

**Interfaces:**
- Consumes: `Button` from Task 5; `.empty-state`, `.empty-state-title`, `.empty-state-description`, `.empty-state-icon` CSS classes (`.empty-state-icon` updated by Task 3); `LucideIcon` type from `lucide-react`.
- Produces: `EmptyState` component, `EmptyStateProps` — replaces the empty-state JSX currently duplicated across 8 page components (`AdminLocationsPage.tsx`, `AdminQRPage.tsx`, `AdminSettingsPage.tsx`, `AnalyticsPage.tsx`, `DashboardPage.tsx`, `app/admin/flow-designer/page.tsx`, `app/admin/service-points/page.tsx`, `QueueManagementPage.tsx`) when those pages are redesigned in a later phase. This plan only builds the component — it does not yet touch those 8 files.

- [ ] **Step 1: Write the component**

`frontend/src/components/ui/EmptyState.tsx`:
```tsx
'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: IconComponent,
  title,
  description,
  action,
}) => {
  return (
    <div className="empty-state">
      <IconComponent size={48} strokeWidth={1.5} className="empty-state-icon" />
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action && (
        <Button
          variant="primary"
          size="md"
          onClick={action.onClick}
          style={{ marginTop: '1.5rem' }}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
```

- [ ] **Step 2: Type-check**

```bash
docker compose exec -T frontend npx tsc --noEmit
```
Expected: no errors referencing `EmptyState.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/EmptyState.tsx
git commit -m "feat(frontend): add shared EmptyState component"
```

---

## Task 10: Build the `PageHeader` component

**Files:**
- Create: `frontend/src/components/ui/PageHeader.tsx`

**Interfaces:**
- Produces: `PageHeader` component, `PageHeaderProps` — replaces the purple gradient banner currently repeated across the dashboard and ~10 `/admin/*` pages, when those pages are redesigned in a later phase. This plan only builds the component.

- [ ] **Step 1: Write the component**

`frontend/src/components/ui/PageHeader.tsx`:
```tsx
'use client';

import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '1rem',
        paddingBottom: '1.5rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--gray-200)',
      }}
    >
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: '0.9375rem', color: 'var(--gray-500)', marginTop: '0.375rem' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
```

- [ ] **Step 2: Type-check**

```bash
docker compose exec -T frontend npx tsc --noEmit
```
Expected: no errors referencing `PageHeader.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/PageHeader.tsx
git commit -m "feat(frontend): add shared PageHeader component"
```

---

## Task 11: Barrel export and style-guide verification page

**Files:**
- Create: `frontend/src/components/ui/index.ts`
- Create: `frontend/src/app/style-guide/page.tsx`

**Interfaces:**
- Consumes: `Button`, `Card`, `Badge`, `Icon`, `EmptyState`, `PageHeader` from Tasks 5–10.
- Produces: `frontend/src/components/ui` as a single import path (`import { Button, Card, ... } from '@/components/ui'`) for later phases; a `/style-guide` route that renders every component/variant for manual visual verification.

- [ ] **Step 1: Write the barrel export**

`frontend/src/components/ui/index.ts`:
```typescript
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Card } from './Card';
export type { CardProps } from './Card';

export { Badge } from './Badge';
export type { BadgeProps, BadgeTone } from './Badge';

export { Icon } from './Icon';
export type { IconProps } from './Icon';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps, EmptyStateAction } from './EmptyState';

export { PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';
```

- [ ] **Step 2: Write the style-guide page**

`frontend/src/app/style-guide/page.tsx`:
```tsx
'use client';

import React from 'react';
import { Building2, Inbox, Settings } from 'lucide-react';
import { Button, Card, Badge, PageHeader, EmptyState } from '@/components/ui';

export default function StyleGuidePage() {
  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem' }}>
      <PageHeader
        title="Style Guide"
        subtitle="Internal reference for the shared UI component set — not linked from app navigation."
        actions={<Button variant="secondary" size="sm">Secondary action</Button>}
      />

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Buttons</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="primary" size="sm">Primary sm</Button>
          <Button variant="primary" size="md">Primary md</Button>
          <Button variant="primary" size="lg">Primary lg</Button>
          <Button variant="secondary" size="md">Secondary</Button>
          <Button variant="ghost" size="md">Ghost</Button>
        </div>
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Badges</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Badge tone="primary">Primary</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="error">Error</Badge>
          <Badge tone="neutral">Neutral</Badge>
        </div>
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Cards</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <Card style={{ padding: '1.5rem' }}>Static card</Card>
          <Card hoverable style={{ padding: '1.5rem' }}>Hoverable card</Card>
        </div>
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Empty state</h2>
        <Card>
          <EmptyState
            icon={Inbox}
            title="No items yet"
            description="This is the shared empty-state pattern that replaces the 8 duplicated inline copies across the admin pages."
            action={{ label: 'Create one', onClick: () => {} }}
          />
        </Card>
      </section>

      <section>
        <h2 style={{ marginBottom: '1rem' }}>Icons</h2>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Building2 size={24} />
          <Settings size={24} />
          <Inbox size={24} />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
docker compose exec -T frontend npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/index.ts frontend/src/app/style-guide/page.tsx
git commit -m "feat(frontend): add ui barrel export and style-guide verification page"
```

---

## Task 12: Full manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: Start the stack**

```bash
docker compose up -d
```

- [ ] **Step 2: Visually verify the style guide with the browse skill**

```bash
B="/c/Users/harri/.claude/skills/gstack/browse/dist/browse"
$B goto http://localhost:8003/style-guide
$B wait --networkidle
$B screenshot
$B text
```
Expected: screenshot shows flat teal primary buttons (no gradient, no glow), gray secondary/ghost buttons, five flat-color badges (no gradient), two cards (one with a hover-lift affordance on mouseover, one without), the empty-state pattern with a real Lucide `Inbox` icon (not an emoji) and a working "Create one" button, and three individually-rendered Lucide icons. Page text contains "No items yet" and "This is the shared empty-state pattern...".

- [ ] **Step 3: Confirm no existing page changed visually**

```bash
$B goto http://localhost:8003
$B wait --networkidle
$B screenshot
```
Expected: landing page renders exactly as before this plan — still purple/indigo, still has emoji icons. This is intentional: Task 2's grep-verified fact was that no existing page consumes the tokens this plan changed, so nothing outside `/style-guide` should look different yet. If anything on this page looks different, something in this plan touched a file it shouldn't have — investigate before proceeding.

**Note on "zero visible change":** the landing page check above proves the landing page didn't change, not that nothing changed anywhere. The landing page is almost entirely styled-jsx with hardcoded purple hex values, so it was never going to show drift regardless of the token work in this plan. Two things genuinely do change globally, across every existing page, the moment this branch ships: (a) the Geist font is now actually loaded — previously `'Inter'`/`'Plus Jakarta Sans'` were referenced in CSS but never loaded via `next/font`/`@import`/`<link>` anywhere in the repo, so `--font-sans` silently fell back to system fonts everywhere; now every page gets real Geist type; and (b) any element on any page using the plain global classes (`.btn-primary`, `.badge-*`, `.card`, `.spinner`, bare `<a>` links, `input:focus` ring — all updated in `globals.css` by this branch) picks up the new teal accent instead of the old purple one, unless a page's own styled-jsx/inline styles override it locally. No page's structure, behavior, or layout changes, and no page file itself was edited by this plan — but a page relying on the global font stack or on these unstyled global CSS classes will render with the new teal accent and real Geist type as a direct, intended consequence of the token change, not a regression.

- [ ] **Step 4: Confirm the Geist font is actually applied**

```bash
$B eval "getComputedStyle(document.body).fontFamily"
```
Expected: string starts with the Geist font family name, not a generic system-font fallback.

- [ ] **Step 5: Update the design spec's open items**

In `docs/superpowers/specs/2026-08-12-visual-redesign-design.md`, under "Open items carried into implementation planning", add a note confirming the Geist `next/font`-style integration worked cleanly via the `geist` npm package (resolves that open item).

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-08-12-visual-redesign-design.md
git commit -m "docs: confirm Geist font integration verified in visual redesign phase 1"
```

---

## Explicitly deferred (not built in this plan)

- **Every page-level redesign** (landing page, register/login rename and restyle, dashboard, all `/admin/*` pages, superadmin panel, join/display polish) — these are Phases 2–5 of the design spec's rollout order, each getting its own implementation plan once this foundation phase ships and is verified.
- **Removing `--gradient-hero`** — still consumed by `workspace-not-found/page.tsx` and the current register/login pages; removed only once those pages are redesigned in Phase 2, not here.
- **The QMS→QueueFlow rename** beyond the `<title>` tag changed in Task 4 — sidebar branding, `LoginPage.tsx`'s `logoText`, and any other in-app "QMS" references are a Phase 2 task, since they live in page files this plan doesn't touch.
