const axios = require('axios');

const portainerClient = axios.create({
  baseURL: process.env.PORTAINER_URL + '/api',
  headers: {
    'X-API-Key': process.env.PORTAINER_TOKEN
  }
});

module.exports = portainerClient;
