# Demo e izoluar

Website-i ka lidhje **Provo Demo** në header, hero, menunë mobile dhe footer. Ato kalojnë përmes `/demo`, që lexon konfigurimin në server dhe hap aplikacionin demo. Nëse konfigurimi mungon ose është i pavlefshëm, shfaqet njoftim i sigurt; login-i real vazhdon të funksionojë. Në production kërkohet hostname i ndryshëm nga aplikacioni real. Shihni [rishikimin para publikimit](security/demo-prepublish-review.md) për korrigjimet dhe provat e fundit.

Gjatë nisjes, `/demo` mban vizitorin në website me një mesazh pritjeje. `/api/demo/status` kontrollon vetëm endpoint-in e gatishmërisë në origin-in e konfiguruar, pa cookies dhe pa ndjekur redirects. Browser-i kalon te demoja vetëm pasi serveri dhe databaza e saj përgjigjen si gati. Kontrolli përsëritet çdo 1.5 sekonda deri në dy minuta; pastaj ofrohet riprovim. Edhe lidhja nga login-i kalon përmes kësaj faqeje.

Në faqen e hyrjes, **Provo Demo** hap aplikacionin me të dhëna fiktive, pa email, fjalëkalim ose MFA. Ky përjashtim ekziston vetëm në procesin demo. Autentikimi i aplikacionit real vazhdon të kërkojë MFA/passkey sipas politikës ekzistuese.

## Përdorimi lokal

Me Docker Desktop aktiv, ekzekutoni `npm run dev` si zakonisht. Përveç aplikacionit kryesor në `http://localhost:3000`, niset demoja në `http://localhost:3001/administrata` dhe MySQL i veçantë në `127.0.0.1:3308`.

Për të nisur vetëm demon: `npm run demo`. Mos e nisni njëkohësisht me një tjetër proces demo në të njëjtin port. Nisja e parë përgatit deri në dy hapësira dhe mund të zgjasë rreth një minutë ose më shumë, sipas diskut/Docker-it. Nëse hapësirat e parapërgatitura mbarojnë, krijimi i një hapësire të re kërkon më shumë kohë; gjatë përgatitjes së një hapësire tjetër, vizitori mund të marrë një njoftim për të riprovuar.

Sekretet gjenerohen lokalisht në `.private/demo/`, pa ndryshuar `.env.local`, profilin ekzistues ose bazën në portin 3307. Compose përdor projektin `construction-demo`, kontejnerin `construction-demo-mysql` dhe volumin e veçantë `construction-demo_demo_mysql_data`. MySQL demo nuk ekspozohet jashtë loopback-ut.

## Izolimi dhe cikli i jetës

- Çdo vizitor merr një databazë `fitimi_demo_<24 shifra hex>`, një përdorues MySQL me privilegje DML vetëm në atë databazë dhe një dosje private PDF me të njëjtin identifikues. Projektet, klientët, pagesat, shpenzimet dhe dëftesat krijohen me shërbimet ekzistuese të biznesit.
- Cookie-ja demo është e veçantë, HttpOnly, SameSite=Lax dhe Secure/__Host në production. Përmban vetëm token të rastësishëm; serveri ruan hash-in dhe përcakton databazën. Browser-i nuk zgjedh databazë, përdorues ose rrugë skedarësh.
- Sesioni zgjat 30 minuta absolute. Rifreskimi dhe rikthimi te demoja aktive nuk e zgjasin afatin server-side. Dalja revokon sesionin dhe skadon hapësirën.
- Sesionet demo mbeten assurance 0. Pranohen vetëm nga lidhjet e shënuara brenda procesit demo; kontrolli normal i sesioneve i refuzon. Nuk krijohet faktor MFA fiktiv dhe nuk falsifikohet verifikimi MFA.
- Ka deri në 20 hapësira gjithsej, përfshirë dy të parapërgatitura; deri në katër nisje të reja në minutë në gjithë instancën; deri në 1500 hapje lidhjesh nga kërkesat për sesion. Numëruesit dhe koordinimi ruhen në MySQL, jo vetëm në RAM. Këto janë kufij fillestarë operacionalë, jo garanci kundër çdo forme DoS.
- Procesi lokal kontrollon pastrimin/rimbushjen çdo 15 sekonda; nisja e një sesioni kontrollon gjithashtu pastrimin. Kur përgatitja ose një pastrim tjetër mban bllokimin, pastrimi shtyhet. Qasja refuzohet menjëherë pas skadimit, edhe nëse fshirja fizike pret.
- Pastrimi lejon vetëm emra të gjeneruar e të regjistruar, verifikon kufirin e dosjes dhe marker-in e pronësisë, refuzon symlinks dhe fshin databazën, përdoruesin MySQL dhe PDF-të përkatëse. Nuk ekzekutohet DROP/TRUNCATE mbi databazën reale.
- Nëse procesi ndalet, të dhënat e skaduara mbeten në volumin demo deri në rinisje/pastrim. Nëse marker-i është i dëmtuar, pastrimi refuzohet dhe kërkon inspektim operatori.

Profili i dokumenteve në demo detyrohet në **DEMO — Të dhëna fiktive**, pavarësisht konfigurimit të kompanisë reale. Numrat e dëftesave kanë prefiks DEMO. PDF-të, Excel-i dhe udhëzuesi brenda ZIP-it identifikojnë demon; ZIP-i përfshin gjithashtu README-DEMO.txt. Mos vendosni të dhëna personale në demo.

Endpoint-et e login/MFA/passkeys dhe faqet e sigurisë/llogarive bllokohen në procesin demo. CSRF Origin/Host, autorizimi i çdo shërbimi, no-store, historiku financiar dhe verifikimi i PDF-ve vazhdojnë të përdoren.

## Konfigurimi i ardhshëm online

Ky ndryshim nuk publikon shërbime. Aplikacioni real shfaq lidhjen vetëm kur ka `DEMO_ORIGIN` të vlefshëm. Lokalisht launcher-i e vendos automatikisht; në production kërkohet origin HTTPS.

Demoja duhet të ketë origin, proces/përdorues sistemi ose kontejner, MySQL dhe volume të dedikuara, pa montuar sekretet, `.env` ose dokumentet reale. Ndarja vetëm në procese lokale nuk është kufi sigurie kundër komprometimit të plotë të hostit/përdoruesit të sistemit. Për production duhet paketim i veçantë dhe shërbim i mbikëqyrur për pastrim/rimbushje; `npm run demo` është launcher zhvillimi, jo udhëzim production.

Runtime demo refuzon `DATABASE_URL`, `ADORE_OPERATOR_KEY`, ose `MFA_ENCRYPTION_KEYS` reale; kërkon MySQL loopback në portin 3308 dhe databazën e kontrollit `fitimi_dev_demo_control`. Gjithashtu refuzon instanca MySQL ku sheh schema që nuk i përkasin demos ose sistemit. `DEMO_PRIVATE_KEY` dhe `DEMO_DATABASE_URL` janë sekrete vetëm të demos. Mos i vendosni këto konfigurime në procesin real.

## Verifikimi

- `npm test`: regresionet ekzistuese.
- `npm run test:demo`: konfigurime të pasigurta, mungesë izolimi, emra databazash të falsifikuar dhe ndarje cookiesh.
- Me demon aktive: `npm run test:demo:browser`. Përdor Edge/Playwright me dy kontekste të ndara dhe vetëm MySQL demo; teston hyrjen, ndryshimin/izolimin e të dhënave, PDF, Excel, endpoint-et e bllokuara, token të falsifikuar, refuzimin nga kontrolli real MFA, mobile, storage, logout, skadim dhe pastrim.
- Provat e gjeneruara ruhen lokalisht te `artifacts/demo/`, jashtë Git.

`npm run test:demo:entry`, me portin 3000 të lirë dhe demon aktive, nis një proces të përkohshëm kryesor pa kredenciale databaze dhe kontrollon lidhjen reale login → demo, mungesën e scroll-it në 1440×900/390×844, mungesën e gabimeve të hydration dhe refuzimin e cookies demo nga API-të kryesore. Ndal vetëm procesin që krijon vetë.

### Rezultatet lokale, 20 nëntor 2026

Kaluan 103 testet ekzistuese, testi i politikës demo, 15 kontrollet MySQL/HTTP/Edge në `verify.ts` dhe kontrolli i kalimit nga login-i kryesor në `entry-browser.ts`. Kaluan lint, TypeScript dhe build production. U inspektuan pamjet mobile të login-it dhe panelit. Hapja nga dy hapësira të parapërgatitura mori rreth 125–190 ms për endpoint-in e nisjes në provën lokale; krijimi i një databaze të re mori rreth 30–36 sekonda. Këto janë matje lokale, jo garanci për hosting. Nuk u aplikuan migrime në databazën reale dhe nuk u bë deploy/commit/push.

## Hosted serverless adapter

The hosted demo is now live at https://construction-demo-ensar.vercel.app/demo. It uses a dedicated TiDB Starter instance, pre-created visitor schemas and request-driven disposal/warming. Its fictitious PDFs are stored as private SQL chunks in the payment transaction; actual receipts remain in private Vercel Blob. The local Docker demo above retains its original behavior. See [hosting operations](hosting.md) and `demo-cloud-verification.json` / `online-demo-verification.json` for the completed live checks.
