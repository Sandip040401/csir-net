# NET Tracker 🎯
> **Frictionless Data-Entry & Bayesian Analytics Platform for CSIR NET Life Sciences & Biotechnology (Dec 2026)**  
> Exam Code: 703 | Exam Window: 19–27 Dec 2026

NET Tracker is a high-speed, mobile-first full-stack application designed specifically for serious CSIR-UGC NET Life Sciences aspirants. It turns daily practice and mock logs into pinpoint Bayesian weakness diagnostics, exam score projections with negative marking deductions, and deterministic study actions.

---

## ⚡ Key Highlights & Features

1. **< 60s High-Speed Frictionless Data Entry (`/`)**:
   - Date picker with instant ◀ Today ▶ navigation.
   - Segmented `[☀️ Morning Practice | 🌙 Night Mock]` toggle.
   - Intelligent chapter dropdown + searchable topic chips. **Only attempted topics are added to the grid** (no giant empty tables).
   - "Same topics as last time" & "+ Add all" one-click accelerators.
   - **Real-time Invariant Autocompletion**:
     - `Wrong` automatically updates as `Total - Right`.
     - `Part C` automatically calculates as `Total - Part B`.
     - Steppers (`+` / `-`) and numeric keypad optimization on mobile (`inputMode="numeric"`).
     - Live row accuracy %, total summary row, and daily target progress bar.
     - **Draft Autosave to LocalStorage**: Never lose input on page refresh.
     - **Ctrl+Enter Quick Save** with instant undo notification.
     - Multi-chapter blocks on the same session day (`+ Add another chapter`).
     - Night mock mode with time taken and mistake tags (`concept gap`, `silly mistake`, `time`, `guess`).

2. **Bayesian Weakness Engine & Analytics (`/analytics`)**:
   - **Exam countdown** & daily pace projection (`at current pace you will solve X by exam day`).
   - **Estimated Exam Score `/200`**: Computes realistic expected score using standard CSIR marking scheme:
     - Part A (max 15 attempt, +2 / -0.5)
     - Part B (max 35 attempt, +2 / -0.5)
     - Part C (max 25 attempt, +4 / -1.0)
   - **Marks lost to negative penalties** displayed directly so you can see where deductions happen.
   - **Wilson Lower Bound / Bayesian Smoothing**: Topics with 3 attempts are not unfairly compared against topics with 60 attempts.
   - **Recency-Weighted Exponential Decay** (half-life = 10 days) to reflect current retention.
   - **Top 10 Topics to Fix Now** ranked by priority score:
     $$\text{Priority} = \text{Error Rate} \times \text{Staleness Factor} \times \text{Chapter Weight}$$
   - **Interactive Charts**: Daily volume line chart with target line, radar competency chart, chapter practice vs. mock pressure gap.

3. **Deterministic "How to Improve" Recommendations**:
   - Generates tactical advice server-side without needing an external API (e.g. concept gaps, high Part C negative penalties, spaced revision queue, silly mistake patterns).
   - *Optional*: Plug in your `ANTHROPIC_API_KEY` to enable Claude AI study advice on demand.

4. **Strategic Planner (`/planner`)**:
   - Generates a non-strict, weakness-weighted study calendar from Nov 15 up to exam date (Dec 19).
   - Pairs Part A every 3rd day.
   - Dedicated 5-day final revision window for high-yield chapters (14, 3, 4, 8).
   - "Regenerate from Today" button to dynamically realign strategy anytime.

5. **Session History (`/history`) & Settings (`/settings`)**:
   - Searchable, filterable calendar log of all sessions.
   - Full JSON backup export & restore, CSV download.
   - Configurable exam date, daily target (default 100 Qs), and accuracy thresholds (Weak < 50%, Needs work < 65%, Good < 80%).
   - Add/hide custom chapters and custom topics.

---

## 🏗️ Architecture & Tech Stack

- **Monorepo Layout**:
  - `/backend`: Node.js + Express (ES Modules), MongoDB + Mongoose, Zod validation, JWT authentication with `httpOnly` cookies, bcryptjs, helmet, morgan.
  - `/frontend`: React 18/19 + Vite, React Router v7, Tailwind CSS v4, Recharts, TanStack Query v5, Lucide Icons, date-fns.
  - Root: `docker-compose.yml`, `README.md`.

---

## 🚀 Exact Run Instructions

### Prerequisites
- Node.js (v18 or v20+)
- MongoDB running locally on port 27017 OR a Docker daemon OR a MongoDB Atlas URI.

### Option A: Running with Local MongoDB / Docker Compose

1. **Start MongoDB**:
   ```bash
   # From root directory:
   docker-compose up -d
   ```
   *(Or ensure your local MongoDB service is running on `mongodb://127.0.0.1:27017/csir_net_tracker`)*.

2. **Configure Backend Environment**:
   ```bash
   cd backend
   cp .env.example .env
   ```
   *The default `.env` is already configured for local use:*
   ```ini
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/csir_net_tracker
   JWT_SECRET=super_secret_jwt_key_csir_dec_2026_aspirant
   CLIENT_URL=http://localhost:5173
   ADMIN_EMAIL=aspirant@csirnet.local
   ADMIN_PASSWORD=csir2026
   ANTHROPIC_API_KEY=
   ```

3. **Install Dependencies & Seed Syllabus**:
   ```bash
   # In /backend:
   npm install
   npm run seed
   ```
   *This seeds Part A (Reasoning & Maths) + Chapters 1 through 14 with all topics, official syllabi descriptions for tooltips, and creates the default user account.*

4. **(Optional) Seed 3 Weeks of Realistic Demo Data**:
   To immediately experience the analytics dashboard, radar charts, and recommendation engine:
   ```bash
   # In /backend:
   npm run seed:demo
   ```
   *(To wipe demo sessions later: `npm run clear:demo`)*

5. **Start Backend Server**:
   ```bash
   # In /backend:
   npm run dev
   # Server runs on http://localhost:5000
   ```

6. **Start Frontend Client**:
   Open a new terminal window:
   ```bash
   cd frontend
   npm install
   npm run dev
   # App runs on http://localhost:5173
   ```

7. **Sign In**:
   - Open [http://localhost:5173](http://localhost:5173) in your browser or phone.
   - Log in with the pre-seeded credentials:
     - **Email**: `aspirant@csirnet.local`
     - **Password**: `csir2026`
     *(Click the "Fill" button on the login screen for instant 1-click login)*.

---

## 🧪 Running Unit Tests

Run the analytics calculation unit tests (testing Wilson score bound, Bayesian smoothing, negative marking estimation, and priority scoring):
```bash
cd backend
npm test
```

---

## ⚙️ Configuration & Customization Guide

### How to Change the Exam Date & Daily Target
1. In the web app, navigate to **Settings** (`/settings`).
2. Adjust the **CSIR NET Exam Date** (default: `2026-12-19`) or **Daily Target Questions** (default: `100`).
3. Click **Save Configuration**. The countdown on all pages will update immediately.

### How Performance Thresholds Work
- **Weak (`< 50%`)**: Triggers critical concept gap alerts and high revision priority.
- **Needs work (`50% - 65%`)**: Highlighted in amber on tables and prompts practice sets.
- **Good (`65% - 80%`)**: Solid retention, scheduled for spaced recall.
- **Strong (`> 80%`)**: Maintained with periodic mini-mocks.
- *Thresholds are fully editable in `/settings`.*

### Guess Break-even Logic
- Part A & Part B (+2 / -0.5) and Part C (+4 / -1.0) both carry an exact 25% negative marking penalty.
- Expected value formula: $E[V] = P(\text{correct}) \times \text{gain} - (1 - P(\text{correct})) \times \text{penalty}$.
- $E[V] > 0 \iff P(\text{correct}) > 20\%$.
- When you can eliminate at least 1 option out of 4 (so $P \ge 33.3\%$) or 2 options out of 4 ($P = 50\%$), guessing yields positive expected marks.

---

## 📱 Mobile-First PWA

NET Tracker is designed mobile-first with:
- iOS/Android numeric keyboards (`inputMode="numeric"`)
- Touch-friendly `+` / `-` steppers
- Sticky bottom navigation bar on mobile screens
- `manifest.json` included in `frontend/public/` for home-screen installation.
