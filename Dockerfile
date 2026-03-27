FROM node:20-slim

# Build tools: only needed if better-sqlite3 prebuilt binary download fails (fallback)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies only (no Vite/React devDeps = fewer packages)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy pre-built frontend (run 'npm run build' locally before deploying)
COPY dist ./dist

# Copy server-side source files
COPY *.js ./
COPY *.json ./

EXPOSE 3000
CMD ["node", "server.js"]
