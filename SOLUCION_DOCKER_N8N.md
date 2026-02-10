# Solución: API DIAN no accesible desde n8n en Docker

## Problema
La API funciona con `curl` desde el servidor, pero n8n en Docker no puede acceder a ella.

## Causa
El servidor probablemente está escuchando solo en `localhost` (127.0.0.1), lo que impide que contenedores Docker accedan a él.

## Solución

### 1. Verificar/Actualizar el servidor API

El archivo `server-dian-api.js` ya está configurado para escuchar en `0.0.0.0` (todas las interfaces).

**Iniciar el servidor:**
```bash
node server-dian-api.js
```

O con variables de entorno personalizadas:
```bash
PORT=3456 HOST=0.0.0.0 node server-dian-api.js
```

### 2. Configurar n8n para acceder a la API

Tienes **3 opciones** dependiendo de tu configuración Docker:

#### Opción A: Usar la IP del host (10.0.0.63)
Si n8n está en Docker y la API está en el host:

En n8n, configura la variable de entorno:
```
DIAN_API_URL=http://10.0.0.63:3456
```

O directamente en el nodo HTTP de n8n:
```
http://10.0.0.63:3456/search
```

#### Opción B: Usar `host.docker.internal` (Windows/Mac)
Si estás en Windows o Mac y n8n está en Docker:

En n8n, configura:
```
DIAN_API_URL=http://host.docker.internal:3456
```

#### Opción C: Usar la misma red Docker
Si ambos están en Docker y en la misma red:

1. Crea un `docker-compose.yml` o asegúrate de que ambos contenedores estén en la misma red
2. Usa el nombre del servicio como hostname:
```
DIAN_API_URL=http://dian-api:3456
```

### 3. Verificar conectividad desde n8n

Desde dentro del contenedor de n8n, prueba:

```bash
# Entrar al contenedor de n8n
docker exec -it <nombre-contenedor-n8n> sh

# Probar conectividad
curl http://10.0.0.63:3456/health
# O según tu configuración:
curl http://host.docker.internal:3456/health
```

### 4. Verificar firewall

Asegúrate de que el puerto 3456 esté abierto:

**Windows:**
```powershell
# Verificar reglas de firewall
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*3456*"}

# Si necesitas abrir el puerto:
New-NetFirewallRule -DisplayName "DIAN API" -Direction Inbound -LocalPort 3456 -Protocol TCP -Action Allow
```

**Linux:**
```bash
# Verificar si el puerto está abierto
sudo netstat -tulpn | grep 3456

# Si usas ufw:
sudo ufw allow 3456/tcp
```

### 5. Verificar logs del servidor

Cuando hagas una petición desde n8n, deberías ver en los logs del servidor:

```
[API] Recibida petición para CUFE: 6667fe1f8018f00e0b6...
[DIAN] Iniciando búsqueda para CUFE: 6667fe1f8018f00e0b6...
...
[API] Respuesta enviada: ok=true, eventos=5
```

Si **NO ves estos logs**, significa que la petición no está llegando al servidor (problema de red/Docker).

## Diagnóstico rápido

1. **¿El servidor está corriendo?**
   ```bash
   curl http://localhost:3456/health
   # Debe responder: {"status":"ok","timestamp":"..."}
   ```

2. **¿El servidor escucha en 0.0.0.0?**
   ```bash
   netstat -an | grep 3456
   # Debe mostrar: 0.0.0.0:3456 o :::3456 (no solo 127.0.0.1:3456)
   ```

3. **¿n8n puede alcanzar el host?**
   Desde dentro del contenedor de n8n:
   ```bash
   ping 10.0.0.63
   # O
   ping host.docker.internal
   ```

4. **¿El puerto está accesible desde Docker?**
   Desde dentro del contenedor de n8n:
   ```bash
   telnet 10.0.0.63 3456
   # O
   nc -zv 10.0.0.63 3456
   ```

## Configuración recomendada para n8n

En el flujo de n8n (`n8n_DIAN_con_Turnstile.json`), el nodo "Configurar CUFE y API" ya tiene:

```javascript
api_url: "={{ $env.DIAN_API_URL || 'http://dian-api:3456' }}"
```

**Solución rápida:** Configura la variable de entorno `DIAN_API_URL` en n8n:

- **Si n8n está en Docker y API en host:** `http://10.0.0.63:3456`
- **Si ambos están en Docker (misma red):** `http://dian-api:3456`
- **Si estás en Windows/Mac:** `http://host.docker.internal:3456`

## Ejemplo de docker-compose.yml (si quieres poner ambos en Docker)

```yaml
version: '3.8'

services:
  dian-api:
    build: .
    ports:
      - "3456:3456"
    environment:
      - PORT=3456
      - HOST=0.0.0.0
    networks:
      - dian-network

  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - DIAN_API_URL=http://dian-api:3456
    networks:
      - dian-network
    volumes:
      - n8n_data:/home/node/.n8n

networks:
  dian-network:
    driver: bridge

volumes:
  n8n_data:
```
