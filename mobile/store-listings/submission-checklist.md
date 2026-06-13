# Bloom v1.0.0 — App Store & Google Play Submission Checklist

Complete every item before submitting to either store. Tick them off as you go.

---

## 1. LEGAL & BUSINESS

- [ ] Register company: **Bloom Health Ltd** (or your entity)
- [ ] Apple Developer Program enrolled ($99/year) — https://developer.apple.com/programs/
- [ ] Google Play Developer account active ($25 one-time) — https://play.google.com/console/signup
- [ ] Privacy policy live at **https://bloompregnancy.app/privacy**
  - Must cover: data collected, how it's used, third parties, user rights (GDPR/CCPA), deletion process
  - Must be accessible without logging in
- [ ] Terms of service live at **https://bloompregnancy.app/terms**
- [ ] Support URL live at **https://bloompregnancy.app/support** (not just an email)
- [ ] Support email active: **support@bloompregnancy.app**
  - Apple requires a response within 24h during review
- [ ] GDPR Data Processing Agreement in place if storing EU user data
- [ ] Medical disclaimer visible in-app (Settings → About or first screen)
  - "Bloom is not a medical device. Always consult your healthcare provider."
- [ ] Copyright year correct (© 2026 Bloom Health Ltd)

---

## 2. APPLE APP STORE — PREREQUISITES

- [ ] Apple Developer account with active membership
- [ ] App ID created in Developer Portal: **com.bloompregnancy.app**
- [ ] Push notification capability enabled (Certificates, Identifiers & Profiles)
- [ ] HealthKit capability enabled (if using Apple Health integration)
- [ ] Sign in with Apple capability enabled (required if offering any third-party login)
- [ ] App-specific password generated for App Store Connect uploads
- [ ] Distribution certificate created and installed
- [ ] Provisioning profile (App Store distribution) created
- [ ] `expo-apple-sign-in` or `expo-auth-session` configured for Sign in with Apple

### App Store Connect Setup
- [ ] New app created in App Store Connect
  - Bundle ID: com.bloompregnancy.app
  - SKU: bloom-pregnancy-tracker-001
  - Primary language: English (UK) or English (US)
- [ ] App name: **Bloom — Pregnancy Tracker** (confirmed available)
- [ ] Subtitle confirmed ≤30 chars: **Your global pregnancy companion** (31 chars — trim to "Global pregnancy companion" or similar)
- [ ] Category: Health & Fitness / Medical
- [ ] Age rating: 4+
- [ ] Pricing: Free (with in-app purchases)

### In-App Purchases (iOS)
- [ ] "Bloom Premium Monthly" product created — $6.99/month (auto-renewable subscription)
- [ ] "Bloom Premium Annual" product created — $39.99/year (auto-renewable subscription)
- [ ] Subscription group created: "Bloom Premium"
- [ ] Subscription promotional text written (up to 3000 chars)
- [ ] Free trial period set (7 days recommended)

### iOS Screenshots — REQUIRED SIZES
All screenshots must be real app screens (no mockups with devices unless showing actual UI)

**iPhone 6.7" (iPhone 15 Pro Max) — REQUIRED**
- [ ] Size: 1290 × 2796 px
- [ ] Minimum 3, maximum 10 screenshots
- Suggested screens:
  - [ ] 1. Onboarding welcome / hero screen
  - [ ] 2. Week-by-week development (e.g. Week 20 baby update)
  - [ ] 3. AI chat conversation showing a helpful response
  - [ ] 4. Contraction timer active
  - [ ] 5. Kick counter session
  - [ ] 6. Symptom tracker / dashboard

**iPhone 6.5" (iPhone 11 Pro Max / XS Max) — REQUIRED**
- [ ] Size: 1242 × 2688 px
- [ ] Same 6 screens as above (can be same content, different size)

**iPhone 5.5" (iPhone 8 Plus) — REQUIRED**
- [ ] Size: 1242 × 2208 px
- [ ] Same screens

**iPad Pro 12.9" (6th gen) — REQUIRED if supportsTablet: true**
- [ ] Size: 2048 × 2732 px
- [ ] At least 1 screenshot showing tablet layout

**App Preview Video (optional but boosts conversion ~15%)**
- [ ] 15–30 second video, portrait, MP4
- [ ] Shows core flow: onboarding → chat → contraction timer
- [ ] No device frames unless showing real device

### iOS Review Information
- [ ] Test account created for App Review team:
  - Email: **reviewer@bloompregnancy.app** (create this)
  - Password: (strong, written down separately)
  - Account pre-configured: week 24 pregnancy profile set up
  - Notes explaining: how to reach contraction timer, kick counter, AI chat
- [ ] Review notes written (see template below)
- [ ] Contact: your name + mobile number (Apple may call during review)
- [ ] Demo video URL (optional — upload to unlisted YouTube if app is complex)

**Review Notes Template:**
```
Bloom is a pregnancy tracking app with AI support.

TEST ACCOUNT:
Email: reviewer@bloompregnancy.app
Password: [REDACTED - submitted via App Store Connect]

The account is pre-configured with a week-24 pregnancy profile so you can 
explore all features immediately.

KEY FEATURES TO TEST:
1. AI Chat (tab 3): Ask any pregnancy question. Emergency detection is built-in — 
   try typing "I am bleeding heavily" to see the emergency response (no AI call made).
2. Contraction Timer (Track tab → Contractions): Tap start/stop to time contractions.
3. Kick Counter (Track tab → Kicks): Tap to count baby movements toward a goal of 10.
4. Mental Health (Track tab → Mood): Includes EPDS screening tool.

NOTIFICATIONS: The app requests notification permission. Please allow during testing 
to verify reminders function correctly.

NETWORK: The app requires an internet connection for AI chat features. 
Other features (contraction timer, kick counter) work offline.

No special hardware required.
```

---

## 3. GOOGLE PLAY — PREREQUISITES

- [ ] Google Play Console account active
- [ ] App created in Play Console
  - Package name: **com.bloompregnancy.app**
  - Default language: English (United Kingdom)
- [ ] App signing: Use Google Play App Signing (recommended — select during first upload)

### Play Store Setup
- [ ] Store listing complete (title, short desc, full desc)
- [ ] App icon uploaded: 512 × 512 px PNG (no alpha)
- [ ] Feature graphic: 1024 × 500 px JPG or PNG (shown at top of listing)
- [ ] Content rating questionnaire complete (see ratings section in google-play.md)
- [ ] Target audience: 18+ (do NOT select "children" — this is a pregnancy app)
- [ ] Category: Health & Fitness
- [ ] Tags: pregnancy tracker, baby tracker, kick counter, contraction timer
- [ ] Privacy policy URL entered: https://bloompregnancy.app/privacy

### Android In-App Purchases
- [ ] "bloom_premium_monthly" subscription created — $6.99/month
- [ ] "bloom_premium_annual" subscription created — $39.99/year
- [ ] Base plan set for each: auto-renewing
- [ ] Grace period: 3 days
- [ ] Free trial: 7 days

### Android Screenshots — REQUIRED
**Phone screenshots**
- [ ] Size: 1080 × 1920 px minimum (16:9 or 9:16)
- [ ] Minimum 2, maximum 8 screenshots
- [ ] Same 6 screens as iOS list above

**7-inch tablet (optional)**
- [ ] Size: 1200 × 1920 px

**10-inch tablet (optional)**
- [ ] Size: 1920 × 1200 px

### Google Play Review
- [ ] Test account for reviewers (same as iOS account above)
  - Enter credentials in "App access" section of Play Console
- [ ] Data safety section complete (REQUIRED since 2022):
  - [ ] "Does your app collect or share user data?" → Yes
  - [ ] Data types collected:
    - Health and fitness → Health info (pregnancy data, symptoms)
    - Personal info → Email address, Name
    - App activity → App interactions
  - [ ] All data encrypted in transit: Yes
  - [ ] Users can request data deletion: Yes (link to: https://bloompregnancy.app/delete-account)
- [ ] Declares use of location data: No (unless adding location features)
- [ ] Declares use of background location: No

---

## 4. TECHNICAL — PRE-BUILD CHECKLIST

- [ ] Bundle ID in app.json: **com.bloompregnancy.app** (not com.bloom.pregnancytracker)
- [ ] Version: **1.0.0** and versionCode/buildNumber: **1**
- [ ] All environment variables set in EAS Secrets:
  - [ ] `ANTHROPIC_API_KEY` — production Claude API key
  - [ ] `JWT_SECRET` — production secret (32+ chars)
  - [ ] `JWT_REFRESH_SECRET` — separate production secret
  - [ ] `API_BASE_URL` — production backend URL (e.g. https://api.bloompregnancy.app/api)
  - [ ] `EXPO_PUBLIC_API_URL` — same
- [ ] Production backend deployed and accessible from mobile
- [ ] SSL certificate valid on production API domain
- [ ] Push notification service configured in production backend
- [ ] Expo push token → APNs / FCM routing tested end-to-end
- [ ] Deep links tested (bloom:// scheme)
  - [ ] `bloom://chat` opens chat tab
  - [ ] `bloom://track` opens tracking tab
- [ ] All third-party API keys are PRODUCTION keys (not dev/test)
- [ ] Error tracking (Sentry or similar) configured for production
- [ ] Analytics (PostHog) configured for production

### Performance
- [ ] JS bundle size checked: `npx expo export --platform ios` then check output
- [ ] Cold start time < 3 seconds on a 3-year-old device
- [ ] No console.error or console.warn calls visible in production build
- [ ] All images optimised (use .webp where possible)
- [ ] No hardcoded localhost URLs anywhere in production code

### Accessibility (Apple requires basic accessibility)
- [ ] All buttons have accessible labels
- [ ] Text minimum size 11pt
- [ ] Sufficient colour contrast (WCAG AA for critical text)
- [ ] VoiceOver / TalkBack doesn't crash the app

---

## 5. EAS BUILD — FINAL BUILD STEPS

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Log in to your Expo account
eas login

# 3. Configure the project (first time only)
eas build:configure

# 4. Set production secrets
eas secret:create --scope project --name ANTHROPIC_API_KEY --value "sk-ant-..."
eas secret:create --scope project --name JWT_SECRET --value "..."
eas secret:create --scope project --name API_BASE_URL --value "https://api.bloompregnancy.app/api"

# 5. Build for iOS (production)
eas build --platform ios --profile production

# 6. Build for Android (production)
eas build --platform android --profile production

# 7. Submit to App Store (after build completes)
eas submit --platform ios --profile production

# 8. Submit to Google Play (after build completes)
eas submit --platform android --profile production
```

---

## 6. POST-SUBMISSION

- [ ] Monitor App Review status (typically 24–48h for iOS, 1–3 days for Android)
- [ ] Respond to any reviewer questions within 24h
- [ ] Set up App Store Connect → Availability → Release options:
  - Recommended: "Manually release this version" so you control go-live timing
- [ ] Prepare go-live announcement (social media, email list)
- [ ] ASO (App Store Optimisation) — after launch, A/B test screenshots
- [ ] Set up crash monitoring alerts (Sentry webhook → Slack)
- [ ] Plan first update: address any review feedback + ship top user-requested feature

---

## SUBTITLE FIX

> ⚠️ The requested subtitle "Your global pregnancy companion" is **31 characters**, which exceeds the 30-character App Store limit.

**Options (all ≤30 chars):**
- `Your global pregnancy guide` — 28 chars ✓
- `Global pregnancy companion` — 26 chars ✓
- `Pregnancy tracker & AI guide` — 28 chars ✓
- `Pregnancy tracker worldwide` — 27 chars ✓

**Recommendation:** `Pregnancy tracker & AI guide` — highlights the AI differentiator.
