# --- Stage 1: Build ---
FROM node:18-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy the rest of the project files
COPY . .

# Build the project (ensure a proper build script exists in package.json)
RUN npm run build

# --- Stage 2: Development ---
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy the package files and install all dependencies (including dev dependencies)
COPY package*.json ./
RUN npm ci

# Copy built application files and source files needed for watch mode
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/nest-cli.json ./nest-cli.json
COPY --from=builder /app/tsconfig*.json ./

# Expose port 3000
EXPOSE 3000

# Install NestJS CLI globally for running with --watch
RUN npm install -g @nestjs/cli

# Start the application with NestJS watch mode
CMD ["nest", "start", "--watch"]