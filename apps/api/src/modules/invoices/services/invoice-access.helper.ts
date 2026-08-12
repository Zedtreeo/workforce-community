// apps/api/src/modules/invoices/services/invoice-access.helper.ts
//
// Centralizes the "who can write to this invoice?" decision:
//   - ADMIN / OWNER  → always allowed
//   - Account manager of the invoice's client → allowed
//   - MANAGER not assigned as account manager  → READ-only (allowed via existing
//     RbacGuard for invoices:read)
//
// Drafts use this check liberally; finalized invoices fall through to the
// existing service-level guards (no edits after PAID, etc.).
//
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { UserRole } from '@prisma/client';

@Injectable()
export class InvoiceAccessHelper {
  constructor(private readonly prisma: PrismaService) {}

  /** Throw ForbiddenException unless user can write to this invoice. */
  async assertCanWrite(tenantId: string, invoiceId: string, userId: string, userRole: UserRole) {
    if (userRole === 'ADMIN' || userRole === 'OWNER') return;

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: { client: { select: { accountManagerId: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.client.accountManagerId === userId) return;

    throw new ForbiddenException(
      'You are not the account manager for this client. Ask an admin or the assigned account manager.',
    );
  }

  /** Same check for client-level mutations (e.g. assigning account manager). */
  async assertClientWrite(tenantId: string, clientId: string, userId: string, userRole: UserRole) {
    if (userRole === 'ADMIN' || userRole === 'OWNER') return;
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
      select: { accountManagerId: true },
    });
    if (!client) throw new NotFoundException('Client not found');
    if (client.accountManagerId === userId) return;
    throw new ForbiddenException('Not authorized for this client');
  }
}
