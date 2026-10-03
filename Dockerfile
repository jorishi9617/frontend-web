FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_SIGNALING_URL=ws://localhost:8083/ws
ARG AUTH_API_INTERNAL_URL=http://localhost:8081
ARG CALL_API_INTERNAL_URL=http://localhost:8082
ENV NEXT_PUBLIC_SIGNALING_URL=$NEXT_PUBLIC_SIGNALING_URL \
    AUTH_API_INTERNAL_URL=$AUTH_API_INTERNAL_URL \
    CALL_API_INTERNAL_URL=$CALL_API_INTERNAL_URL
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
