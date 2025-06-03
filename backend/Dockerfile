FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV FRONTEND_URL=http://frontend:3000

# Expose the port
EXPOSE 4000

# Start the app with a script that ensures the database is ready
CMD ["node", "index.js"]