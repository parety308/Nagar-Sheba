# Project Requirements — City Complaint & Service Platform

## 1. Overview

City Complaint & Service Platform lets citizens report civic issues (potholes, broken streetlights, garbage collection, water leaks, etc.) and request paid municipal services (document corrections, permit applications, utility service requests) directly to the city. A citizen files a complaint or service request, the system routes it to the right department based on category and location, a staff member is assigned to investigate or carry out the work, and the citizen is kept updated until the issue is resolved and they leave feedback. Admins keep the platform running: they manage departments, categories, and staff, and they monitor the whole system through a dashboard.

This document is the product spec — what the system must do and the exact rules it must follow. It is not the database schema and not the API design; those come next, and every rule below is written so that whoever designs them doesn't have to guess.

## 2. User roles

Three roles exist: **Admin**, **Staff**, **Citizen**.

| Role        | How they join the platform                                                  | How they log in       |
| ----------- | ------------------------------------------------------------------------------ | ------------------------ |
| **Citizen** | Registers directly — email/password or Google                                  | Email/password or Google |
| **Staff**   | Created by an Admin — cannot self-register                                     | Email/password only      |
| **Admin**   | Created by another Admin, or seeded as the platform's first Admin              | Email/password only      |

Google login is a **citizen-only** feature. Staff and Admins always use email and password.

### 2.1 Who can do what

| Action                                        | Citizen | Staff | Admin |
| ------------------------------------------------ | :-------: | :-----: | :-----: |
| File a complaint / service request                | ✅       | ❌     | ❌     |
| View and comment on their own complaints           | ✅       | ❌     | ❌     |
| Rate/give feedback on a resolved complaint         | ✅       | ❌     | ❌     |
| View complaints assigned to them                    | ❌       | ✅     | ✅     |
| Update status / add investigation notes on an assigned complaint | ❌ | ✅     | ✅     |
| Create/manage Departments and Categories             | ❌       | ❌     | ✅     |
| Create Staff accounts, assign them to a Department   | ❌       | ❌     | ✅     |
| Assign or reassign a complaint to a Staff member     | ❌       | ❌     | ✅     |
| Block or unblock a Citizen or Staff account          | ❌       | ❌     | ✅     |
| View platform-wide dashboard, SLA breaches, reports  | ❌       | ❌     | ✅     |

Staff only ever see and act on complaints assigned to them; they cannot see the whole queue or other departments' work. Admin has full visibility and control.

## 3. Accounts and authentication

### 3.1 Registration

- **Citizen** registers with name, email, and password — or with Google. Either way, they land in the system as a Citizen; there is no way to register directly as anything else.
- **Staff** is never self-registered. A Staff account only comes into existence when an Admin creates one (see [Section 4](#4-department-and-staff-management)).
- **Admin** is never self-registered either. New Admins are created by an existing Admin; the very first Admin account is seeded directly into the database during setup.

### 3.2 Email OTP verification

Citizen credential registration must be verified with a one-time password (OTP) sent to their email before the account is usable. Google registration doesn't need this, since Google has already verified the email. Staff and Admin accounts skip OTP entirely, because they're created by someone else, not self-registered — the invite-and-generated-password flow (Section 4) secures those instead.

### 3.3 Login

- Citizens log in with email/password or with Google — and it's the same account either way. A citizen who originally registered with email/password can also log in with Google afterward (matched by email), and vice versa; the system doesn't treat these as two separate citizens.
- Staff and Admins log in with email/password only — always.

### 3.4 Forgot password / reset password

Two-step flow, available to anyone who logs in with a password:

1. **Forgot password** — user submits their email; system emails them an OTP.
2. **Reset password** — user submits the OTP plus a new password; system verifies the OTP and updates the password.

### 3.5 Change password (logged in)

A logged-in user submits their **current password** and a **new password**. This is different from reset: it's for someone who remembers their current password and just wants to change it. Someone who's forgotten their current password uses forgot-password/reset-password instead.

### 3.6 Set password (citizens only)

A citizen who first signed up through Google doesn't have a password yet — Google login never asks for one. **Set Password** lets that citizen choose one, so afterward they can log in either way: with Google or with email/password. This feature exists only for citizens, since Staff and Admins never use Google login and always have a password from the moment their account is created.

### 3.7 Tokens and sessions

Every successful login or registration — credential or Google, any role — issues an **access token** and a **refresh token**, both set as cookies.

### 3.8 Welcome emails

| Event                                    | Recipient           | Contains                                                                          |
| -------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------- |
| Citizen's first registration, right after auto-login | Citizen's email        | Welcome message                                                                        |
| Staff or Admin account gets created           | Their **personal** email | Their new **organization** email (their login), their generated password, and a prompt to change that password after logging in |

## 4. Department and staff management

Only an Admin can create Departments, Categories, or Staff accounts.

- **Department** — e.g. Roads & Infrastructure, Sanitation, Water Supply, Electrical, Permits & Documentation. Every complaint category belongs to exactly one Department.
- **Category** — e.g. "Pothole", "Streetlight Outage", "Garbage Not Collected", "Water Leak", "Birth Certificate Correction". Each category has: the Department it routes to, whether it's **free** or a **paid service**, and (for paid categories) a fixed fee.
- **Staff** — created by an Admin and assigned to exactly one Department. The creator fills in two email addresses, same as below.

The creator fills in two email addresses for a new Staff or Admin account:

- **Organization email** — the account's login identity going forward, assigned by whoever creates the account.
- **Personal email** — the actual person's own inbox, used only to deliver the welcome message.

The system generates a password for the new account and sends it to the **personal** email inside the welcome email, along with the organization email and a prompt to change the password on first login.

## 5. Filing a complaint or service request

1. Citizen picks a **category** (which determines the Department and whether it's free or paid).
2. Citizen provides a description, a **location** (address or coordinates), and optionally photo attachments.
3. If the category is a **paid service**, the citizen must pay the fixed fee before the request is accepted (see [Section 8](#8-payments)). Free categories are accepted immediately on submission.
4. Once accepted, the request is created with status **submitted** and automatically routed to the Department tied to its category. It is not yet assigned to a specific Staff member.

## 6. Assignment and SLA

- Every Category has a **target resolution time** (SLA), set by the Admin when the category is created (e.g. "Pothole" = 5 days, "Garbage Not Collected" = 2 days).
- An Admin assigns a **submitted** request to one Staff member within the responsible Department. A request can only be assigned to Staff belonging to that Department.
- The SLA clock starts at submission, not at assignment. A request whose SLA deadline has passed without reaching **resolved** is flagged as an **SLA breach** and surfaced on the Admin dashboard.
- An Admin can reassign a request to a different Staff member at any time before it's resolved.

## 7. Status lifecycle

A complaint/service request moves through these statuses:

```
submitted → assigned → in_progress → resolved → closed
                                   ↘ rejected
```

- **Submitted** — set automatically once the request is accepted (and paid, if applicable).
- **Assigned** — set automatically the moment an Admin assigns it to a Staff member.
- **In progress** — the assigned Staff member sets this manually when they begin work, and may add investigation notes at any point from here on.
- **Resolved** — the assigned Staff member sets this manually when the work is done, with a required resolution note (and optionally a photo of the completed work).
- **Rejected** — the assigned Staff member (or Admin) can set this instead of resolving, with a required reason (e.g. duplicate report, outside jurisdiction). Only possible from **assigned** or **in_progress**.
- **Closed** — set automatically 7 days after **resolved**, or immediately once the citizen submits feedback — whichever happens first. A **resolved** request can be reopened by the citizen (moving it back to **assigned**, kept with the same Staff member) if they're not satisfied, but only before it reaches **closed**.

## 8. Payments

Payment only applies to **paid service** categories (Section 4); free complaint categories never involve payment.

1. At submission time, if the category is paid, the citizen is redirected to a payment session for the category's fixed fee.
2. Once payment succeeds, the system verifies it via the payment gateway's webhook/callback, marks the payment **paid**, and only then creates the request with status **submitted** (Section 5). If payment fails or is abandoned, no request is created.
3. A receipt (amount, category, date, transaction ID) is emailed to the citizen right after a successful payment.
4. If a paid request is **rejected** (Section 7), the fee is automatically refunded. Resolved paid requests are not refunded.

## 9. Feedback

Once a request reaches **resolved**, the citizen can leave a **star rating (1–5)** and an optional comment. Feedback can only be submitted once per request and only while it's in **resolved** status (i.e., before it auto-closes or after they reopen and it's resolved again). Feedback is visible to the Admin and to Staff on their own completed requests, for performance tracking.

## 10. Data models (conceptual)

The database design isn't finalized yet, so this is a description of what each model needs to hold — not a schema.

- **User** — the shared identity for every role: email, password (nullable — a Google-only citizen has none until they set one), linked Google account, role (`ADMIN` / `STAFF` / `CITIZEN`), account status (active/blocked), email-verified flag, and a "must change password" flag (used right after a Staff/Admin is created).
- **Citizen profile** — personal info plus saved addresses.
- **Staff profile** — personal info, plus the Department they belong to and the organization email assigned at creation.
- **Department** — name, description.
- **Category** — name, Department it belongs to, free/paid flag, fee amount (if paid), SLA target duration.
- **Request** — citizen, category, description, location, attachments, status, assigned staff (nullable), submission time, SLA deadline, resolution note, rejection reason (nullable).
- **Payment** — request, amount, gateway transaction ID, status (pending/paid/refunded).
- **Feedback** — request, citizen, rating, comment, submitted-at.
