const { chromium } = require('C:/Users/2ronne/AppData/Local/Programs/nodejs-v26/node_modules/@playwright/cli/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // 1. Login page — verificar título e screenshot
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  const title = await page.title();
  console.log('Title da página de login:', title);
  console.log('Título OK?', title === 'Entrar · Trama' ? '✓' : '✗ ESPERADO: Entrar · Trama, GOT: ' + title);
  await page.screenshot({ path: 'assets/sprint4-login-page.png' });
  console.log('✓ screenshot: sprint4-login-page.png');

  // 2. Sign in
  await page.fill('#auth-email', 'ttayronne@gmail.com');
  await page.fill('#auth-password', 'carate61');
  await page.click('button[type="submit"]');
  
  await page.waitForTimeout(4000);
  const urlAfterLogin = page.url();
  console.log('URL após login:', urlAfterLogin);
  
  if (!urlAfterLogin.includes('/create')) {
    const alert = await page.$('.auth-alert');
    if (alert) console.log('Erro de login:', await alert.textContent());
    console.log('⚠ Login falhou - abortando testes que requerem autenticação');
    await browser.close();
    process.exit(0);
  }

  console.log('✓ Login OK');
  
  // 3. Screenshot /create
  await page.screenshot({ path: 'assets/sprint4-create-page.png' });
  console.log('✓ screenshot: sprint4-create-page.png');

  // 4. Clica no botão de perfil — verifica popover
  await page.click('.sidebar-profile-btn');
  await page.waitForSelector('.profile-popover', { timeout: 5000 });
  await page.screenshot({ path: 'assets/sprint4-profile-popover.png' });
  console.log('✓ screenshot: sprint4-profile-popover.png');

  // 5. Verifica cores do popover
  const popoverNameColor = await page.evaluate(() => {
    const el = document.querySelector('.popover-name-text');
    if (!el) return 'NOT FOUND';
    return window.getComputedStyle(el).color;
  });
  console.log('popover-name-text color:', popoverNameColor, '(esperado: rgb(22, 33, 28))');

  // 6. Verifica se o popover está dentro dos limites da sidebar (não ultrapassa)
  const popoverRect = await page.evaluate(() => {
    const el = document.querySelector('.profile-popover');
    if (!el) return null;
    return el.getBoundingClientRect();
  });
  const sidebarRect = await page.evaluate(() => {
    const el = document.querySelector('.sidebar');
    if (!el) return null;
    return el.getBoundingClientRect();
  });
  if (popoverRect && sidebarRect) {
    const overflows = popoverRect.right > sidebarRect.right;
    console.log(`Popover right: ${popoverRect.right.toFixed(0)}px, Sidebar right: ${sidebarRect.right.toFixed(0)}px`);
    console.log('Popover estoura sidebar?', overflows ? '✗ SIM - PROBLEMA!' : '✓ NÃO (ok)');
  }

  // 7. Fecha popover, vai para /publish
  await page.keyboard.press('Escape');
  await page.click('a[href="/publish"]');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'assets/sprint4-publish-page.png' });
  console.log('✓ screenshot: sprint4-publish-page.png');

  // 8. Vai para /calendar
  await page.click('a[href="/calendar"]');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'assets/sprint4-calendar-page.png' });
  console.log('✓ screenshot: sprint4-calendar-page.png');

  // 9. Report de erros
  console.log('\n--- Console Errors ---');
  console.log(errors.length === 0 ? '✓ NENHUM erro de console' : errors.join('\n'));

  await browser.close();
  console.log('\n✓ E2E completo!');
})();
