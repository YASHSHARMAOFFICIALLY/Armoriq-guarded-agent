# Backend: agent + policy engine + MCP client (Express + Socket.IO).
# This part CANNOT run on Vercel — it holds websockets, in-memory approval state, and spawns the
# security-ops MCP server as a stdio child process. It needs a persistent container (Render/Railway/Fly).
FROM node:22-slim
WORKDIR /app

# prisma's query engine needs openssl at runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy the whole repo (node_modules/.next/dist excluded via .dockerignore) so npm workspaces resolve.
COPY . .

# NODE_ENV is left unset here so devDependencies (tsx, prisma) DO install — the server runs via tsx,
# there is no separate compile step.
RUN npm install \
 && npm run build -w packages/mcp-servers/security-ops \
 && npx -w packages/server prisma generate

ENV NODE_ENV=production
# Host injects PORT, OPENAI_API_KEY, DATABASE_URL. `db push` creates the tables on first boot;
# the server seeds the default rules itself (seedRulesIfEmpty). cwd is /app so mcp-servers.json resolves.
CMD ["sh", "-c", "npx -w packages/server prisma db push --skip-generate && node --import tsx packages/server/src/index.ts"]
