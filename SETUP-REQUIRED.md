# NOIR — remaining setup

Status: **Apple Developer Program membership is active.** That unblocks almost
everything below. Work through it in order — several steps depend on earlier
ones, and step 2 is the one people most often miss.

Reference values:

| | |
|---|---|
| Bundle ID | `com.noir.cosmos` |
| Firebase project | `noir-60abb` |
| Monthly product | `com.noir.cosmos.plus.monthly` |
| Weekly product | `com.noir.cosmos.plus.weekly` |

---

## 1. Create the app record

App Store Connect → My Apps → **+** → New App.

- Platform iOS, bundle ID `com.noir.cosmos` (register the App ID first in the
  Developer portal if it isn't in the dropdown)
- Note the **Apple ID** number it assigns — that is the `ascAppId` you'll need
  for `eas submit`

## 2. Sign the Paid Applications Agreement — do this first

App Store Connect → **Business** → Agreements. Sign *Paid Applications*, and
fill in the banking and tax forms.

**Until this is active, StoreKit returns an empty product list** — the paywall
will show "couldn't reach the App Store" and the purchase button stays disabled,
even in sandbox. This is the single most common reason IAP "doesn't work", and
the agreement can take a day or two to go active.

## 3. Create the subscriptions

App Store Connect → your app → **Subscriptions** → create one subscription
group (e.g. "NOIR+"), then two auto-renewable subscriptions **in that group**:

| Product ID | Duration | Price |
|---|---|---|
| `com.noir.cosmos.plus.monthly` | 1 month | $7.99 (US tier) |
| `com.noir.cosmos.plus.weekly` | 1 week | $3.99 (US tier) |

The IDs must match exactly — they're in `constants/config.ts` →
`NOIR_PLUS_PRODUCTS`. Change them there if you use different ones.

**3-day free trial:** on the monthly product add an *Introductory Offer* →
type **Free Trial**, duration **3 days**, all territories. The app reads the
trial from StoreKit and labels the button itself; nothing is hardcoded.

Each subscription needs a localized display name, description, and a review
screenshot before it will leave "Missing Metadata".

Prices in other countries come from Apple's tier table automatically — the app
shows StoreKit's localized `displayPrice` and never converts currency itself.

## 4. Create a sandbox tester

App Store Connect → **Users and Access** → Sandbox → Testers → **+**.

Use a fresh email (not your Apple ID). On the device, sign in under
Settings → Developer → Sandbox Apple Account — *not* the main iCloud account.

## 5. Build

```bash
eas login
eas init          # links the project, writes extra.eas.projectId into app.json
eas build --profile development --platform ios
```

EAS generates the distribution certificate, provisioning profile and APNs key
for you — just answer yes. It will ask about a **Push Notifications key**
because `expo-notifications` adds the `aps-environment` entitlement; NOIR only
uses *local* notifications, so this isn't required functionally, but letting EAS
create the key is harmless and leaves remote push available later.

Install the resulting build on a registered device (`eas device:create` to
register one first).

## 6. Register the App Check debug token

Run the development build and find this in the Metro/Xcode console:

```
FIREBASE APP CHECK DEBUG TOKEN: <token>
```

Firebase Console → App Check → Apps → NOIR → **Manage debug tokens** → add it.

Without this every Gemini request fails, so the preview and full reading will
error. The token is per-install — a reinstall gives you a new one.

**Do not turn on App Check *enforcement* for Firebase AI Logic yet.** Verify
readings generate first, then enforce. Enforcing early locks out your own
builds and the failure looks identical to a broken AI integration.

Production builds use App Attest with a DeviceCheck fallback
(`firebase/appCheck.ts`) and need no token — only a properly signed build.

## 7. Fill in the privacy policy, then deploy it with the Firestore rules

The privacy policy and support pages are written and live in `hosting/`
(`hosting/privacy/index.html`, `hosting/support/index.html`). They describe
what the code actually does — no analytics, no ads, no tracking; Gemini gets the
onboarding answers and calculated chart positions, never name, email, raw birth
details or the journal.

**Before deploying,** replace the two placeholders in both pages:

- `[YOUR NAME OR COMPANY]` — the legal name on your developer account
- `[YOUR CONTACT EMAIL]` — a support address you will actually read

Then deploy both at once (`firebase.json` now configures hosting and rules):

```bash
firebase deploy --only hosting,firestore:rules
```

That makes these live — check both open in a browser:

- Privacy policy: https://noir-60abb.web.app/privacy (linked from the paywall
  and the birth screen)
- Support: https://noir-60abb.web.app/support

`firestore.rules` restricts `users/{uid}` and its `dailyReadings` subcollection
to the owner. The project's default test-mode rules expire, after which every
read fails.

In **App Store Connect → App Information**, enter the privacy URL as *Privacy
Policy URL* and the support URL as *Support URL* (both required). Optionally set
`NOIR_LEGAL.supportEmail` in `constants/config.ts` to show a support row in
Settings.

**App Privacy label** (App Store Connect → App Privacy). Based on the code:
Contact Info → Email (account), User Content → other (onboarding answers,
journal), Other Data → birth date/time/place, Identifiers → User ID. All
*linked to the user*, used for *App Functionality* only, *not* used for
tracking. No analytics or advertising data is collected.

## 8. Test the real purchase

With the sandbox account signed in, open the paywall. You should see real
prices in your storefront's currency, the trial labelled on the monthly plan,
then: purchase → Apple confirms → celebration → full reading unlocks.

Sandbox subscriptions renew on an accelerated clock (a month ≈ 5 minutes), so
expiry and the locked state are quick to test.

## 9. Account deletion — built; one Firebase step makes it complete

Settings → **Delete account** is in the app (App Store Review Guideline
5.1.1(v)). It re-authenticates, erases the Firestore profile and every daily
reading, cancels the reminder, deletes the Firebase login and signs out.

It also tries to **revoke the Sign in with Apple token**, which removes NOIR
from the person's Apple ID — Apple asks apps to do this. That call only works
once Firebase holds your Apple key:

1. Apple Developer → Certificates, IDs & Profiles → **Keys** → **+** → enable
   *Sign in with Apple*, configure it for `com.noir.cosmos`, download the `.p8`
   file (you can only download it once) and note the **Key ID**.
2. Firebase Console → Authentication → Sign-in method → **Apple** → OAuth code
   flow configuration → enter your **Team ID**, the **Key ID**, and paste the
   contents of the `.p8`.

Until that is done, deletion still works completely — revocation is
deliberately best-effort, because an account the person cannot delete is the
outcome App Review rejects. Apple users are then shown how to remove NOIR from
their Apple ID themselves (Settings → their name → Sign-In & Security → Sign in
with Apple). After step 2, that instruction stops appearing.

**Deploy the updated `firestore.rules` before testing this.** The previous rules
forbade client deletes, so deletion fails with "permission denied" until the new
rules are live.

Deleting an account does **not** cancel an Apple subscription — Apple bills it
separately. The deletion screen says so before the person confirms, with a
button to Manage Subscription, and repeats it afterwards.

---

## Still outstanding — not fixed by the membership

**Third-party AI consent (Guideline 5.1.2) — built.** The birth screen asks for
explicit permission before anything goes to Gemini, names Google's Gemini AI,
says what is and isn't sent, and links the privacy policy. Save & continue stays
disabled until it is ticked; the time of consent is stored on the profile as
`aiConsentAt`. Mention this in App Review notes.

**Gemini data terms.** Check which Gemini terms apply to `noir-60abb` in
Firebase Console → AI Logic. On the free (Spark) tier, Google may use prompts to
improve its products; on a paid (Blaze) plan it does not. The privacy policy
says Google processes the data to generate the reading — if you stay on the
free tier, say so there too.

**Editing birth details.** There is no in-app way to change birth date, time or
place after sign-up. The support page tells people to email you; a later update
should add an edit screen.

**Google Sign-In on Android** would need `GOOGLE_WEB_CLIENT_ID` filled in from
Firebase Console → Project settings → General → Web client. iOS reads the
client ID from `GoogleService-Info.plist`, so it is not needed for iOS.

## Recommended before launch

**Server-side receipt validation.** Purchases are verified on-device with
StoreKit 2 (`isTransactionVerifiedIOS`), and StoreKit — not Firestore — is
treated as the authority: `refreshEntitlement()` overwrites the cached
entitlement from StoreKit on every launch and foreground. That is solid for
normal use.

To harden it, add a Cloud Function subscribed to **App Store Server
Notifications v2** that writes `users/{uid}.noirPlus`, and tighten the Firestore
rules so clients cannot write that field at all. Today a determined user could
write it directly, though the next StoreKit refresh corrects it.
