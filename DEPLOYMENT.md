# 🚀 Deployment Guide

Complete guide for deploying to various cloud platforms.

## Table of Contents
- [Heroku](#heroku)
- [Railway](#railway)
- [Render](#render)
- [Vercel + Railway](#vercel--railway)
- [AWS](#aws)
- [Digital Ocean](#digital-ocean)

---

## Heroku

### Backend Deployment

1. Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli

2. Create a Procfile in `/backend`:
```
web: gunicorn -k eventlet -w 1 app:app
```

3. Add gunicorn to requirements.txt:
```
gunicorn==21.2.0
```

4. Deploy:
```bash
cd backend
heroku login
heroku create meeting-scraper-api
git init
git add .
git commit -m "Initial commit"
git push heroku main
```

5. Note your backend URL (e.g., https://meeting-scraper-api.herokuapp.com)

### Frontend Deployment

```bash
cd frontend
heroku create meeting-scraper-web
heroku buildpacks:set mars/create-react-app
git init
git add .
git commit -m "Initial commit"
heroku config:set REACT_APP_BACKEND_URL=https://meeting-scraper-api.herokuapp.com
git push heroku main
```

---

## Railway

### Full Stack Deployment

1. Go to [Railway](https://railway.app/)
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub repository
4. Railway will auto-detect both services

**Backend Config:**
- Root Directory: `/backend`
- Start Command: `python app.py`
- Add environment variables (optional)

**Frontend Config:**
- Root Directory: `/frontend`
- Build Command: `npm run build`
- Start Command: `npx serve -s build`
- Environment Variable: `REACT_APP_BACKEND_URL` = your Railway backend URL

---

## Render

### Backend

1. Go to [Render](https://render.com/)
2. Click "New +" → "Web Service"
3. Connect your repo
4. Configure:
   - **Name**: meeting-scraper-backend
   - **Root Directory**: backend
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python app.py`
   - **Port**: 5000

### Frontend

1. Click "New +" → "Static Site"
2. Configure:
   - **Name**: meeting-scraper-frontend
   - **Root Directory**: frontend
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: build
   - **Environment Variable**: 
     - Key: `REACT_APP_BACKEND_URL`
     - Value: Your backend URL from Render

---

## Vercel + Railway

**Best combo for simplicity!**

### Backend (Railway)

Follow Railway instructions above for backend.

### Frontend (Vercel)

1. Go to [Vercel](https://vercel.com/)
2. Click "Import Project"
3. Connect your GitHub repo
4. Configure:
   - **Framework Preset**: Create React App
   - **Root Directory**: frontend
   - **Environment Variable**: 
     - `REACT_APP_BACKEND_URL` = Your Railway backend URL
5. Deploy!

---

## AWS

### Backend (Elastic Beanstalk)

1. Install AWS CLI and EB CLI
2. Create `application.py` in backend:
```python
from app import app, socketio

if __name__ == '__main__':
    socketio.run(app)
```

3. Deploy:
```bash
cd backend
eb init -p python-3.10 meeting-scraper-backend
eb create meeting-scraper-env
eb deploy
```

### Frontend (S3 + CloudFront)

1. Build the app:
```bash
cd frontend
npm run build
```

2. Upload to S3:
```bash
aws s3 sync build/ s3://your-bucket-name --acl public-read
```

3. Configure CloudFront for your S3 bucket

---

## Digital Ocean

### Using App Platform

1. Go to Digital Ocean App Platform
2. Click "Create App"
3. Connect your GitHub repo

**Backend Component:**
- **Type**: Web Service
- **Source Directory**: /backend
- **Run Command**: `python app.py`
- **HTTP Port**: 5000

**Frontend Component:**
- **Type**: Static Site
- **Source Directory**: /frontend
- **Build Command**: `npm run build`
- **Output Directory**: build
- **Environment Variable**: `REACT_APP_BACKEND_URL`

---

## Environment Variables

### Backend
- `FLASK_ENV`: production
- `FLASK_DEBUG`: False

### Frontend
- `REACT_APP_BACKEND_URL`: Your backend URL (e.g., https://api.example.com)

**Note:** Back4app credentials are set via the web UI, not environment variables.

---

## Post-Deployment Checklist

- [ ] Backend is accessible and returns responses
- [ ] Frontend loads without errors
- [ ] WebSocket connection works (check browser console)
- [ ] Configure Back4app credentials in the UI
- [ ] Test scraping with a small run
- [ ] Monitor logs for errors
- [ ] Set up custom domain (optional)
- [ ] Configure HTTPS (most platforms do this automatically)
- [ ] Set up monitoring/alerts

---

## Troubleshooting

**WebSocket Connection Failed:**
- Ensure your backend supports WebSocket
- Check for reverse proxy configuration (nginx, etc.)
- Verify firewall rules allow WebSocket traffic

**CORS Errors:**
- Make sure CORS is properly configured in backend
- Update allowed origins in `app.py`

**Build Failures:**
- Check Node.js version (should be 16+)
- Verify Python version (should be 3.8+)
- Review build logs for specific errors

**Back4app Connection Issues:**
- Verify credentials are correct
- Check Back4app dashboard for API errors
- Ensure Meetings class exists

---

## Scaling Considerations

For production use:

1. **Add Redis** for session storage
2. **Use Celery** for background tasks
3. **Implement rate limiting** per IP
4. **Add authentication** if needed
5. **Set up monitoring** (Sentry, LogRocket, etc.)
6. **Configure CDN** for frontend assets
7. **Add database** for scraping queue management
8. **Implement retries** for failed scrapes

---

## Cost Estimates

**Free Tier Options:**
- Railway: Free tier available
- Render: Free tier for both frontend/backend
- Vercel: Free for frontend
- Heroku: No longer has free tier

**Paid Options:**
- Railway: ~$5-10/month
- Render: ~$7-15/month
- Heroku: ~$7/month per dyno
- Digital Ocean: ~$12/month

---

Need help? Check the main README or open an issue!
