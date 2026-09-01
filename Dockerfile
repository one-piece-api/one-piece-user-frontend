# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist/user-frontend/browser /usr/share/nginx/html
COPY docker-entrypoint.d/40-generate-runtime-config.sh /docker-entrypoint.d/40-generate-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-generate-runtime-config.sh
# Stesso valore hardcoded finora in auth-urls.ts (locale/ci: vedi
# docs/adr/0001-runtime-config-injection.md) - onepiece-infrastructure lo
# sovrascrive solo nell'ambiente "remote".
ENV KEYCLOAK_ORIGIN=http://localhost:8080
EXPOSE 80
