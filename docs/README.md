# CarLoan RN – Project Documentation

## 📦 Overview
The **carloan‑rn** repository is a **React Native (Expo)** application that lets users manage vehicle financing contracts. It integrates with **Supabase** for backend storage and authentication, and implements a lightweight **image‑caching** strategy using `AsyncStorage`.

---

## 📁 Repository Structure
```
carloan-rn/
├─ src/
│   ├─ components/          # UI building blocks (FinancingCard, AddFinancingSheet …)
│   ├─ screens/             # Full‑screen pages (FinancingListScreen, Dashboard …)
│   ├─ services/            # Business‑logic & API wrappers (financingService, sharingService, imageService)
│   ├─ hooks/               # Custom React hooks (useResponsive, etc.)
│   ├─ theme/               # Design tokens, colors, shadows, dark‑mode support
│   ├─ navigation/          # Stack & tab navigation, helpers for tabBar visibility
│   ├─ lib/                 # Supabase client instance
│   └─ types/               # TypeScript interfaces (Financing, FinancingShare …)
├─ App.tsx                 # Root component, theme provider, navigation container
├─ app.json                # Expo configuration
└─ .claude                 # Project metadata for AI tooling
```

---

## 📱 Screens (UI Pages)
### 1️⃣ `FinancingListScreen`
* **Purpose:** List the user's own financings and any shared financings.
* **Key features:**
  - Pull‑to‑refresh (`RefreshControl`).
  - Loading spinner displayed **until all car images are cached**.
  - Retrieves financing data via `financingService.getAll()` and shared data via `sharingService.getSharedWithMe()`.
  - Counts paid installments by querying the `payments` table (Supabase). 
  - **Image pre‑caching**: builds an array of all `carPhotoPath` values, then calls `imageService.getOrCachePhoto` for each path *before* setting `loading` to `false`.
* **State variables:** `financings`, `sharedFinancings`, `paidCounts`, `loading`, `refreshing`, `showAdd`.
* **Navigation:** on card tap → `Dashboard` screen (via `useNavigation`).

### 2️⃣ `Dashboard` (not shown in diff but referenced)
* Displays details of a single financing, payment schedule, etc.
* Receives `financingId` and `readOnly` params.

### 3️⃣ `AddFinancingSheet`
* Modal sheet triggered by the floating‑action‑button (FAB).
* Handles creation of a new financing record and refreshes the list after success.

---

## 🧩 Components
| Component | Role | Important Props |
|-----------|------|-----------------|
| **FinancingCard** | Renders a financing row with car photo, name, plate, bank, progress bar. | `financing`, `paidCount`, `onPress` |
| **AddFinancingSheet** | Form UI to create a new financing entry. | `visible`, `onClose`, `onCreated` |
| **FinancingCard** (see above) | Uses `imageService.getOrCachePhoto` to load car photo (cached as base64). |
| **Other UI components** (`Button`, `Input`, etc.) are in `src/components/` but not modified in this task.

---

## 🛠️ Services (API / Business Logic)
### `financingService`
* **Methods:** `getAll()`, `create(data)`, `update(id, data)`, `remove(id)`.
* Wraps Supabase calls to the `financings` table.

### `sharingService`
* Handles sharing relationships (`financing_shares` table).
* Methods: `getSharedWithMe()`, `share(financingId, email)`, `revoke(shareId)`.

### `imageService`
* **Newly added** for image caching:
  ```ts
  async getOrCachePhoto(path: string): Promise<string | null>
  ```
  - Checks `AsyncStorage` for a stored base64 string.
  - If missing, obtains a signed URL via Supabase storage, fetches the binary, converts to base64, stores it, and returns the data URI.
* Helper `arrayBufferToBase64` performs the conversion without `btoa` (which isn’t available in RN).
* `remove(path)` clears the cached entry when a financing is deleted.

---

## 🎨 Theme & Styling
* `src/theme/` defines a **Design System** (colors, shadows, dark‑mode, typography).
* `useTheme()` hook provides the active `Theme` object.
* Styles are generated with `StyleSheet.create` inside each component/screen, consuming tokens such as `theme.bg`, `theme.accentDark`, `theme.shadowLg`.
* Dark mode automatically follows the system preference.

---

## 🔧 Hooks & Utilities
* `useResponsive` – returns layout‑aware `contentStyle` for safe‑area handling.
* `useSafeAreaInsets` – from `react-native-safe-area-context`.
* `showTabBar()` – helper to reveal the bottom tab bar when a screen gains focus.

---

## 📦 Caching Strategy (Images)
1. **First load** – `FinancingListScreen.load()` gathers every `carPhotoPath`.
2. Calls `imageService.getOrCachePhoto` for each path **in parallel** via `Promise.all`.
3. `getOrCachePhoto`:
   - Looks up `AsyncStorage` (`CAR_PHOTO_CACHE_${path}`)
   - If not present, fetches a **signed URL** from Supabase, downloads the file, converts to base64, stores it.
   - Returns a **data URI** (`data:image/jpeg;base64,…`).
4. Subsequent renders of `FinancingCard` read directly from the cache, resulting in **instant image display**.
5. The spinner on `FinancingListScreen` remains visible until **all images are cached**, guaranteeing a smooth first‑view experience.

---

## 🚀 Running the App
```bash
# Install dependencies (run once)
npm install

# Start Expo development server
npm run dev   # or: expo start
```
The app runs on iOS/Android simulators or physical devices via the Expo Go client.

---

## 📚 How to Extend / Maintain
* **Add a new screen:**
  1. Create the screen in `src/screens/`.
  2. Register it in the navigation stack (`src/navigation/`).
  3. Follow the same pattern: fetch data in a `load` callback, set a `loading` state, and use the shared `Theme`.
* **Add a new component:**
  1. Place the component in `src/components/`.
  2. Use `useTheme()` for styling, keep styling inside `makeStyles`.
* **Cache other assets:** replicate the `imageService` logic for PDFs, avatars, etc., using a distinct storage key prefix.

---

## 📄 License
MIT – see LICENSE file in the repository root.

---

*Generated by Antigravity AI – ready for next‑step development or hand‑off to a new AI assistant.*
