import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';

test('login fits laptop and phone viewports without scrolling or clipping controls',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const [width,height] of [[1366,768],[1440,900],[1280,720],[1024,768],[900,700],[390,844],[375,667]] as const){
  await page.setViewportSize({width,height});await page.goto('/administrata');
  await expect(page.getByRole('button',{name:'Hyni',exact:true})).toBeInViewport({ratio:1});
  await expect(page.getByRole('button',{name:'Hyr shpejt',exact:true})).toBeInViewport({ratio:1});
  const dimensions=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,viewportWidth:innerWidth,viewportHeight:innerHeight}));
  expect(dimensions.width,`${width}x${height} horizontal fit`).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.height,`${width}x${height} vertical fit`).toBeLessThanOrEqual(dimensions.viewportHeight+1);
  await mkdir('artifacts/login-ui',{recursive:true});
  await page.screenshot({path:`artifacts/login-ui/polish-${width}x${height}.png`,fullPage:true});
 }
});

test('branded login supports mobile, keyboard password visibility and accessible inputs',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [1440,900,390,320]){
  await page.setViewportSize({width,height:1000});await page.goto('/administrata');
  await expect(page.locator('.auth-logo img')).toBeVisible();await expect(page.locator('#login-title')).toBeVisible();
  await expect(page.getByRole('link',{name:/regjistr/i})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const email=page.getByLabel('Emaili',{exact:true});await email.fill('synthetic@example.invalid');
  await page.locator('#password').fill('Synthetic UI password 123!');await page.getByRole('button',{name:'Shfaq fjalëkalimin',exact:true}).click();
  await expect(page.locator('#password')).toHaveAttribute('type','text');await expect(page.getByRole('button',{name:'Fshih fjalëkalimin',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Enter');await expect(page.locator('#password')).toHaveAttribute('type','password');
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(audit.violations).toEqual([]);
  await mkdir('artifacts/login-ui',{recursive:true});await page.locator('#email').fill('');await page.locator('#password').fill('');
  await page.screenshot({path:`artifacts/login-ui/login-${width}.png`,fullPage:true,caret:'initial'});
 }
 expect(errors).toEqual([]);
});

test('password errors remain visible and success notification waits for completed MFA',async({page})=>{
 const consoleErrors:string[]=[];page.on('pageerror',e=>consoleErrors.push(e.message));
 await page.route('**/api/auth/login',route=>route.fulfill({status:401,json:{ok:false}}));
 await page.goto('/administrata');await page.locator('#email').fill('synthetic@example.invalid');await page.locator('#password').fill('Synthetic UI password 123!');
 await page.getByRole('button',{name:'Hyni',exact:true}).click();await expect(page.locator('.login-error')).toBeFocused();
 await expect(page.locator('.login-error')).toContainText('Hyrja dështoi');
 expect(await page.evaluate(()=>sessionStorage.getItem('fitimi:login-welcome'))).toBeNull();
 await page.route('**/api/auth/login',route=>route.fulfill({json:{ok:true,returnTo:'/administrata/mfa'}}));
 await page.route('**/api/auth/mfa',route=>route.fulfill({json:route.request().method()==='GET'?{ok:true,state:'verify'}:{ok:false,message:'Kodi nuk është i vlefshëm.'}}));
 await page.getByRole('button',{name:'Hyni',exact:true}).click();await page.waitForURL(/\/administrata\/mfa$/);
 await expect(page.locator('.auth-steps [aria-current="step"]')).toContainText('Verifikimi');
 expect(await page.evaluate(()=>sessionStorage.getItem('fitimi:login-welcome'))).toBeNull();
 await page.locator('#mfa-code').fill('123456');await page.getByRole('button',{name:'Verifikoni dhe hyni',exact:true}).click();
 await expect(page.locator('.login-error')).toContainText('Kodi nuk është i vlefshëm.');
 expect(await page.evaluate(()=>sessionStorage.getItem('fitimi:login-welcome'))).toBeNull();
 await page.route('**/api/auth/mfa',route=>route.fulfill({json:{ok:true,state:'complete',returnTo:'/administrata?ui-test=complete'}}));
 await page.locator('#mfa-code').fill('654321');await page.getByRole('button',{name:'Verifikoni dhe hyni',exact:true}).click();await page.waitForURL(/ui-test=complete/);
 expect(await page.evaluate(()=>sessionStorage.getItem('fitimi:login-welcome'))).toBe('1');
 await page.evaluate(()=>sessionStorage.removeItem('fitimi:login-welcome'));
 expect(consoleErrors).toEqual([]);
});

test('MFA setup, recovery and enlarged text fit the branded mobile card',async({page})=>{
 await page.setViewportSize({width:320,height:900});await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/api/auth/mfa',route=>route.fulfill({json:{ok:true,state:'verify'}}));
 await page.goto('/administrata/mfa');await page.getByRole('button',{name:'Përdorni një kod rikuperimi',exact:true}).click();
 await expect(page.getByLabel('Kodi i rikuperimit',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(audit.violations).toEqual([]);
 await page.screenshot({path:'artifacts/login-ui/mfa-mobile.png',fullPage:true,caret:'initial'});
 await page.goto('/administrata');await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.getByRole('button',{name:'Hyni',exact:true})).toBeVisible();
});

test('enrollment UI keeps code acknowledgement mandatory before showing the welcome hint',async({page})=>{
 await page.setViewportSize({width:390,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 // Presentation fixtures only: no user, factor, challenge or session is created.
 await page.route('**/api/auth/mfa',route=>{
  const action=route.request().method()==='POST'?route.request().postDataJSON().action:'';
  const json=action==='start'?{ok:true,state:'enroll',seed:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',qr:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="240" height="240"%3E%3Crect width="240" height="240" fill="white"/%3E%3C/svg%3E',uri:'otpauth://totp/Synthetic?secret=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'}:action==='enroll'?{ok:true,state:'ack',codes:Array.from({length:16},(_,i)=>`synthetic-ui-code-${String(i).padStart(4,'0')}`)}:action==='acknowledge'?{ok:true,state:'complete',returnTo:'/administrata?ui-test=enrolled'}:{ok:true,state:'enroll'};
  return route.fulfill({json});
 });
 await page.goto('/administrata/mfa');await page.getByRole('button',{name:'Shfaqni konfigurimin e autentikimit',exact:true}).click();
 await expect(page.getByTestId('mfa-manual-key')).toBeVisible();await page.locator('#mfa-code').fill('123456');
 await page.getByRole('button',{name:'Verifikoni konfigurimin e autentikimit',exact:true}).click();
 await expect(page.getByTestId('mfa-recovery-code')).toHaveCount(16);
 const finish=page.getByRole('button',{name:'Përfundoni hyrjen e sigurt',exact:true});await expect(finish).toBeDisabled();
 expect(await page.evaluate(()=>sessionStorage.getItem('fitimi:login-welcome'))).toBeNull();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('checkbox').check();await finish.click();await page.waitForURL(/ui-test=enrolled/);
 expect(await page.evaluate(()=>sessionStorage.getItem('fitimi:login-welcome'))).toBe('1');await page.evaluate(()=>sessionStorage.removeItem('fitimi:login-welcome'));
});

 test('administrata replaces the old login URL and protects MFA pages from indexing',async({request})=>{
 for(const path of ['/login','/login/mfa']){const response=await request.get(path,{maxRedirects:0});expect(response.status()).toBe(404);expect(response.headers().location).toBeUndefined();}
 for(const path of ['/administrata','/administrata/mfa']){const response=await request.get(path);expect(response.status()).toBe(200);expect(response.headers()['x-robots-tag']).toContain('noindex');expect(response.headers()['cache-control']).toContain('no-store');expect(response.headers()['content-security-policy']).toContain('nonce-');}
 });
