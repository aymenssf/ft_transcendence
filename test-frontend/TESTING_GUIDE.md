# 🧪 Testing Guide for Google OAuth

## ✅ What I Fixed

### 1. **Frontend Updates:**
- ✅ Fixed login endpoint: `/auth/login` → `/login`
- ✅ Added service status indicator (shows if auth-service is online)
- ✅ Better error handling with more descriptive messages
- ✅ Fixed JWT token decode to handle both `userId` and `id` fields
- ✅ Added CORS mode to API calls

### 2. **Backend Configuration:**
Your auth-service should now be running correctly with:
- Port: `3010`
- Google OAuth routes: `/auth/google` and `/auth/google/callback`
- Login endpoint: `/login`

---

## 🚀 How to Test

### **Step 1: Make Sure Services Are Running**

**Terminal 1 - Auth Service:**
```bash
cd /Users/nassirinassiri/development/ft_transcendence
docker-compose up auth-service
```

Wait for this message:
```
✅ Auth Service running on port 3010
```

**Terminal 2 - Test Frontend:**
```bash
cd /Users/nassirinassiri/development/ft_transcendence/test-frontend
python3 -m http.server 3000
```

---

### **Step 2: Open Browser**

Go to: **http://localhost:3000**

You should see:
- ✅ **Service Online** badge (green) if auth-service is running
- ❌ **Service Offline** badge (red) if auth-service is not running

---

### **Step 3: Test Google OAuth**

1. Click **"Continue with Google"** button
2. Browser redirects to Google login
3. Login with your Google account
4. Google redirects back to `http://localhost:3000?token=...`
5. Page should show your user info!

---

### **Step 4: Test Local Login (Optional)**

If you have a user in the database:
1. Enter email and password
2. Click **"Sign In"**
3. Should show user info

---

## 🐛 Troubleshooting

### ❌ "Service Offline" Badge Shows

**Check if auth-service is running:**
```bash
docker ps | grep auth
```

**Should show:**
```
ft_transcendence_auth
```

**Test the endpoint directly:**
```bash
curl http://localhost:3010/test
```

**Should return:**
```json
{"ok":true,"service":"auth-service","status":"running"}
```

---

### ❌ "Access Denied" or Redirect Error

**Check Google Console Settings:**
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth Client ID
3. Verify these are set:

**Authorized JavaScript origins:**
```
http://localhost:3010
http://localhost:3000
```

**Authorized redirect URIs:**
```
http://localhost:3010/auth/google/callback
```

4. Click **Save**
5. Wait 5 minutes for changes to take effect

---

### ❌ CORS Error in Browser Console

**Check your `.env` file has:**
```properties
FRONTEND_URL=http://localhost:3000
```

**Restart auth-service:**
```bash
docker-compose restart auth-service
```

---

### ❌ "Invalid token" Error

This means JWT signing/parsing issue.

**Check `.env` has:**
```properties
JWT_SECRET=/6xmBA7iVJE1IrI8+VptMnbm9McEEaUc10PFVBS0iZc
```

---

### ❌ Google Login Redirects to Wrong URL

**Check your `.env` file:**
```properties
GOOGLE_CALLBACK_URL=http://localhost:3010/auth/google/callback
FRONTEND_URL=http://localhost:3000
```

Both must be correct!

---

## 📊 Expected Flow

### **Google OAuth Flow:**
```
1. User clicks "Continue with Google"
   → Frontend: window.location.href = 'http://localhost:3010/auth/google'

2. Auth-service redirects to Google
   → Google login page appears

3. User logs in with Google
   → Google redirects: http://localhost:3010/auth/google/callback?code=xyz

4. Auth-service processes callback
   → Creates/finds user in database
   → Generates JWT token

5. Auth-service redirects back to frontend
   → http://localhost:3000?token=eyJhbG...

6. Frontend receives token
   → Stores in localStorage
   → Decodes and displays user info
```

---

## 🎯 Quick Checklist

Before testing, verify:

- [ ] Auth-service is running on port 3010
- [ ] Frontend is running on port 3000  
- [ ] Google Console has correct redirect URI (port 3010)
- [ ] `.env` file has `FRONTEND_URL=http://localhost:3000`
- [ ] `.env` file has `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- [ ] Service status badge shows "✅ Service Online"

---

## 🔍 Debug Tips

### **Check Auth Service Logs:**
```bash
docker logs ft_transcendence_auth -f
```

### **Check Browser Console:**
Open DevTools (F12) and look at:
- **Console tab**: JavaScript errors
- **Network tab**: API calls (should see `/test`, `/auth/google`, etc.)

### **Test Auth Service Endpoints Manually:**

**Test service health:**
```bash
curl http://localhost:3010/test
```

**Test Google OAuth redirect:**
```bash
curl -I http://localhost:3010/auth/google
```

Should return `302 Redirect` with Google URL.

---

## 📝 What Should Happen

### ✅ **Success Scenario:**

1. Open http://localhost:3000
2. See green "✅ Service Online" badge
3. Click "Continue with Google"
4. Google login page appears
5. Login successful
6. Redirected back to frontend
7. See your user info displayed:
   - ID
   - Username
   - Email
   - Provider: "google"
   - Avatar (if available)

### ❌ **If Something Goes Wrong:**

Check the **Browser Console** for errors and match them with the troubleshooting section above!

---

Good luck! 🚀
