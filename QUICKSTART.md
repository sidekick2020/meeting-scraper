# 🚀 Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites

- Python 3.8+ installed
- Node.js 16+ installed
- Back4app account ([Sign up free](https://www.back4app.com/))

## Step 1: Get Your Back4app Credentials

1. Go to [Back4app](https://www.back4app.com/)
2. Create a new app (or use existing)
3. Go to **App Settings → Security & Keys**
4. Copy your **Application ID** and **REST API Key**

## Step 2: Start the Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

✅ Backend running at http://localhost:5000

## Step 3: Start the Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm start
```

✅ Frontend running at http://localhost:3000

## Step 4: Configure & Run

1. Open http://localhost:3000 in your browser
2. Click **"⚙️ Configure"**
3. Enter your Back4app credentials
4. Click **"Save Configuration"**
5. Click **"▶️ Start Scraping"**

## That's It! 🎉

Watch as the system:
- Discovers meetings from regional websites
- Saves them to your Back4app database
- Updates the dashboard in real-time

## Using Docker (Alternative)

If you have Docker installed:

```bash
docker-compose up --build
```

Access at http://localhost

## Troubleshooting

**Port 5000 already in use?**
```bash
# Find and kill the process
lsof -ti:5000 | xargs kill -9
```

**npm install fails?**
```bash
# Clear npm cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Backend errors?**
```bash
# Make sure you have the right Python version
python --version  # Should be 3.8+

# Install dependencies again
pip install --upgrade pip
pip install -r requirements.txt
```

## Next Steps

- Check the main README.md for detailed documentation
- Customize scraping sources in `backend/scraper.py`
- Modify the UI in `frontend/src/components/`

## Need Help?

- Ensure both backend and frontend are running
- Check browser console for errors (F12)
- Verify Back4app credentials are correct
- Make sure your Meetings class exists in Back4app

---

Happy scraping! 🔍
