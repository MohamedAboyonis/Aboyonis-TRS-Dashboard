# TRS Field Ops — Tubular Running Services ERP app

A white-label app for **Tubular Running Services (TRS)** companies. It covers the operations team, field crews, workshop, training and HSE. One build works for any company: on first start the company enters its name, logo, brand colour and drop-down lists, and activates the license key you issue.

It runs on **Android, iOS, Windows and the web** from one code base (React + TypeScript, installable PWA, wrapped with Capacitor for the stores).

The original Excel dashboard (`TRS_Operation Full Dashboard.xlsx`) is kept in the repo. Its daily-log rows are imported as demo jobs, and the app's dashboard calculates the same KPIs: revenue, NPT %, joints per productive hour, and average revenue per job.

---

## Modules

| Module | Who | What |
|---|---|---|
| **Dashboard** | Management / Ops | KPIs (revenue, NPT %, joints/hr, completion), rig board, alerts for expiring certificates, overdue maintenance, pending leave, open preparations and HSE events |
| **Rigs** | Operations | List of rigs with status, **current operation** and a queue of **next operations**. "▶ Start" moves the next operation to current, archives the old one to history, and sets the linked job to *In Progress* |
| **Jobs** | Operations | Job register that replaces the Excel daily log: job no., rig, customer, well, service and tool type, **one or more sizes**, revenue, hours, joints, NPT. Exports to CSV |
| **My Work** | Field / Workshop | Technicians choose their **name and ID from a drop-down**, register on a job, and their **timesheet fills in automatically**. They request **vacation or sick leave** (with an attachment) and see their certificates |
| **Timesheets** | Operations | Monthly grid for each department. Ops tap a day to add or remove **safety day, absent, workshop day, training, standby, office, day off…**, or use **Bulk mark** for many people at once. Edited days show ✎ and can be undone. Exports to CSV for payroll |
| **Leave** | Ops / HR | Approve or reject requests. Approved leave appears on the timesheet straight away |
| **Workshop** | Workshop | Job preparation by **job number, rig and several sizes** (connection, weight, quantity), with linked equipment, assigned team, checklist with progress, and status (Requested → In Preparation → Ready → Dispatched → Returned) |
| **Training & HSE** | HSE / Training | Certificate expiry tracker, **training matrix** (required certificates per position), requirements editor, HSE event log (observation, near miss, first aid…) |
| **People** | All | Each technician's profile is linked to **identification (ID/Iqama, passport), HSE certificates and technical certificates**, each with a scanned file and expiry date. Also shows training compliance, timesheet and job history |
| **Equipment** | Workshop / Ops | Equipment register. Each item links to its **maintenance history**, **certificates, COC, load test and NDT reports**, next due date, and the job preparations it was used on |
| **Settings** | Admin | Company profile and **logo**, drop-down lists, **roles**, **users and extra permissions for special people**, **license**, backup/restore, audit log |

### Permissions
Access uses **roles** plus **extra permissions per person**. Default roles are Administrator, Operations, Field Technician, Workshop, and Training & HSE. You can create new roles from 19 permissions (view/manage per module, approve leave, edit timesheets, admin…). To give one person an extra task, such as letting a supervisor approve leave, add that permission to their user without changing their role.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/ (PWA, works offline)
```

On first start, fill in the company form. If you tick **Load demo data**, the demo users can sign in with PIN `1234` (for example `omar` is a field technician, `ahmed` is operations, `tariq` is workshop, `nora` is HSE).

---

## Licensing (you are the vendor)

License keys are **digitally signed** (ECDSA P-256). Only you can create them, and the app checks them offline.

```bash
npm run license:keys
#   → creates license-keys/private.jwk.json   (SECRET: back it up, never commit; it is git-ignored)
#   → writes your public key into src/lib/licensePublicKey.ts (commit this, then rebuild the app)

npm run license:issue -- --company "ACME TRS" --users 50 --expires 2027-12-31 --plan Enterprise
#   → prints a key like  TRS1.eyJjb21wYW55Ij....MEUCIQ...
```

The customer pastes the key in **Settings → License**. A key is bound to the exact company name and shows the plan, maximum users, modules and expiry date. If the key is missing, expired or invalid, the app shows a banner. Until you run `license:keys`, the build runs in *evaluation* mode.

---

## Publishing to the stores

| Store | How |
|---|---|
| **Google Play** | `npx cap add android` → `npm run cap:sync` → open in Android Studio → build a signed AAB → upload |
| **Apple App Store** | `npx cap add ios` → `npm run cap:sync` → open in Xcode (needs a Mac and an Apple Developer account) → archive → upload |
| **Microsoft Store** | Deploy `dist/` to HTTPS hosting, then package it at **pwabuilder.com** (MSIX) and submit through Partner Center. Tauri or Electron are other options |

The app ID is set in `capacitor.config.json` (`com.aboyonis.trsfieldops`). Change it before you publish.

---

## Data & roadmap

**Today:** data is stored **on the device** (IndexedDB) and works fully offline. Attachments (certificate scans, COC, sick notes) are stored the same way. Settings → Data lets you download a full backup and restore it.

**Before rollout to real crews**, the next step is the **cloud backend**, so that the phones of field technicians, the operations office and the workshop all share one live dataset:

1. Create a Supabase (or any PostgreSQL) project and run `supabase/schema.sql`. It contains multi-tenant tables, with **Row Level Security per company** and per permission.
2. Replace the persistence functions in `src/lib/store.ts` (`loadStore` / `persist` / `saveFile`) with API calls. All screens already read and write through this one module.
3. Move sign-in to server authentication. The current username + PIN login is a **local** check and is not a security boundary.
4. Add the license check and user limit on the server.

Other ideas: push notifications for expiring certificates, maintenance due and leave approvals; QR codes on equipment; Arabic (RTL) interface; payroll export formats; customer job tickets in PDF.

## Project layout

```
src/lib/types.ts         data model (mirrors supabase/schema.sql)
src/lib/store.ts         offline store, files, session — swap for cloud sync here
src/lib/permissions.ts   permissions & default roles
src/lib/timesheet.ts     automatic timesheet rules
src/lib/license.ts       license verification
src/lib/seed.ts          demo data (incl. Excel daily log import)
src/pages/*              one file per module
scripts/license.mjs      vendor license tool
supabase/schema.sql      cloud database with row-level security
```
