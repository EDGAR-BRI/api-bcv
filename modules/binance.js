// modules/binance.js
// Tasa USDT promedio P2P Binance contra VES (BUY + SELL, top 20 por lado).
const axios = require('axios');

const P2P_URL = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'content-type': 'application/json',
};

function buildBody(tradeType) {
  return {
    asset: 'USDT',
    fiat: 'VES',
    page: 1,
    rows: 20,
    payTypes: [],
    tradeType,
  };
}

async function fetchPrices(tradeType) {
  const { data } = await axios.post(P2P_URL, buildBody(tradeType), {
    headers: HEADERS,
    timeout: 15000,
  });

  const ads = data && Array.isArray(data.data) ? data.data : [];
  const prices = ads
    .map((ad) => {
      const price = parseFloat(ad && ad.adv ? ad.adv.price : NaN);
      return Number.isFinite(price) && price > 0 ? price : null;
    })
    .filter((p) => p !== null);

  return prices;
}

function average(prices) {
  if (!prices || prices.length === 0) return null;
  return prices.reduce((sum, p) => sum + p, 0) / prices.length;
}

/**
 * Promedio simple de los precios top 20 de cada lado (BUY y SELL).
 * @returns {Promise<{usdt: number|null}>}
 */
async function scrapeUsdt() {
  const [buyPrices, sellPrices] = await Promise.all([
    fetchPrices('BUY'),
    fetchPrices('SELL'),
  ]);

  const all = [...buyPrices, ...sellPrices];
  return { usdt: average(all) };
}

module.exports = { scrapeUsdt };
