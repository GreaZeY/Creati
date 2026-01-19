# Deployment Guide: Production Checklist

This guide outlines the steps to deploy the Creati platform to a production environment.

## 🏗️ Infrastructure Requirements

- **Database:** PostgreSQL 14+ (Managed AWS RDS or similar recommended)
- **Cache/Queue:** Redis 7+ (AWS ElastiCache or similar recommended)
- **Storage:** AWS S3 Bucket
- **Compute:** 
  - 1x API Server (Go)
  - 1x Job Worker (Go)
  - 1x Frontend Static Hosting (Vite build)

---

## 🔒 Security Checklist

1. **Environment Variables:**
   - [ ] Set `JWT_SECRET` to a long, random string.
   - [ ] Set `FRONTEND_URL` to your production domain to restrict CORS.
   - [ ] Ensure `YOUTUBE_REDIRECT_URL` uses `https`.

2. **Database:**
   - [ ] Do not use public subnets for RDS.
   - [ ] Enable SSL for database connections.

3. **API Security:**
   - [ ] Implement rate limiting (Fiber has a built-in middleware).
   - [ ] Ensure all cookies are `Secure: true`.

---

## 🚀 Deployment Steps

### 1. Backend

```bash
cd backend
# Build binaries
go build -o api_server ./cmd/server
go build -o job_worker ./cmd/worker

# Run server
./api_server

# Run worker (as a separate process/service)
./job_worker
```

### 2. Frontend

```bash
cd frontend
# Set production API URL
echo "VITE_API_BASE_URL=https://api.yourdomain.com/api" > .env.production

# Build
npm run build

# Deploy the contents of the 'dist' folder to your CDN/Web Server (Netlify, Vercel, S3+CloudFront)
```

---

## 📉 Monitoring & Maintenance

- **Logs:** Centralize logs using CloudWatch, ELK, or Datadog.
- **Queue:** Monitor Redis memory and `upload_queue` length.
- **Failures:** Monitor the `video_platform_jobs` table for high failure rates.

### Database Backup
Regularly backup your PostgreSQL instance.
```bash
pg_dump -U username -d creati > backup.sql
```

---

## 🛠️ Scaling

- **Horizontal Scaling:** The API server is stateless and can be scaled horizontally.
- **Worker Scaling:** You can run multiple instances of the `job_worker` pointing to the same Redis instance to process more uploads in parallel.
