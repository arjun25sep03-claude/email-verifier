# Email Verifier - MailTester Ninja Integration

A complete email verification service using MailTester Ninja API. Upload CSV → Get verified results CSV back.

## Features

- ✅ CSV upload for batch email verification
- ✅ Integration with MailTester Ninja API
- ✅ Rate limiting (respects API limits)
- ✅ Supabase database for tracking
- ✅ Instant CSV download of results
- ✅ One-click deployment to Railway

## Setup Instructions

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Enter project name: `email-verifier`
4. Choose region closest to you
5. Set a strong password and save it
6. Click **Create New Project** (takes ~2 mins)

Once created:
1. Go to **SQL Editor** → Click **New Query**
2. Copy-paste the entire contents of `supabase-setup.sql`
3. Click **Run** (this creates your tables)

**Get your credentials:**
1. Go to **Settings** → **API**
2. Copy `Project URL` (this is `SUPABASE_URL`)
3. Copy `anon public` key (this is `SUPABASE_KEY`)
4. Keep these safe - you'll need them in Step 4

### Step 2: Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name: `email-verifier`
3. Description: "Email verification service"
4. Choose **Public** (easier for deployment)
5. Click **Create Repository**

### Step 3: Push Code to GitHub

In your terminal:

```bash
cd /path/to/email-verifier
git config user.email "your-email@gmail.com"
git config user.name "Your Name"
git add .
git commit -m "Initial commit: email verifier setup"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/email-verifier.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

### Step 4: Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Click **"Create New Project"**
3. Choose **"Deploy from GitHub"**
4. Select your `email-verifier` repository
5. Click **Deploy**

**Add Environment Variables:**

Once deployment starts:
1. Go to your Railway project
2. Click the `email-verifier` service
3. Go to **Variables** tab
4. Add these variables:
   - `SUPABASE_URL`: (from Step 1)
   - `SUPABASE_KEY`: (from Step 1)
   - `MAILTESTER_KEY`: Your MailTester Ninja API key
   - `PORT`: `3000`

5. Click **Deploy** again

Railway will give you a public URL (something like `email-verifier-prod.up.railway.app`)

## How to Use

### Upload Emails

```bash
curl -X POST https://your-railway-url/upload \
  -F "file=@emails.csv"
```

**Response:**
```json
{
  "uploadId": "1234567890",
  "totalEmails": 100,
  "message": "Processing started..."
}
```

### Check Status

```bash
curl https://your-railway-url/status/1234567890
```

**Response:**
```json
{
  "status": "completed",
  "totalEmails": 100,
  "completedAt": "2026-04-24T10:30:00Z"
}
```

### Download Results

```bash
curl https://your-railway-url/download/1234567890 \
  -o results.csv
```

Or open in browser:
```
https://your-railway-url/download/1234567890
```

## CSV Format

**Input CSV (emails.csv):**
```
email
john@example.com
jane@example.com
test@domain.com
```

**Output CSV (results):**
```
Email,Code,Message,User,Domain,MX
john@example.com,ok,Accepted,john,example.com,mx.example.com
jane@example.com,ko,Rejected,jane,example.com,mx.example.com
```

## API Limits

- **Pro Plan**: 100k/day (11 emails/10 sec)
- **Ultimate Plan**: 500k/day (57 emails/10 sec)

The app is configured for Pro Plan. Adjust `RATE_LIMIT_MS` in `server.js` if needed.

## Local Testing

```bash
npm install
npm run dev
```

Server runs on `http://localhost:3000`

Test upload:
```bash
curl -X POST http://localhost:3000/upload \
  -F "file=@test-emails.csv"
```

## Troubleshooting

- **"Database error"** → Check Supabase URL and key in Railway variables
- **"No valid emails found"** → Make sure CSV has `email` column header
- **"Processing takes too long"** → Check Railway logs: go to Deployments → View Logs
- **API not verifying** → Check `MAILTESTER_KEY` is correct in Railway variables

## Support

For MailTester API issues: https://mailtester.ninja
For Railway support: https://railway.app/support
