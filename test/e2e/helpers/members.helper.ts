import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

export type MembershipBody = {
  id: string;
  role: string;
  user: { id: string; email: string };
};

export async function addMember(
  app: INestApplication<App>,
  accessToken: string,
  organizationId: string,
  email: string,
  role: string,
): Promise<MembershipBody> {
  const response = await request(app.getHttpServer())
    .post(`/api/organizations/${organizationId}/members`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ email, role })
    .expect(201);

  return response.body as MembershipBody;
}
