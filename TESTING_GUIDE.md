# 📝 Testing Google OAuth - Setup Guide

## 🚀 Quick Start

### 1. **Get Google OAuth Credentials**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3010/auth/google/callback`
5. Copy your **Client ID** and **Client Secret**

### 2. **Configure Environment**

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your Google credentials:
GOOGLE_CLIENT_ID=your_actual_client_id_here
GOOGLE_CLIENT_SECRET=your_actual_client_secret_here
```

### 3. **Install Dependencies**

```bash
# In auth-service directory
cd services/auth-service
npm install passport passport-google-oauth20 @types/passport @types/passport-google-oauth20
```

### 4. **Build and Run**

```bash
# From project root
docker-compose up --build
```

### 5. **Test the Frontend**

1. Open your browser: **http://localhost:3000**
2. Click "Sign in with Google"
3. Authorize with your Google account
4. You should see your profile information

---

## 🎯 What's Been Set Up

### ✅ Frontend (Port 3000)
- Simple, beautiful HTML/CSS/JS test page
- Google Sign-in button
- Profile display after login
- JWT token storage
- Logout functionality

### ✅ Backend (Port 3010)
- Ready for Google OAuth routes
- CORS configured
- JWT authentication ready
- Database schema ready

### ✅ Docker Configuration
- Frontend service added
- All services networked together
- Environment variables configured

---

## 🔧 Next Steps to Complete Implementation

You still need to implement these files in your auth-service:

### 1. Create Google Strategy (`services/auth-service/src/strategies/google.strategy.ts`)
### 2. Create Google Routes (`services/auth-service/src/routes/google.routes.ts`)
### 3. Update your main server file to include:
   - Google routes registration
   - CORS configuration
   - Passport initialization

---

## 📊 Testing Checklist

- [ ] Environment variables set in `.env`
- [ ] Google OAuth credentials configured
- [ ] Docker containers running
- [ ] Frontend accessible at http://localhost:3000
- [ ] Auth service accessible at http://localhost:3010
- [ ] Can click "Sign in with Google"
- [ ] Successfully redirects to Google login
- [ ] Redirects back with token
- [ ] Profile information displayed
- [ ] Logout works

---

## 🐛 Troubleshooting

### Issue: "redirect_uri_mismatch"
**Solution:** Make sure your Google Cloud Console has these exact URLs:
- JavaScript origins: `http://localhost:3000`
- Redirect URIs: `http://localhost:3010/auth/google/callback`

### Issue: CORS errors
**Solution:** Make sure your auth-service has CORS enabled:
```typescript
await fastify.register(cors, {
  origin: 'http://localhost:3000',
  credentials: true
});
```

### Issue: Cannot find module 'passport'
**Solution:** Run `npm install` in the auth-service directory

### Issue: Frontend not loading
**Solution:** Check if port 3000 is already in use: `lsof -i :3000`

---

## 📁 File Structure

```
ft_transcendence/
├── frontend/
│   ├── Dockerfile
│   ├── index.html          ✅ Created
│   └── nginx.conf          ✅ Created
├── services/
│   └── auth-service/
│       ├── dockerfile       ✅ Ready
│       ├── package.json     ✅ Dependencies added
│       └── src/
│           ├── strategies/  ⏳ To create
│           └── routes/      ⏳ To create
├── docker-compose.yml       ✅ Updated
└── .env.example            ✅ Created
```

---

## 🎨 Frontend Features

- **Responsive Design**: Works on mobile and desktop
- **Beautiful UI**: Modern gradient design with smooth animations
- **JWT Display**: Shows token for debugging
- **User Info**: Displays username, email, user ID, provider
- **Avatar Support**: Shows Google profile picture if available
- **Status Messages**: Success/error feedback
- **Logout**: Clear token and session

---

## 🔐 Security Notes

- Frontend stores JWT in localStorage (for testing)
- In production, use httpOnly cookies
- Never commit `.env` file to git
- Use HTTPS in production
- Rotate JWT secrets regularly

---

## 📞 Support

If you encounter issues:
1. Check Docker logs: `docker-compose logs auth-service`
2. Check frontend network tab in browser DevTools
3. Verify Google OAuth credentials
4. Ensure all ports are available

---

**Happy Testing! 🎉**
