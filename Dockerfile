# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Runtime stage
FROM node:18-alpine AS runtime

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S anarchy -u 1001

# Change ownership of the app directory
RUN chown -R anarchy:nodejs /app

# Switch to non-root user
USER anarchy

# Expose port (if needed for health checks)
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]