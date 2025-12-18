# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --production

# Copy source code and supporting assets
COPY src ./src
COPY config ./config
COPY docs ./docs
COPY proto ./proto
COPY DATA_STRUCTURE_REPORT.json ./DATA_STRUCTURE_REPORT.json

# Expose port
EXPOSE 8080

# Start the application
CMD ["node", "src/index.js"]

