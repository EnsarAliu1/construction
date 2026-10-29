# Aplikacioni vetëm në shqip

29 tetor 2026. Përkthimi përfshin hyrjen/MFA, hapësirën e punës, klientët, projektet/kontratat/fazat, referencat, shpenzimet, pagesat/dëftesat, historikun, raportet, mesazhet e validimit dhe veprimet e operatorit. Nuk u ndryshua drejtimi vizual.

- Website-i publikon vetëm pesë faqet shqip. Përkthimi anglisht dhe ndërruesi i gjuhës u hoqën. Pesë rrugët e vjetra `/en` ridrejtohen me308 te `/sq`; metadata dhe sitemap nuk publikojnë alternativë anglisht.
- Dokumentet kanë gjuhën `sq`, përfshirë hyrjen, faqet private dhe404. Për404 globale me disa root layouts përdoret mekanizmi i dokumentuar `global-not-found` i Next.js; ky mekanizëm mbetet veçori eksperimentale e framework-ut dhe u verifikua në versionin aktual.
- PDF-të e reja, raportet PDF/XLSX, emrat e shkarkimeve dhe udhëzuesi i ZIP-it janë shqip. PDF-të historike të lëshuara nuk u rishkruan. Emrat/tekstet e regjistruara nga përdoruesit dhe identiteti tregtar nuk u përkthyen automatikisht.
- Identifikuesit teknikë, rrugët e API-ve, skema kanonike JSON/CSV dhe vlerat e ruajtura të gjendjeve mbeten të qëndrueshme. Paraqitja e tyre në ndërfaqe, historik dhe raporte është shqip. Të dhënat monetare mbeten të sakta dhe kontrollohen nga të njëjtat rregulla/transaksione.
- CLI i llogarive ka udhëzime shqip dhe përgjigje `p/J`. Arsyet e rikuperimit MFA zgjidhen me numrat1–4 dhe ruhen me kodet teknike të pandryshuara. Komandat/konfirmimet teknike ekzistuese dhe kufiri i operatorit ruhen.

Verifikimi final:77 teste bazë,169 rezultate MySQL,8 rezultate MFA HTTP,12 rezultate raportimi HTTP dhe20 teste të website-it = **286 rezultate** pa dështime ose anashkalime. Veç tyre:13 skenarë MFA,13 skenarë të plotë biznesi,9 sigurie dhe3 rikuperimi pagese = **38 skenarë të mirëfilltë Edge**. Përsëritjet nuk numërohen dy herë. TypeScript, lint, build dhe kontrollet e rrugëve kaluan. U verifikuan308 për rrugët anglisht dhe404 në shqip.

Testet përdorën vetëm container-in `fitimiconstruction-mysql-sq`, skemën sintetike `fitimi_test_sq` dhe portet ekzistuese3307/3000. README.md, `.env.local`, migrimet origjinale dhe të dhënat/container-at ekzistues nuk u ndryshuan. Laboratori kontrollon identitetin, etiketat, portin dhe skemën para çdo resetimi/pastrimi; nuk përdor bazën e demos për regresionet.

Për riprodhim të izoluar, me portet e lira: `node scripts/localization/lab.mjs setup`, pastaj `run test`, `run typecheck`, `run lint`, `run build` dhe `node scripts/localization/verify.mjs`. Komandat kërkojnë Docker-in lokal; `dispose` heq vetëm container-in e verifikuar të këtij laboratori. Regjistrimet e hollësishme dhe çelësat sintetikë janë në `artifacts/sq`, jashtë Git-it. Ky ndryshim nuk jep miratim për prodhim; bllokuesit e dokumentuar të sigurisë/hostimit mbeten.

Referencë për404 me disa layouts: [Next.js global-not-found](https://nextjs.org/docs/app/api-reference/file-conventions/not-found#global-not-foundjs-experimental).
