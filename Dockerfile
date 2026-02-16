FROM node:18-alpine AS client-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./

ARG BASE_PATH=/cloud
ENV BASE_URL=${BASE_PATH}
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server/ ./server/

COPY --from=client-builder /app/client/dist ./client/dist

RUN mkdir -p /app/data/uploads

EXPOSE 6868

CMD ["node", "server/index.js"]
