// modules/bcv.js
// Scraping de tasas del Banco Central de Venezuela (BCV).
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const BCV_URL = process.env.BCV_URL || 'https://www.bcv.org.ve/';

function parseRate(rateStr) {
  if (!rateStr) return null;
  const value = parseFloat(String(rateStr).trim().replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function parseDateBCV(dateStr) {
  if (!dateStr) return null;
  const months = {
    enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
    julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
  };

  const cleanStr = String(dateStr).toLowerCase().replace(/,/g, '').trim();
  const parts = cleanStr.split(/\s+/);

  const day = parts.find((p) => /^\d{1,2}$/.test(p));
  const year = parts.find((p) => /^\d{4}$/.test(p));
  const monthName = parts.find((p) => months[p]);

  if (day && year && monthName) {
    return `${year}-${months[monthName]}-${day.padStart(2, '0')}`;
  }
  return null;
}

/**
 * Extrae las tasas USD y EUR publicadas por el BCV.
 * Parse defensivo: si un selector no devuelve número, se usa null (no rompe el resto).
 * @returns {Promise<{usd: number|null, eur: number|null, fecha_iso: string|null}>}
 */
async function scrapeBcv() {
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });

  const { data: html } = await axios.get(BCV_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      Host: 'www.bcv.org.ve',
    },
    decompress: true,
    httpsAgent,
  });

  const $ = cheerio.load(html);
  const fecha = $('.pull-right .date-display-single').text().trim();

  return {
    usd: parseRate($('#dolar strong').text()),
    eur: parseRate($('#euro strong').text()),
    fecha_iso: parseDateBCV(fecha),
  };
}

module.exports = { scrapeBcv, parseRate, parseDateBCV, BCV_URL };
