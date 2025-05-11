# Deployment Guide for Voting System

This guide provides instructions for deploying the Voting System application to production environments.

## Prerequisites

- Node.js 20 or later
- PostgreSQL 15 or later
- Docker and Docker Compose (for containerized deployment)
- NGINX (for reverse proxy setup)
- SSL certificate for your domain

## Environment Variables

Before deployment, ensure all required environment variables are properly configured in `.env.production`:

```
# Required environment variables for production:
DATABASE_URL=postgresql://username:password@hostname:5432/dbname
ONE_KITTY_API_KEY=your_production_api_key
ONE_KITTY_CHANNEL_CODES=63902,63903,55
NEXTAUTH_SECRET=your_secure_random_string
NEXTAUTH_URL=https://your-production-domain.com
```

## Deployment Options

### 1. Standard Node.js Deployment

```bash
# Install dependencies
npm ci

# Build the application
npm run build:production

# Start the server
npm run start:production
```

### 2. Docker Deployment

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f
```

### 3. Platform Deployments

#### Vercel Deployment

```bash
# Deploy to Vercel
npm run deploy:vercel
```

#### Other Platforms

The application is compatible with any platform that supports Node.js applications, including:
- AWS Elastic Beanstalk
- Google Cloud Run
- Heroku
- Digital Ocean App Platform

## Database Migration

Run database migrations before deploying the application:

```bash
# Apply database migrations
npm run db:migrate
```

## SSL Configuration

For production deployments, always use HTTPS:

1. Obtain an SSL certificate for your domain
2. Configure your web server or load balancer to use the certificate
3. Set up HTTPS redirects and secure headers as shown in the NGINX configuration

## Performance Optimizations

The application includes several performance optimizations:

1. **Image Optimization**: Proper sizing and formats (WebP, AVIF)
2. **Static Generation**: Pre-rendered pages for faster loading
3. **Edge Caching**: CDN-friendly cache headers
4. **Code Splitting**: Automatic code splitting for optimized bundles

## Security Considerations

1. **Environment Variables**: Never commit sensitive values to version control
2. **Database Access**: Use least-privilege database users
3. **API Keys**: Rotate API keys regularly
4. **Headers**: Secure HTTP headers are configured in NGINX and Next.js

## Monitoring and Maintenance

1. **Health Checks**: The application exposes a `/api/health` endpoint
2. **Logging**: Production logs are minimized to error level only
3. **Database Backups**: Schedule regular database backups

## Troubleshooting

Common deployment issues:

1. **Database Connection**: Verify DATABASE_URL is correct and the database is accessible
2. **API Keys**: Ensure ONE_KITTY_API_KEY is valid for production use
3. **CORS Issues**: Check that your domain is allowed in API configurations
4. **Node Version**: Ensure Node.js 20+ is used in production
