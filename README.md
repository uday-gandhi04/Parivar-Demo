# Parivar — Family Tree & Relationship Explorer

A full-stack family relationship management platform that transforms complex family structures into an interactive, searchable, multi-generational family graph.

**Parivar Demo** is a public, read-only version of the application, built with an entirely fictional dataset so visitors can explore its features without accessing private family information.

<p align="center">
  <a href="https://YOUR-FRONTEND-URL.onrender.com">
    <strong>🚀 Live Demo</strong>
  </a>
  &nbsp; · &nbsp;
  <a href="https://github.com/uday-gandhi04/Parivar-Demo">
    <strong>💻 Source Code</strong>
  </a>
</p>

---

## Overview

Managing large family structures across multiple generations can become complicated, especially when relationships, personal profiles, educational backgrounds, and business information are scattered across different records.

Parivar provides a centralized platform to explore and understand these connections through an interactive family graph and relationship discovery system.

The application demonstrates how a structured database, graph traversal, and an intuitive interface can make complex family relationships accessible and easy to navigate.

### Demo Dataset

The public demonstration uses a completely fictional family dataset.

| Dataset | Records |
|---|---:|
| Family Members | 250 |
| Generations | 6 |
| Main Family Branches | 8 |
| Business Records | 45 |
| Education Records | 135 |

All names, relationships, dates, locations, educational details, and business information are synthetic.

## Features

### 1. Family Directory
- Browse a directory of 250 fictional family members.
- Search and discover members.
- Access individual member profiles.

### 2. Interactive Family Tree
- Visualize multi-generational family structures.
- Explore different family branches.
- Navigate parent-child and spouse relationships.

### 3. Member Profiles
- View individual family member information.
- Explore family connections.
- Access educational and business information.

### 4. Relationship Explorer
- Discover how two family members are connected.
- Calculate relationships from a fixed reference member.
- Explore intermediate connections across generations.
- Display relationship descriptions, including Hindi kinship terminology.

### 5. Education & Business Directory
- Explore educational backgrounds.
- Browse family business information.
- Discover connections between members and their associated records.

### 6. Public Demo Access
- One-click demo access without registration or OTP.
- Fixed synthetic viewer identity.
- Read-only access enforced at the API level.
- No access to the private production database.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Visualization | D3.js |
| Authentication | JWT |
| Deployment | Render |
| Dataset | Excel, SheetJS |

## Architecture

The application follows a client-server architecture.

```text
                  Visitor
                     |
                     v
             React Frontend
                (Vite)
                     |
                 REST API
                     |
                     v
             Express Backend
                     |
              JWT Middleware
                     |
              Read-only Access
                     |
                     v
                MongoDB
               (Atlas)
```

The frontend communicates with the Express API through REST endpoints. The backend validates demo sessions, restricts access to the designated synthetic family, and serves read-only data.

## Security & Privacy

The public demo is intentionally isolated from the private Parivar application.

- Uses a separate MongoDB Atlas project/cluster and database.
- Contains fictional data only.
- Uses dedicated database credentials and JWT secrets.
- Demo authentication issues a short-lived JWT for a fixed viewer.
- API requests are restricted to the `PARIVAR_DEMO` family.
- Write operations are rejected server-side.
- No production credentials, personal records, or profile photographs are included.

The demo does not include account registration, OTP, uploads, notifications, wishes, or AI chatbot functionality.

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm
- MongoDB Atlas account

### 1. Clone the repository

```bash
git clone https://github.com/uday-gandhi04/Parivar-Demo.git
cd Parivar-Demo
```

### 2. Install backend dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Configure the following:

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/parivar_demo?retryWrites=true&w=majority

AUTH_JWT_SECRET=<unique-random-secret-at-least-32-characters>

DEMO_MODE=true
DEMO_FID=PARIVAR_DEMO
DEMO_MEMBER_ID=1051

FRONTEND_URLS=http://localhost:5173

PORT=4000
NODE_ENV=development
```

Generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Important:** Use a dedicated demo database. Never use production credentials or point the demo importer at the private Parivar database.

### 4. Validate and import the dataset

The repository includes a synthetic Excel workbook and validation utilities.

```bash
npm run demo:validate
npm run demo:dry-run
npm run demo:import
```

The importer is guarded to accept only the designated demo family and database.

### 5. Start the backend

```bash
npm run dev
```

Backend:

```text
http://localhost:4000
```

Health endpoint:

```text
http://localhost:4000/api/health
```

### 6. Start the frontend

Open another terminal:

```bash
cd web
npm install
```

Create `web/.env`:

```env
VITE_API_URL=http://localhost:4000
```

Start the development server:

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173
```

## Deployment

The public demo is deployed as two independent Render services.

| Service | Configuration |
|---|---|
| Backend | Render Web Service |
| Frontend | Render Static Site |
| Database | MongoDB Atlas |

### Backend

- Root Directory: Repository root
- Build Command: `npm ci`
- Start Command: `npm start`

Required environment variables:

- `MONGO_URI`
- `AUTH_JWT_SECRET`
- `DEMO_MODE`
- `DEMO_FID`
- `DEMO_MEMBER_ID`
- `FRONTEND_URLS`
- `NODE_ENV`

Render supplies the `PORT` environment variable.

### Frontend

- Root Directory: `web`
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`

Required build environment variable:

```env
VITE_API_URL=<deployed-backend-url>
```

Configure a rewrite rule on the frontend host:

```text
Source:      /*
Destination: /index.html
Action:      Rewrite (200)
```

The backend CORS configuration must contain the exact deployed frontend origin.

**Hosting note:** The backend uses Render's free web service, which may spin down after inactivity. The first request after a period of inactivity can take longer while the service starts.

## Repository Structure

```text
Parivar-Demo/
│
├── data/
│   └── Parivar_Demo_Family_250_Members.xlsx
│
├── scripts/
│   ├── import-excel.js
│   └── validate-demo-graph.js
│
├── src/
│   ├── lib/
│   ├── models/
│   └── server/
│
├── vendor/
│
├── web/
│   ├── src/
│   ├── public/
│   └── ...
│
├── .env.example
├── package.json
└── README.md
```

## Future Scope

Potential directions for the full Parivar platform include:

- Extended family collaboration and member management.
- More advanced relationship discovery.
- Richer family history and archival information.
- Additional visualization and exploration capabilities.

These are future directions and are not part of the current public demo.

---

## Author

**Uday Gandhi**

Computer Science Undergraduate | Full-Stack Developer

- GitHub: https://github.com/uday-gandhi04
- Portfolio: https://udaygandhi.is-a.dev

---

*Parivar Demo is a portfolio demonstration containing fictional family data. It is not intended to provide real genealogical information.*
