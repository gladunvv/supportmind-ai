# SupportMind AI

Backend для AI-помощника поддержки: загрузка базы знаний, поиск по документам, вопросы к AI и генерация черновиков ответов клиентам в рамках организаций.

## Стек

- NestJS 11 + TypeScript
- Prisma 7 + PostgreSQL + pgvector
- Redis + BullMQ для фоновой обработки документов
- JWT-авторизация, роли и права доступа
- Swagger для документации API
- Jest, ESLint, Prettier

## Запуск

```bash
pnpm install
cp env.example .env
docker compose up -d
pnpm prisma migrate dev
pnpm start:dev
```

API будет доступен на `http://localhost:3000/api`, Swagger - на `http://localhost:3000/api/docs`.

Полезные команды:

```bash
pnpm build       # сборка
pnpm test        # unit-тесты
pnpm test:e2e    # e2e-тесты
pnpm lint        # проверка и автофикс линтером
```

## Фишки

- Мультитенантность: пользователи работают внутри организаций.
- Роли участников: owner, admin, support_agent, viewer.
- Загрузка документов и фоновая индексация чанков.
- Поиск по базе знаний организации.
- AI-вопросы с сохранением источников и статуса проверки.
- Генерация черновиков ответов поддержки с тоном ответа и risk flags.
- Учет использования и аудит действий.

## Примеры использования

Регистрация и вход:

```http
POST /api/auth/register
POST /api/auth/login
```

Создание организации и загрузка документа:

```http
POST /api/organizations
POST /api/organizations/:organizationId/documents
```

Работа с базой знаний:

```http
POST /api/organizations/:organizationId/search
POST /api/organizations/:organizationId/ai/ask
POST /api/organizations/:organizationId/support/draft-reply
```

Для защищенных эндпоинтов нужен Bearer token из ответа авторизации.
