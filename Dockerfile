# JexonGo multiplayer server for Fly.io (see fly.toml).
# Only the game server: no front-end build, no Vercel API keys needed.
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# server.js only needs the "ws" package.
RUN echo '{"type":"module","private":true}' > package.json \
 && npm install --omit=dev --no-audit --no-fund ws@8.18.0

COPY server.js ./
COPY api/email.js api/save.js ./api/
COPY src/utils/pilot-name.js ./src/utils/

USER node
EXPOSE 8080
CMD ["node", "server.js"]
