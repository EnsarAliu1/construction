# Nisja e përditshme

Me Docker Desktop aktiv, në terminalin Bash të VS Code, nga folderi i projektit:

```bash
docker compose up -d
npm run dev
```

Aplikacioni hapet në http://127.0.0.1:3000; MySQL përdor vetëm 127.0.0.1:3307. Compose menaxhon një shërbim/container të qëndrueshëm `fitimiconstruction-mysql` dhe volume-in `fitimiconstruction_mysql_data`. Next.js ndalet me Ctrl+C. MySQL mund të ndalet me `docker compose stop`; rinisja nuk fshin të dhënat. Mos përdorni `docker compose down -v` për ruajtjen e punës: ai fshin volume-in.

Vetëm për konfigurimin e parë në një kopje të re: `npm run dev:setup`. Ky hap gjeneron fjalëkalime dhe çelësa sintetikë privatë, pa mbishkruar profil ekzistues. Pastaj përdoren gjithmonë dy komandat më sipër. Nuk kërkohet konfigurimi i laboratorëve WP për punën e përditshme.

Profili ruhet në `.env.development.local` dhe `.private/development/`, të përjashtuara nga Git. `.env.local`, README.md dhe bazat/container-at e vjetër nuk ndryshohen. Ky është ambient lokal provues, jo konfigurim prodhimi.

`npm run dev` pret bazën dhe aplikon vetëm migrimet në skemën e re të këtij profili, `fitimi_dev_local`; nuk migron automatikisht bazat e tjera. Vetëm kur kjo skemë është bosh, krijon një llogari provuese përmes kontrollit ekzistues të operatorit. Të dhënat e hyrjes janë në `.private/development/login.txt`; regjistrimi MFA mbetet i detyrueshëm. Nisjet e tjera nuk rivendosin llogaritë, fjalëkalimet, faktorët ose numërimin e dëftesave.

MySQL merr vetëm sekretet e veta përmes skedarëve Compose secrets. Çelësi MFA mbetet jashtë container-it dhe bazës. PDF-të dhe lidhja e pronësisë ruhen te `.private/development/receipts`; ruajeni këtë folder bashkë me bazën dhe çelësat kur përgatitni një rikuperim. Një volume lokal nuk zëvendëson backup-in e enkriptuar/offsite.

Container-at e vjetër të testimit mbeten të ndalur dhe nuk përdoren nga ky profil. Nuk i fshijmë bashkë me të dhënat apo dokumentet e tyre gjatë konfigurimit të nisjes së përditshme.
