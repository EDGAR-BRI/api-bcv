# API de Tasas de Cambio BCV (No Oficial)

Una API REST simple, desarrollada en Node.js y Express, que extrae las tasas de cambio de referencia publicadas por el [Banco Central de Venezuela (BCV)](https://www.bcv.org.ve/).

Implementa un sistema de caché integrado para ofrecer respuestas instantáneas, minimizar las peticiones al sitio del BCV y evitar bloqueos de IP.

![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=node.js)
![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express)

## Características Principales

* **Extracción Confiable:** Obtiene las tasas de las principales divisas publicadas (USD, EUR, CNY, TRY, RUB).
* **Sistema de Caché:** Las respuestas se almacenan en caché durante **3 horas** (configurable) para una velocidad extrema y para proteger tu servidor de ser bloqueado por el BCV.
* **Endpoints Flexibles:** Provee un endpoint para todas las tasas y rutas dinámicas para consultar monedas individuales.
* **Manejo de Errores:** Gestiona los errores de certificado SSL del BCV y los fallos de red.

## Instalación y Puesta en Marcha

Sigue estos pasos para ejecutar la API en tu propio servidor o de forma local.

**Requisitos Previos:**
* [Node.js](https://nodejs.org/) (v16 o superior)

**Pasos:**

1.  Clona este repositorio:
    ```bash
    git clone https://github.com/Edgarbri26/api-bcv.git
    ```

2.  Navega a la carpeta del proyecto:
    ```bash
    cd tu-repo
    ```

3.  Instala las dependencias:
    ```bash
    npm install
    ```

4.  Inicia el servidor:
    ```bash
    node server.js
    ```

¡Eso es todo! El servidor se iniciará localmente en `http://localhost:3000`.

## Endpoints de la API

La API expone dos rutas principales para consumir los datos.

### 1. Obtener Todas las Tasas

Devuelve un objeto JSON completo con todas las tasas de cambio disponibles y la fecha de valor.

* **Ruta:** `GET /api/tasa`
* **Respuesta Exitosa (200 OK):**
    ```json
    {
      "fuente": "Banco Central de Venezuela (BCV)",
      "fecha_valor": "Martes, 04 Noviembre 2025",
      "tasas": {
        "USD": {
          "valor_str": "224,37620000",
          "valor_num": 224.3762
        },
        "EUR": {
          "valor_str": "258,41406954",
          "valor_num": 258.41406954
        },
        "CNY": {
          "valor_str": "31,51129836",
          "valor_num": 31.51129836
        },
        "TRY": {
          "valor_str": "5,33673772",
          "valor_num": 5.33673772
        },
        "RUB": {
          "valor_str": "2,78071880",
          "valor_num": 2.7807188
        }
      }
    }
    ```

---

### 2. Obtener una Tasa Individual

Devuelve el objeto JSON de una moneda específica. Los códigos de moneda no distinguen mayúsculas de minúsculas (`usd` funciona igual que `USD`).

* **Ruta:** `GET /api/tasa/:moneda`
* **Parámetros de Ruta:**
    * `:moneda`: El código de la divisa (`usd`, `eur`, `cny`, `try`, `rub`).

#### Ejemplo de Petición
```bash
GET /api/tasa/usd
```

#### Respuesta Exitosa (200 OK)
```json
{
  "moneda": "USD",
  "fecha": "Martes, 04 Noviembre  2025",
  "valor": {
    "valor_str": "224,37620000",
    "valor_num": 224.3762
  }
}
```

#### Ejemplo de Petición (Error)
```bash
GET /api/tasa/jpy
```

#### Respuesta de Error (404 Not Found)
```json
{
  "error": "Moneda no encontrada.",
  "moneda_solicitada": "JPY",
  "monedas_disponibles": [
    "USD",
    "EUR",
    "CNY",
    "TRY",
    "RUB"
  ]
}
```

## 🚀 Stack Tecnológico

* **Servidor:** [Node.js](https://nodejs.org/), [Express](https://expressjs.com/)
* **Cliente HTTP:** [Axios](https://axios-http.com/)
* **Web Scraping:** [Cheerio](https://cheerio.js.org/)

## ⚠️ Aviso Legal

Esta es una API no oficial y no está afiliada, asociada, autorizada, respaldada ni conectada de ninguna manera con el Banco Central de Venezuela (BCV).

El propósito de este proyecto es puramente educativo y de conveniencia. Los datos se extraen (*scrapean*) directamente del sitio web público del BCV. El uso de esta API es bajo su propio riesgo.
