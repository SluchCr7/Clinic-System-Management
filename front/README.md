# Frontend – Clinic Management System

This directory contains the Next.js client application for the clinic management platform. It provides the user interface for patient workflows, appointment scheduling, doctor dashboards, billing workflows, and administrative operations.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Redux Toolkit
- Tailwind CSS
- Framer Motion
- Socket.IO client
- i18next for localization

## Main Responsibilities

- user authentication and session handling
- dashboard views for admin, doctor, and receptionist roles
- patient records and appointment management
- service and billing workflow screens
- medical attachments and consultation modules
- real-time notifications via Socket.IO
- responsive, RTL-friendly UI for clinical workflows
- appointment reminders with admin-configurable timing in Settings → Clinic

## Project Structure

```text
front/
├── app/                # app router pages and global layout
├── components/         # reusable UI and layout components
├── features/           # Redux slices and feature modules
├── lib/                # shared utilities and helpers
├── redux/              # Redux store and hooks
├── services/           # API integration layer
├── types/              # TypeScript domain models
├── public/             # static assets
├── .env.local          # frontend environment settings
├── package.json
├── next.config.ts
├── tsconfig.json
└── README.md
```

## Prerequisites

- Node.js 18+
- npm
- API server running from `back/`

## Environment Setup

Create a `.env.local` file inside `front/` with:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_API_URL_SOCKET=http://localhost:3001
```

## Install and Run

```bash
cd front
npm install
npm run dev
```

Then open:

- http://localhost:3000

## Useful Notes

- The app redirects unauthenticated users to the login flow and authenticated users to the dashboard.
- Styling is based on a modern clinical design system with light/dark support.
- Most data is served through the backend API located in `back/`.

## Related Project Documentation

- [../README.md](../README.md) – project overview and full-stack setup
- [../back/README.md](../back/README.md) – backend API details
