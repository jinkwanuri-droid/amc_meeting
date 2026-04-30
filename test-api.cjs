const http = require('http');

http.get('http://localhost:3000/api/rooms', (res) => {
  console.log('Status:', res.statusCode);
  let rawData = '';
  res.on('data', (chunk) => { rawData += chunk; });
  res.on('end', () => {
    console.log('Body start:', rawData.substring(0, 100));
  });
}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
});
