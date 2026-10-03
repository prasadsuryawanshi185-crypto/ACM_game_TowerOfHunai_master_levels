# 🕷️ DSA Launchpad — Tower of Hanoi (Spider-Verse Edition)

A Spider-Verse themed Tower of Hanoi DSA game built for the **DSA Launchpad** college event by ACM. Designed to handle ~200 concurrent participants with reliable score tracking and a live leaderboard.

## Features

- **Spider-Verse Themed UI** — Neon colors, web patterns, comic-book typography, smooth animations
- **Tower of Hanoi Puzzle** — 3, 4, or 5 disk options with proper DSA rule enforcement
- **Server-Side Scoring** — Score calculated on the server (not trusting client values)
- **Live Leaderboard** — Cached for performance, auto-refreshes, shows rank/score/moves/time
- **200-Participant Ready** — In-memory leaderboard cache, duplicate submission prevention, rate limiting
- **Mobile Responsive** — Works on desktop, laptop, tablet, and mobile
- **Error Resilient** — Graceful error handling, retry logic, never crashes on bad input

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend  | Vanilla HTML/CSS/JS (no framework) |
| Backend   | Node.js + Express.js |
| Database  | MongoDB |
| Fonts     | Google Fonts (Bangers, Orbitron, Inter) |

## Architecture

```
Browser (Frontend)
    ↓ REST API calls
Express Server (server.js)
    ↓ Native MongoDB driver
MongoDB (gameResults collection)
```

## Scoring System

The score is calculated **server-side** to prevent cheating:

```
minimumMoves = 2^diskCount - 1
moveEfficiency = min(1, minimumMoves / max(1, moves))
timeEfficiency = min(1, 120 / max(1, timeTaken))
score = round((moveEfficiency × 0.7 + timeEfficiency × 0.3) × 1000)
```

- Score is capped at **1000**
- 70% weight on **move efficiency** (closer to minimum moves = higher score)
- 30% weight on **time efficiency** (faster = higher score, 120s reference)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/health` | Health check with DB status |
| `POST` | `/api/submit` | Submit a completed game result |
| `GET`  | `/api/leaderboard` | Get top 50 results (cached) |
| `GET`  | `/api/leaderboard/:participantName` | Get a specific participant's results |

### POST /api/submit — Request Body

```json
{
  "participantName": "John Doe",
  "participantId": "ACM-042",
  "diskCount": 4,
  "moves": 18,
  "timeTaken": 95
}
```

### Server-Side Validations

- `participantName` must be non-empty
- `diskCount` must be 3, 4, or 5
- `moves` must be ≥ minimum moves (2^diskCount - 1)
- `timeTaken` must be > 0 and < 600 seconds
- Duplicate submissions (same name + diskCount) are blocked within 60 seconds

## Database Schema

**Collection: `gameResults`**

| Field | Type | Description |
|-------|------|-------------|
| `participantName` | String | Participant's name |
| `participantId` | String | Optional participant ID |
| `diskCount` | Number | Number of disks (3, 4, or 5) |
| `moves` | Number | Total moves made |
| `minimumMoves` | Number | Minimum possible moves |
| `timeTaken` | Number | Seconds taken |
| `score` | Number | Calculated score (0-1000) |
| `completedAt` | String | ISO 8601 timestamp |
| `ipAddress` | String | Client IP address |

**Indexes:**
- `{ score: -1, timeTaken: 1 }` — for leaderboard sorting
- `{ participantName: 1, diskCount: 1, completedAt: -1 }` — for duplicate detection

## How 200 Participants Are Handled

1. **In-memory leaderboard cache** — Refreshed every 5 seconds. All leaderboard reads hit the cache, not the database directly
2. **No periodic score updates** — Game state is kept entirely client-side during play; only the final result is submitted
3. **Duplicate submission prevention** — Same participant + diskCount blocked within 60 seconds
4. **Efficient indexes** — Leaderboard query uses a compound index for fast sorting
5. **Minimal DB writes** — Only one write per completed game

## Installation & Local Development

### Prerequisites

- Node.js ≥ 14
- MongoDB (local or cloud — e.g., [MongoDB Atlas](https://www.mongodb.com/atlas) free tier)

### Steps

1. **Clone / extract the project**

2. **Install dependencies**
   ```bash
   cd acmmain
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

4. **Start MongoDB** (if using local)
   ```bash
   mongod
   ```

5. **Run the server**
   ```bash
   npm start        # Production
   npm run dev      # Development with auto-reload
   ```

6. **Open in browser**
   ```
   http://localhost:4000
   ```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `DB_NAME` | `dsa_launchpad` | Database name |

## Deployment

### Frontend + Backend (Single Service)

Since this is a single Express server serving static files, deploy as one unit:

**Option A — [Render](https://render.com) (Free tier)**
1. Push to GitHub
2. Create a new Web Service on Render
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables: `MONGODB_URI`, `DB_NAME`

**Option B — [Railway](https://railway.app)**
1. Push to GitHub
2. Create a new project → Deploy from GitHub
3. Add MongoDB plugin or set `MONGODB_URI`
4. Railway auto-detects Node.js and deploys

### Database

**MongoDB Atlas (Free Tier)**
1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a database user
3. Whitelist your server's IP (or use `0.0.0.0/0` for simplicity)
4. Copy the connection string → Set as `MONGODB_URI`

## Project Structure

```
acmmain/
├── server.js              # Express server, API routes, DB logic
├── package.json           # Dependencies and scripts
├── .env.example           # Environment variable template
├── public/                # Static frontend files
│   ├── index.html         # Main game page (Spider-Verse themed)
│   ├── script.js          # Game logic, UI management, API calls
│   ├── leaderboard.html   # Standalone leaderboard page
│   ├── acmlogo.png        # ACM logo
│   ├── college logo.png   # College logo
│   └── images/            # Game assets
└── README.md              # This file
```

## Keyboard Shortcuts

- `Ctrl + Shift + L` — Open leaderboard from any screen

## License

MIT
