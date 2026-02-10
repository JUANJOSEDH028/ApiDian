FROM node:18-alpine

# Instalar dependencias del sistema para Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Configurar Playwright para usar Chromium del sistema
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código de la aplicación
COPY server-dian-api.js .
COPY dian-search-by-cufe.js .
COPY dian-search-by-cufe-visible.js .
COPY extraer-turnstile-token.js .

# Exponer puerto
EXPOSE 3456

# Comando para iniciar la API
CMD ["node", "server-dian-api.js"]
