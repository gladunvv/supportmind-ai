FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app


FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile


FROM dependencies AS builder

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

RUN pnpm prisma generate
RUN pnpm build
RUN pnpm prune --prod


FROM node:22-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

RUN addgroup --system --gid 1001 supportmind \
  && adduser --system --uid 1001 --ingroup supportmind supportmind

COPY --from=builder --chown=supportmind:supportmind /app/package.json ./
COPY --from=builder --chown=supportmind:supportmind /app/node_modules ./node_modules
COPY --from=builder --chown=supportmind:supportmind /app/dist ./dist
COPY --from=builder --chown=supportmind:supportmind /app/prisma ./prisma
COPY --from=builder --chown=supportmind:supportmind /app/prisma.config.ts ./
COPY --chown=supportmind:supportmind docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x ./docker/entrypoint.sh \
  && mkdir -p storage/uploads \
  && chown -R supportmind:supportmind /app

USER supportmind

EXPOSE 3000

ENTRYPOINT ["./docker/entrypoint.sh"]