# PourMatch

[繁體中文](README.md) · **English**

A drinking social app built around a taste quiz. You answer twelve questions about how you drink, an AI reads them back as a flavour persona with four recommendations, and the site then finds the people whose answers overlap with yours. Both sides have to say they want to meet before a chat opens.

Live: <https://missioncookies.cv>

## Features

| Feature | What it does |
|---|---|
| Taste quiz | Twelve questions across single-choice, multi-select and slider types; the AI returns a persona nickname, trait tags and four recommendations that each play a different role |
| Cocktail generator | Builds a recipe from your preferences; advanced mode adds ten more option groups covering technique, glassware, dietary limits and naming style |
| Matching | Ranks people by how much their quiz answers overlap with yours |
| Chat | Opens on a mutual like; direct and group conversations share one room and message model |
| Community | Publish quiz results and recipes, like and comment |
| THE POUR | A scroll-driven 3D showcase computed live in Three.js, with no downloaded models or textures |

## Stack

- **Backend**: Node.js + Express, SQLite via better-sqlite3
- **Auth**: Google Identity Services, JWT in an httpOnly cookie
- **AI**: OpenAI, for the quiz, the generator and match blurbs
- **Frontend**: plain HTML/CSS/JS, no build step
- **3D**: Three.js, vendored under `vendor/` rather than pulled from a CDN

### How the overlap score works

Scoring lives in [`taste.js`](taste.js). Each question is compared on its own, then the results are averaged with per-question weights:

- Single choice: 1 if the answers agree
- Multi-select: Jaccard overlap, the intersection over the union
- Sliders: falls off linearly with the distance between the two values

It returns a 0–100 score plus a per-question breakdown, which the UI uses to say *what* two people agree on rather than just how much. Questions either side skipped are left out of the average instead of counting as a disagreement.

Run the tests:

```bash
node taste.test.js
```

## Running locally

```bash
npm install
```

Create `.env`:

```env
PORT=3001
JWT_SECRET=generate with openssl rand -hex 32
GOOGLE_CLIENT_ID=your Google OAuth client ID
OPENAI_API_KEY=your OpenAI API key
```

Start it:

```bash
npm start
```

The backend binds to `127.0.0.1` only. Static files are expected to come from Nginx, which reverse-proxies `/api/` to the app.

## Deploying

Push to `main`, then on the server:

```bash
git pull && npm install && pm2 restart missioncookies
```

Nginx has to block `server.js`, `db.js`, `taste.js`, `.env` and `*.db`. The static root and the application directory are the same folder, so without those rules the backend files are downloadable.

## Known gaps

- `/api/taste-quiz`, `/api/cocktail-generator` and `/api/match` have no rate limiting, and the first two need no login, so anyone who knows the paths can spend your OpenAI credit
- Group matching is not built yet; the plan is that a group only forms once enough people accept, so it is never an empty room
- Deleting a user orphans rows in `rooms`, which has no foreign key back to `users`
