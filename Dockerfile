FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist
# The Frida dataset (if bundled) ships with the image — it's static reference
# data, not per-deployment state, so it needs no volume.
COPY data ./data
USER node
EXPOSE 3000
CMD ["node", "dist/http.js"]
