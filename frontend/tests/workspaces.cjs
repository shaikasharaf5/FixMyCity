// Isolated UI regression checks: all application APIs are intercepted; no live reports are changed.
// Run: node tests/workspaces.cjs (set PLAYWRIGHT_MODULE if Playwright is installed outside this project).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  const image = { name: 'issue.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64') };
  async function workspace(role, width = 1440, sharedReports = null) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: 'Asia/Kolkata', geolocation: { latitude: 17.4485, longitude: 78.3741 }, permissions: ['geolocation'] });
    await context.addInitScript(({ role }) => {
      localStorage.setItem('civicsense_user', JSON.stringify({ id: role === 'officer' ? 7 : 1, username: 'Test ' + role, role }));
      localStorage.setItem('civicsense_token', 'isolated-test-token');
    }, { role });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const officer = { id: 3, user: { id: 7, username: 'Assigned officer' }, department: { id: 1, name: 'Roads & Buildings' }, district: 'Hyderabad' };
    let reports = sharedReports || [
      { id: 1, category: 'Pothole', district: 'Hyderabad', ward: 'Madhapur', latitude: 17.4485, longitude: 78.3741, department_id: 1, department: officer.department, description: 'A complete report description.\nThe second sentence remains visible.', created_at: new Date().toISOString().replace('Z', ''), updated_at: new Date().toISOString(), severity: 'high', status: 'assigned', citizen_id: 1, assigned_officer: officer, officer_id: 3 },
      { id: 2, category: 'Garbage', district: 'Warangal', ward: 'Hanamkonda', latitude: 18.0, longitude: 79.5, department_id: 2, department: { id: 2, name: 'Sanitation' }, description: 'Other district report', created_at: new Date(Date.now() - 60000).toISOString(), severity: 'medium', status: 'pending', citizen_id: 9 },
    ];
    const requests = [];
    await page.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url()), method = req.method();
      requests.push({ url: url.pathname, method, body: req.postData() });
      let data = {};
      if (url.pathname === '/api/complaints' && method === 'GET') data = reports;
      else if (url.pathname === '/api/departments/officers') data = [officer];
      else if (url.pathname === '/api/locations/reverse') data = { district: Number(url.searchParams.get('latitude')) > 18 ? 'Warangal' : 'Hyderabad', ward: 'Test locality', place: 'Test locality, ' + (Number(url.searchParams.get('latitude')) > 18 ? 'Warangal' : 'Hyderabad') };
      else if (url.pathname === '/api/complaints/analyze') { await new Promise(resolve => setTimeout(resolve, 800)); data = { category: 'Pothole', severity: 'high', confidence: .94, department: officer.department, description: 'Must not automatically appear', before_image_url: '/uploads/test.png', detections: [{ category: 'Pothole', confidence: .94, bbox_normalized: [.2,.3,.8,.9] }] }; }
      else if (url.pathname === '/api/complaints' && method === 'POST') data = { id: 99 };
      else if (url.pathname === '/api/complaints/1' && method === 'PUT') { reports[0] = { ...reports[0], ...req.postDataJSON() }; data = reports[0]; }
      else if (url.pathname === '/api/complaints/1/verify') { reports[0].status = req.postData().includes('\r\n\r\nfake\r\n') ? 'rejected' : 'verified'; reports[0].verification_outcome = reports[0].status === 'verified' ? 'real' : 'fake'; reports[0].verified_image_url = '/uploads/test.png'; reports[0].verification_notes = 'Inspection evidence submitted'; data = reports[0]; }
      else if (url.pathname === '/api/complaints/1/proceed') { reports[0].status = 'in_progress'; data = reports[0]; }
      else if (url.pathname === '/api/complaints/1/complete') { reports[0].status = 'resolved'; data = reports[0]; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto('http://localhost:5173');
    await page.locator('.work-page').waitFor();
    return { page, context, requests, reports };
  }
  async function responsive(page, name) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: path.join(__dirname, '../test-results', name + '.png'), fullPage: true, animations: 'disabled' });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), name + ' horizontal overflow');
    assert(await page.locator('.work-page').evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16));
    assert(await page.locator('.work-page').evaluate(el => el.getBoundingClientRect().right <= window.innerWidth), name + ' clipped content');
  }
  try {
    const central = await workspace('state_admin');
    const { page } = central;
    await page.locator('.register-list > button').first().waitFor();
    assert.equal(await page.locator('.register-list > button').count(), 2);
    assert.match(await page.locator('.register-list').innerText(), /\ds ago/);
    assert.match(await page.locator('.register-list time').first().innerText(), /\d{1,2}:\d{2}:\d{2}/);
    assert(!/SLA/.test(await page.locator('.work-page').innerText()));
    await responsive(page, 'central-desktop');
    await page.getByLabel('Sort complaints').selectOption('Oldest first');
    assert.match(await page.locator('.register-list > button').first().innerText(), /Garbage/);
    await page.getByLabel('Sort complaints').selectOption('Newest first');
    assert.match(await page.locator('.register-list > button').first().innerText(), /Pothole/);
    for (const width of [1024, 768, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await responsive(page, 'central-' + width);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: /Awaiting assignment.*Ready for officer/ }).click();
    assert.equal(await page.locator('.register-list > button').count(), 1);
    await page.getByRole('button', { name: /Open complaints.*View the active queue/ }).click();
    assert.equal(await page.locator('.register-list > button').count(), 2);
    await page.getByLabel('District', { exact: true }).selectOption('Warangal');
    assert.equal(await page.locator('.register-list > button').count(), 1);
    assert.match(await page.locator('.register-list').innerText(), /Hanamkonda/);
    await page.getByLabel('District', { exact: true }).selectOption('Hyderabad');
    await page.getByLabel('Responsible officer').selectOption('3');
    await page.getByRole('button', { name: 'Assign complaint', exact: true }).click();
    await page.getByText('Complaint assigned successfully.').waitFor();
    assert(central.requests.some(req => req.method === 'PUT' && JSON.parse(req.body).officer_id === 3));
    await page.setViewportSize({ width: 390, height: 844 });
    await responsive(page, 'central-mobile');
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.portal-sidebar').getBoundingClientRect().left >= 0);
    await page.getByRole('button', { name: 'Close navigation', exact: true }).click();
    await central.context.close();

    const officer = await workspace('officer');
    assert.equal(await officer.page.locator('.simple-case-list > button').count(), 1);
    assert(!await officer.page.locator('.officer-action-form').count());
    await responsive(officer.page, 'officer-list');
    await officer.page.setViewportSize({ width: 768, height: 1000 });
    await responsive(officer.page, 'officer-tablet');
    await officer.page.setViewportSize({ width: 1440, height: 1000 });
    await officer.page.locator('.simple-case-list > button').click();
    await officer.page.getByLabel('Inspection findings').fill('Inspected the assigned road.');
    await officer.page.getByLabel('On-site verification photo').setInputFiles(image);
    await officer.page.getByRole('button', { name: 'Submit update' }).click();
    await officer.page.getByText('Inspection submitted. Waiting for the Central Room to proceed.').waitFor();
    await officer.page.locator('.simple-case-list > button').click();
    await officer.page.getByText(/Real issue confirmed. Waiting for the Central Room/).waitFor();
    assert.equal(await officer.page.getByRole('button', { name: 'Submit update' }).count(), 0);
    const approving = await workspace('state_admin', 1440, officer.reports);
    await approving.page.getByRole('button', { name: 'Proceed with work' }).click();
    await approving.page.getByText('Work approved. The same officer can now carry out and complete the repair.').waitFor();
    assert.equal(officer.reports[0].officer_id, 3);
    await approving.context.close();
    await officer.page.reload();
    await officer.page.locator('.simple-case-list > button').click();
    await officer.page.getByLabel('Work notes').fill('Repair completed and verified on site.');
    await officer.page.getByLabel('After-work photo').setInputFiles(image);
    await officer.page.setViewportSize({ width: 390, height: 844 });
    await responsive(officer.page, 'officer-action-mobile');
    await officer.page.getByRole('button', { name: 'Submit update' }).click();
    await officer.page.getByText('Resolution submitted successfully.').waitFor();
    assert(officer.requests.some(req => req.url.endsWith('/complete') && req.body.includes('Repair completed')));
    await officer.context.close();

    const fake = await workspace('officer');
    await fake.page.locator('.simple-case-list > button').click();
    await fake.page.getByLabel('Action', { exact: false }).selectOption('fake');
    await fake.page.getByLabel('Inspection findings').fill('No issue exists at this location.');
    await fake.page.getByLabel('On-site verification photo').setInputFiles(image);
    await fake.page.getByRole('button', { name: 'Submit update' }).click();
    await fake.page.getByText('Report declined with inspection evidence.').waitFor();
    await fake.page.getByRole('button', { name: 'Declined', exact: true }).click();
    assert.equal(await fake.page.locator('.simple-case-list > button').count(), 1);
    await fake.context.close();

    const citizen = await workspace('citizen');
    const cp = citizen.page;
    assert.equal(await cp.locator('#citizen-description').inputValue(), '');
    await responsive(cp, 'citizen-initial');
    assert.equal(await cp.getByRole('button', { name: /Report on WhatsApp/i }).count(), 0);
    await cp.getByLabel('Issue photo').setInputFiles(image);
    await cp.getByText('Detecting the issue… Analysing your photo.').waitFor();
    await cp.getByRole('button', { name: 'Generate with AI' }).waitFor();
    await cp.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Generate with AI')).disabled);
    assert(citizen.requests.findIndex(req => req.url.endsWith('/reverse')) < citizen.requests.findIndex(req => req.url.endsWith('/analyze')));
    assert.equal(await cp.locator('#citizen-description').inputValue(), '');
    assert.equal(await cp.locator('.detection-boxes rect').count(), 1);
    assert.equal(await cp.locator('.detection-boxes text, .detection-boxes title').count(), 0);
    assert.equal(await cp.locator('.detection-boxes rect').getAttribute('x'), '20');
    assert.match(await cp.locator('.detected-issue').innerText(), /Pothole/);
    await cp.getByRole('button', { name: 'Generate with AI' }).click();
    assert.match(await cp.locator('#citizen-description').inputValue(), /Test locality, Hyderabad.*17\.448500/);
    await responsive(cp, 'citizen-desktop');
    await citizen.context.setGeolocation({ latitude: 18.1, longitude: 79.5 });
    await cp.getByRole('button', { name: 'Detect location', exact: true }).click();
    await cp.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Generate with AI')).disabled);
    assert.equal(await cp.locator('#citizen-description').inputValue(), '');
    await cp.getByRole('button', { name: 'Generate with AI' }).click();
    assert.match(await cp.locator('#citizen-description').inputValue(), /Warangal.*18\.100000/);
    await cp.setViewportSize({ width: 390, height: 844 });
    await responsive(cp, 'citizen-mobile');
    await cp.getByRole('button', { name: 'Submit complaint', exact: true }).click();
    await cp.getByRole('heading', { name: 'Complaint submitted' }).waitFor();
    const submitted = JSON.parse(citizen.requests.find(req => req.method === 'POST' && req.url === '/api/complaints').body);
    assert.equal(submitted.district, 'Warangal'); assert.equal(submitted.latitude, 18.1);
    await citizen.context.close();

    const denied = await workspace('citizen', 390);
    await denied.page.evaluate(() => { navigator.geolocation.getCurrentPosition = (_ok, fail) => fail({ code: 1, message: 'Permission denied' }); });
    await denied.page.getByLabel('Issue photo').setInputFiles(image);
    await denied.page.getByText(/Allow browser location access/).waitFor();
    assert.equal(denied.requests.filter(req => req.url.endsWith('/analyze')).length, 0);
    assert(await denied.page.getByRole('button', { name: 'Submit complaint', exact: true }).isDisabled());
    await denied.context.close();

    const offlineNames = await workspace('citizen');
    await offlineNames.page.route('**/api/locations/reverse?**', route => route.fulfill({ status: 503, body: 'Name lookup offline' }));
    await offlineNames.page.getByLabel('Issue photo').setInputFiles(image);
    await offlineNames.page.getByText(/Coordinates captured. Enter the place/).waitFor();
    await offlineNames.page.getByLabel('Place / locality', { exact: true }).fill('Confirmed locality');
    await offlineNames.page.getByLabel('District', { exact: true }).fill('Confirmed district');
    await offlineNames.page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Generate with AI')).disabled);
    await offlineNames.page.getByRole('button', { name: 'Generate with AI' }).click();
    assert.match(await offlineNames.page.locator('#citizen-description').inputValue(), /Confirmed locality, Confirmed district.*17\.448500/);
    await offlineNames.context.close();
    assert.deepEqual(errors, []);
    console.log('PASS: district filter, exact local time, assignment, officer ownership UI, work/evidence submission, photo-triggered geolocation, opt-in AI text, new-location text, submission, responsive layouts.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
