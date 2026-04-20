# Build desde el directorio frontend/app (contexto .). Misma idea que ../../Dockerfile.frontend.
FROM node:20-alpine AS build-stage

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Sin VITE_API_BASE_URL: en prod el cliente usa window.location.origin y nginx proxea /api.
RUN npm run build

FROM nginx:1.26-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build-stage /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
