import {test,expect,type Page} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {mkdir} from "node:fs/promises";
import {dictionaries,locales,publicPages,publicPath} from "../../../src/i18n/dictionaries";
const issues=new WeakMap<Page,string[]>();
test("process navigation reveals four steps, values and clearly illustrative testimonials",async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/sq');
 await page.locator('.public-links').getByRole('link',{name:'Procesi',exact:true}).click();
 await expect(page).toHaveURL(/\/sq#procesi$/);await expect(page.locator('#procesi')).toHaveCount(1);
 await expect(page.locator('.process-timeline>li')).toHaveCount(4);await expect(page.locator('#process-heading')).toBeInViewport();
 await expect(page.locator('.process-blueprint')).toHaveAttribute('data-revealed','true');
 await expect.poll(async()=>Number.parseFloat(await page.locator('.process-house>path').first().evaluate(e=>getComputedStyle(e).strokeDashoffset))).toBe(0);
 await page.locator('.quality-section').scrollIntoViewIfNeeded();await expect(page.locator('.quality-values article')).toHaveCount(4);
 await expect(page.locator('.quality-scene')).toHaveAttribute('data-revealed','true');
 await page.locator('.testimonials-section').scrollIntoViewIfNeeded();await expect(page.locator('.testimonial-card')).toHaveCount(3);
 for(const caption of await page.locator('.testimonial-card figcaption').all())await expect(caption).toContainText('ilustrues');
 await expect(page.locator('.testimonials-section .showcase-eyebrow')).toContainText('ILUSTRUESE');
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const selector of ['.quality-blocks','.quality-block-large','.process-house>path','.process-dot'])expect(await page.locator(selector).first().evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
});
test("services and illustrative projects use home anchors and the gallery supports keyboard and focus return",async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/sq');
 await page.locator('.public-links').getByRole('link',{name:'Shërbimet',exact:true}).click();
 await expect(page).toHaveURL(/\/sq#sherbimet$/);await expect(page.locator('.showcase-service')).toHaveCount(4);
 await expect(page.locator('.public-header')).toHaveAttribute('data-scrolled','true');
 await page.locator('.public-links').getByRole('link',{name:'Projektet',exact:true}).click();
 await expect(page).toHaveURL(/\/sq#projektet$/);await expect(page.locator('.showcase-project')).toHaveCount(6);
 await expect(page.locator('.showcase-note')).toContainText('ilustruese');
 const opener=page.locator('.showcase-project-open').first();await opener.click();
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('#showcase-dialog-title')).toHaveText('Rezidencë bashkëkohore');
 await page.keyboard.press('ArrowRight');await expect(page.locator('#showcase-dialog-title')).toHaveText('Arkitekturë në lartësi');
 await page.keyboard.press('ArrowLeft');await expect(page.locator('#showcase-dialog-title')).toHaveText('Rezidencë bashkëkohore');
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(audit.violations).toEqual([]);
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(opener).toBeFocused();
});

test("about navigation scrolls within home, reveals the image and finishes approved counters",async({page})=>{
 await page.goto('/sq');
 const original=await page.locator('#rreth-nesh').elementHandle();
 await page.locator('.public-links').getByRole('link',{name:'Rreth nesh',exact:true}).click();
 await expect(page).toHaveURL(/\/sq#rreth-nesh$/);
 expect(await original!.evaluate(element=>element.isConnected)).toBe(true);
 await expect(page.locator('#about-title')).toBeInViewport();
 await page.locator('.about-statistics').scrollIntoViewIfNeeded();
 for(const value of ['15','120','98'])await expect(page.locator(`[data-count-to="${value}"]`)).toHaveText(value);
 await expect(page.locator('.about-building')).toHaveAttribute('data-revealed','true');
 expect(await page.locator('.about-photo img').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});
 expect(await page.locator('.about-floor-crown').evaluate(element=>getComputedStyle(element).animationName)).toBe('none');
 expect(await page.locator('html').evaluate(element=>getComputedStyle(element).scrollBehavior)).toBe('auto');
 await page.goto('/sq/about');await expect(page).toHaveURL(/\/sq#rreth-nesh$/);
});
test("about anchor and final statistics remain available without JavaScript",async({browser,baseURL})=>{
 const context=await browser.newContext({javaScriptEnabled:false,baseURL,viewport:{width:390,height:844}});
 try{
  const page=await context.newPage();await page.goto('/sq');await page.locator('.site-mobile-menu summary').click();
  await page.locator('.site-mobile-menu').getByRole('link',{name:'Rreth nesh',exact:true}).click();
  await expect(page).toHaveURL(/\/sq#rreth-nesh$/);await expect(page.locator('#about-title')).toBeInViewport();
  for(const value of ['15','120','98'])await expect(page.locator(`[data-count-to="${value}"]`)).toHaveText(value);
 }finally{await context.close();}
});
test("hero entrance completes and the crane cable stays attached throughout its lift",async({page})=>{
 await page.emulateMedia({reducedMotion:"no-preference"});await page.goto("/sq");
 const motion=await page.evaluate(async()=>{
  const finite=document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity);
  const entryCount=[...document.querySelectorAll(".public-header-inner,.hero-photograph,.hero-reference-eyebrow,h1>span,.hero-reference-tagline,.hero-reference-actions")].filter(e=>getComputedStyle(e).animationName!=="none").length;
  await Promise.all(finite.map(a=>a.finished.catch(()=>{})));
  const titleOpacity=getComputedStyle(document.querySelector("h1>span")!).opacity;
  const rope=document.querySelector<SVGGraphicsElement>(".crane-rope")!,load=document.querySelector<SVGGraphicsElement>(".crane-hook")!;
  const frames=[];
  for(const time of [0,2000,4000,6000]){
   for(const element of [rope,load])for(const animation of element.getAnimations()){animation.pause();animation.currentTime=time;}
   const cableEnd=new DOMPoint(416,466).matrixTransform(rope.getCTM()!),loadTop=new DOMPoint(416,466).matrixTransform(load.getCTM()!);
   frames.push({gap:Math.abs(cableEnd.y-loadTop.y),y:loadTop.y});
  }
  return {entryCount,titleOpacity,frames};
 });
 expect(motion.entryCount).toBeGreaterThanOrEqual(6);expect(motion.titleOpacity).toBe("1");
 expect(motion.frames.every(frame=>frame.gap<.5)).toBe(true);
 expect(Math.max(...motion.frames.map(f=>f.y))-Math.min(...motion.frames.map(f=>f.y))).toBeGreaterThan(20);
 await page.emulateMedia({reducedMotion:"reduce"});
 for(const selector of [".hero-photograph","h1>span",".hero-reference-actions",".crane-rope",".crane-hook"]){
  expect(await page.locator(selector).first().evaluate(e=>getComputedStyle(e).animationName)).toBe("none");
 }
});
test.beforeEach(async({page})=>{const errors:string[]=[];issues.set(page,errors);page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error"||/hydration|didn't match|did not match/i.test(m.text()))errors.push(m.text());});});
test.afterEach(async({page})=>{expect(issues.get(page)).toEqual([]);});
for(const width of [1440,390])for(const locale of locales)for(const route of ["home",...publicPages] as const){test(`${width}px ${locale} ${route}: direct page, metadata, overflow and screenshot`,async({page,browser})=>{
 const expectedRoute=route==="contact"?"contact":"home";await page.setViewportSize({width,height:1000});const response=await page.goto(publicPath(locale,route));expect(response?.status()).toBe(200);await expect(page.locator("html")).toHaveAttribute("lang",locale);await expect(page.locator("h1")).toHaveCount(1);await expect(page.locator("h1")).toHaveText(dictionaries[locale].pages[expectedRoute].title);await expect(page).toHaveTitle(new RegExp("Fitimi Construction"));if(process.env.PUBLIC_SITE_URL?.trim()){await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href",process.env.PUBLIC_SITE_URL.trim()+publicPath(locale,expectedRoute));await expect(page.locator('link[hreflang="en"]')).toHaveCount(0);}else{await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);}
 // Audit the settled view, excluding the intentionally continuous crane movement.
 await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await expect(page.locator(".site-mobile-menu")).toBeVisible({visible:width<1101});if(width===1440){const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();expect(result.violations).toEqual([]);}await mkdir("artifacts/wp11/screenshots",{recursive:true});await page.screenshot({path:`artifacts/wp11/screenshots/${locale}-${route}-${width}.png`,fullPage:true});if(locale==="sq"&&route==="home"&&width===1440)console.log("Actual isolated Edge/Chromium:",browser.version());
});}
for(const pageName of ["home",...publicPages] as const)test(`old English route redirects to Albanian: ${pageName}`,async({page})=>{const suffix=pageName==="home"?"":"/"+pageName;await page.goto('/en'+suffix);await expect(page).toHaveURL(new RegExp(pageName==="about"?"/sq#rreth-nesh$":pageName==="services"?"/sq#sherbimet$":pageName==="projects"?"/sq#projektet$":"/sq"+suffix+"$"));await expect(page.locator('html')).toHaveAttribute('lang','sq');await expect(page.getByRole('link',{name:'English',exact:true})).toHaveCount(0);});
for(const locale of locales){test(`${locale} mobile keyboard, Escape, outside click and navigation`,async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto(`/${locale}`);const menu=page.locator(".site-mobile-menu"),summary=menu.locator("summary");await summary.focus();await page.keyboard.press("Enter");await expect(menu).toHaveAttribute("open","");await page.keyboard.press("Tab");await expect(menu.locator("a").first()).toBeFocused();await page.keyboard.press("Escape");await expect(menu).not.toHaveAttribute("open","");await expect(summary).toBeFocused();await summary.click();await menu.getByRole("link",{name:dictionaries[locale].nav.services,exact:true}).click();await expect(page).toHaveURL(new RegExp(`/${locale}#sherbimet$`));await expect(menu).not.toHaveAttribute("open","");await summary.click();await page.mouse.click(8,420);await expect(menu).not.toHaveAttribute("open","");});
 test(`${locale} skip link and contact non-delivery state`,async({page})=>{await page.goto(`/${locale}/contact`);await page.keyboard.press("Tab");await expect(page.locator(".skip-link")).toBeFocused();await page.keyboard.press("Enter");await expect(page.locator("main")).toBeFocused();await expect(page.getByLabel(dictionaries[locale].email,{exact:true})).toBeDisabled();await expect(page.getByRole("button",{name:dictionaries[locale].submit,exact:true})).toBeDisabled();await expect(page.locator("#contact-note")).toContainText(dictionaries[locale].contactNote);expect((await page.request.post("/api/contact",{data:{message:"Synthetic no-delivery check"}})).status()).toBe(404);});}
test("reduced motion and 200 percent root text resize preserve essential content",async({page})=>{await page.emulateMedia({reducedMotion:"reduce"});await page.setViewportSize({width:640,height:900});await page.goto("/sq");await page.evaluate(()=>{const sheet=new CSSStyleSheet();sheet.replaceSync("html{font-size:200%}");document.adoptedStyleSheets=[...document.adoptedStyleSheets,sheet];});expect(await page.locator("html").evaluate(e=>getComputedStyle(e).fontSize)).toBe("32px");await expect(page.locator("h1")).toBeVisible();await expect(page.locator(".hero-crane")).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(await page.locator(".crane-hook").evaluate(e=>getComputedStyle(e).animationName)).toBe("none");expect(await page.locator(".hero-project-link").evaluate(e=>getComputedStyle(e).transitionDuration)).toBe("0s");});
test("mobile navigation and content work without JavaScript",async({browser,baseURL})=>{const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844},baseURL});const page=await context.newPage();try{await page.goto("/sq");await expect(page.locator("h1")).toBeVisible();await page.locator(".site-mobile-menu summary").click();await page.locator(".site-mobile-menu").getByRole("link",{name:dictionaries.sq.nav.services,exact:true}).click();await expect(page).toHaveURL(/\/sq#sherbimet$/);await expect(page.locator("h1")).toHaveText(dictionaries.sq.pages.home.title);}finally{await context.close();}});
test("320/768/1024/1280 responsive breakpoints retain content and the correct navigation",async({page})=>{for(const width of [320,768,1024,1280])for(const route of ["/sq","/sq/contact"]){await page.setViewportSize({width,height:1000});await page.goto(route);await expect(page.locator("h1")).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await expect(page.locator(".site-mobile-menu")).toBeVisible({visible:width<1101});await expect(page.locator(".public-links")).toBeVisible({visible:width>=1101});}});
