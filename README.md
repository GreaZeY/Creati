# Multi-Platform Creator Upload & Management App

A unified creator tool for uploading content to YouTube (and more platforms soon) from a single, beautiful interface.

---

## 🎯 What This Is

Upload once, publish to multiple platforms. Currently supports **YouTube**, with extensible architecture for Instagram, Facebook, X, and LinkedIn.

**Key Features:**
- ✨ Beautiful Gen Z-inspired UI with delightful animations
- 🎬 Unified upload to multiple platforms
- 📊 Real-time status tracking
- 🔐 Secure OAuth integration
- 🎨 Dark/Light theme support

---

## 📐 Architecture Principles

This project follows strict **SOLID principles** and **zero code duplication**. See [`architecture_principles.md`](./brain/architecture_principles.md) for details.

**Adding a new platform requires:**
1. Create one new service file implementing the `Platform` interface
2. Register in platform factory
3. Add OAuth config

**Should NOT require:**
- Modifying core upload/job logic
- Touching other platform implementations

---

## 🛠️ Tech Stack

### Frontend
- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** (custom theme)
- **Framer Motion** (animations)
- **React Query** (data fetching)
- **Axios** (HTTP client)

### Backend
- **Go** + **Fiber** (web framework)
- **PostgreSQL** (database)
- **Redis** (job queue)
- **AWS S3** (video storage)
- **OAuth 2.0** (platform authentication)

---

## 📦 Project Structure

```
Creati/
├── frontend/                # Vite + React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/         # Reusable UI components
│   │   │   ├── motion/     # Animation wrappers
│   │   │   ├── upload/     # Upload-specific components
│   │   │   └── dashboard/  # Dashboard components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities (API, animations, constants)
│   │   └── pages/          # Page components
│   └── package.json
│
└── backend/                 # Go backend
    ├── cmd/server/         # Main server entry point
    ├── internal/
    │   ├── api/            # HTTP handlers
    │   ├── services/       # Platform services (YouTube, etc.)
    │   ├── db/             # Database models & migrations
    │   ├── middleware/     # Auth, logging, etc.
    │   └── utils/          # Helper functions
    └── go.mod
```

---

## 🚀 Getting Started

### Prerequisites

1. **Backend:**
   - Go 1.21+
   - PostgreSQL 14+
   - Redis 7+
   - AWS S3 bucket
   - YouTube OAuth credentials ([Get Here](https://console.cloud.google.com))

2. **Frontend:**
   - Node.js 18+
   - npm/yarn

### Installation

#### 1. Clone & Setup Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with your API URL
npm run dev
```

Frontend will run at `http://localhost:5173`

#### 2. Setup Backend

```bash
cd backend
go mod download
cp .env.example .env
# Edit .env with your credentials
```

#### 3. Setup Database

```bash
# Create database
createdb creati

# Run migrations
psql -U your_user -d creati -f internal/db/migrations/001_init.sql
```

#### 4. Run Backend

```bash
cd cmd/server
go run main.go
```

Backend will run at `http://localhost:8080`

---

## 🔑 Configuration

### Backend (.env)

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/creati
REDIS_URL=redis://localhost:6379
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET=creati-uploads
JWT_SECRET=your-secret-key
YOUTUBE_CLIENT_ID=your-youtube-client-id
YOUTUBE_CLIENT_SECRET=your-youtube-secret
YOUTUBE_REDIRECT_URL=http://localhost:8080/api/platforms/youtube/callback
```

### Frontend (.env.local)

```bash
VITE_API_BASE_URL=http://localhost:8080/api
```

---

## 🎨 Design System

### Colors
- **Primary:** `#08cea8` (used ONLY for CTAs, progress, success)
- **Dark BG:** `#121212`
- **Dark Card:** `#1a1a1a`

### Animations
- **Duration:** 200-400ms
- **Easing:** `easeOut`
- **Motion:** Framer Motion variants in `lib/animations.ts`

### Confetti Triggers
- Platform connection success (80 particles)
- Upload success (150 particles)
- Milestones: 1st upload, 5 uploads, 100 views (200 particles)

---

## 🧪 API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login

### Platforms
- `GET /api/platforms` - List platforms and connection status
- `GET /api/platforms/:platform/connect` - Get OAuth URL
- `GET /api/platforms/:platform/callback` - OAuth callback
- `DELETE /api/platforms/:platform` - Disconnect platform

### Videos (Coming Soon)
- `POST /api/videos/init` - Initialize upload
- `POST /api/videos/confirm` - Confirm upload
- `GET /api/videos` - List videos
- `GET /api/videos/:id/status` - Get upload status

---

## 🔧 Development Workflow

### Frontend

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Backend

```bash
go run cmd/server/main.go  # Run server
go test ./...              # Run tests
```

---

## 📝 Adding a New Platform

Example: Adding Instagram

1. **Create service** (`internal/services/instagram.go`):
```go
type InstagramService struct {
    db *sql.DB
    oauthConfig *oauth2.Config
}

func (i *InstagramService) Upload(video *models.Video) (string, error) {
    // Instagram-specific upload logic
}
```

2. **Register in factory** (`internal/services/factory.go`):
```go
case "instagram":
    return NewInstagramService(db), nil
```

3. **Add OAuth config** (`.env`):
```bash
INSTAGRAM_CLIENT_ID=...
INSTAGRAM_CLIENT_SECRET=...
```

4. **Update constants** (`frontend/src/lib/constants.ts`):
```ts
instagram: {
    enabled: true,
}
```

That's it! No core logic changes needed.

---

## 🐛 Troubleshooting

**Frontend won't connect to backend:**
- Check CORS settings in `backend/cmd/server/main.go`
- Verify `VITE_API_BASE_URL` in `.env.local`

**Database connection fails:**
- Ensure PostgreSQL is running: `pg_isready`
- Check `DATABASE_URL` format

**YouTube OAuth fails:**
- Verify redirect URL matches exactly in Google Console
- Check OAuth credentials are correct

---

## 📄 License

MIT

---

## 🙏 Contributing

This project is built with maintainability in mind. Please follow the architecture principles in [`architecture_principles.md`](./brain/architecture_principles.md).
