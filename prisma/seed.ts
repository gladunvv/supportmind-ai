import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  AuditLogAction,
  DocumentStatus,
  MembershipRole,
  UsageEventType,
} from '../src/generated/prisma/enums';

const DEMO_OWNER_EMAIL = 'owner@supportmind.dev';
const DEMO_OWNER_PASSWORD = 'StrongPassword123!';
const DEMO_ORGANIZATION_SLUG = 'acme-support';
const DEMO_DOCUMENT_ID = 'demo_refund_policy_document';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
  }

  // Prisma adapter typings may trigger false-positive no-unsafe-* warnings.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  const prisma = new PrismaClient({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    adapter,
  });

  try {
    const passwordHash = await hash(DEMO_OWNER_PASSWORD);

    const owner = await prisma.user.upsert({
      where: {
        email: DEMO_OWNER_EMAIL,
      },
      update: {
        firstName: 'Owner',
        lastName: 'User',
        passwordHash,
      },
      create: {
        email: DEMO_OWNER_EMAIL,
        passwordHash,
        firstName: 'Owner',
        lastName: 'User',
      },
    });

    const organization = await prisma.organization.upsert({
      where: {
        slug: DEMO_ORGANIZATION_SLUG,
      },
      update: {
        name: 'Acme Support',
        description: 'Demo support workspace for SupportMind AI.',
        archivedAt: null,
      },
      create: {
        name: 'Acme Support',
        slug: DEMO_ORGANIZATION_SLUG,
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
        id: DEMO_DOCUMENT_ID,
      },
      update: {
        organizationId: organization.id,
        uploadedById: owner.id,
        title: 'Refund Policy',
        originalName: 'refund-policy.md',
        mimeType: 'text/markdown',
        sizeBytes: 280,
        storageKey: 'seed/refund-policy.md',
        status: DocumentStatus.indexed,
        deletedAt: null,
      },
      create: {
        id: DEMO_DOCUMENT_ID,
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

    await prisma.usageEvent.deleteMany({
      where: {
        organizationId: organization.id,
        metadata: {
          path: ['source'],
          equals: 'seed',
        },
      },
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

    await prisma.auditLog.deleteMany({
      where: {
        organizationId: organization.id,
        metadata: {
          path: ['source'],
          equals: 'seed',
        },
      },
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

    console.log('Seed completed successfully.');
    console.log(`Email: ${DEMO_OWNER_EMAIL}`);
    console.log(`Password: ${DEMO_OWNER_PASSWORD}`);
    console.log(`Organization ID: ${organization.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
