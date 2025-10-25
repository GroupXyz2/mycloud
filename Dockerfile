FROM node:18-alpine AS client-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./

# Build mit BASE_PATH
ARG BASE_PATH=/cloud
ENV BASE_URL=${BASE_PATH}
RUN npm run build

FROM node:18-alpine

WORKDIR /app

# Install dependencies for server
COPY package*.json ./
RUN npm install --omit=dev

# Copy server code
COPY server/ ./server/

# Copy built client from previous stage
COPY --from=client-builder /app/client/dist ./client/dist

# Create data directories
RUN mkdir -p /app/data/uploads

# Expose port
EXPOSE 6868

# Start server
CMD ["node", "server/index.js"]
