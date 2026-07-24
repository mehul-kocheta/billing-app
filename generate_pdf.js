const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const filePath = `file://${path.resolve(__dirname, 'test_pdf.html')}`;
  
  await page.goto(filePath, { waitUntil: 'networkidle0' });
  
  await page.pdf({
    path: 'test_output.pdf',
    format: 'A4',
    printBackground: true
  });
  
  await browser.close();
  console.log('PDF generated: test_output.pdf');
})();
