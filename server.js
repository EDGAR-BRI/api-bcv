const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');


const app = express();
const PORT = process.env.PORT || 3000;
const BCV_URL = 'https://www.bcv.org.ve/';

let cache = null;
let cacheTimestamp = null;
const CACHE_DURATION_MS = 3 * 60 * 60 * 1000; // 3 horas


function parseRate(rateStr) {
  if (!rateStr) return null;
  return parseFloat(rateStr.trim().replace(',', '.'));
}


async function scrapeBCVData() {
  console.log('EXTRAYENDO DATOS DESDE EL BCV (SIN CACHÉ)...');
  
  // Crear un agente HTTPS que no rechace certificados no autorizados
  const httpsAgent = new https.Agent({ 
    rejectUnauthorized: false 
  });

  try {
    const { data: html } = await axios.get(BCV_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Host': 'www.bcv.org.ve'
      },
      decompress: true,
      httpsAgent: httpsAgent
    });

    const $ = cheerio.load(html);

    // extraer los datos
    const dolarStr = $('#dolar strong').text();
    const euroStr = $('#euro strong').text();
    const yuanStr = $('#yuan strong').text();
    const liraStr = $('#lira strong').text();
    const rubloStr = $('#rublo strong').text();
    const fecha = $(".pull-right .date-display-single").text().trim();

    // construir la respuesta
    const responseData = {
      fuente: 'Banco Central de Venezuela (BCV)',
      fecha_valor: fecha,
      tasas: {
        USD: {
          valor_str: dolarStr.trim(),
          valor_num: parseRate(dolarStr)
        },
        EUR: {
          valor_str: euroStr.trim(),
          valor_num: parseRate(euroStr)
        },
        CNY: {
          valor_str: yuanStr.trim(),
          valor_num: parseRate(yuanStr)
        },
        TRY: {
          valor_str: liraStr.trim(),
          valor_num: parseRate(liraStr)
        },
        RUB: {
          valor_str: rubloStr.trim(),
          valor_num: parseRate(rubloStr)
        }
      }
    };

    
    cache = responseData;
    cacheTimestamp = Date.now();
    
    return responseData;

  } catch (error) {
    console.error('Error al hacer scraping:', error.message);
    
    cache = null; 
    cacheTimestamp = null;
    throw new Error('No se pudo conectar y extraer los datos del BCV.');
  }
}

async function getTasaData() {
  const ahora = Date.now();
  if (cache && (ahora - cacheTimestamp < CACHE_DURATION_MS)) {
    console.log('ENTREGANDO DATOS DESDE LA CACHÉ...');
    return cache; 
  }
  
  // Si la caché no existe o está expirada, hace scraping
  return await scrapeBCVData();
}


app.get('/api/tasa', async (req, res) => {
  try {
    const data = await getTasaData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      error: 'Error interno del servidor.',
      message: error.message 
    });
  }
});


app.get('/api/tasa/:moneda', async (req, res) => {
  try {
    const moneda = req.params.moneda.toUpperCase();

    const data = await getTasaData();

    if (data.tasas && data.tasas[moneda]) {
      res.json({
        moneda: moneda,
        fecha: data.fecha_valor,
        valor: data.tasas[moneda]
      });
    } else {
      res.status(404).json({ 
        error: 'Moneda no encontrada.',
        moneda_solicitada: moneda,
        monedas_disponibles: Object.keys(data.tasas)
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Error interno del servidor.',
      message: error.message 
    });
  }
});

// Se inicia el servidor
app.listen(PORT, () => {
  console.log(`API de tasas BCV corriendo en http://localhost:${PORT}`);
  console.log(`Endpoint (TODAS): http://localhost:${PORT}/api/tasa`);
  console.log(`Endpoint (INDIVIDUAL): http://localhost:${PORT}/api/tasa/usd (o /eur, /cny, etc.)`);
});