FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_SIGNALING_URL=wss://jorishi9617-video-platform-signaling.onrender.com/ws
ARG AUTH_API_INTERNAL_URL=https://jorishi9617-video-platform-auth.onrender.com
ARG CALL_API_INTERNAL_URL=https://jorishi9617-video-platform-call.onrender.com
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
