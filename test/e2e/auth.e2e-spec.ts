import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { bootstrapTestApp } from './helpers/bootstrap-app.helper';
import { uniqueEmail } from './helpers/register-user.helper';

type AuthResponseBody = {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  accessToken: string;
  refreshToken: string;
};

type ErrorResponseBody = {
  message: string;
};

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }

    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user and returns tokens without leaking password hashes', async () => {
      const email = uniqueEmail('register');
      createdEmails.push(email);

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: 'StrongPassword123!',
          firstName: 'Vlad',
          lastName: 'Gladun',
        })
        .expect(201);

      const body = response.body as AuthResponseBody;

      expect(body).toEqual({
        user: {
          id: expect.any(String) as string,
          email,
          firstName: 'Vlad',
          lastName: 'Gladun',
        },
        accessToken: expect.any(String) as string,
        refreshToken: expect.any(String) as string,
      });
      expect(Object.keys(body.user)).toEqual([
        'id',
        'email',
        'firstName',
        'lastName',
      ]);
    });

    it('normalizes the email to lowercase', async () => {
      const email = uniqueEmail('normalize');
      createdEmails.push(email);

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: email.toUpperCase(),
          password: 'StrongPassword123!',
        })
        .expect(201);

      const body = response.body as AuthResponseBody;

      expect(body.user.email).toBe(email);
    });

    it('rejects registering the same email twice', async () => {
      const email = uniqueEmail('duplicate');
      createdEmails.push(email);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'StrongPassword123!' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password: 'AnotherPassword123!' })
        .expect(409);
    });

    it('rejects a password shorter than the minimum length', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: uniqueEmail('short-pw'), password: 'short' })
        .expect(400);
    });

    it('rejects an invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'StrongPassword123!' })
        .expect(400);
    });

    it('rejects requests containing unknown fields', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: uniqueEmail('unknown-field'),
          password: 'StrongPassword123!',
          role: 'owner',
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    const password = 'StrongPassword123!';
    let email: string;

    beforeAll(async () => {
      email = uniqueEmail('login');
      createdEmails.push(email);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email, password })
        .expect(201);
    });

    it('logs in with correct credentials and returns tokens', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);

      const body = response.body as AuthResponseBody;

      expect(body).toEqual({
        user: {
          id: expect.any(String) as string,
          email,
          firstName: null,
          lastName: null,
        },
        accessToken: expect.any(String) as string,
        refreshToken: expect.any(String) as string,
      });
    });

    it('rejects an unknown email with a generic message', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: uniqueEmail('missing'), password })
        .expect(401);

      const body = response.body as ErrorResponseBody;

      expect(body.message).toBe('Invalid email or password');
    });

    it('rejects an incorrect password with the same generic message', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassword123!' })
        .expect(401);

      const body = response.body as ErrorResponseBody;

      expect(body.message).toBe('Invalid email or password');
    });
  });
});
