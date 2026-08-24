# API de Tasas de Cambio (BCV + USDT P2P)

API REST en Node.js y Express que obtiene tasas de cambio en bolívares (Bs) con semántica
**"1 unidad de la moneda = X Bs"**:

- **USD / EUR** — publicados por el [Banco Central de Venezuela (BCV)](https://www.bcv.org.ve/).
- **USDT** — promedio de los precios **P2P de Binance** (BUY + SELL, top 20 por lado) contra VES.

> Este servicio reemplaza los endpoints anteriores (`/api/tasa`, `/api/tasa/:moneda`) por
> `GET /api/rates` y `GET /api/rates/:moneda`. Se despliega a un sitio **nuevo**; el deploy de
> producción con las rutas `/api/tasa` queda intacto.

## Stack

- **Servidor:** [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
- **HTTP:** [Axios](https://axios-http.com/)
- **Scraping:** [Cheerio](https://cheerio.js.org/)
- **Config:** [dotenv](https://github.com/motdotla/dotenv)

## Instalación y puesta en marcha

```sh
npm install
cp .env.example .env   # ajustar si es necesario
node server.js         # o: npm start
```

El servidor inicia en `http://localhost:3000`.

## Variables de entorno (`.env`)

| Variable | Descripción | Default |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `CACHE_MS_USDT` | TTL de caché para USDT (P2P Binance) en ms | `1800000` (30 min) |
| `BCV_REFRESH_HOUR` | Hora (0-23) de refresco diario del BCV | `1` (1:00 am) |
| `BCV_TZ` | Zona horaria del BCV (IANA) | `America/Caracas` |
| `BCV_URL` | URL del sitio del BCV | `https://www.bcv.org.ve/` |

## Endpoints

### 1. Obtener todas las tasas

- **Ruta:** `GET /api/rates`
- **Query opcional:** `?force=1` para forzar scraping (ignora la caché).

```json
{
  "bcv": { "usd": 779.9522, "eur": 911.21815526, "fecha_iso": "2026-08-21" },
  "usdt": { "valor": 916.9473499999998, "fecha_iso": "2026-08-20" },
  "generated_at": "2026-08-20T23:06:50.127Z"
}
```

Si una fuente falla, se devuelve la otra con un campo `error` (error parcial). Si **todas**
fallan, responde `500`.

### 2. Obtener una moneda

- **Ruta:** `GET /api/rates/:moneda` (`usd`, `eur`, `usdt`; no distingue mayúsculas).
- **Query opcional:** `?force=1`.

```json
{ "moneda": "USDT", "valor": 916.9473499999998, "fecha_iso": "2026-08-20" }
```

Si la moneda no existe, responde `404` con las disponibles.

## Caché

Se cachea **por fuente** para evitar bloqueos por parte del BCV y de Binance:

- **USDT (P2P Binance):** `CACHE_MS_USDT` (30 min por defecto).
- **BCV:** se invalida automáticamente a las `BCV_REFRESH_HOUR` (1:00 am por defecto, en la
  zona `BCV_TZ`), ya que el BCV publica su tasa una vez al día.

Usa `?force=1` cuando quieras forzar una consulta en vivo.

## Despliegue

- Trabaja en la rama `feat/rates-p2p` del fork.
- Despliega el nuevo código a **otro sitio** (ej. Vercel). El deploy actual de producción con
  las rutas `/api/tasa` queda intacto.
- El backend Adonis consume este servicio vía la variable `RATES_API_URL`.

## Aviso Legal

API no oficial. Los datos se extraen de fuentes públicas (BCV y P2P Binance). El uso es bajo tu
propio riesgo.
