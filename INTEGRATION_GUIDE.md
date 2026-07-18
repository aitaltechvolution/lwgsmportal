# LWGSM Communications System — Integration Guide

> **Update note:** This guide documents an earlier communications-system
> patch. Since then, `src/components/ui/primitives.tsx` has been rebuilt to
> also export `EmptyState`, `SkeletonRow`, `SkeletonCard`, `Modal`,
> `ToggleSwitch`, `ProgressBar`, and `StatCard` (not just `Badge`) — the rest
> of the app depends on those and the build would not compile without them.
> Branding, currency, lecturer-data, tests/exams, and file-security changes
> made after this guide are described in `README.md` instead.

## Files Delivered

### New Components
| File | Purpose |
|------|---------|
| `src/components/NotificationBell.tsx` | Bell icon dropdown for all portals — unread badge, mark-as-read, realtime |
| `src/components/AnnouncementsWidget.tsx` | Dashboard widget showing latest 3 announcements |
| `src/components/ui/primitives.tsx` | Shared Badge component |

### Updated Layouts (drop-in replacements)
| File | Changes |
|------|---------|
| `src/components/PortalLayout.tsx` | ✅ NotificationBell in topbar • LWGSM branding • bilingual lang toggle |
| `src/components/AdminLayout.tsx` | ✅ Announcements nav item • role="admin" prop |
| `src/components/StudentLayout.tsx` | ✅ Messages + Announcements nav • unread badge count |
| `src/components/LecturerLayout.tsx` | ✅ Messages + Announcements nav • unread badge count |

### New Pages
| File | Route | Description |
|------|-------|-------------|
| `src/pages/shared/MessagesPage.tsx` | (shared) | Split-pane messaging UI — reused by all roles |
| `src/pages/shared/AnnouncementsPage.tsx` | (shared) | Read-only announcements list — used by all roles |
| `src/pages/student/Messages.tsx` | `/student/messages` | Student messaging (can message lecturers + admins) |
| `src/pages/lecturer/Messages.tsx` | `/lecturer/messages` | Lecturer messaging (can message students + admins) |
| `src/pages/admin/Messages.tsx` | `/admin/messages` | Admin messaging (can message anyone) |
| `src/pages/student/Announcements.tsx` | `/student/announcements` | Student announcement viewer |
| `src/pages/lecturer/Announcements.tsx` | `/lecturer/announcements` | Lecturer announcement viewer |
| `src/pages/admin/Announcements.tsx` | `/admin/announcements` | Admin create + view announcements |

### Database
| File | Purpose |
|------|---------|
| `supabase_communications.sql` | Run in Supabase SQL Editor — creates messages + announcements tables with RLS + Realtime |

---

## Step 1 — Run the SQL migration

1. Open your Supabase project → **SQL Editor**
2. Paste and run `supabase_communications.sql`
3. Go to **Database → Replication** and confirm `messages` and `announcements` are listed under supabase_realtime

---

## Step 2 — Add routes to your App.tsx / router

```tsx
// In your router, add:
import StudentMessages     from "@/pages/student/Messages";
import LecturerMessages    from "@/pages/lecturer/Messages";
import AdminMessages       from "@/pages/admin/Messages";
import StudentAnnouncements from "@/pages/student/Announcements";
import LecturerAnnouncements from "@/pages/lecturer/Announcements";
import AdminAnnouncements  from "@/pages/admin/Announcements";

// Student routes:
<Route path="/student/messages"      element={<StudentMessages />} />
<Route path="/student/announcements" element={<StudentAnnouncements />} />

// Lecturer routes:
<Route path="/lecturer/messages"      element={<LecturerMessages />} />
<Route path="/lecturer/announcements" element={<LecturerAnnouncements />} />

// Admin routes:
<Route path="/admin/messages"      element={<AdminMessages />} />
<Route path="/admin/announcements" element={<AdminAnnouncements />} />
```

---

## Step 3 — Replace layout files

Replace your existing layout files with the new versions from this package:
- `src/components/PortalLayout.tsx`
- `src/components/AdminLayout.tsx`
- `src/components/StudentLayout.tsx`
- `src/components/LecturerLayout.tsx`

---

## Step 4 — Add AnnouncementsWidget to dashboards

In each portal's dashboard page, add:

```tsx
import AnnouncementsWidget from "@/components/AnnouncementsWidget";

// Inside the dashboard JSX:
<AnnouncementsWidget role="student" />   // or "lecturer" / "admin"
```

---

## Step 5 — profiles table requirement

The `profiles` table must have these columns (already present in your schema):
- `id` (UUID, FK to auth.users)
- `full_name` (text)
- `role` (text: 'student' | 'lecturer' | 'admin')
- `email` (text)

---

## Features Delivered

### ✅ Notification Bell (all portals)
- Bell icon in every portal topbar
- Red badge with unread count (messages + announcement count)
- Dropdown: latest 5 items (announcements + unread messages)
- Click item → marks message as read
- "Mark all read" button
- Realtime updates via Supabase subscription
- Links to /[role]/messages and /[role]/announcements

### ✅ Internal Messaging
- Split-pane: left = conversations, right = thread
- Avatar initials, last message preview, timestamp, unread dot
- Chat bubbles: orange (sent right) / navy+lavender (received left)
- "New message" with user search by name (role-filtered per user type)
- Send with Enter (Shift+Enter for newline)
- Mark as read on thread open
- Realtime: new messages appear instantly

### ✅ Admin Announcements
- Bilingual form: title EN+FR, body EN+FR
- Target audience: Everyone / Students / Lecturers / Public
- Post immediately or schedule for future
- Published list below the form

### ✅ Viewer Announcements (all roles)
- Role-filtered (only see relevant announcements)
- Collapsible cards with audience badge + date
- Realtime: new announcements appear instantly
- Dashboard widget shows latest 3

### ✅ Name Change
- All layouts now show **LWGSM** and **Living Waters Global School of Ministry**

---

## Messaging Permissions Matrix

| Sender | Can message |
|--------|------------|
| Student | Lecturers, Admins |
| Lecturer | Students, Admins |
| Admin | Everyone |

