FROM node:24-bookworm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable \
    && corepack prepare pnpm@12.6.0 --activate \
    && pnpm install --prod

COPY src ./src
COPY docs ./docs

RUN mkdir -p /app/data && chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 4000

USER node

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
