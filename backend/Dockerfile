FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

ENV NODE_ENV=production
EXPOSE 8080

# 기동 시 대기 중인 마이그레이션을 먼저 적용한다. 실패하면 컨테이너가 뜨지 않으므로
# Cloud Run은 새 리비전으로 트래픽을 넘기지 않고 기존 리비전이 계속 서비스한다.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
