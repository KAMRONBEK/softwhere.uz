# 🚨 Vercel Deployment Timeout Fix Guide

## 🔍 **Problem Analysis**
Your API routes are experiencing `FUNCTION_INVOCATION_TIMEOUT` errors on Vercel due to:
1. Database connection timeouts
2. Missing Vercel function configuration
3. Inefficient database queries
4. Potential environment variable issues

## ✅ **Fixes Applied**

### 1. **Vercel Configuration** (`vercel.json`)
- Set function timeout to 30 seconds
- Configured Sydney region (syd1)
- Added environment variable reference

### 2. **Database Connection Optimization** (`src/lib/db.ts`)
- Reduced connection timeouts for serverless environment
- Added connection timeout wrapper (8 seconds)
- Optimized connection pool settings
- Added heartbeat monitoring

### 3. **API Route Optimization**
- Added timeout wrappers to all database operations
- Added performance logging
- Limited query results for better performance
- Added proper error handling with timing

### 4. **Health Check Routes**
- `/api/health` - Basic health check
- `/api/health/db` - Database connectivity check

## 🚀 **Deployment Steps**

### Step 1: Environment Variables
Ensure these are set in your Vercel dashboard:

```bash
MONGODB_URI=your_mongodb_connection_string
GOOGLE_API_KEY=your_google_api_key (optional)
OPENAI_API_KEY=your_openai_api_key (optional)
API_SECRET=your_api_secret (optional)
```

### Step 2: Deploy with New Configuration
```bash
# Commit the changes
git add .
git commit -m "Fix: Add Vercel timeout configuration and optimize database connections"

# Deploy to Vercel
vercel --prod
```

### Step 3: Test the Deployment
After deployment, test these endpoints:

1. **Basic Health Check**:
   ```
   GET https://your-domain.vercel.app/api/health
   ```

2. **Database Health Check**:
   ```
   GET https://your-domain.vercel.app/api/health/db
   ```

3. **Blog Posts API**:
   ```
   GET https://your-domain.vercel.app/api/blog/posts
   ```

## 🔧 **Additional Optimizations**

### MongoDB Connection String
Ensure your MongoDB connection string includes these parameters:
```
mongodb+srv://user:pass@cluster.mongodb.net/dbname?retryWrites=true&w=majority&maxPoolSize=5&serverSelectionTimeoutMS=5000
```

### Vercel Function Regions
If you're still experiencing issues, try changing the region in `vercel.json`:
```json
{
  "regions": ["iad1", "sfo1", "lhr1"]
}
```

### Database Indexing
Ensure your MongoDB collections have proper indexes:
```javascript
// In MongoDB shell or Compass
db.blogposts.createIndex({ "status": 1, "locale": 1 })
db.blogposts.createIndex({ "slug": 1, "locale": 1 })
db.blogposts.createIndex({ "generationGroupId": 1 })
```

## 🚨 **Troubleshooting**

### If timeouts persist:

1. **Check Vercel Function Logs**:
   ```bash
   vercel logs --follow
   ```

2. **Test Database Connection**:
   - Use `/api/health/db` endpoint
   - Check MongoDB Atlas connection limits
   - Verify network access settings

3. **Monitor Performance**:
   - Check function execution time in Vercel dashboard
   - Monitor database query performance in MongoDB Atlas

4. **Fallback Options**:
   - Increase function timeout to 60s (Pro plan required)
   - Consider using Vercel Edge Runtime for faster cold starts
   - Implement database connection pooling with external service

## 📊 **Expected Results**

After applying these fixes:
- ✅ API routes should respond within 5-10 seconds
- ✅ Database connections should establish quickly
- ✅ No more FUNCTION_INVOCATION_TIMEOUT errors
- ✅ Improved overall performance

## 🔄 **Next Steps**

1. Deploy the changes
2. Test all API endpoints
3. Monitor Vercel function logs
4. Check MongoDB Atlas metrics
5. Consider implementing caching for frequently accessed data

If issues persist, the problem might be with your MongoDB Atlas configuration or network connectivity between Vercel and your database. 