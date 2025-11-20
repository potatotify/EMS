# EMS — Employee Management System

A modern, role-based employee & project management platform built with Next.js (App Router), TypeScript, Tailwind CSS and MongoDB. EMS provides dashboards and workflows for Clients, Employees and Admins: project creation & assignment, daily updates, in-app messaging, meeting scheduling and progress tracking.

## Table of contents

- Features
- Tech stack
- Prerequisites
- Installation
- Environment variables
- Available scripts
- Project structure
- API (high level)
- Usage
- Contributing
- License
- Support

## Features

- Role-based access: Client, Employee, Admin
- Project lifecycle: create, assign, update, complete
- Daily updates / progress reporting with scoring
- In-app messaging per project
- Meeting scheduling & management
- Admin tools: approve employees, assign projects, analytics/leaderboards
- Responsive UI with Tailwind and small motion enhancements
- Google OAuth (NextAuth) for authentication
- MongoDB (Mongoose) for persistent storage

## Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- MongoDB + Mongoose
- NextAuth.js (Google provider)
- Framer Motion (optional UI motion)
- Lucide icons
- Vercel recommended for deployment

## Prerequisites

- Node.js 18+ (LTS)
- npm or yarn
- MongoDB Atlas account or local MongoDB
- Google OAuth credentials (Client ID & Secret)

## Installation

1. Clone the repo
   ```bash
   git clone https://github.com/your-username/your-repo.git
   cd your-repo
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create environment file
   Create a `.env.local` file in the project root with the variables below.

4. Run the dev server
   ```bash
   npm run dev
   # or
   yarn dev
   ```
   Open http://localhost:3000

## Environment variables

Add the following to `.env.local` (example keys — replace with your values):

```
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.example.mongodb.net/ems?retryWrites=true&w=majority
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-32-or-more-char-secret>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
ADMIN_EMAIL=<initial-admin-email@example.com>
```

Notes:
- NEXTAUTH_SECRET should be a secure random value (use `openssl rand -hex 32`).
- ADMIN_EMAIL can be used to seed the first admin or permit admin access.

## Available scripts

- `dev` - run Next.js dev server
- `build` - build app for production
- `start` - start production server
- `lint` - run ESLint
- `test` - run tests (if configured)

Example:
```bash
npm run dev
npm run build
npm start
```

## Project structure (typical)

```
.
├── src/
│   ├── app/                  # Next.js App Router pages & API routes
│   ├── components/           # UI components (client/admin/employee/shared)
│   ├── lib/                  # utilities, helpers
│   ├── models/               # Mongoose models
│   ├── types/                # TypeScript types
│   └── styles/               # global css / tailwind files
├── public/                   # static assets
├── .env.local
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

Adjust paths to match the repository layout in your workspace.

## API (high-level)

API routes will vary by project but commonly include:

- Auth
  - NextAuth endpoints for OAuth login (Google)
- Projects
  - GET /api/projects — list projects (role-based)
  - POST /api/projects — create project (client)
  - GET /api/projects/:id — project details
  - PATCH /api/projects/:id — update project (admin/client)
- Assignments
  - POST /api/admin/assign-project — assign employees to a project
- Employees
  - POST /api/employee/complete-profile
  - GET /api/employees/approved
- Messaging & Meetings
  - GET/POST /api/projects/:id/messages
  - GET/POST /api/projects/:id/meetings

Document actual endpoints in the repo if you need exact paths.

## Usage (quick)

- Sign in with Google and select / get assigned a role.
- Clients: create projects, attach brief & links, and monitor progress.
- Employees: claim or get assigned projects, submit daily updates and progress.
- Admins: approve employees, assign projects, review reports, and manage the system.

## Best practices & tips

- Use environment-specific `.env` files and never commit secrets.
- Seed an initial admin via ADMIN_EMAIL or a seed script.
- Enable Vercel preview deployments for PRs for easy QA.
- Monitor DB usage on MongoDB Atlas; configure backups and alerts.

## Testing

If tests exist:
```bash
npm test
# or
yarn test
```
Add unit/integration tests for API routes, model logic and important components.

## Contributing

1. Fork the repo
2. Create a topic branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "feat: add ..."`
4. Push and open a PR

Follow existing code style and run linter/tests before submitting PRs.

## Deployment

- Vercel is recommended: connect repository, set environment variables in Vercel dashboard, and deploy.
- Alternatively deploy to any Node hosting that supports Next.js (ensure MONGODB_URI and NEXTAUTH_URL are configured).

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Support

Open an issue in the repository for bugs, feature requests, or questions.

---
