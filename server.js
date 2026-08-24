// server.js
// API de tasas de cambio: BCV (USD/EUR) + promedio P2P Binance (USDT).
// Endpoints nuevos:
//   GET /api/rates          -> todas las fuentes (BCV + USDT)
//   GET /api/rates/:moneda  -> una moneda (usd | eur | usdt)
// Endpoints legacy (compatibilidad hacia atrás):
//   GET /api/tasa           -> tasas BCV (USD, EUR) en formato original
//   GET /api/tasa/:moneda   -> moneda individual (usd, eur) en formato original
// Caché por fuente: USDT 30 min (CACHE_MS_USDT), BCV con refresco diario a la
// 1:00 am (BCV_REFRESH_HOUR en la zona BCV_TZ). ?force=1 para forzar scraping.
// Error parcial: si una fuente falla, se devuelve la otra con su campo "error".
require('dotenv').config();
const express = require('express');
const { scrapeBcv } = require('./modules/bcv');
const { scrapeUsdt } = require('./modules/binance');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_MS_USDT = Number(process.env.CACHE_MS_USDT) || 30 * 60 * 1000; // 30 min
const BCV_REFRESH_HOUR = Number(process.env.BCV_REFRESH_HOUR) || 1; // 1:00 am
const BCV_TZ = process.env.BCV_TZ || 'America/Caracas';

// Caché por fuente: { bcv: {data, ts}, usdt: {data, ts} }
const cache = {};

const MONEDAS = ['USD', 'EUR', 'USDT'];

function cacheGet(source, force, ttl) {
  const entry = cache[source];
  if (!force && entry && Date.now() - entry.ts < ttl) {
    return entry.data;
  }
  return null;
}

function cacheSet(source, data) {
  cache[source] = { data, ts: Date.now() };
}

// ─── Expiración por reloj para el BCV ────────────────────────────────────────
// El BCV publica su tasa una vez al día. El caché es válido solo si se grabó
// después de la última 1:00 am (BCV_REFRESH_HOUR) en la zona BCV_TZ.

function zonedParts(date, tz) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return parts;
}

function zonedTs(y, mo, d, hour, tz) {
  const guess = Date.UTC(y, mo - 1, d, hour, 0, 0, 0);
  const local = zonedParts(new Date(guess), tz);
  const delta =
    guess - Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, 0);
  return guess + delta;
}

function lastBcvRefreshTs() {
  const now = new Date();
  const p = zonedParts(now, BCV_TZ);
  let ts = zonedTs(p.year, p.month, p.day, BCV_REFRESH_HOUR, BCV_TZ);
  if (ts > now.getTime()) {
    const yp = zonedParts(new Date(now.getTime() - 24 * 60 * 60 * 1000), BCV_TZ);
    ts = zonedTs(yp.year, yp.month, yp.day, BCV_REFRESH_HOUR, BCV_TZ);
  }
  return ts;
}

function bcvCacheGet(force) {
  const entry = cache['bcv'];
  if (!force && entry && entry.ts >= lastBcvRefreshTs()) {
    return entry.data;
  }
  return null;
}

async function getBcv(force) {
  const cached = bcvCacheGet(force);
  if (cached) return cached;
  const data = await scrapeBcv();
  cacheSet('bcv', data);
  return data;
}

async function getUsdt(force) {
  const cached = cacheGet('usdt', force, CACHE_MS_USDT);
  if (cached) return cached;
  const data = await scrapeUsdt();
  cacheSet('usdt', data);
  return data;
}

/**
 * Obtiene las tasas de todas las fuentes con error parcial.
 * @returns {{ bcv?: any, usdt?: any, error?: Record<string,string> }}
 */
async function getAllRates(force) {
  const result = {};

  try {
    result.bcv = await getBcv(force);
  } catch (error) {
    result.error = { ...(result.error || {}), bcv: error.message };
  }

  try {
    result.usdt = await getUsdt(force);
  } catch (error) {
    result.error = { ...(result.error || {}), usdt: error.message };
  }

  return result;
}

function buildFullResponse(rates) {
  const bcv = rates.bcv;
  const usdt = rates.usdt;

  const payload = {
    bcv: bcv
      ? { usd: bcv.usd, eur: bcv.eur, fecha_iso: bcv.fecha_iso }
      : null,
    usdt: usdt ? { valor: usdt.usdt, fecha_iso: new Date().toISOString().slice(0, 10) } : null,
    generated_at: new Date().toISOString(),
  };

  if (rates.error) payload.error = rates.error;
  return payload;
}

// Health check: verifica que el servicio está corriendo. No depende del
// scraping externo (BCV/Binance), responde rápido con 200.
app.get('/api', (req, res) => {
  res.json({
    status: 'OK',
    service: 'api-dollar',
    version: '2.0.0',
    uptime_seconds: Math.floor(process.uptime()),
    generated_at: new Date().toISOString(),
    endpoints: ['/api', '/api/rates', '/api/rates/:moneda', '/api/tasa', '/api/tasa/:moneda'],
  });
});

app.get('/api/rates', async (req, res) => {
  const force = req.query.force === '1' || req.query.force === 'true';
  try {
    const rates = await getAllRates(force);

    // Si TODAS las fuentes fallaron, respondemos 500.
    if (!rates.bcv && !rates.usdt) {
      return res.status(500).json({
        error: 'No se pudo obtener ninguna fuente de tasas.',
        details: rates.error,
      });
    }

    res.json(buildFullResponse(rates));
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor.', message: error.message });
  }
});

app.get('/api/rates/:moneda', async (req, res) => {
  const force = req.query.force === '1' || req.query.force === 'true';
  const moneda = String(req.params.moneda || '').toUpperCase();

  if (!MONEDAS.includes(moneda)) {
    return res.status(404).json({
      error: 'Moneda no encontrada.',
      moneda_solicitada: moneda,
      monedas_disponibles: MONEDAS,
    });
  }

  try {
    let data;
    let fecha_iso = new Date().toISOString().slice(0, 10);

    if (moneda === 'USDT') {
      const usdt = await getUsdt(force);
      data = usdt.usdt;
    } else {
      const bcv = await getBcv(force);
      data = moneda === 'USD' ? bcv.usd : bcv.eur;
      fecha_iso = bcv.fecha_iso || fecha_iso;
    }

    if (data === null || data === undefined) {
      return res.status(502).json({
        error: `No se pudo obtener la tasa de ${moneda} en esta fuente.`,
        moneda,
      });
    }

    res.json({ moneda, valor: data, fecha_iso });
  } catch (error) {
    res.status(500).json({
      error: `Error obteniendo la tasa de ${moneda}.`,
      message: error.message,
    });
  }
});

// ─── Endpoints legacy (compatibilidad hacia atrás) ───────────────────────────
const LEGACY_MONEDAS = ['USD', 'EUR'];

app.get('/api/tasa', async (req, res) => {
  const force = req.query.force === '1' || req.query.force === 'true';
  try {
    const bcv = await getBcv(force);

    if (!bcv) {
      return res.status(500).json({
        error: 'Error interno del servidor.',
        message: 'No se pudo obtener datos del BCV.',
      });
    }

    const tasas = {};
    for (const moneda of LEGACY_MONEDAS) {
      const val = moneda === 'USD' ? bcv.usd : bcv.eur;
      if (val !== null && val !== undefined) {
        tasas[moneda] = {
          valor_str: String(val).replace('.', ','),
          valor_num: val,
        };
      }
    }

    res.json({
      fuente: 'Banco Central de Venezuela (BCV)',
      fecha_valor: bcv.fecha_iso || null,
      fecha_iso: bcv.fecha_iso,
      tasas,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error interno del servidor.',
      message: error.message,
    });
  }
});

app.get('/api/tasa/:moneda', async (req, res) => {
  const force = req.query.force === '1' || req.query.force === 'true';
  const moneda = String(req.params.moneda || '').toUpperCase();

  if (!LEGACY_MONEDAS.includes(moneda)) {
    return res.status(404).json({
      error: 'Moneda no encontrada.',
      moneda_solicitada: moneda,
      monedas_disponibles: LEGACY_MONEDAS,
    });
  }

  try {
    const bcv = await getBcv(force);
    const val = moneda === 'USD' ? bcv.usd : bcv.eur;

    if (val === null || val === undefined) {
      return res.status(502).json({
        error: `No se pudo obtener la tasa de ${moneda}.`,
        moneda,
      });
    }

    res.json({
      moneda,
      fecha: bcv.fecha_iso,
      fecha_iso: bcv.fecha_iso,
      valor: {
        valor_str: String(val).replace('.', ','),
        valor_num: val,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error interno del servidor.',
      message: error.message,
    });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`API de tasas corriendo en http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET http://localhost:${PORT}/api            (health check)`);
  console.log(`  GET http://localhost:${PORT}/api/rates`);
  console.log(`  GET http://localhost:${PORT}/api/rates/:moneda (usd | eur | usdt)`);
  console.log(`  GET http://localhost:${PORT}/api/tasa         (legacy)`);
  console.log(`  GET http://localhost:${PORT}/api/tasa/:moneda (legacy: usd | eur)`);
});
