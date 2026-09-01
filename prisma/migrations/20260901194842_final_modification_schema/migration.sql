/*
  Warnings:

  - The values [BKASH] on the enum `PaymentProvider` will be removed. If these variants are still used in the database, this will fail.
  - The values [PROCESSING,PAID] on the enum `PaymentStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `entity` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `oldValue` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `departments` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `departments` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `departments` table. All the data in the column will be lost.
  - You are about to drop the column `managerId` on the `departments` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `departments` table. All the data in the column will be lost.
  - You are about to drop the column `complaintId` on the `feedbacks` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `feedbacks` table. All the data in the column will be lost.
  - You are about to drop the column `complaintId` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `paymentUrl` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `transactionId` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `payments` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `payments` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(10,2)`.
  - You are about to drop the column `changedById` on the `status_histories` table. All the data in the column will be lost.
  - You are about to drop the column `complaintId` on the `status_histories` table. All the data in the column will be lost.
  - The `fromStatus` column on the `status_histories` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `address` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerified` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `needPasswordChange` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `profileImage` on the `users` table. All the data in the column will be lost.
  - The `status` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `assignments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `complaints` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[departmentId,name]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[requestId]` on the table `feedbacks` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[requestId]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[providerRef]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[googleId]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `actorId` to the `audit_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityType` to the `audit_logs` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `action` on the `audit_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `entityId` on table `audit_logs` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `feeType` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slaHours` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requestId` to the `feedbacks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerRef` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requestId` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `changedBy` to the `status_histories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requestId` to the `status_histories` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `toStatus` on the `status_histories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING_PAYMENT', 'SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('EVIDENCE', 'RESOLUTION_PROOF');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL');

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentProvider_new" AS ENUM ('STRIPE', 'SSLCOMMERZ');
ALTER TABLE "payments" ALTER COLUMN "provider" TYPE "PaymentProvider_new" USING ("provider"::text::"PaymentProvider_new");
ALTER TYPE "PaymentProvider" RENAME TO "PaymentProvider_old";
ALTER TYPE "PaymentProvider_new" RENAME TO "PaymentProvider";
DROP TYPE "public"."PaymentProvider_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');
ALTER TABLE "public"."payments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "payments" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_complaintId_fkey";

-- DropForeignKey
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_staffId_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_userId_fkey";

-- DropForeignKey
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_citizenId_fkey";

-- DropForeignKey
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_managerId_fkey";

-- DropForeignKey
ALTER TABLE "feedbacks" DROP CONSTRAINT "feedbacks_complaintId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_complaintId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_userId_fkey";

-- DropForeignKey
ALTER TABLE "status_histories" DROP CONSTRAINT "status_histories_changedById_fkey";

-- DropForeignKey
ALTER TABLE "status_histories" DROP CONSTRAINT "status_histories_complaintId_fkey";

-- DropIndex
DROP INDEX "audit_logs_action_idx";

-- DropIndex
DROP INDEX "audit_logs_entityId_idx";

-- DropIndex
DROP INDEX "audit_logs_entity_idx";

-- DropIndex
DROP INDEX "audit_logs_userId_idx";

-- DropIndex
DROP INDEX "categories_departmentId_idx";

-- DropIndex
DROP INDEX "categories_isDeleted_idx";

-- DropIndex
DROP INDEX "categories_name_departmentId_key";

-- DropIndex
DROP INDEX "departments_isActive_idx";

-- DropIndex
DROP INDEX "departments_isDeleted_idx";

-- DropIndex
DROP INDEX "departments_managerId_idx";

-- DropIndex
DROP INDEX "departments_name_idx";

-- DropIndex
DROP INDEX "feedbacks_citizenId_idx";

-- DropIndex
DROP INDEX "feedbacks_complaintId_key";

-- DropIndex
DROP INDEX "feedbacks_createdAt_idx";

-- DropIndex
DROP INDEX "feedbacks_rating_idx";

-- DropIndex
DROP INDEX "payments_complaintId_idx";

-- DropIndex
DROP INDEX "payments_createdAt_idx";

-- DropIndex
DROP INDEX "payments_provider_idx";

-- DropIndex
DROP INDEX "payments_transactionId_key";

-- DropIndex
DROP INDEX "payments_userId_idx";

-- DropIndex
DROP INDEX "status_histories_changedById_idx";

-- DropIndex
DROP INDEX "status_histories_complaintId_idx";

-- DropIndex
DROP INDEX "status_histories_createdAt_idx";

-- DropIndex
DROP INDEX "status_histories_toStatus_idx";

-- DropIndex
DROP INDEX "users_createdAt_idx";

-- DropIndex
DROP INDEX "users_email_idx";

-- DropIndex
DROP INDEX "users_isDeleted_idx";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "entity",
DROP COLUMN "ipAddress",
DROP COLUMN "oldValue",
DROP COLUMN "userAgent",
DROP COLUMN "userId",
ADD COLUMN     "actorId" TEXT NOT NULL,
ADD COLUMN     "entityType" TEXT NOT NULL,
ADD COLUMN     "previousValue" JSONB,
DROP COLUMN "action",
ADD COLUMN     "action" TEXT NOT NULL,
ALTER COLUMN "entityId" SET NOT NULL;

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "description",
DROP COLUMN "isDeleted",
ADD COLUMN     "feeAmount" DECIMAL(10,2),
ADD COLUMN     "feeType" "FeeType" NOT NULL,
ADD COLUMN     "slaHours" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "departments" DROP COLUMN "email",
DROP COLUMN "isActive",
DROP COLUMN "isDeleted",
DROP COLUMN "managerId",
DROP COLUMN "phone";

-- AlterTable
ALTER TABLE "feedbacks" DROP COLUMN "complaintId",
DROP COLUMN "updatedAt",
ADD COLUMN     "requestId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "complaintId",
DROP COLUMN "currency",
DROP COLUMN "paymentUrl",
DROP COLUMN "transactionId",
DROP COLUMN "userId",
ADD COLUMN     "providerRef" TEXT NOT NULL,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "requestId" TEXT NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "status_histories" DROP COLUMN "changedById",
DROP COLUMN "complaintId",
ADD COLUMN     "changedBy" TEXT NOT NULL,
ADD COLUMN     "requestId" TEXT NOT NULL,
DROP COLUMN "fromStatus",
ADD COLUMN     "fromStatus" "RequestStatus",
DROP COLUMN "toStatus",
ADD COLUMN     "toStatus" "RequestStatus" NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "address",
DROP COLUMN "emailVerified",
DROP COLUMN "gender",
DROP COLUMN "isDeleted",
DROP COLUMN "name",
DROP COLUMN "needPasswordChange",
DROP COLUMN "password",
DROP COLUMN "phone",
DROP COLUMN "profileImage",
ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordHash" TEXT,
ALTER COLUMN "role" DROP DEFAULT,
DROP COLUMN "status",
ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE "assignments";

-- DropTable
DROP TABLE "complaints";

-- DropEnum
DROP TYPE "AssignmentStatus";

-- DropEnum
DROP TYPE "AuditAction";

-- DropEnum
DROP TYPE "ComplaintPriority";

-- DropEnum
DROP TYPE "ComplaintStatus";

-- DropEnum
DROP TYPE "Gender";

-- DropEnum
DROP TYPE "UserStatus";

-- CreateTable
CREATE TABLE "admin_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,

    CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citizen_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,

    CONSTRAINT "citizen_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "trackingRef" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "assignedStaffId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "feeCharged" DECIMAL(10,2),
    "slaDueAt" TIMESTAMP(3),
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "title" TEXT,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_profiles_userId_key" ON "admin_profiles"("userId");

-- CreateIndex
CREATE INDEX "attachments_requestId_idx" ON "attachments"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "citizen_profiles_userId_key" ON "citizen_profiles"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_trackingRef_key" ON "service_requests"("trackingRef");

-- CreateIndex
CREATE INDEX "service_requests_status_idx" ON "service_requests"("status");

-- CreateIndex
CREATE INDEX "service_requests_citizenId_idx" ON "service_requests"("citizenId");

-- CreateIndex
CREATE INDEX "service_requests_departmentId_idx" ON "service_requests"("departmentId");

-- CreateIndex
CREATE INDEX "service_requests_assignedStaffId_idx" ON "service_requests"("assignedStaffId");

-- CreateIndex
CREATE INDEX "service_requests_categoryId_idx" ON "service_requests"("categoryId");

-- CreateIndex
CREATE INDEX "service_requests_isOverdue_idx" ON "service_requests"("isOverdue");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_userId_key" ON "staff_profiles"("userId");

-- CreateIndex
CREATE INDEX "staff_profiles_departmentId_idx" ON "staff_profiles"("departmentId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_departmentId_name_key" ON "categories"("departmentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "feedbacks_requestId_key" ON "feedbacks"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_requestId_key" ON "payments"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerRef_key" ON "payments"("providerRef");

-- CreateIndex
CREATE INDEX "status_histories_requestId_idx" ON "status_histories"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- AddForeignKey
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citizen_profiles" ADD CONSTRAINT "citizen_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_histories" ADD CONSTRAINT "status_histories_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_histories" ADD CONSTRAINT "status_histories_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
