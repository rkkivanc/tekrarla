# Tekrarla

A spaced repetition web app that helps students learn more effectively.

🔗 **[tekrarla.app](https://tekrarla.app)**

## What Is It?

Tekrarla lets students save questions they couldn't solve and topics they didn't understand, then review them using scientifically proven spaced repetition intervals. Teachers can track their students' progress.

### Student Features
- 📸 Capture question photos with text or image answers
- 📝 Create topic notes
- 🎙️ Voice note recording
- 📂 Subject-based folder organization and filtering
- 🔄 Smart review system (customizable easy/medium/hard intervals)
- 🔔 Daily review reminder notifications (PWA push)

### Teacher Features
- 👥 Invite students to class
- 📊 View student progress and statistics
- 📋 Review student content

### Admin Features
- 📈 App-wide statistics dashboard
- 👤 User management (role changes, password reset, deletion)
- 📢 Individual or broadcast push notifications

## Tech Stack

### Frontend
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- PWA (push notifications, offline support)
- Cloudflare Turnstile (bot protection)

### Backend
- Node.js + Express + TypeScript
- PostgreSQL
- JWT Authentication
- Cloudflare R2 (file storage)
- Web Push (VAPID)

### Infrastructure
- **Frontend**: Cloudflare Pages
- **Backend**: Hetzner VPS + Nginx + PM2
- **Database**: PostgreSQL
- **Files**: Cloudflare R2
- **DNS/CDN/SSL**: Cloudflare

## Security

- Bcrypt password hashing
- Parameterized SQL queries (injection protection)
- Cloudflare Turnstile (registration/login)
- Rate limiting (auth, content creation, password change)
- Helmet HTTP security headers
- CORS restrictions
- Per-request DB user and role verification
- File upload: type + extension validation, size limits

## Setup

### Requirements
- Node.js 18+
- PostgreSQL 14+
- Cloudflare R2 account
- Cloudflare Turnstile site/secret key

### Backend
```bash
cd backend
cp .env.example .env  # fill in environment variables
npm install
npm run build
npm start
```

### Frontend
```bash
cd frontend
cp .env.example .env  # fill in VITE_API_URL and VITE_TURNSTILE_SITE_KEY
npm install
npm run dev
```

## License

This project is for personal use and portfolio purposes.