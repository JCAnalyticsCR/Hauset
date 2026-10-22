FROM node:24-alpine AS build
WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG PUBLIC_SITE_URL=https://hausetcr.com
ARG PUBLIC_BASE_PATH=/
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL PUBLIC_BASE_PATH=$PUBLIC_BASE_PATH
RUN npm run check && npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
ARG PUBLIC_SITE_URL=https://hausetcr.com
ARG PUBLIC_BASE_PATH=/
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL PUBLIC_BASE_PATH=$PUBLIC_BASE_PATH
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
USER node
EXPOSE 3000
CMD ["node", "server/index.mjs"]
