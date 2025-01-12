
import url from 'url'
import path from 'path';
import http from 'http';
import puppeteer from 'puppeteer';
import nodeStatic from 'node-static';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fileServer = new nodeStatic.Server(path.resolve(__dirname, 'browser'));
const httpServer = http.createServer();

httpServer.on('request', (req, res) => {
  req.once('end', () => fileServer.serve(req, res)).resume();
});

let exitCode = 0;

httpServer.once('listening', () => {
  (async () => {
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    page.on('console', async (evt) => {
      const [msg, ...args] = await Promise.all(evt.args().map(arg => arg.jsonValue()));
      console.log(msg, ...args);
    });
    await page.goto('http://127.0.0.1:8080/index.html');
    await page.waitForFunction('window.__TEST_RESULTS__');
    const { failures, total }: { failures: number, total: number }
      = await page.evaluate('window.__TEST_RESULTS__') as any;
    if (failures > 0  || total === 0) {
      exitCode = 1;
    }
    await browser.close();
    httpServer.close(() => {
      process.exit(exitCode);
    });
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
});

httpServer.listen(8080, '127.0.0.1');
