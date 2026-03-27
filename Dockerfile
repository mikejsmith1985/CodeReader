FROM node:20-alpine

# git is needed to clone learning repos; python3/make/g++ for better-sqlite3 native build
RUN apk add --no-cache git python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "server.js"]
