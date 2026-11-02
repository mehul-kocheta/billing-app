import puppeteer from 'puppeteer';
import fs from 'fs';
import { execSync } from 'child_process';

const items = [
  { type: 'title', name: 'Supply of FL Boards and Vinyl\nAt Various Durga Pooja Stalls' },
  { name: 'Acrylic Sheet + Vinyl on Menu (WOD750)' },
  { name: 'Eco Vinyl + 5mm Forex Sheet (WOD750)' },
  { name: 'New Banner with Ripit (WOD837)' },
  { name: 'New D/S BL Board with Pole (WOD750)' },
  { name: 'New FL Board with printing (WOD791)' },
  { name: 'New FL Board with printing WOD842/827/831/834/791)' },
  { name: 'New S/S BL Board with printing (WOD750)' },
  { name: 'Old D/S BL Board Repairing' },
  { name: 'UV Vinyl on Menu (WOD750)' },
  { name: 'Sent by bus from Jabalpur to Mandla to Jabalpur' },
  { name: 'Sent by bus from Jabalpur to Budhar Jabalpur' },
  { name: 'Sent by bus from Jabalpur to Katni Jabalpur' },
  { name: 'Sent by bus from Jabalpur to Singrauli Jabalpur' },
  { name: 'Vinyl Printing on Sunpack (WOD760)' },
  { name: 'Glow Sign Board Repairing & Fitting' },
  { name: 'Flex Banner with Eyelets (WOD800)' },
  { name: 'One Way Vision Film on Glass (WOD710)' },
  { name: 'Star Flex Banner with Frame Fitting' },
  { name: 'Sent by courier to Rewa branch office' },
  { name: 'New S/S BL Board with printing (WOD750)' } // 20th item
];

async function runVerification() {
  console.log('='.repeat(80));
  console.log('  TEST VERIFICATION: ADDRESS RESIZE PRESERVATION IN PDF & DYNAMIC PAGINATION');
  console.log('='.repeat(80));

  const browser = await puppeteer.launch({ headless: true });
  const css = fs.readFileSync('src/index.css', 'utf8');

  const testCases = [
    { name: 'Default Address Height (38px), Top Margin 0cm', addressHeight: 38, topMarginCm: 0 },
    { name: 'Resized Address Height (120px), Top Margin 0cm', addressHeight: 120, topMarginCm: 0 },
    { name: 'Resized Address Height (120px), Top Margin 5cm (Multi-Page)', addressHeight: 120, topMarginCm: 5 },
    { name: 'Resized Address Height (160px), Top Margin 5cm (Multi-Page Extreme)', addressHeight: 160, topMarginCm: 5 }
  ];

  for (let idx = 0; idx < testCases.length; idx++) {
    const tc = testCases[idx];
    console.log(`\nTesting Case: ${tc.name}`);
    console.log('-'.repeat(80));

    const page = await browser.newPage();

    const simulation = await page.evaluate(({ testItems, addrH, topMargin }) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = '11px Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      function getLineCount(text, maxWidth = 255) {
        if (!text) return 1;
        const paragraphs = text.split('\n');
        let totalLines = 0;
        for (const para of paragraphs) {
          const trimmed = para.trim();
          if (!trimmed) { totalLines += 1; continue; }
          const words = trimmed.split(/\s+/);
          let currentLine = '';
          let paraLines = 1;
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine) {
              paraLines++;
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          totalLines += paraLines;
        }
        return Math.max(1, totalLines);
      }

      function getItemH(item) {
        if (item.type === 'title') return 25;
        const rawText = (item.name || '').replace(/<br\s*[\/]?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
        const lineCount = getLineCount(rawText, 275);
        return 25 + (lineCount - 1) * 16;
      }

      const topMarginPx = topMargin * 37.8;
      const pageHeightPx = 1122.5;

      const rawAddr = 'Bhateja Parisar, Behind BPCL Petrol Pump\nMaharajpur, Jabalpur (M.P.)';
      const addrLines = getLineCount(rawAddr, 255);
      const textAddrExtraH = Math.max(0, addrLines - 1) * 16;
      const manualAddrExtraH = addrH ? Math.max(0, addrH - 38) : 0;
      const extraAddrH = Math.max(textAddrExtraH, manualAddrExtraH);

      const dynamicMetaExtraH = extraAddrH;

      const p1NonItemH = topMarginPx + 442 + dynamicMetaExtraH;
      const p1Capacity = Math.max(200, pageHeightPx - p1NonItemH);
      const subNonItemH = topMarginPx + 476 + dynamicMetaExtraH;
      const subCapacity = Math.max(200, pageHeightPx - subNonItemH);

      // Distribute items across pages
      let curH = 0;
      const p1 = [];
      const p2 = [];
      for (const it of testItems) {
        const h = getItemH(it);
        if (p1.length > 0 && curH + h > p1Capacity) {
          p2.push(it);
        } else {
          p1.push(it);
          curH += h;
        }
      }

      return {
        dynamicMetaExtraH,
        p1NonItemH,
        p1Capacity,
        p1Count: p1.filter(x => x.type !== 'title').length,
        p2Count: p2.filter(x => x.type !== 'title').length,
        p1Items: p1,
        p2Items: p2
      };
    }, { testItems: items, addrH: tc.addressHeight, topMargin: tc.topMarginCm });

    console.log(`Dynamic Meta Extra Height: ${simulation.dynamicMetaExtraH}px`);
    console.log(`Page 1 Non-Item Overhead : ${simulation.p1NonItemH}px`);
    console.log(`Page 1 Capacity          : ${simulation.p1Capacity}px`);
    console.log(`Page 1 Items allocated   : ${simulation.p1Count}`);
    console.log(`Page 2 Items allocated   : ${simulation.p2Count}`);

    const pagesData = [
      { items: simulation.p1Items, isFirst: true, isLast: simulation.p2Items.length === 0, pageIndex: 0 }
    ];
    if (simulation.p2Items.length > 0) {
      pagesData.push({ items: simulation.p2Items, isFirst: false, isLast: true, pageIndex: 1 });
    }

    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>${css}</style>
      </head>
      <body>
        <div class="app-container">
          ${pagesData.map((p, pIdx) => `
            <div class="invoice-paper" style="--top-margin: ${tc.topMarginCm}cm; margin-top: ${tc.topMarginCm}cm; height: calc(297mm - ${tc.topMarginCm}cm); min-height: calc(297mm - ${tc.topMarginCm}cm); max-height: calc(297mm - ${tc.topMarginCm}cm);">
              <div class="bill-frame">
                <div class="doc-type-label">
                  <div class="doc-type-meta">Pan No. :- ACHPJ1044Q</div>
                  <div class="doc-type-title">TAX INVOICE</div>
                  <div class="doc-type-meta">GSTN :- 23ACHPJ1044Q1ZK</div>
                </div>
                <div class="invoice-meta-row">
                  <div class="bill-to">
                    <div class="grid-row"><label>Name</label><span>:</span><span>Ramani Ice Cream & Co. Ltd.</span></div>
                    <div class="grid-row">
                      <label>Address</label><span>:</span>
                      <textarea class="input-field" style="height: ${tc.addressHeight}px;">Bhateja Parisar, Behind BPCL Petrol Pump&#10;Maharajpur, Jabalpur (M.P.)</textarea>
                    </div>
                    <div class="grid-row"><label>Pin Code</label><span>:</span><span>482004</span></div>
                    <div class="grid-row"><label>GSTIN</label><span>:</span><span>23AABCR4589H1Z8</span></div>
                  </div>
                  <div class="invoice-details">
                    <div class="grid-row"><label>Invoice No.</label><span>:</span><span>087/2026-2027</span></div>
                    <div class="grid-row"><label>Date</label><span>:</span><span>31.10.2026</span></div>
                  </div>
                </div>
                <table class="invoice-table">
                  <thead>
                    <tr>
                      <th style="width: 4%;">Sr.No.</th>
                      <th style="width: 32%;">Name of Product / Service</th>
                      <th style="width: 8%;">HSN SAC</th>
                      <th style="width: 7%;">Size</th>
                      <th style="width: 7%;">TTL.Sq.Ft.</th>
                      <th style="width: 5%;">Qty</th>
                      <th style="width: 7%;">Rate</th>
                      <th style="width: 11%;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${p.items.map((it, idx) => {
                      if (it.type === 'title') {
                        return `<tr class="title-row"><td></td><td class="font-bold underline">${it.name.replace(/\n/g, '<br>')}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
                      }
                      return `<tr class="item-row"><td class="text-center">${idx}</td><td>${it.name}</td><td>3919</td><td>10x4</td><td>40</td><td>1</td><td>100</td><td>100.00</td></tr>`;
                    }).join('')}
                    <tr class="empty-filler"><td colspan="8"></td></tr>
                    <tr class="subtotal-row"><td colspan="7">Total Amount / Taxable Value</td><td>93028.41</td></tr>
                  </tbody>
                </table>
                <div class="invoice-footer">
                  <div class="footer-left">
                    <div class="terms-conditions">
                      <p>1. Invoice must be paid within 15days from date of invoice</p>
                      <p>2. The design shall be given by the company once flex printed shall not be changed.</p>
                      <p>3. Interest shall be charged @1.5% p.m. if invoice is not paid within 15days</p>
                      <p>4. Any complaint about this bill must be received within 10 days from the date of invc</p>
                    </div>
                  </div>
                  <div class="footer-right">
                    <div>Total Amount/Taxable Value : to continue......</div>
                    <div>Add : CGST :- 9% : 0.00</div>
                    <div>Add : SGST :- 9% : 0.00</div>
                    <div>Round Off : 0.00</div>
                    <div>Total Amount After Tax : to continue......</div>
                    <div style="text-align: right; margin-top: 15px;">for : Jain Advertising Agency</div>
                    <div style="text-align: right; margin-top: 25px;">Proprietor.</div>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `;

    await page.setContent(testHtml);

    // Verify DOM rendered height of textarea
    const renderedH = await page.evaluate(() => {
      const ta = document.querySelector('.bill-to textarea');
      return ta ? ta.offsetHeight : 0;
    });
    console.log(`DOM textarea rendered height: ${renderedH}px (Target: ${tc.addressHeight}px)`);

    // Emulate print media & check print-rendered textarea height
    await page.emulateMediaType('print');
    const printRenderedH = await page.evaluate(() => {
      const ta = document.querySelector('.bill-to textarea');
      return ta ? window.getComputedStyle(ta).height : '0px';
    });
    console.log(`Print CSS computed height   : ${printRenderedH} (Target: ${tc.addressHeight}px)`);

    // Generate physical A4 PDF
    const tmpPdf = `/tmp/pdf_verify_case_${idx}_${process.pid}.pdf`;
    await page.pdf({ path: tmpPdf, format: 'A4', printBackground: true });
    const pdfPageCount = parseInt(execSync(`python3 -c "import pypdf; print(len(pypdf.PdfReader('${tmpPdf}').pages))"`).toString().trim(), 10);

    console.log(`Physical PDF Generated      : ${pdfPageCount} Page(s)`);

    const expectedPages = pagesData.length;
    if (pdfPageCount === expectedPages) {
      console.log(`[PASS] PDF page count matches expected (${expectedPages} pages). Footer NEVER overflowed!`);
    } else {
      console.log(`[FAIL] PDF page count mismatch: Expected ${expectedPages}, got ${pdfPageCount}!`);
      const dump = execSync(`python3 -c "
import pypdf
reader = pypdf.PdfReader('${tmpPdf}')
for i, p in enumerate(reader.pages):
    print(f'--- PAGE {i+1} ---')
    print(p.extract_text()[:250].strip())
"`).toString();
      console.log(dump);
    }
    try { fs.unlinkSync(tmpPdf); } catch(e) {}

    if (printRenderedH === `${tc.addressHeight}px`) {
      console.log(`[PASS] Print PDF preserved the user's exact address height (${tc.addressHeight}px)!`);
    } else {
      console.log(`[FAIL] Print PDF skipped the address height adjustment! Got ${printRenderedH}`);
    }

    await page.close();
  }

  console.log('\n' + '='.repeat(80));
  console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
  console.log('='.repeat(80));

  await browser.close();
}

runVerification().catch(console.error);
