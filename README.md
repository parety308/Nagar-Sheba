# 🏙️ Nagar Sheba — City Complaint & Service Request Platform

> A backend-only RESTful API that lets citizens report civic issues (potholes, water leakage, garbage collection, licensing requests, etc.), routes them to the right city department, tracks them through a full status lifecycle, and handles paid service fees through real payment gateways.

---

## 📖 Table of Contents

- [Problem & Solution](#-problem--solution)
- [Tech Stack](#️-tech-stack)
- [Roles & Permissions](#-roles--permissions)
- [Core Workflow](#-core-workflow)
- [Database Design](#-database-design)
- [API Overview](#-api-overview)
- [Response Format](#-response-format)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Payment Integration](#-payment-integration)
- [Background Jobs](#-background-jobs)
- [Security](#-security)
- [Submission Details](#-submission-details)

---

## 🎯 Problem & Solution

City residents currently report civic issues (road damage, water leaks, waste collection failures, licensing needs) through scattered, informal channels with no tracking, no accountability, and no SLA enforcement. **Nagar Sheba** gives citizens a single place to file a request, gives city staff a queue to work from, and gives administrators oversight, analytics, and audit visibility across every department.

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Runtime & Framework | Node.js, TypeScript, Express.js |
| Database & ORM | PostgreSQL, Prisma ORM (`@prisma/adapter-pg`) |
| Validation | Zod |
| Authentication | JWT (access + refresh, Bearer token), Google OAuth (GCP) |
| Caching / Temp State | Redis (OTP storage, rate-limit backing) |
| File Storage | Multer (memory storage) + Cloudinary |
| Email | Nodemailer (Gmail SMTP) + EJS templates |
| Payments | SSLCommerz, bKash (Tokenized Checkout) |
| Security | Helmet, express-rate-limit, cookie-parser, CORS |
| Code Quality | Biome (lint + format) |
| Deployment | Vercel Serverless / Render |

---

## 👥 Roles & Permissions

Nagar Sheba enforces **3 fixed roles** via a Bearer-token + `auth(...roles)` middleware, backed by a database re-check on every request (blocked/deleted accounts are rejected even with a valid token).

| Role | Description | Key Permissions |
|---|---|---|
| **CITIZEN** | Reports issues and pays applicable fees | Create/cancel/reopen own requests, upload evidence, pay fees, leave feedback, manage own profile |
| **STAFF** | Department field worker assigned to requests | View requests scoped to their own department, move an assigned request `ASSIGNED → IN_PROGRESS → RESOLVED`, attach resolution proof |
| **ADMIN** | Platform operator | Manage departments & categories, provision staff/admin accounts, reassign/override any request status, block/unblock users, view audit logs & dashboard stats |

---

## 🔄 Core Workflow

```text
Citizen
   │
   ▼
Create Service Request  ──(PAID category)──▶  PENDING_PAYMENT ──▶ Payment Gateway
   │                                                                    │
   ▼ (FREE category)                                          success  │  fail/cancel
SUBMITTED  ◀───────────────────────────────────────────────────────────┘
   │
   ▼ (Admin reassigns / Staff picks up)
ASSIGNED  (SLA due date calculated from category.slaHours)
   │
   ▼
IN_PROGRESS
   │
   ▼
RESOLVED ──(citizen reopens within 3 days)──▶ ASSIGNED
   │
   ▼ (auto-closed after 3 days, or manually)
CLOSED

Citizen may CANCEL while PENDING_PAYMENT / SUBMITTED / ASSIGNED (triggers refund if paid)
Admin may override status at any non-terminal point
```

A background job (`requestLifecycleJob`, runs every 15 minutes) automatically:
- Flags any non-terminal request as **overdue** once its `slaDueAt` passes.
- Auto-closes a `RESOLVED` request into `CLOSED` after the 3-day citizen response window elapses.

---

## 🗄️ Database Design

PostgreSQL via Prisma, modeled with a multi-file schema (`prisma/schema/*.prisma`). Key entities:

- **User** — single table for all 3 roles, linked 1:1 to exactly one profile (`CitizenProfile` / `StaffProfile` / `AdminProfile`) based on `role`.
- **Department** → **Category** (fee type, SLA hours) → **ServiceRequest**.
- **ServiceRequest** — the central entity: tracking reference, geolocation, status, SLA due date, overdue flag, soft delete.
- **StatusHistory** — full audit trail of every status transition (`fromStatus → toStatus`, actor, note).
- **Payment** — 1:1 with a `ServiceRequest`, tracks provider, provider reference, amount, status, paid/refunded timestamps.
- **Attachment** — evidence (citizen) or resolution proof (staff), stored on Cloudinary.
- **Feedback** — 1:1 rating + comment, only allowed after `RESOLVED`/`CLOSED`.
- **AuditLog** — actor, action, entity, before/after snapshot — written for all admin-level overrides (status overrides, reassignments, user blocking, staff provisioning).
- **Notification** — in-app/email notification log.

All list-heavy tables carry indexes on their most-queried columns (`status`, `citizenId`, `departmentId`, `assignedStaffId`, `categoryId`, `isOverdue`, `createdAt`) and soft-deletes use a nullable `deletedAt` timestamp rather than hard deletes.

---

## 📡 API Overview

Base path: `/api/v1`. All protected routes require `Authorization: Bearer <accessToken>` (falls back to an httpOnly cookie).

### Auth (`/auth`)
| Method | Endpoint | Access |
|---|---|---|
| POST | `/register` | Public — starts OTP-based citizen registration |
| POST | `/verify-email` | Public — verifies OTP, creates account, returns tokens |
| POST | `/google-login` | Public — Google ID token sign-in/sign-up |
| POST | `/login` | Public |
| POST | `/forgot-password` | Public — sends OTP |
| POST | `/reset-password` | Public — verifies OTP + sets new password |
| GET | `/me` | Authenticated |
| PATCH | `/me` | Authenticated — update profile |
| PATCH | `/me/profile-image` | Authenticated — Cloudinary upload |
| POST | `/refresh-token` | Public (needs valid refresh cookie) |
| POST | `/logout` | Public |

### Departments (`/departments`)
| Method | Endpoint | Access |
|---|---|---|
| GET | `/` | Authenticated — paginated |
| GET | `/:id` | Authenticated |
| POST | `/` | Admin |
| PATCH | `/:id` | Admin |
| DELETE | `/:id` | Admin — soft delete |

### Categories (`/categories`)
| Method | Endpoint | Access |
|---|---|---|
| GET | `/` | Authenticated — paginated, filter by `departmentId` |
| GET | `/:id` | Authenticated |
| POST | `/` | Admin |
| PATCH | `/:id` | Admin |
| DELETE | `/:id` | Admin — soft delete |

### Service Requests (`/requests`)
| Method | Endpoint | Access |
|---|---|---|
| POST | `/` | Citizen — multipart, up to 5 attachments |
| GET | `/` | Authenticated — paginated, filter by status/department/category/overdue, sortable |
| GET | `/search?q=` | Authenticated — search by title/tracking ref |
| GET | `/:id` | Authenticated — scoped by role |
| POST | `/:id/cancel` | Citizen (owner only) |
| PATCH | `/:id/status` | Staff (assigned only) / Admin (override) |
| PATCH | `/:id/reassign` | Admin |
| POST | `/:id/reopen` | Citizen (owner only, within 3-day window) |
| POST | `/:id/attachments` | Authenticated — role-scoped attachment type |

### Payments (`/payments`)
| Method | Endpoint | Access |
|---|---|---|
| POST | `/initiate` | Citizen — creates/recreates a checkout session |
| GET | `/:id` | Authenticated — scoped |
| GET | `/` | Authenticated — paginated, filterable, sortable |
| POST | `/sslcommerz/ipn` | Public webhook |
| POST | `/sslcommerz/success` \| `/fail` \| `/cancel` | Public redirect handlers |
| GET | `/bkash/callback` | Public callback |

### Feedback (`/feedbacks`)
| Method | Endpoint | Access |
|---|---|---|
| POST | `/` | Citizen — only on resolved/closed own requests |
| GET | `/` | Authenticated — scoped, filterable |
| GET | `/:requestId` | Authenticated — scoped |

### Admin (`/admin`)
| Method | Endpoint | Access |
|---|---|---|
| POST | `/staff` | Admin — provisions STAFF/ADMIN accounts with a temp password |
| PATCH | `/users/:id/status` | Admin — block/unblock |
| GET | `/audit-logs` | Admin — paginated, filterable |
| GET | `/dashboard-stats` | Admin — user/request/payment/feedback aggregates |

**45 endpoints total** — well above the 20-endpoint minimum.

📎 Full request/response examples: **[Postman Collection — add link here]**

---

## 📦 Response Format

**Success**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Service request fetched successfully",
  "data": { },
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

**Error**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "path": "email", "message": "Please provide a valid email address." }
  ]
}
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Redis instance
- Cloudinary account
- SSLCommerz sandbox credentials and/or bKash sandbox credentials
- Google OAuth Client ID (for social login)
- Gmail account with an App Password (for Nodemailer)

### Installation

```bash
git clone https://github.com/<your-username>/nagar-sheba-backend.git
cd nagar-sheba-backend
npm install
```

### Configure environment

```bash
cp .env.example .env
# fill in every value — see the table below
```

### Database setup

```bash
npx prisma generate
npx prisma migrate deploy   # applies existing migrations
```

The admin account, staff accounts, departments, and categories are seeded automatically on server start (see `src/app/lib/seed.ts`) — no separate seed command is needed.

### Run

```bash
npm run dev      # tsx watch — local development
npm run build    # tsc — compile to dist/
npm start        # node dist/src/server.js — production
```

### Code quality

```bash
npm run lint:check
npm run format:check
```

---

## 🔐 Environment Variables

All variables required by `src/app/config/index.ts`. See `.env.example` for the full template — **never commit real values**.

| Variable | Purpose |
|---|---|
| `NODE_ENV`, `PORT` | Runtime environment |
| `DATABASE_URL` | PostgreSQL connection string |
| `BACKEND_URL`, `FRONTEND_URL` | Used to build absolute callback URLs and CORS origin |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Auth tokens |
| `GOOGLE_CLIENT_ID` | Google OAuth verification |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STAFF_PASSWORD` | Seed credentials |
| `BCRYPT_SALT_ROUNDS` | Password hashing cost |
| `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_HOST`, `REDIS_PORT` | Redis connection |
| `SMTP_USER`, `SMTP_SENDER`, `SMTP_PASSWORD` | Nodemailer (Gmail App Password) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | File uploads |
| `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_IS_LIVE` | SSLCommerz gateway |
| `BKASH_BASE_URL`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_APP_KEY`, `BKASH_APP_SECRET` | bKash Tokenized Checkout |

> ⚠️ If any of these values are ever pasted somewhere public (chat, issue tracker, etc.), rotate them immediately.

---

## 💳 Payment Integration

- A `ServiceRequest` under a `PAID` category is created in `PENDING_PAYMENT` status with `feeCharged` set from the category.
- `POST /payments/initiate` creates a checkout session with **SSLCommerz** or **bKash**, storing a `Payment` row (`PENDING`) keyed by a unique `providerRef`.
- **SSLCommerz**: verified via IPN webhook *and* the success/fail/cancel redirect handlers (idempotent — both paths call the same `verifySSLCommerzAndComplete`, which re-validates the transaction with SSLCommerz and checks the amount before marking it complete).
- **bKash**: a single callback endpoint differentiates success/failure/cancel by query param, then calls `executePayment` and cross-checks `transactionStatus` and amount before completing.
- On successful verification, `Payment.status → COMPLETED` and `ServiceRequest.status → SUBMITTED` are updated **in the same transaction**, with a `StatusHistory` row recorded.
- Cancelling a request that was already paid triggers an automatic refund attempt (`refundPaymentForRequest`) via the same provider, without blocking the cancellation itself if the refund call fails.

---

## ⏱️ Background Jobs

`runRequestLifecycleJob` runs once at startup and then every 15 minutes:
1. **Flag overdue requests** — any non-terminal request past its `slaDueAt` is marked `isOverdue: true`.
2. **Auto-close resolved requests** — any `RESOLVED` request untouched by the citizen for 3 days is transitioned to `CLOSED` with a `StatusHistory` entry.

---

## 🔒 Security

- Passwords hashed with bcrypt (configurable salt rounds).
- JWT Bearer access tokens + rotating refresh tokens (httpOnly cookies as a fallback transport).
- Role-based middleware re-validates the user against the database on every request (rejects blocked/deleted accounts even with a still-valid token).
- `helmet` for security headers, `cors` locked to `FRONTEND_URL`, global + endpoint-specific (`otpLimiter`) rate limiting.
- Centralized error handler normalizes Prisma, Multer, Zod, and generic errors into the standard error response shape without leaking internals in production.

---

## 📤 Submission Details

```text
Project Name    : Nagar Sheba — City Complaint & Service Request Platform
Backend Repo    : <add repo URL>
Live API        : <add deployed URL>
API Docs        : <add Postman/Swagger link>
Demo Video      : <add video link>
Admin Email     : <dedicated demo admin email — do not reuse real credentials>
Admin Password  : <dedicated demo admin password>
```

> ⚠️ Use dedicated demo credentials for evaluation, never real production secrets.
