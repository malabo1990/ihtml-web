// Tests de UI del sitio (estático). Correr con: tests/run.sh
// Sirve la raíz del repo con python3 en :8472 y usa el Playwright ya
// instalado en el repo del editor (el sitio no tiene package.json a propósito).
const path = require('path');

module.exports = {
  testDir: __dirname,
  testMatch: /.*\.spec\.cjs$/,
  timeout: 30000,
  fullyParallel: true,
  reporter: [['list']],
  // resultados fuera del repo (no se publican en Pages)
  outputDir: process.env.PW_OUTPUT_DIR || require('os').tmpdir() + '/ihtml-web-test-results',
  use: {
    baseURL: 'http://127.0.0.1:8472/',
    browserName: 'chromium',
    headless: true
  },
  webServer: {
    command: 'python3 -m http.server 8472 --bind 127.0.0.1',
    cwd: path.resolve(__dirname, '..'),
    url: 'http://127.0.0.1:8472/index.html',
    reuseExistingServer: true,
    timeout: 15000
  }
};
