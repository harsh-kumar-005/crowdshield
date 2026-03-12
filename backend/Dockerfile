FROM node:20-alpine
WORKDIR /app

# Install dependencies first (layer cache friendly)
COPY package*.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY . .
RUN npm run build

EXPOSE 5000
CMD ["node", "dist/index.js"]
