FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=8081

WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm ci --ignore-scripts --omit=dev --no-audit --no-fund \
    && npm cache clean --force
COPY server.mjs /app/server.mjs

USER node
EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=8s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8081/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "/app/server.mjs"]
