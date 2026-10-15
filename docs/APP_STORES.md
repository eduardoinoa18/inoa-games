# Inoa Games in the app stores (free beta)

Status 2026-10-15: the Capacitor wrappers exist (`app/`), the web copy builds offline-ready (`tools/build_app_www.mjs`), icons/splash are generated, and store screenshots, the feature graphic and the listing copy are in `store/`. **Nothing has been uploaded.** Uploading needs the owner's developer accounts, signing keys, a Mac with Xcode, and Android Studio (or the Android SDK). None of these exist in the cloud sandbox.

Goal of this phase: a **free** beta through **TestFlight** (iOS/iPadOS) and **Google Play closed testing** (Android). There are **no payments in the apps**. Microsoft Store is optional (§9).

Items marked **[RE-CHECK]** are store rules or prices that change. Confirm them on the day.

---

## 1. Accounts and fees (owner only)

| Store | Account | Cost | Notes |
| --- | --- | --- | --- |
| Apple App Store / TestFlight | Apple Developer Program, enrol as an **organization** (Inoa Services, needs a D-U-N-S number, free from Dun & Bradstreet, takes ~1–2 weeks) or as an individual | **US$99 / year** | An organization account shows "Inoa Services" as the seller. Individual shows the owner's legal name. TestFlight external testing (up to 10,000 testers by link) needs a short Beta App Review |
| Google Play | Google Play Console developer account, **organization** (needs D-U-N-S) or personal | **US$25 once** | **Personal accounts created after Nov 2023 must run a closed test with at least 12 testers who stay opted in for 14 continuous days** before they can apply for production. Organization accounts are exempt **[RE-CHECK]**. Identity verification is required either way |
| Microsoft Store | Partner Center / storedeveloper.microsoft.com | **Free for individuals** (since Sept 2025). Microsoft announced free company accounts in May 2026 **[RE-CHECK]** | Ship the PWA through PWABuilder (§9) |

Recommendation: enrol both Apple and Google as an **organization** (Inoa Services). This skips Google's 12-tester/14-day gate and puts the company name on the listings. A closed test is still worth running.

---

## 2. What is in the repo

| Path | What |
| --- | --- |
| `app/package.json` | Capacitor 8.5.2 (core, cli, android, ios), @capacitor/splash-screen 8.0.2, @capacitor/status-bar 8.0.3, @capacitor/assets 3.0.5, @fontsource fonts. Exact versions, all ≥ 2 weeks old on 2026-10-15 |
| `app/capacitor.config.json` | appId `com.inoaservices.games` (**the owner may change it before the first upload; after that it is permanent**), appName "Inoa Games", webDir `www`, Android scheme `https`, iOS scheme `capacitor`, `contentInset: never` (the pages already use `viewport-fit=cover` + `env(safe-area-inset-*)`), no web debugging, splash 1.2 s on `#0b2a3a`, dark system bars |
| `app/android/`, `app/ios/` | Native projects (commit them). iOS uses Swift Package Manager (no CocoaPods). Version 1.0.0 (build 1) |
| `app/resources/` | Art sources: `icon-only.png` (1024, opaque = App Store icon), `icon-foreground.png`/`icon-background.png` (Android adaptive), `splash.png`/`splash-dark.png` (2732). Redraw with `node scripts/make_resources.mjs`, then `npm run assets` (from `app/`) writes every native size |
| `app/www/` | **Generated, git-ignored.** The site copy the apps ship |
| `tools/build_app_www.mjs` | Builds `app/www` (see §3) |
| `tools/store_shots.js` | Store screenshots + Play feature graphic (see §8) |
| `store/listing.md` | Names, descriptions EN/ES, keywords, category, age rating, privacy label + Data safety answers |
| `store/screenshots/{iphone69,ipad13,android}/`, `store/feature-graphic.png` | Store art |

`app/` and `store/` are in `.vercelignore` (never deployed to the website).

---

## 3. How the app build differs from the website

`node tools/build_app_www.mjs --site https://<production domain>` (or `npm run app:www` + `INOA_SITE=…`). The website files are never changed; only the copy in `app/www` is:

1. **Copies the deployable site** using the `.vercelignore` exclusions, and also leaves out `api/`, `admin.html` (owner dashboard, web only), `sw.js`, and the legacy `packs/<game>.json` base64 bundles (~50 MB). The engine's `loadPack()` tries `packs/<game>/manifest.json` first and every game has one. The script checks that every model/HDRI a manifest names is present. App web payload: **~12 MB**.
2. **Vendors three.js r170** (`build/three.module.js` + the 18 `examples/jsm` files the pages import, with their relative dependencies) into `vendor/three/`, and rewrites every import map from jsDelivr to relative paths (`../vendor/three/…` in `games/`). **No remotely loaded code** (Apple 2.5.2), and the apps work offline on first launch. The script fails the build if any jsDelivr/unpkg/cdnjs or Google Fonts URL is left, or if an import-map target is missing.
2b. **Vendors any other jsDelivr npm script** the pages/engine load (today `engine/net.js` loads `peerjs@1.5.4` and `qrcode-generator@1.4.4`) from `app/node_modules` into `vendor/npm/<pkg>@<ver>/`. In ES modules the URL becomes `new URL(…, import.meta.url)`. A new CDN dependency fails the build until its exact version is added to `app/package.json`.
3. **Vendors the fonts** (Manrope 500–800, Unbounded 600–900, Press Start 2P; latin woff2 from @fontsource, OFL) into `vendor/fonts/fonts.css`, replacing the Google Fonts `<link>`s.
4. **No service worker in the app.** Every `'serviceWorker' in navigator` check also requires "not running in native Capacitor" (`window.Capacitor.isNativePlatform()`), because the files are already local.
5. **No purchase entry points (3.1.1 / Play Payments):** `pricing.html` is replaced by a "Free during the beta" page (EN/ES), and on `account.html` the Upgrade and Manage-billing buttons and pricing links are hidden.
6. **`--site`** turns the account page's relative `fetch('api/…')` calls into `https://<site>/api/…`, and the e-mail verification/reset return URL into `https://<site>/account.html` (a `capacitor://` link means nothing in a mail client: players confirm on the web, then sign in in the app).
7. Writes `app-build.json` `{native, version, built, three, site}`.

**Verified in the sandbox (jsDelivr and Google Fonts are blocked here, and the check also aborted every non-localhost request):** `app/www/index.html`, `games/drift.html` (title + 7 s of racing with the 3D scene rendering), `games/pixelpact.html` and `pricing.html` loaded from a plain static server with **zero external requests** and the vendored fonts loaded. The only console error was the browser test's `sw.js` 404, which is expected: outside Capacitor the guard lets registration run, and `sw.js` is not in the copy.

### Things the lead engineer must do in files this work did not touch
- ✅ **Done (2026-10-15):** `api/_lib.js` answers `OPTIONS` and sends CORS headers for the app origins only (`capacitor://localhost`, `https://localhost`); tested in `test/api.test.js`. Original note: **CORS on `api/account-delete` (and `api/portal`) is required for in-app account deletion.** The app's origin is `https://localhost` (Android) / `capacitor://localhost` (iOS). The `Authorization` header triggers a preflight, so the function must answer `OPTIONS` and send `Access-Control-Allow-Origin` for those two origins (and `Access-Control-Allow-Headers: authorization, content-type`). Without this, "Delete account" fails in the app, and **Apple 5.1.1(v) requires in-app deletion when accounts can be created in-app**. Supabase Auth/PostgREST already allow any origin.
- Supabase Auth → URL configuration: the redirect allow-list must contain `<site>/account.html` (already on the owner list).
- Hub copy shown in the app says "One link · No download · browser games" (`hub-src/`). Consider an app variant (e.g. hide the eyebrow when `window.Capacitor` exists). The store screenshots hide that banner.
- `platform.json` ships inside the app. Changing `enabled` or the keys needs an app update (or switch the engine to fetch it from `<site>` when native).

---

## 4. Apple review risks and how this build answers them

| Guideline | Risk | Our answer |
| --- | --- | --- |
| **4.2 Minimum functionality** (repackaged website) | High for "web wrapper" apps | 13 complete games with local assets, **works fully offline** (everything bundled, no remote code), touch + **game controller** support, read-aloud, EN/ES, native splash/status bar/safe areas. Highlight offline play + controllers in the review notes. Optional hardening: add `@capacitor/haptics` (tap/score feedback) and `@capacitor/share` (hero card), both small engine additions |
| **2.5.2** Software must be self-contained; no downloading of executable code | Import maps pointed at jsDelivr | **Vendored** three.js + fonts; the build fails if a CDN URL remains. Supabase is used through plain `fetch` (data only, no script) |
| **5.1.1(v)** Account deletion | Apps that allow account creation must allow deletion in-app | `account.html` → "Delete account" (exists). **Needs the CORS change in §3** to work from the app |
| **Sign in with Apple (4.8)** | Required only if the app offers third-party/social login | **Not required**: e-mail + password only (Supabase), no Google/Facebook login |
| **3.1.1** In-app purchase | Digital goods/subscriptions must use IAP | **No purchases in the beta app**: pricing/upgrade/billing UI removed in the app build; server is in `beta_free` mode. Do not mention prices or a website purchase in the app or metadata |
| **1.3 Kids Category / 5.1.4** | Kids rules (parental gates, no third-party data) | **Not** in the Kids Category; general audience Games › Family (see `store/listing.md`) |
| **2.3 Accurate metadata** | Screenshots must show the app in use | `store/screenshots/` are real captures of the shipped games |
| **5.1.2 Data use** | Privacy label must match the code | Answers in `store/listing.md` derived from `engine/platform.js`, `engine/feedback.js`, migrations. No tracking (no ATT prompt needed) |
| **2.1 App completeness** | Broken links, placeholders | Finish `privacy.html` `[OWNER TO CONFIRM]` items (support e-mail, retention) before review. Give the reviewer a demo account **if** accounts are enabled |
| **Medical (1.4.1)** | Allergy game could be read as medical advice | Safari is framed as practice, with a "not medical advice" line. **Allergist review is still open** (`docs/audit-notes/safari.md`). Consider hiding Safari from the store build until it is done |
| **Party rooms (`engine/net.js`, WebRTC via PeerJS)** | Uses the public PeerJS cloud signaling server (`0.peerjs.com`). Peers see each other's IP addresses. 4-letter room codes could be guessed by strangers | Before store review: decide whether rooms ship in the app build. If yes, add them to the privacy label/Data safety (IP address processed by a third-party signaling service), self-host signaling, use longer codes and require host approval to join (keeps the "no strangers" rule). In App Review notes, state that they are local/party rooms without chat |
| Trademarks (5.2) | Names/brands | All CC0/original, no real brands (project rule) |

### When paid Premium launches later (not this beta) **[RE-CHECK with counsel]**
- **iOS:** a digital subscription sold inside the app must use **Apple In-App Purchase**. A cross-platform layer like **RevenueCat** maps App Store/Play/Stripe purchases to one entitlement, which the `ig_subscriptions` table would mirror. On the **US storefront**, after *Epic v. Apple*, apps may include a link or button to buy on the web. The Ninth Circuit (Dec 2025) let Apple charge a "reasonable" commission on linked purchases, set on remand, and the Supreme Court took a narrow question in June 2026, so fee terms are still unsettled. Outside the US, the StoreKit External Purchase Link entitlements apply where available (EU, Korea, Japan, etc.).
- **Android:** Google Play Billing is required for digital goods, except under the US alternative-billing/external-offers programmes that followed *Epic v. Google*, and EEA/other regional programmes, each with their own fees and forms.
- Practical default: "reader-style" is **not** available to games. Plan on IAP via RevenueCat for the apps, keep Stripe for the web, and let one entitlement unlock both.

---

## 5. Kids, COPPA and Google Families: decision for the beta

**Recommendation: general-audience app, Google Play target audience 13+ (13–15, 16–17, 18+), not "Designed for Families", not Apple Kids Category, until counsel completes the COPPA review** (`docs/PLATFORM_ARCHITECTURE.md` §9b).

Why: choosing any under-13 age group in Play's Target audience puts the app under the **Families policy**: only Families-certified SDKs, COPPA/GDPR-K compliance, a teacher-approved/age-appropriate content review, and restrictions on collecting personal data such as e-mail from children. Our sign-up collects an e-mail address with a "13+ or parent" checkbox. That is a reasonable web-beta stance but not a reviewed COPPA program. Under-13 players can still play everything as guests (no data leaves the device). Revisit after counsel: options are a neutral age screen before sign-up, verifiable parental consent, or a separate kids app with accounts removed.

Note: a 13+ *target audience* is not the same as the *content rating* (expected Apple 9+, ESRB E10+/PEGI 7). Families still play, and the listing says "family-friendly" without targeting children.

---

## 6. Build and upload

Refresh the web copy every time the site changes:
```bash
npm install                       # repo root (three is vendored from node_modules)
(cd app && npm install)           # Capacitor + fonts
node tools/build_app_www.mjs --site https://<production domain>    # or: INOA_SITE=… npm run app:sync
cd app && npx cap sync            # copies www + config into android/ and ios/, updates plugins
```

### iOS → TestFlight (Mac with Xcode 16+; owner)
1. `cd app && npx cap open ios` (opens `ios/App/App.xcodeproj`. SPM fetches Capacitor packages on first open).
2. Target **App** → Signing & Capabilities: Team = the Inoa Services developer team, "Automatically manage signing". The bundle ID must match the App ID created in App Store Connect (`com.inoaservices.games` unless changed: change it in `capacitor.config.json` **and** Xcode before the first upload).
3. General: Version (`MARKETING_VERSION`) `1.0.0`, Build (`CURRENT_PROJECT_VERSION`) `1`. Deployment target iOS 15.0. Devices: iPhone + iPad. Check the orientations you want (games support both).
4. App Store Connect → My Apps → **+ New App** (platform iOS, name, primary language English (U.S.), bundle ID, SKU `inoa-games`).
5. Xcode: select "Any iOS Device (arm64)" → **Product → Archive** → Organizer → **Distribute App → App Store Connect → Upload**.
6. Export compliance: the app only uses HTTPS/standard OS encryption, so answer "uses exempt encryption". To skip the question on every build, `ITSAppUsesNonExemptEncryption = NO` is already set in `app/ios/App/App/Info.plist`.
7. App Store Connect → TestFlight: internal testers (up to 100 team members, no review), or an **external group** with a public link (needs Beta App Review: add "What to test", a contact, and a demo account if sign-in is needed).
8. Before a public release: listing (`store/listing.md`), screenshots (`store/screenshots/iphone69`, `ipad13`), privacy label, age rating, privacy policy URL.

### Android → Play closed testing (owner)
1. Install **Android Studio** (bundles JDK 21 + SDK). Capacitor 8 needs compileSdk 36 and JDK 21.
2. **Create the upload keystore once, keep it OUT of the repo** (password manager + offline backup; losing it means contacting Google to reset the upload key):
   ```bash
   keytool -genkeypair -v -keystore ~/keys/inoa-upload.jks -alias inoa-upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   Use **Play App Signing** (default). Google holds the app signing key and you hold only the upload key.
3. Build a signed **App Bundle**: Android Studio → Build → Generate Signed App Bundle, or from the command line:
   ```bash
   cd app/android
   ./gradlew bundleRelease \
     -Pandroid.injected.signing.store.file=$HOME/keys/inoa-upload.jks \
     -Pandroid.injected.signing.store.password=*** \
     -Pandroid.injected.signing.key.alias=inoa-upload \
     -Pandroid.injected.signing.key.password=***
   # → app/build/outputs/bundle/release/app-release.aab
   ```
   Debug APK for a quick phone test: `./gradlew assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk` (`adb install -r …`).
4. Play Console → Create app (name, default language, Game, Free) → complete **App content**: privacy policy URL, ads = No, app access (instructions/demo account if sign-in gates anything), content rating (IARC), target audience (13+, §5), Data safety (`store/listing.md`), government apps = No, account deletion URL.
5. **Testing → Internal testing** (up to 100 testers, minutes to go live) → upload the `.aab` → check the pre-launch report.
6. **Testing → Closed testing** → create a track, add testers (Google Group or e-mail list), upload/promote the release. For a **personal** account: keep **≥12 testers opted in for 14 continuous days**, then apply for production access.
7. Store listing: short/full description, icon 512×512 (use `app/resources/icon-only.png` resized), feature graphic `store/feature-graphic.png` (1024×500), phone screenshots `store/screenshots/android/`, tablet screenshots optional (`ipad13` art is 3:4, which Play accepts for tablets).

### Version bumping (every upload)
| | Marketing version | Build number (must increase every upload) |
| --- | --- | --- |
| iOS | `MARKETING_VERSION` in Xcode (1.0.0 → 1.0.1 …) | `CURRENT_PROJECT_VERSION` (1, 2, 3 …) |
| Android | `versionName` in `app/android/app/build.gradle` | `versionCode` (1, 2, 3 …) |
| Web copy | `app/package.json` `version` (written to `www/app-build.json`) | |
Keep the three marketing versions equal.

---

## 7. Signing material: never in git
`app/.gitignore` ignores `*.jks`, `*.keystore`, `keystore.properties`, `*.p12`, `*.mobileprovision`, `*.cer`. The Android upload key and Apple certificates live in the owner's password manager and on the owner's Mac. For CI later, store them as encrypted CI secrets (e.g. GitHub Actions secrets + `fastlane match`).

---

## 8. Store art
`npm run store:shots` (= `PORT=8890 node test/run.js index tools/store_shots.js`). Options: `STORE_DEVICES=iphone69,ipad13,android`, `STORE_GAMES=hub,drift,runner,brew,trivia,tidelines,junk`, `STORE_LANG=es`, `STORE_FEATURE=0`. It renders the real pages in headless Chromium with a seeded demo profile. Sizes: iPhone 6.9" **1320×2868** (440×956 @3x), iPad 13" **2064×2752** (1032×1376 @2x), Android phone **1080×1920** (432×768 @2.5x), feature graphic **1024×500**. All are opaque RGB PNGs. Software WebGL is slow (~2–4 min per game shot), so run one device at a time with different `PORT`s in parallel if needed. Apple accepts 1–10 screenshots per device size; 1320×2868 and 2064×2752 are the current largest sizes, and Apple scales them down for smaller devices **[RE-CHECK]**. Look at every image before uploading.

---

## 9. Microsoft Store (optional, cheap)
Package the **website** (not Capacitor) as a PWA: https://www.pwabuilder.com → enter `<site>` → Package for stores → Windows → upload the `.msixbundle` in Partner Center. The live PWA already has a manifest, icons and an offline service worker. Individual registration is free. The PWA loads three.js from jsDelivr, which the Microsoft Store allows for PWAs. Same no-purchase rule for the beta.

---

## 10. Checklist

| # | Step | Who | Status |
| --- | --- | --- | --- |
| 1 | Decide the final bundle ID / package name (`com.inoaservices.games`) | **Owner** | open |
| 2 | D-U-N-S number for Inoa Services (for organization accounts) | **Owner** | open |
| 3 | Apple Developer Program enrolment (US$99/yr) | **Owner** | open |
| 4 | Google Play Console account (US$25) + identity verification | **Owner** | open |
| 5 | Production domain on Vercel; set `--site` | Owner + engineer | open |
| 6 | CORS on `api/account-delete` (+ `api/portal`) for `https://localhost`, `capacitor://localhost` | Engineer (api/) | **open: blocks in-app deletion** |
| 7 | Finish `privacy.html` `[OWNER TO CONFIRM]` items, support e-mail | **Owner** (+ counsel) | open |
| 8 | COPPA review; keep the 13+ target audience until done | **Owner + counsel** | open |
| 9 | Safari allergist review, or leave Safari out of the store build | **Owner** | open |
| 10 | `node tools/build_app_www.mjs --site …` + `npx cap sync` | Engineer | done (re-run per release) |
| 11 | Icons, splash, adaptive icon | Engineer | done (`app/resources`) |
| 12 | Store screenshots + feature graphic | Engineer | done (`store/`); re-shoot after visual changes |
| 13 | Listing copy EN/ES, age rating, privacy answers | Engineer → **Owner reviews** | drafted (`store/listing.md`) |
| 14 | Upload keystore created + backed up (not in git) | **Owner** | open |
| 15 | Android debug build on a real phone (`./gradlew assembleDebug`) | Owner/engineer with Android SDK | open (no SDK in sandbox) |
| 16 | Signed `.aab` → Internal → Closed testing (≥12 testers × 14 days if personal account) | **Owner** | open |
| 17 | Xcode archive → TestFlight internal → external group (Beta App Review) | **Owner** (Mac) | open |
| 18 | Real-device check: load time, FPS, safe areas, controller, offline, audio after background/resume | Owner + testers | open |
| 19 | Optional: haptics + share plugins to strengthen 4.2 | Engineer | idea |
| 20 | Microsoft Store via PWABuilder | **Owner** | optional |
