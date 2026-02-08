# Stage 1: Build the application
FROM node:20.12.2-alpine as builder

WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
# NOTE: A .dockerignore file should be present in the root of your project
# to exclude node_modules, .git, and other unnecessary files from being copied.
COPY . .

# Run tests
# This step ensures that the application is functional before creating an image.
RUN npm test

# Stage 2: Create a minimal production image
FROM node:20.12.2-alpine

WORKDIR /app

# Copy only necessary files from the builder stage
# Copy node_modules separately to ensure it's present for production
COPY --from=builder /app/node_modules ./node_modules

# Copy all application files (excluding node_modules which is handled above).
# This assumes a standard Node.js project structure where source files are directly
# under the work directory or in subdirectories, and no separate 'dist' folder is used.
COPY --from=builder /app/. ./

# Expose the application port
EXPOSE 3000

# Command to run the application using npm start, as defined in package.json
CMD ["npm", "start"]