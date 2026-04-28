FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY host.json ./
COPY server.js ./
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build && npm prune --omit=dev

EXPOSE 7071
CMD ["node", "server.js"]
