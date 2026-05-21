# Spark Classroom Picker

A playful classroom picker website for primary teachers. Teachers can sign in with Google, save separate class lists, spin a colorful wheel to choose one child, and instantly build random groups of different sizes.

## Features

- Google sign-in for teachers using Google Identity Services
- Multiple saved class lists stored per teacher on the current device
- Spinning wheel with a clear winner panel and color legend
- Random group generator with remix support
- Demo mode and sample classroom for quick testing

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a local environment file:
   ```bash
   cp .env.example .env.local
   ```
3. Add your Google OAuth client ID to `.env.local`.
4. Start the app:
   ```bash
   npm run dev
   ```

## Google sign-in setup

1. Open Google Cloud Console.
2. Create or reuse a project.
3. Configure an OAuth client for a web application.
4. Add your local development URL (for example `http://localhost:5173`) to the allowed JavaScript origins.
5. Copy the client ID into `.env.local` as `VITE_GOOGLE_CLIENT_ID`.

If no Google client ID is configured, the app still offers demo mode so the interface can be explored.

## Scripts

- `npm run dev` - start the Vite development server
- `npm run build` - build the production bundle
- `npm run lint` - run ESLint
