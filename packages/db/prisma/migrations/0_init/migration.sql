-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('PENDING', 'COMMITTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayHeadType" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "PayHeadCategory" AS ENUM ('FIXED', 'VARIABLE', 'STATUTORY');

-- CreateEnum
CREATE TYPE "StatutoryType" AS ENUM ('PF', 'ESI', 'PT', 'GRATUITY', 'TDS');

-- CreateEnum
CREATE TYPE "RoundingMode" AS ENUM ('NORMAL', 'FLOOR', 'CEILING', 'NONE');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "EmployeeApprovalStatus" AS ENUM ('PENDING_INVITE', 'INVITED', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ItDeclarationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('NEW', 'OLD');

-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('EMPLOYEE', 'CONSULTANT');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED', 'ON_NOTICE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEKEND', 'WFH');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'SELF_CHECKIN', 'BIOMETRIC', 'SYSTEM', 'CSV', 'AGENT');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'WEEKLY', 'HOURLY', 'FIXED');

-- CreateEnum
CREATE TYPE "WorkSchedule" AS ENUM ('FULL_TIME', 'PART_TIME');

-- CreateEnum
CREATE TYPE "TimeLogSource" AS ENUM ('MANUAL', 'DESKTOP_AGENT', 'BROWSER_EXTENSION', 'API');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID', 'PARTIALLY_PAID');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'PROCESSING', 'COMPLETED', 'APPROVED', 'PAID', 'CONSOLIDATED', 'RECTIFIED', 'COMPUTED', 'REVIEWED', 'FROZEN', 'BANK_GENERATED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LEAVE_APPLIED', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'LEAVE_CANCELLED', 'INVOICE_GENERATED', 'INVOICE_PAID', 'EMPLOYEE_ADDED', 'ASSIGNMENT_CREATED', 'ASSIGNMENT_ENDED', 'PAYROLL_PROCESSED', 'PAYSLIP_GENERATED', 'DOCUMENT_UPLOADED', 'DOCUMENT_EXPIRING', 'CLIENT_PORTAL_INVITE', 'APPRAISAL_DUE', 'APPRAISAL_SELF_REVIEW', 'APPRAISAL_MANAGER_REVIEW', 'APPRAISAL_APPROVED', 'APPRAISAL_APPLIED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "KbCategory" AS ENUM ('GUIDE', 'FAQ', 'POLICY', 'COMPLIANCE', 'TROUBLESHOOTING');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('INVITED', 'OFFER_PENDING', 'DETAILS_PENDING', 'DOCUMENTS_PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProfileChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OfferLetterStatus" AS ENUM ('SENT', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LetterType" AS ENUM ('OFFER_LETTER', 'APPOINTMENT_LETTER', 'EXPERIENCE_LETTER', 'CLIENT_AGREEMENT');

-- CreateEnum
CREATE TYPE "LetterStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'PAYONEER', 'WIRE', 'CREDIT_CARD', 'CHECK', 'CASH', 'OTHER');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "logo" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'STARTER',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "gst_number" TEXT,
    "pan_number" TEXT,
    "tan_number" TEXT,
    "pf_number" TEXT,
    "esi_number" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "module_scopes" JSONB,
    "access_profile_id" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_profiles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "base_role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "scopes" JSONB,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "id_token" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "designation" TEXT,
    "department_id" TEXT,
    "join_date" TIMESTAMP(3) NOT NULL,
    "exit_date" TIMESTAMP(3),
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "engagement_type" "EngagementType" NOT NULL DEFAULT 'EMPLOYEE',
    "consultant_tds_rate" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "tax_regime" "TaxRegime" NOT NULL DEFAULT 'NEW',
    "salary" DECIMAL(12,2) NOT NULL,
    "pf_number" TEXT,
    "esi_number" TEXT,
    "pan_number" TEXT,
    "bank_account" TEXT,
    "bank_ifsc" TEXT,
    "bank_name" TEXT,
    "bank_branch" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,
    "onboarding_status" "OnboardingStatus",
    "reporting_manager_id" TEXT,
    "invite_token" TEXT,
    "invite_expires_at" TIMESTAMP(3),
    "offer_accepted_at" TIMESTAMP(3),
    "accrued_leave_months" INTEGER NOT NULL DEFAULT 0,
    "approval_status" "EmployeeApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "head_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billing_email" TEXT,
    "payoneer_email" TEXT,
    "website" TEXT,
    "registered_address" TEXT,
    "signatory_name" TEXT,
    "contact_number" TEXT,
    "portal_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "billing_entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "account_manager_id" TEXT,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_assignments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "role" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "billing_rate" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "work_schedule" "WorkSchedule" NOT NULL DEFAULT 'FULL_TIME',
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "accrued_leave_months" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "employee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tax_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "payment_terms" TEXT,
    "payoneer_link" TEXT,
    "paid_at" TIMESTAMP(3),
    "paid_amount" DECIMAL(14,2),
    "payment_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "billing_entity_id" TEXT,
    "amount_written_off" DECIMAL(14,2) DEFAULT 0,
    "write_off_reason" TEXT,
    "sent_at" TIMESTAMP(3),
    "sent_to" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_entities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registered_address" TEXT,
    "tax_line" TEXT,
    "payment_instructions" TEXT,
    "invoice_prefix" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "assignment_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clock_in" TIMESTAMP(3) NOT NULL,
    "clock_out" TIMESTAMP(3),
    "duration" INTEGER,
    "source" "TimeLogSource" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "screenshot_url" TEXT,
    "thumbnail_url" TEXT,
    "activity_percent" INTEGER NOT NULL DEFAULT 0,
    "keystrokes" INTEGER NOT NULL DEFAULT 0,
    "mouseClicks" INTEGER NOT NULL DEFAULT 0,
    "mouse_movements" INTEGER NOT NULL DEFAULT 0,
    "active_app" TEXT,
    "active_url" TEXT,
    "active_title" TEXT,
    "is_idle" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "default_days" INTEGER NOT NULL DEFAULT 12,
    "carry_forward" BOOLEAN NOT NULL DEFAULT false,
    "max_carry_days" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitled" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "used" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "carried_over" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "adjustment" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days" DECIMAL(4,1) NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "basic" DECIMAL(12,2) NOT NULL,
    "hra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "da" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "special_allow" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_allow" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gross_salary" DECIMAL(12,2) NOT NULL,
    "pf_employee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pf_employer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "esi_employee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "esi_employer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "prof_tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tds" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_salary" DECIMAL(12,2) NOT NULL,
    "ctc" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "run_date" TIMESTAMP(3) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "total_gross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "employee_count" INTEGER NOT NULL DEFAULT 0,
    "processed_by" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "frozen_at" TIMESTAMP(3),
    "frozen_by" TEXT,
    "finalized_at" TIMESTAMP(3),
    "finalized_by" TEXT,
    "bank_file_url" TEXT,
    "bank_file_generated_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "payroll_run_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "basic" DECIMAL(12,2) NOT NULL,
    "hra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "da" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "special_allow" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_allow" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gross_earnings" DECIMAL(12,2) NOT NULL,
    "pf_employee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "esi_employee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "prof_tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tds" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(12,2) NOT NULL,
    "net_pay" DECIMAL(12,2) NOT NULL,
    "adjustments" JSONB NOT NULL DEFAULT '[]',
    "tds_breakdown" JSONB,
    "working_days" INTEGER NOT NULL DEFAULT 0,
    "paid_days" INTEGER NOT NULL DEFAULT 0,
    "lop_days" INTEGER NOT NULL DEFAULT 0,
    "paid_at" TIMESTAMP(3),
    "payment_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "check_in" TIMESTAMP(3),
    "check_out" TIMESTAMP(3),
    "work_hours" DECIMAL(5,2),
    "notes" TEXT,
    "marked_by" TEXT,
    "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL DEFAULT 0,
    "mime_type" TEXT,
    "expiry_date" DATE,
    "notes" TEXT,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "grace_minutes" INTEGER NOT NULL DEFAULT 15,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "lunch_break_minutes" INTEGER NOT NULL DEFAULT 60,
    "total_hours" DECIMAL(4,2) NOT NULL DEFAULT 9,
    "working_hours" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_shifts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "shift_type_id" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_import_batches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PENDING',
    "errors" JSONB,
    "dry_run" BOOLEAN NOT NULL DEFAULT true,
    "committed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link_url" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_heads" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PayHeadType" NOT NULL,
    "category" "PayHeadCategory" NOT NULL DEFAULT 'FIXED',
    "description" TEXT,
    "is_statutory" BOOLEAN NOT NULL DEFAULT false,
    "statutory_type" "StatutoryType",
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_heads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_structure_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "effective_from" DATE,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_structure_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_structure_components" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "head_id" TEXT NOT NULL,
    "formula" TEXT,
    "formula_display" TEXT,
    "is_variable" BOOLEAN NOT NULL DEFAULT false,
    "show_on_payslip" BOOLEAN NOT NULL DEFAULT true,
    "has_arrear" BOOLEAN NOT NULL DEFAULT false,
    "has_incr_pct" BOOLEAN NOT NULL DEFAULT false,
    "affects_pf" BOOLEAN NOT NULL DEFAULT false,
    "affects_esi" BOOLEAN NOT NULL DEFAULT false,
    "affects_pt" BOOLEAN NOT NULL DEFAULT false,
    "affects_gratuity" BOOLEAN NOT NULL DEFAULT false,
    "rounding_mode" "RoundingMode" NOT NULL DEFAULT 'NORMAL',
    "rounding_precision" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_structure_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_structure_assignments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "ctc_annual" DECIMAL(14,2),
    "ctc_monthly" DECIMAL(12,2),
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_structure_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslip_lines" (
    "id" TEXT NOT NULL,
    "payslip_id" TEXT NOT NULL,
    "head_id" TEXT NOT NULL,
    "head_name" TEXT NOT NULL,
    "head_type" "PayHeadType" NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL,
    "arrear_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "formula" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "show_on_payslip" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslip_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_portal_users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "otp_hash" TEXT,
    "otp_expires_at" TIMESTAMP(3),
    "otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_portal_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_contents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "example" TEXT,
    "validation_rule" TEXT,
    "learn_more_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_articles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "module" TEXT NOT NULL,
    "category" "KbCategory" NOT NULL DEFAULT 'GUIDE',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "kb_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_change_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "status" "ProfileChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_letters" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "department" TEXT,
    "salary" DECIMAL(12,2) NOT NULL,
    "joining_date" TIMESTAMP(3) NOT NULL,
    "probation_months" INTEGER NOT NULL DEFAULT 6,
    "work_location" TEXT,
    "reporting_to" TEXT,
    "work_schedule" TEXT,
    "employment_type" "WorkSchedule" NOT NULL DEFAULT 'FULL_TIME',
    "benefits" TEXT,
    "terms" TEXT,
    "status" "OfferLetterStatus" NOT NULL DEFAULT 'SENT',
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "letter_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "LetterType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "file_path" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "letter_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_letters" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "type" "LetterType" NOT NULL,
    "employee_id" TEXT,
    "client_id" TEXT,
    "assignment_id" TEXT,
    "reference_no" TEXT,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "pdf_path" TEXT,
    "variables" JSONB NOT NULL,
    "status" "LetterStatus" NOT NULL DEFAULT 'DRAFT',
    "generated_by" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "sent_to" TEXT,
    "accepted_at" TIMESTAMP(3),
    "signed_file_path" TEXT,
    "notes" TEXT,

    CONSTRAINT "generated_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_letter_settings" (
    "tenant_id" TEXT NOT NULL,
    "default_working_hours" TEXT NOT NULL DEFAULT '9 hours/day, 6 days/week',
    "default_probation_days" INTEGER NOT NULL DEFAULT 90,
    "default_location" TEXT NOT NULL DEFAULT 'New Delhi',
    "signatory_name" TEXT,
    "signatory_title" TEXT,
    "ref_number_prefix" TEXT NOT NULL DEFAULT 'LEGELP/ZT',
    "employee_code_prefix" TEXT NOT NULL DEFAULT 'LE',
    "counters" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_letter_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "tenant_invoice_settings" (
    "tenant_id" TEXT NOT NULL,
    "email_subject" TEXT,
    "email_body" TEXT,
    "payment_instructions" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_invoice_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "invoice_email_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "paid_on" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "exchange_rate" DECIMAL(10,6),
    "amount_in_invoice_currency" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "bank_fee" DECIMAL(10,2),
    "notes" TEXT,
    "recorded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_attendance_overrides" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "working_days" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "timeoff" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "over_time" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "late_count" INTEGER NOT NULL DEFAULT 0,
    "early_count" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'UPLOAD',
    "uploaded_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_attendance_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_slabs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "regime" "TaxRegime" NOT NULL,
    "financial_year" TEXT NOT NULL,
    "from_amount" DECIMAL(12,2) NOT NULL,
    "to_amount" DECIMAL(12,2),
    "rate_pct" DECIMAL(5,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_regime_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "regime" "TaxRegime" NOT NULL,
    "financial_year" TEXT NOT NULL,
    "standard_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rebate_max_taxable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cess_pct" DECIMAL(5,2) NOT NULL DEFAULT 4,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_regime_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_declarations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "regime" "TaxRegime" NOT NULL DEFAULT 'OLD',
    "status" "ItDeclarationStatus" NOT NULL DEFAULT 'DRAFT',
    "sec_80c" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sec_80ccd1b" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sec_80d" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sec_80e" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sec_80g" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sec_80tta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "home_loan_interest" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hra_rent_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "metro_city" BOOLEAN NOT NULL DEFAULT false,
    "other_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_exits" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "exitType" TEXT NOT NULL DEFAULT 'RESIGNATION',
    "resignation_date" DATE,
    "last_working_day" DATE NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "ctc_monthly" DECIMAL(12,2),
    "pending_salary_days" DECIMAL(6,2),
    "pending_salary_amount" DECIMAL(12,2),
    "adjustments" JSONB,
    "net_settlement" DECIMAL(12,2),
    "settlement_notes" TEXT,
    "settlement_pdf_path" TEXT,
    "settled_at" TIMESTAMP(3),
    "initiated_by" TEXT,
    "settled_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_exits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_access_profile_id_idx" ON "users"("access_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "access_profiles_tenant_id_idx" ON "access_profiles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "access_profiles_tenant_id_name_key" ON "access_profiles"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_invite_token_key" ON "employees"("invite_token");

-- CreateIndex
CREATE INDEX "employees_tenant_id_idx" ON "employees"("tenant_id");

-- CreateIndex
CREATE INDEX "employees_tenant_id_status_idx" ON "employees"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "employees_tenant_id_department_id_idx" ON "employees"("tenant_id", "department_id");

-- CreateIndex
CREATE INDEX "employees_tenant_id_deleted_at_idx" ON "employees"("tenant_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "employees_tenant_id_employee_code_key" ON "employees"("tenant_id", "employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_tenant_id_email_key" ON "employees"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "departments_tenant_id_idx" ON "departments"("tenant_id");

-- CreateIndex
CREATE INDEX "departments_tenant_id_deleted_at_idx" ON "departments"("tenant_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenant_id_code_key" ON "departments"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "clients_tenant_id_idx" ON "clients"("tenant_id");

-- CreateIndex
CREATE INDEX "clients_tenant_id_is_active_idx" ON "clients"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "clients_tenant_id_deleted_at_idx" ON "clients"("tenant_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "clients_tenant_id_email_key" ON "clients"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "employee_assignments_tenant_id_idx" ON "employee_assignments"("tenant_id");

-- CreateIndex
CREATE INDEX "employee_assignments_tenant_id_employee_id_idx" ON "employee_assignments"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_assignments_tenant_id_client_id_idx" ON "employee_assignments"("tenant_id", "client_id");

-- CreateIndex
CREATE INDEX "employee_assignments_tenant_id_status_idx" ON "employee_assignments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_idx" ON "invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_client_id_idx" ON "invoices"("tenant_id", "client_id");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_status_idx" ON "invoices"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_due_date_idx" ON "invoices"("tenant_id", "due_date");

-- CreateIndex
CREATE INDEX "invoices_billing_entity_id_idx" ON "invoices"("billing_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenant_id_invoice_number_key" ON "invoices"("tenant_id", "invoice_number");

-- CreateIndex
CREATE INDEX "billing_entities_tenant_id_idx" ON "billing_entities"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_entities_tenant_id_name_key" ON "billing_entities"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoice_id_idx" ON "invoice_line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "time_logs_tenant_id_date_idx" ON "time_logs"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "time_logs_tenant_id_employee_id_idx" ON "time_logs"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "time_logs_tenant_id_employee_id_date_idx" ON "time_logs"("tenant_id", "employee_id", "date");

-- CreateIndex
CREATE INDEX "activity_snapshots_tenant_id_employee_id_captured_at_idx" ON "activity_snapshots"("tenant_id", "employee_id", "captured_at");

-- CreateIndex
CREATE INDEX "activity_snapshots_tenant_id_captured_at_idx" ON "activity_snapshots"("tenant_id", "captured_at");

-- CreateIndex
CREATE INDEX "leave_types_tenant_id_idx" ON "leave_types"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_tenant_id_code_key" ON "leave_types"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "leave_balances_tenant_id_employee_id_idx" ON "leave_balances"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "leave_balances_tenant_id_year_idx" ON "leave_balances"("tenant_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_tenant_id_employee_id_leave_type_id_year_key" ON "leave_balances"("tenant_id", "employee_id", "leave_type_id", "year");

-- CreateIndex
CREATE INDEX "leave_requests_tenant_id_employee_id_idx" ON "leave_requests"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "leave_requests_tenant_id_status_idx" ON "leave_requests"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "leave_requests_tenant_id_start_date_idx" ON "leave_requests"("tenant_id", "start_date");

-- CreateIndex
CREATE INDEX "salary_structures_tenant_id_employee_id_idx" ON "salary_structures"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "salary_structures_tenant_id_is_active_idx" ON "salary_structures"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "payroll_runs_tenant_id_idx" ON "payroll_runs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_tenant_id_month_year_key" ON "payroll_runs"("tenant_id", "month", "year");

-- CreateIndex
CREATE INDEX "payslips_tenant_id_payroll_run_id_idx" ON "payslips"("tenant_id", "payroll_run_id");

-- CreateIndex
CREATE INDEX "payslips_tenant_id_employee_id_idx" ON "payslips"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_tenant_id_employee_id_month_year_key" ON "payslips"("tenant_id", "employee_id", "month", "year");

-- CreateIndex
CREATE INDEX "attendance_tenant_id_date_idx" ON "attendance"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "attendance_tenant_id_employee_id_idx" ON "attendance"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "attendance_tenant_id_status_idx" ON "attendance"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_tenant_id_employee_id_date_key" ON "attendance"("tenant_id", "employee_id", "date");

-- CreateIndex
CREATE INDEX "document_categories_tenant_id_idx" ON "document_categories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_categories_tenant_id_code_key" ON "document_categories"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "employee_documents_tenant_id_employee_id_idx" ON "employee_documents"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_documents_tenant_id_category_id_idx" ON "employee_documents"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "holidays_tenant_id_year_idx" ON "holidays"("tenant_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_tenant_id_date_key" ON "holidays"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "shift_types_tenant_id_idx" ON "shift_types"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_types_tenant_id_code_key" ON "shift_types"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "employee_shifts_tenant_id_employee_id_idx" ON "employee_shifts"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_idx" ON "audit_logs"("tenant_id", "entity");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_user_id_idx" ON "audit_logs"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "attendance_import_batches_tenant_id_created_at_idx" ON "attendance_import_batches"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "attendance_import_batches_tenant_id_status_idx" ON "attendance_import_batches"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_user_id_is_read_idx" ON "notifications"("tenant_id", "user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_user_id_created_at_idx" ON "notifications"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_type_idx" ON "notifications"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "pay_heads_tenant_id_type_idx" ON "pay_heads"("tenant_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "pay_heads_tenant_id_code_key" ON "pay_heads"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "pay_structure_templates_tenant_id_idx" ON "pay_structure_templates"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "pay_structure_templates_tenant_id_name_key" ON "pay_structure_templates"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "pay_structure_components_template_id_idx" ON "pay_structure_components"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "pay_structure_components_template_id_head_id_key" ON "pay_structure_components"("template_id", "head_id");

-- CreateIndex
CREATE INDEX "pay_structure_assignments_tenant_id_employee_id_idx" ON "pay_structure_assignments"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "pay_structure_assignments_tenant_id_is_active_idx" ON "pay_structure_assignments"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "payslip_lines_payslip_id_idx" ON "payslip_lines"("payslip_id");

-- CreateIndex
CREATE INDEX "client_portal_users_tenant_id_client_id_idx" ON "client_portal_users"("tenant_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_portal_users_tenant_id_email_key" ON "client_portal_users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "help_contents_tenant_id_module_idx" ON "help_contents"("tenant_id", "module");

-- CreateIndex
CREATE UNIQUE INDEX "help_contents_tenant_id_key_key" ON "help_contents"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "kb_articles_tenant_id_module_idx" ON "kb_articles"("tenant_id", "module");

-- CreateIndex
CREATE INDEX "kb_articles_tenant_id_category_idx" ON "kb_articles"("tenant_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "kb_articles_tenant_id_slug_key" ON "kb_articles"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "profile_change_requests_tenant_id_idx" ON "profile_change_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "profile_change_requests_tenant_id_status_idx" ON "profile_change_requests"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "profile_change_requests_tenant_id_employee_id_idx" ON "profile_change_requests"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "offer_letters_employee_id_key" ON "offer_letters"("employee_id");

-- CreateIndex
CREATE INDEX "offer_letters_tenant_id_idx" ON "offer_letters"("tenant_id");

-- CreateIndex
CREATE INDEX "letter_templates_tenant_id_type_is_active_idx" ON "letter_templates"("tenant_id", "type", "is_active");

-- CreateIndex
CREATE INDEX "generated_letters_tenant_id_type_generated_at_idx" ON "generated_letters"("tenant_id", "type", "generated_at");

-- CreateIndex
CREATE INDEX "generated_letters_tenant_id_employee_id_idx" ON "generated_letters"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "generated_letters_tenant_id_client_id_idx" ON "generated_letters"("tenant_id", "client_id");

-- CreateIndex
CREATE INDEX "generated_letters_tenant_id_reference_no_idx" ON "generated_letters"("tenant_id", "reference_no");

-- CreateIndex
CREATE INDEX "invoice_email_templates_tenant_id_idx" ON "invoice_email_templates"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_email_templates_tenant_id_name_key" ON "invoice_email_templates"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "invoice_payments_tenant_id_invoice_id_idx" ON "invoice_payments"("tenant_id", "invoice_id");

-- CreateIndex
CREATE INDEX "invoice_payments_tenant_id_paid_on_idx" ON "invoice_payments"("tenant_id", "paid_on");

-- CreateIndex
CREATE INDEX "monthly_attendance_overrides_tenant_id_year_month_idx" ON "monthly_attendance_overrides"("tenant_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_attendance_overrides_tenant_id_employee_id_year_mon_key" ON "monthly_attendance_overrides"("tenant_id", "employee_id", "year", "month");

-- CreateIndex
CREATE INDEX "tax_slabs_tenant_id_regime_financial_year_idx" ON "tax_slabs"("tenant_id", "regime", "financial_year");

-- CreateIndex
CREATE UNIQUE INDEX "tax_regime_configs_tenant_id_regime_financial_year_key" ON "tax_regime_configs"("tenant_id", "regime", "financial_year");

-- CreateIndex
CREATE INDEX "it_declarations_tenant_id_status_idx" ON "it_declarations"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "it_declarations_tenant_id_employee_id_financial_year_key" ON "it_declarations"("tenant_id", "employee_id", "financial_year");

-- CreateIndex
CREATE UNIQUE INDEX "employee_exits_employee_id_key" ON "employee_exits"("employee_id");

-- CreateIndex
CREATE INDEX "employee_exits_tenant_id_status_idx" ON "employee_exits"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_access_profile_id_fkey" FOREIGN KEY ("access_profile_id") REFERENCES "access_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_reporting_manager_id_fkey" FOREIGN KEY ("reporting_manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_billing_entity_id_fkey" FOREIGN KEY ("billing_entity_id") REFERENCES "billing_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_account_manager_id_fkey" FOREIGN KEY ("account_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billing_entity_id_fkey" FOREIGN KEY ("billing_entity_id") REFERENCES "billing_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_entities" ADD CONSTRAINT "billing_entities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "employee_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_snapshots" ADD CONSTRAINT "activity_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_snapshots" ADD CONSTRAINT "activity_snapshots_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_categories" ADD CONSTRAINT "document_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "document_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_types" ADD CONSTRAINT "shift_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_shift_type_id_fkey" FOREIGN KEY ("shift_type_id") REFERENCES "shift_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_import_batches" ADD CONSTRAINT "attendance_import_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_heads" ADD CONSTRAINT "pay_heads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_structure_templates" ADD CONSTRAINT "pay_structure_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_structure_components" ADD CONSTRAINT "pay_structure_components_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "pay_structure_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_structure_components" ADD CONSTRAINT "pay_structure_components_head_id_fkey" FOREIGN KEY ("head_id") REFERENCES "pay_heads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_structure_assignments" ADD CONSTRAINT "pay_structure_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_structure_assignments" ADD CONSTRAINT "pay_structure_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_structure_assignments" ADD CONSTRAINT "pay_structure_assignments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "pay_structure_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_head_id_fkey" FOREIGN KEY ("head_id") REFERENCES "pay_heads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_users" ADD CONSTRAINT "client_portal_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_users" ADD CONSTRAINT "client_portal_users_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_contents" ADD CONSTRAINT "help_contents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_change_requests" ADD CONSTRAINT "profile_change_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_change_requests" ADD CONSTRAINT "profile_change_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter_templates" ADD CONSTRAINT "letter_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_letters" ADD CONSTRAINT "generated_letters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_letters" ADD CONSTRAINT "generated_letters_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "letter_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_letters" ADD CONSTRAINT "generated_letters_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_letters" ADD CONSTRAINT "generated_letters_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_letters" ADD CONSTRAINT "generated_letters_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "employee_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_letter_settings" ADD CONSTRAINT "tenant_letter_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invoice_settings" ADD CONSTRAINT "tenant_invoice_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_email_templates" ADD CONSTRAINT "invoice_email_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_attendance_overrides" ADD CONSTRAINT "monthly_attendance_overrides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_attendance_overrides" ADD CONSTRAINT "monthly_attendance_overrides_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_declarations" ADD CONSTRAINT "it_declarations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_declarations" ADD CONSTRAINT "it_declarations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

