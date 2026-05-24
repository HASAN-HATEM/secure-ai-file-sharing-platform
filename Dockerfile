FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED 1
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ENV DATABASE_URL=postgres://postgres:postgres@db:5432/securefiles
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
