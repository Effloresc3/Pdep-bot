# Development-focused Dockerfile
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Install NestJS CLI globally for running with --watch
RUN npm install -g @nestjs/cli

# No need to copy package files or run npm install here
# This will be handled by the entrypoint script

# Expose port 3000
EXPOSE 3000

# Create entrypoint script to check for package changes and install dependencies
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Use the entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]

# Default command (can be overridden in docker-compose)
CMD ["npm", "run", "start:dev"]