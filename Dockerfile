# Clearworth: single container, zero npm dependencies.
FROM node:22-alpine
WORKDIR /app
COPY package.json server.js ./
COPY lib ./lib
COPY public ./public
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
# Persist the database by mounting a volume at /data
VOLUME ["/data"]
EXPOSE 3000
USER node
CMD ["node", "--no-warnings", "server.js"]
