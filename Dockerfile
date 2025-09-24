FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
COPY packages/dto/package*.json ./packages/dto/

# Install dependencies for all workspaces
RUN npm ci --workspace=packages/dto && \
    npm ci --workspace=apps/api && \
    npm ci --workspace=apps/web

# Copy source code
COPY . .

# Build all workspaces
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]
