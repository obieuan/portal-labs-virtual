const axios = require('axios');

const token = process.env.PORTAINER_TOKEN || '';

const portainerClient = axios.create({
  baseURL: process.env.PORTAINER_URL + '/api',
  headers: {
    'X-API-Key': token
  },
  // Crear stack puede tardar por descarga de imagenes; damos 60s
  timeout: 180000
});

module.exports = portainerClient;
