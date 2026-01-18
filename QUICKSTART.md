# Quick Start Guide

## Frontend

```bash
cd frontend
npm run dev
```

**Frontend runs at:** `http://localhost:5173`

### Test the Flow:
1. Click "Get Started" → Register
2. Enter email/password → Create Account
3. You'll be redirected to Connect Platforms
4. Click "Connect" on YouTube → OAuth flow
5. After successful connection → Confetti! 🎉

---

## Backend

### Prerequisites:
1. **Go 1.21+** - [Install Go](https://golang.org/dl/)
2. **PostgreSQL** - Running on localhost:5432
3. **Redis** (optional for now) - Can skip if testing auth only

### Setup:

```powershell
cd backend

# Run setup script
.\setup.ps1

# Create database
psql -U postgres
CREATE DATABASE creati;
\q

# Run migrations
psql -U postgres -d creati -f internal/db/migrations/001_init.sql

# Create .env from example and update credentials
cp .env.example .env
# Edit .env with your database password

# Run server
go run cmd/server/main.go
```

**Backend runs at:** `http://localhost:8080`

---

## YouTube OAuth Setup (For Platform Connection)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable "YouTube Data API v3"
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:8080/api/platforms/youtube/callback`
5. Copy Client ID and Client Secret to `.env`:
   ```
   YOUTUBE_CLIENT_ID=your-id.apps.googleusercontent.com
   YOUTUBE_CLIENT_SECRET=your-secret
   ```

---

## Testing Without Backend

Frontend works standalone! Backend calls will fail gracefully.

To test UI only:
```bash
cd frontend
npm run dev
# Navigate through pages to see animations
```

---

## Full Flow Test

1. **Start Backend:**
   ```bash
   cd backend
   go run cmd/server/main.go
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test Registration:**
   - Go to http://localhost:5173
   - Click "Get Started"
   - Fill form → Watch animations!

4. **Test Login:**
   - Use same credentials
   - Should redirect to /connect

5. **Test Platform Connection:**
   - Click "Connect" on YouTube
   - Complete OAuth
   - See confetti animation 🎉

---

## Troubleshooting

**Frontend won't start:**
```bash
cd frontend
rm -rf node_modules
npm install
npm run dev
```

**Backend database error:**
```bash
# Make sure PostgreSQL is running
pg_isready

# Recreate database
dropdb creati
createdb creati
psql -U postgres -d creati -f internal/db/migrations/001_init.sql
```

**CORS errors:**
- Check `FRONTEND_URL` in backend `.env` matches frontend URL
- Default: `http://localhost:5173`
