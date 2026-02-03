# Deploy PWA to Vercel

This deploys the mobile PWA to Vercel's free tier so you don't need a local server.

## Prerequisites

1. Vercel account (free): https://vercel.com/signup
2. Vercel CLI: `npm i -g vercel`

## Deployment Steps

### 1. Login to Vercel

```powershell
npx vercel login
```

### 2. Deploy

```powershell
npx vercel --prod
```

Follow the prompts:
- Confirm project settings
- It will build and deploy automatically

### 3. Set Environment Variables

In Vercel Dashboard:
1. Go to your project
2. Settings → Environment Variables
3. Add these (your Firebase credentials):

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Your Firebase API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | your-project.firebaseapp.com |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | https://your-project.firebaseio.com |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | your-project-id |

4. Redeploy: `npx vercel --prod`

## Using the Deployed PWA

**On your phone:**
1. Open Chrome/Safari
2. Go to: `https://YOUR-APP.vercel.app/mobile`
3. Save to home screen (optional - makes it feel like an app)
4. Enter your Groq API key
5. Enter same Firebase credentials as Chromebook extension

**On Chromebook:**
1. Load extension (already done)
2. Enter Firebase credentials
3. Generate/copy Device ID

## That's It!

- Phone records → Sends to Firebase
- Chrome extension receives → Auto-pastes
- No local server needed
- Works from anywhere with internet

## Free Tier Limits

Vercel free tier:
- 100GB bandwidth/month
- 6,000 build minutes/month
- 10,000 API requests/day

More than enough for personal use!
