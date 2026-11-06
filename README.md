# Parivar Demo

A public, read-only demonstration of **Parivar**, a family graph and relationship-exploration application. This repository is intentionally separate from the private Parivar application and must use its own MongoDB project/cluster, database credentials, deployment secrets, and synthetic dataset.

> **Privacy boundary:** this project contains fictional data only. Never copy a production `.env`, MongoDB URI, Excel export, profile photo, private handoff document, or real family record into this repository.

## Demo dataset

The included workbook `data/Parivar_Demo_Family_250_Members.xlsx` contains:

- **250 fictional members** under the family ID `PARIVAR_DEMO`.
- **6 generations** and **8 main branches** descending from the fictional founder couple.
- **45 synthetic business records** and **135 synthetic education records**.
- No real mobile numbers, email addresses, profile photos, or production records.
- A fixed viewing perspective: **Aarav Vardhan** (`m_id = 1051`).

All names, dates, cities, relationships, education details, and business details are synthetic. The workbook has the exact sheet names and columns expected by the Parivar Excel importer: `F_master`, `members`, `business`, and `education`. It also includes a `Guide` sheet describing the dataset.

## What visitors can do

- Enter the public demo in one click; no registration, email, or OTP is required.
- Browse and search the 250-member fictional family directory.
- Explore the multi-generation graph.
- Open member profiles and see computed relationships from Aarav's perspective.
- Use the relationship explorer to discover how two members are connected.
- View synthetic education and business information.

The public application is read-only. Editing, adding/deleting members, role changes, uploads, wishes, push notifications, and the AI chatbot are not included in this demo.

## Repository structure

```text
Parivar-Demo/
├── data/
│   └── Parivar_Demo_Family_250_Members.xlsx
├── scripts/
│   ├── import-excel.js
│   └── validate-demo-graph.js
├── src/
│   ├── lib/                 # MongoDB connection, date parsing, logging
│   ├── models/              # Family, Member, Business, Education
│   └── server/              # Express API, fixed demo auth, read-only routes
├── vendor/                 # Vendored SheetJS package used by the importer
├── web/                    # React + Vite frontend
├── .env.example
└── README.md
```

## Requirements

- Node.js 20 or newer
- A **new, dedicated MongoDB Atlas project/cluster** created only for this demo
- A separate backend service and frontend deployment

Do not reuse the MongoDB cluster, database user, connection string, JWT secret, Cloudinary account, email account, or environment variables from the private Parivar application.

## 1. Create and configure the demo database

Create a new MongoDB Atlas project and a new cluster for Parivar Demo. Create a database named exactly `parivar_demo`, then create a database user with access only to that database.

From the repository root:

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```dotenv
MONGO_URI=mongodb+srv://<demo-user>:<url-encoded-password>@<demo-cluster>.mongodb.net/parivar_demo?retryWrites=true&w=majority
AUTH_JWT_SECRET=<unique-random-secret-at-least-32-characters>
DEMO_MODE=true
DEMO_FID=PARIVAR_DEMO
DEMO_MEMBER_ID=1051
FRONTEND_URLS=http://localhost:5173
PORT=4000
NODE_ENV=development
```

Generate a fresh JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The API refuses to start unless `DEMO_MODE=true`, `AUTH_JWT_SECRET` is at least 32 characters, and the MongoDB URI names the database `parivar_demo`. The importer only accepts `--family PARIVAR_DEMO` and requires demo mode before writing.

## 2. Validate and import the synthetic workbook

The graph validator does **not** connect to MongoDB. It checks the workbook for:

- Exactly 250 members and one demo family row.
- Duplicate member IDs and invalid/missing dates or gender values.
- Missing parent/spouse references, self-links, incompatible parent gender, and non-reciprocal spouse links.
- Parent-child cycles and implausible parent ages.
- Six generations and eight founder branches.
- Business/education records pointing to valid members and plausible education years.
- No disconnected members using **BFS from Aarav Vardhan (`1051`)**.

Run both checks before writing to MongoDB:

```bash
npm run demo:validate
npm run demo:dry-run
```

Only when both complete with zero errors should you import the workbook:

```bash
npm run demo:import
```

The import command uses `--reset`, but it is guarded to the `PARIVAR_DEMO` family ID, `DEMO_MODE=true`, and the database named `parivar_demo`. It deletes/reloads only that synthetic family within the dedicated demo database. **Never point this command at the private Parivar database.** The report from the validated workbook is included at `data/demo-validation-report.json`.

## 3. Run the API locally

From the repository root:

```bash
npm run dev
```

The API listens on `http://localhost:4000`.

Check health:

```bash
curl http://localhost:4000/api/health
```

The public demo session endpoint is `POST /api/auth/demo-session`. It issues a short-lived (two-hour) JWT for the single synthetic viewer. All family data routes require this token, are scoped to `PARIVAR_DEMO`, and only expose read methods. All write methods are rejected server-side.

## 4. Run the frontend locally

In a second terminal:

```bash
cd web
npm install
cp .env.example .env
npm run dev
```

The frontend is available at `http://localhost:5173` and uses `VITE_API_URL=http://localhost:4000` from `web/.env`.

## 5. Deploy separately

Deploy the API and frontend as separate services. Do not combine them with the private Parivar deployment.

### Backend service

- Root directory: repository root
- Build/install command: `npm ci`
- Start command: `npm start`
- Environment variables: `MONGO_URI`, `AUTH_JWT_SECRET`, `DEMO_MODE=true`, `DEMO_FID=PARIVAR_DEMO`, `DEMO_MEMBER_ID=1051`, `FRONTEND_URLS=<exact-frontend-origin>`, `NODE_ENV=production`, and hosting-provided `PORT`.
- `MONGO_URI` must point to the new dedicated cluster and the database named `parivar_demo`.

### Frontend service

- Root directory: `web`
- Build/install command: `npm ci && npm run build`
- Publish directory: `dist`
- Build environment variable: `VITE_API_URL=<deployed-demo-api-origin>`

Set `FRONTEND_URLS` on the API to the exact deployed frontend origin (including `https://`, with no trailing slash). Configure the frontend host to rewrite React Router paths to `index.html` so `/directory`, `/graph`, `/explore`, `/about`, and member profile URLs load on refresh.

## Read-only and isolation guarantees

- Only the fixed synthetic viewer can obtain a demo session.
- The token expires after two hours and can be renewed by re-entering the demo.
- API reads use the token's fixed `fid`; another family ID is rejected.
- All write methods are rejected by backend middleware; hiding controls in React is not the security boundary.
- The frontend identifies the session as `DEMO MODE · Fictional family · Read-only access`.
- OTP, account creation, uploads, notifications, wishes and AI chat are not part of the public demo.
- The database connection guard accepts only the database name `parivar_demo`; the operator must still create and use a separate MongoDB cluster/project.

This is a portfolio demonstration, not a source of real genealogical information.
