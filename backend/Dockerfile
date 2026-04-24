FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production && npm install express

COPY host.json ./
COPY server.js ./
COPY src/ ./src/

EXPOSE 7071
CMD ["node", "server.js"]
