import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma';
import { LoggerModule } from './common/logger';
import { AllExceptionsFilter } from './common/filters';
import { LoggingInterceptor, SanitizeInterceptor } from './common/interceptors';
import { CorrelationIdMiddleware, SecurityHeadersMiddleware } from './common/middleware';
import { ThrottleGuard } from './common/guards';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LettersModule } from './modules/letters/letters.module';
import { ClientsModule } from './modules/clients/clients.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PortalModule } from './modules/portal/portal.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { HolidaysModule } from './modules/holidays/holidays.module';
import { AuditModule } from './modules/audit/audit.module';
import { ClientPortalModule } from './modules/client-portal/client-portal.module';
import { EmailModule } from './modules/email/email.module';
import { KbModule } from './modules/kb/kb.module';
import { UsersModule } from './modules/users/users.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { ProfileChangesModule } from './modules/profile-changes/profile-changes.module';
import { ExitModule } from './modules/exit/exit.module';
import { CacheModule } from './common/cache';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    // Activates @Cron jobs (auto clock-out sweep, leave accrual)
    ScheduleModule.forRoot(),
    LoggerModule,
    CacheModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    TenantsModule,
    EmployeesModule,
    DepartmentsModule,
    AttendanceModule,
    LettersModule,
    ClientsModule,
    AssignmentsModule,
    InvoicesModule,
    DashboardModule,
    LeavesModule,
    ReportsModule,
    NotificationsModule,
    SettingsModule,
    PortalModule,
    PayrollModule,
    DocumentsModule,
    HolidaysModule,
    AuditModule,
    ClientPortalModule,
    EmailModule,
    KbModule,
    UsersModule,
    ProfileChangesModule,
    OnboardingModule,
    ShiftsModule,
    ExitModule,
  ],
  providers: [
    // Global rate limiter — 60 req/min per IP by default
    // Override per-route with @Throttle({ limit: 5, ttl: 60 })
    {
      provide: APP_GUARD,
      useClass: ThrottleGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // Sanitize runs first — strips XSS before validation & logging
    {
      provide: APP_INTERCEPTOR,
      useClass: SanitizeInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityHeadersMiddleware, CorrelationIdMiddleware)
      .forRoutes('*');
  }
}
