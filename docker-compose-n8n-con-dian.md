# Configuración de docker-compose para n8n con acceso a API DIAN

## Solución recomendada: Agregar extra_hosts y variable de entorno

Agrega estas líneas al servicio `n8n` en tu `docker-compose.yml`:

```yaml
  n8n:
    image: docker.n8n.io/n8nio/n8n
    restart: always
    container_name: n8n
    ports:
      - "127.0.0.1:5678:5678"
    # ───── AGREGAR ESTO para acceso al host ─────
    extra_hosts:
      - "host.docker.internal:host-gateway"
    # ───── FIN AGREGAR ─────
    environment:
      # ... tus variables existentes ...
      
      # ───── AGREGAR ESTA VARIABLE para la API DIAN ─────
      DIAN_API_URL: http://host.docker.internal:3456
      # O si prefieres usar la IP del servidor directamente:
      # DIAN_API_URL: http://10.0.0.63:3456
      # ───── FIN AGREGAR ─────
      
      # ───── Base de datos LOCAL ─────
      DB_TYPE: postgresdb
      # ... resto de tus variables ...
```

## docker-compose.yml completo (solo servicio n8n actualizado)

```yaml
  n8n:
    image: docker.n8n.io/n8nio/n8n
    restart: always
    container_name: n8n
    ports:
      - "127.0.0.1:5678:5678"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      # ───── API DIAN ─────
      DIAN_API_URL: http://host.docker.internal:3456
      
      # ───── Base de datos LOCAL ─────
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres_n8n
      DB_POSTGRESDB_PORT: 5432
      DB_POSTGRESDB_DATABASE: n8n
      DB_POSTGRESDB_USER: postgres
      DB_POSTGRESDB_PASSWORD: JUANJOse0228
      
      # ───── Configuración de Redis (Caché) ─────
      N8N_REDIS_HOST: redis_n8n
      N8N_REDIS_PORT: 6379
      N8N_REDIS_PASSWORD: JUANJOse0228
      N8N_REDIS_DB: 0
      QUEUE_BULL_REDIS_HOST: redis_n8n
      QUEUE_BULL_REDIS_PORT: 6379
      QUEUE_BULL_REDIS_PASSWORD: JUANJOse0228
      QUEUE_BULL_REDIS_DB: 1
      
      # ───── Encriptación y autenticación ─────
      N8N_ENCRYPTION_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cXdhaGlvY3pnbW5tcmVhZHJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTY3NTI5NSwiZXhwIjoyMDY1MjUxMjk1fQ.xhozha1hG0CmXR55MJmx7H06kDR-uhVbZ0Xek2h6bWM
      N8N_BASIC_AUTH_ACTIVE: true
      N8N_BASIC_AUTH_USER: admin
      N8N_BASIC_AUTH_PASSWORD: Lpff*2018
      N8N_RUNNERS_ENABLED: true
      
      # ───── Configuración de red ────
      N8N_HOST: n8n.laproff.com
      N8N_PORT: 5678
      N8N_TRUST_PROXY: "true" 
      N8N_BASE_URL: https://n8n.laproff.com/
      WEBHOOK_URL: https://n8n.laproff.com/
      N8N_EDITOR_BASE_URL: https://n8n.laproff.com/
      N8N_DIAGNOSTICS_ENABLED: false
      N8N_SECURE_COOKIE: true
      N8N_DISABLE_UI_ACCESS_CONTROL: true
      
      # ───── Configuración general ─────
      GENERIC_TIMEZONE: America/Bogota
      NODE_FUNCTION_ALLOW_EXTERNAL: "*"
      PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: "false"
      N8N_BINARY_DATA_MODE: filesystem
      N8N_BINARY_DATA_PATH: /data/binary

    volumes:
      - n8n_data:/home/node/.n8n
      - n8n_binary:/data/binary 
    depends_on:
      - postgres_n8n
      - redis_n8n
```

## Pasos para aplicar

1. **Edita tu `docker-compose.yml`** y agrega:
   - `extra_hosts` al servicio n8n
   - Variable `DIAN_API_URL` en environment

2. **Reinicia n8n:**
   ```bash
   docker-compose down n8n
   docker-compose up -d n8n
   ```

3. **Verifica que funciona:**
   ```bash
   # Entrar al contenedor
   docker exec -it n8n sh
   
   # Probar conectividad
   wget -O- http://host.docker.internal:3456/search \
     --post-data='{"cufe":"test"}' \
     --header='Content-Type: application/json'
   ```

4. **En n8n**, el flujo ya debería funcionar porque:
   - El flujo usa `{{ $env.DIAN_API_URL || 'http://172.17.0.1:3456' }}`
   - Con la variable `DIAN_API_URL=http://host.docker.internal:3456` configurada, la usará automáticamente

## Alternativa: Usar IP del servidor directamente

Si `host.docker.internal` no funciona, usa la IP del servidor:

```yaml
environment:
  DIAN_API_URL: http://10.0.0.63:3456
```

Y actualiza el flujo para usar esta IP por defecto en lugar de `172.17.0.1`.
