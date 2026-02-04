FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Allow overriding API URL at build time (defaults to .env.production value)
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Build - Vite reads from .env.production, but env vars take precedence
# Source maps are disabled in vite.config.ts
RUN npm run build

# Production stage - use nginx for security headers
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config with security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy only the built static files (no source code)
COPY --from=builder /app/dist /usr/share/nginx/html

# Remove any source maps if accidentally generated
RUN find /usr/share/nginx/html -name "*.map" -delete 2>/dev/null || true

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
