FROM node:20-alpine AS runner

WORKDIR /app

# Install security and production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy application source code
COPY server.js ./
COPY lib/ ./lib/
COPY public/ ./public/
COPY data/default/ ./data/default/

# Set production environment and non-root user
ENV NODE_ENV=production
ENV PORT=3000
RUN chown -R node:node /app

USER node
EXPOSE 3000

CMD ["node", "server.js"]
