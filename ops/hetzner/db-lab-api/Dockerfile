FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=8080

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates default-mysql-client postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server.mjs /app/server.mjs

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=8s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "/app/server.mjs"]
