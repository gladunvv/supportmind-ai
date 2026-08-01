import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

export type DocumentBody = {
  id: string;
  organizationId: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function uploadDocument(
  app: INestApplication<App>,
  accessToken: string,
  organizationId: string,
  content: string,
  filename: string,
  contentType: string,
): Promise<DocumentBody> {
  const response = await request(app.getHttpServer())
    .post(`/api/organizations/${organizationId}/documents`)
    .set('Authorization', `Bearer ${accessToken}`)
    .attach('file', Buffer.from(content), { filename, contentType })
    .expect(201);

  return response.body as DocumentBody;
}

export async function waitForDocumentStatus(
  app: INestApplication<App>,
  accessToken: string,
  organizationId: string,
  documentId: string,
  targetStatuses: string[],
  timeoutMs = 10_000,
): Promise<DocumentBody> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const response = await request(app.getHttpServer())
      .get(`/api/organizations/${organizationId}/documents/${documentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as DocumentBody;

    if (targetStatuses.includes(body.status)) {
      return body;
    }

    if (Date.now() > deadline) {
      throw new Error(
        `Document ${documentId} did not reach [${targetStatuses.join(', ')}] within ${timeoutMs}ms (last status: ${body.status})`,
      );
    }

    await sleep(200);
  }
}

export async function uploadAndIndexDocument(
  app: INestApplication<App>,
  accessToken: string,
  organizationId: string,
  content: string,
  filename: string,
  contentType: string,
  timeoutMs = 10_000,
): Promise<DocumentBody> {
  const document = await uploadDocument(
    app,
    accessToken,
    organizationId,
    content,
    filename,
    contentType,
  );

  return waitForDocumentStatus(
    app,
    accessToken,
    organizationId,
    document.id,
    ['indexed', 'failed'],
    timeoutMs,
  );
}
