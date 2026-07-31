import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

export type RegisteredUser = {
  email: string;
  userId: string;
  accessToken: string;
};

export const uniqueEmail = (label: string): string =>
  `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@test.supportmind.dev`;

export async function registerUser(
  app: INestApplication<App>,
  label: string,
): Promise<RegisteredUser> {
  const email = uniqueEmail(label);

  const response = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, password: 'StrongPassword123!' })
    .expect(201);

  const body = response.body as {
    user: { id: string };
    accessToken: string;
  };

  return { email, userId: body.user.id, accessToken: body.accessToken };
}
