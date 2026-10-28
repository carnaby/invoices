# Export z iDokladu

Jednorazové stiahnutie všetkých dát z iDokladu, napríklad pri prechode na túto appku. Stačí aktívny prístup k API. Skript iba číta a v iDoklade nič nemení.

## 1. Prístup k API
V iDoklade otvor **Nastavení → Aplikace → API** a tlačidlom **Vygenerovat** si vytvor **Client Id** a **Client Secret**. V starších účtoch je to v *Nastavení → Uživatel → Nastavení API*. Application ID iDoklad bežne neuvádza a skript ho nepotrebuje.

Do súboru `.env` v koreni repa (nie je v gite) pridaj:
```
IDOKLAD_CLIENT_ID=...
IDOKLAD_CLIENT_SECRET=...
IDOKLAD_APPLICATION_ID=...   # iba ak ho iDoklad uvádza
```

## 2. Spustenie
```bash
pnpm install
pnpm idoklad:fetch
```

Výstup sa uloží do `./idoklad/` (priečinok je v `.gitignore`):
```
idoklad/
  manifest.json            počty a súčty podľa rokov a mien, chyby PDF
  raw/issued-invoices.json faktúry vrátane položiek, úhrad a adries
  raw/credit-notes.json    dobropisy
  raw/contacts.json        kontakty
  raw/*.json               číselníky (meny, krajiny, sadzby DPH…)
  pdf/faktura-<číslo>-<id>.pdf   originály PDF
  pdf/dobropis-<číslo>-<id>.pdf
```

## 3. Kontrola
Porovnaj tabuľku súčtov na konci výpisu (alebo `manifest.json`) s prehľadom v iDoklade. Počet faktúr a súčty za každý rok musia sedieť.

Skript sa dá spustiť znova. JSON súbory sa prepíšu a už stiahnuté PDF sa preskočia, takže pri výpadku stačí spustiť ho ešte raz.

## 4. Poistka
Kým máš prístup do iDokladu, urob si navyše aj ručný export z UI iDokladu (faktúry a kontakty do XLSX). Nestojí to nič a slúži ako záloha, keby sa niečo pokazilo.

Celý `./idoklad/` priečinok si zálohuj mimo repa. Obsahuje originály dokladov, ktoré treba archivovať 10 rokov.
