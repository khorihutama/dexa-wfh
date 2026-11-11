# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/common/package.json ./packages/common/
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/ui/package.json ./packages/ui/
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY apps/auth-service/package.json ./apps/auth-service/
COPY apps/employee-service/package.json ./apps/employee-service/
COPY apps/attendance-service/package.json ./apps/attendance-service/
COPY apps/log-service/package.json ./apps/log-service/
COPY apps/web-employee/package.json ./apps/web-employee/
COPY apps/web-admin/package.json ./apps/web-admin/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm build

FROM base AS runner
ARG APP_DIR=apps/api-gateway
ENV NODE_ENV=production
ENV APP_DIR=${APP_DIR}
COPY --from=builder --chown=node:node /app /app
RUN mkdir -p /app/uploads/avatars && chown -R node:node /app/uploads
USER node
WORKDIR /app/${APP_DIR}
CMD ["pnpm", "start"]
