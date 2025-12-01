FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy all source files first (node_modules excluded by .dockerignore)
COPY . .

# Install dependencies and generate Prisma client for Debian runtime
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x
RUN npm install && npx prisma generate

EXPOSE 3000

CMD ["/bin/sh", "-c", "npx prisma migrate deploy && npm run dev"]
