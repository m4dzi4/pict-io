FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy only necessary files
COPY next.config.mjs ./
COPY jsconfig.json ./
COPY postcss.config.mjs ./
COPY public ./public
COPY src ./src

# Build the Next.js app
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy from builder stage only what's needed to run
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Set environment variables
ENV NODE_ENV=production
ENV BACKEND_URL=http://backend:4000

# Expose the port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]