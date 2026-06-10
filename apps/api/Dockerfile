FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci

EXPOSE 3015

CMD ["npm", "run", "--workspace", "api", "dev"]
