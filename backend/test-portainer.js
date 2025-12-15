const axios = require('axios');

const headers = {
  'X-API-Key': 'ptr_yleHutYsJ1Y3GTfcj5ha4VWLjBQEydWQN5sSHpPB+/M='
};

(async () => {
  try {
    console.log('Testing GET...');
    const r = await axios.get('http://portainer:9000/api/endpoints/3', { headers, timeout: 5000 });
    console.log('GET OK:', r.status);
  } catch (e) {
    console.error('GET ERROR:', e.code, e.response?.status, e.response?.data || e.message);
  }

  try {
    console.log('Testing POST...');
    const stackFileContent = "version: '3.8'\nservices:\n  hello:\n    image: alpine\n    command: ['echo','hi']\n";
    const r2 = await axios.post(
      'http://portainer:9000/api/stacks/create/standalone/string?endpointId=3',
      { name: 'ping-stack-test', stackFileContent },
      { headers, timeout: 60000 }
    );
    console.log('POST OK:', r2.status, r2.data);
  } catch (e) {
    console.error('POST ERROR:', e.code, e.response?.status, e.response?.data || e.message);
  }
})();
