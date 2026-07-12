import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  AuditLogAction,
  DocumentStatus,
  MembershipRole,
  UsageEventType,
} from '../src/generated/prisma/enums';
import { hash } from 'argon2';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  try {
    const ownerEmail = 'owner@supportmind.dev';
    const ownerPassword = 'StrongPassword123!';

    const passwordHash = await hash(ownerPassword);

    const owner = await prisma.user.upsert({
      where: {
        email: ownerEmail,
      },
      update: {},
      create: {
        email: ownerEmail,
        passwordHash,
        firstName: 'Owner',
        lastName: 'User',
      },
    });

    const organization = await prisma.organization.upsert({
      where: {
        slug: 'acme-support',
      },
      update: {},
      create: {
        name: 'Acme Support',
        slug: 'acme-support',
        description: 'Demo support workspace for SupportMind AI.',
      },
    });

    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: owner.id,
          organizationId: organization.id,
        },
      },
      update: {
        role: MembershipRole.owner,
      },
      create: {
        userId: owner.id,
        organizationId: organization.id,
        role: MembershipRole.owner,
      },
    });

    const document = await prisma.document.upsert({
      where: {
        id: 'demo_refund_policy_document',
      },
      update: {},
      create: {
        id: 'demo_refund_policy_document',
        organizationId: organization.id,
        uploadedById: owner.id,
        title: 'Refund Policy',
        originalName: 'refund-policy.md',
        mimeType: 'text/markdown',
        sizeBytes: 280,
        storageKey: 'seed/refund-policy.md',
        status: DocumentStatus.indexed,
      },
    });

    await prisma.documentChunk.deleteMany({
      where: {
        documentId: document.id,
      },
    });

    await prisma.documentChunk.createMany({
      data: [
        {
          organizationId: organization.id,
          documentId: document.id,
          content:
            'Refund policy\n\nAnnual plans may be reviewed by billing support. Customers should provide an invoice ID and account email. Refund eligibility depends on account status and prior billing exceptions.',
          chunkIndex: 0,
          tokenCount: 45,
        },
        {
          organizationId: organization.id,
          documentId: document.id,
          content:
            'Password reset\n\nUsers can reset their password from account settings. If they cannot access their account, support can send a secure password reset link.',
          chunkIndex: 1,
          tokenCount: 35,
        },
      ],
    });

    await prisma.usageEvent.createMany({
      data: [
        {
          organizationId: organization.id,
          userId: owner.id,
          type: UsageEventType.document_uploaded,
          metadata: {
            documentId: document.id,
            source: 'seed',
          },
        },
        {
          organizationId: organization.id,
          userId: owner.id,
          type: UsageEventType.document_indexed,
          metadata: {
            documentId: document.id,
            source: 'seed',
          },
        },
      ],
    });

    await prisma.auditLog.createMany({
      data: [
        {
          organizationId: organization.id,
          actorUserId: owner.id,
          action: AuditLogAction.organization_created,
          entityType: 'organization',
          entityId: organization.id,
          metadata: {
            source: 'seed',
          },
        },
        {
          organizationId: organization.id,
          actorUserId: owner.id,
          action: AuditLogAction.document_uploaded,
          entityType: 'document',
          entityId: document.id,
          metadata: {
            title: document.title,
            source: 'seed',
          },
        },
      ],
    });

    console.log('Seed completed.');
    console.log('');
    console.log('Demo credentials:');
    console.log(`Email: ${ownerEmail}`);
    console.log(`Password: ${ownerPassword}`);
    console.log('');
    console.log(`Organization ID: ${organization.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
