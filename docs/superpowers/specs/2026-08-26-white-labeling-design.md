# White-Labeling — Design Spec

**Date:** 2026-08-26
**Status:** Approved, implemented
**Sub-project 5 of 6** in the usage-based billing platform initiative (see
`docs/superpowers/specs/2026-08-25-usage-tracking-limits-design.md` for the
full decomposition). Custom domains (sub-project 6) are handled separately.

## Problem

The plan feature flag `customBranding` has existed since before this
initiative (`subscription.middleware.ts`'s `DEFAULT_FEATURES`) but gates
nothing — no branding feature exists yet. Organizations have no way to
show their own logo/colors or hide "Powered by QueueFlow," which appears
hardcoded on the public join page (4x) and the status/display page (1x).

## Scope

- **Applies to**: the org-subdomain login screen, the public join page,
  and the status/display screen — the surfaces an organization's own
  customers and staff-logging-in actually see. The internal admin
  dashboard UI (sidebar, buttons, etc.) is explicitly out of scope — a
  full per-org theming system for staff-only screens is a much larger
  undertaking than this pass warrants.
- **Logo upload uses a real file storage provider**, not a pasted URL and
  not local disk storage. Configured the same way Stripe/Paystack are:
  superadmin pastes provider credentials into a settings page; works
  today even before real credentials exist (mirrors the existing Stripe
  sandbox-key situation in this project).
- **Gated behind the existing `customBranding` plan feature flag** — no
  new flag needed.

## Data model

```prisma
model Organization {
  // ...existing fields...
  logoUrl       String?
  logoFileId    String?  // provider's file id, used to delete the old logo on replace
  primaryColor  String?  // hex, e.g. "#14b8a6"
  hidePoweredBy Boolean  @default(false)
}

model FileStorageProviderConfig {
  id            String   @id @default(uuid())
  provider      String   // "uploadcare"
  isActive      Boolean  @default(false)
  publicKey     String?
  secretKey     String   // encrypted at rest, same as PaymentProviderConfig
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([provider])
}
```

## File storage provider abstraction

Mirrors `backend/src/services/payments/` exactly:

```typescript
// backend/src/services/fileStorage/types.ts
export interface UploadedFile {
  fileId: string;
  url: string;
}

export interface FileStorageProvider {
  name: string;
  uploadFile(buffer: Buffer, filename: string, mimeType: string): Promise<UploadedFile>;
  deleteFile(fileId: string): Promise<void>;
}
```

`backend/src/services/fileStorage/uploadcare.provider.ts`: uses
Uploadcare's REST API directly via Node's built-in `fetch`/`FormData`/`Blob`
(Node 20, no new dependency needed for the HTTP calls themselves):

- Upload: `POST https://upload.uploadcare.com/base/` with multipart
  `UPLOADCARE_PUB_KEY`, `UPLOADCARE_STORE=1`, and the file. Response:
  `{ file: "<uuid>" }`. Resulting CDN URL: `https://ucarecdn.com/<uuid>/`.
- Delete: `DELETE https://api.uploadcare.com/files/<uuid>/storage/` with
  `Authorization: Uploadcare.Simple <publicKey>:<secretKey>`.

`backend/src/services/fileStorage/index.ts`:
`getProvider()`/`getActiveProviderNames()`, identical shape to
`services/payments/index.ts`.

## Backend endpoints

- **Superadmin** (mirrors `paymentProvider.controller.ts`):
  `GET /superadmin/file-storage`, `PUT /superadmin/file-storage/:provider`,
  `POST /superadmin/file-storage/:provider/test`.
- **Tenant logo upload**: `POST /organizations/:id/logo`, multipart
  (`multer` with `memoryStorage()` — parses the request into a buffer,
  nothing touches local disk). Middleware chain:
  `authorize('SUPER_ADMIN', 'ORG_ADMIN')`, `requireOwnOrganization`,
  `requireFeature('customBranding')`. Validates MIME type
  (png/jpeg/svg+xml/webp) and size (max 2MB) before upload. On success,
  deletes the organization's previous `logoFileId` (if any) via
  `deleteFile`, then updates `logoUrl`/`logoFileId`.
- **`updateOrganization`** (existing endpoint) extended to accept
  `primaryColor` and `hidePoweredBy` alongside its current fields.
- **`getPublicOrganizationBySlug`** and **`getPublicOrganization`**
  (existing, unauthenticated) extended to select and return
  `logoUrl`, `primaryColor`, `hidePoweredBy`.
- **Tenant login**: the org lookup that already happens for the
  org-subdomain login screen is extended the same way.

## Frontend

- **Superadmin "File Storage" page** (`superadmin/file-storage`), same
  shape as the existing Payment Providers page, added to
  `SuperadminLayout`'s nav.
- **AdminSettingsPage**: new "Branding" tab, gated on
  `useSubscription().hasFeature('customBranding')` (existing hook) — shows
  an upgrade prompt when not entitled, consistent with how other
  feature-gated UI in this app behaves. Contains: logo file input +
  upload button (calls the new endpoint directly, no separate "save"
  step since it's already a persisted action), a color input for
  `primaryColor`, and a "Hide 'Powered by QueueFlow'" checkbox (saved via
  the existing `updateOrganization` call alongside other settings fields).
- **Public join page** (`app/join/[code]/page.tsx`) and **status/display
  page** (`app/status/[queueId]/[entryId]/page.tsx`): render the org's
  `logoUrl` when present (in place of/alongside the default QueueFlow
  mark), apply `primaryColor` as the accent color on key interactive
  elements, and wrap each "Powered by QueueFlow" footer in
  `{!org.hidePoweredBy && (...)}`.
- **Tenant login page** (`LoginPage.tsx`): when on an org subdomain (not
  `admin`, not the lookup step), apply the org's logo/primaryColor to the
  branded hero panel.

## Testing

- Unit tests for `UploadcareProvider.uploadFile`/`deleteFile` (mocked
  `fetch`): correct multipart body sent, URL correctly derived from the
  returned file id, delete calls the right endpoint with the right auth
  header.
- Unit tests for the logo upload endpoint: rejects disallowed MIME types;
  rejects oversized files; deletes the previous logo file id on replace;
  404s / 403s for a non-owning org (via the existing
  `requireOwnOrganization` behavior); 403s when `customBranding` isn't on
  the org's plan (via existing `requireFeature` behavior).
- Manual verification: configure the file storage provider (even with a
  placeholder key, to confirm the settings page round-trips like the
  Payment Providers page does); confirm the Branding tab is hidden/shown
  correctly based on plan; confirm `hidePoweredBy` actually removes the
  footer on the join and status pages.

## Out of scope (deferred)

- Theming the internal admin dashboard UI per org.
- Multiple file storage providers active simultaneously (mirrors the
  existing single-active-provider-per-type pattern from payments, which
  this reuses as-is).
- Image resizing/transformation on upload (Uploadcare supports on-the-fly
  CDN transforms via URL parameters if needed later — not built now).
