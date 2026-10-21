FROM node:20-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY database ./database
COPY .sequelizerc ./
COPY docker-entrypoint.sh ./
RUN chmod 0555 docker-entrypoint.sh && chown -R node:node /app

USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]