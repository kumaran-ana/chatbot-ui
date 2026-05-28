# SearchSomething Chatbot

Small mobile-first ChatGPT-style chatbot UI with an Express backend and PostgreSQL storage.

## What It Does

- Shows a `SearchSomething` branded chat interface.
- Replies to basic messages like greetings, nearby-search prompts, and location questions.
- Saves each browser visitor by local session id, with no login/logout.
- Stores latitude, longitude, location accuracy, exact location text, and chat history in PostgreSQL.

## Setup

1. Copy the environment file and update it if needed:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create the database:

   ```bash
   npm run db:create
   ```

4. Start React and Express together:

   ```bash
   npm run dev
   ```

5. Open:

   ```text
   http://localhost:5173
   ```

The server runs on `http://localhost:5050`. The React dev server proxies `/api` calls to Express.
