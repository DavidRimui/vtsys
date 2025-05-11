# Voting System Front-End

A Next.js application designed for deployment on Vercel that serves as a simple voting system with direct payment functionality.

## Features

- Vote for candidates using M-Pesa, Airtel Money, or Card payments
- No sign-in required - direct payment flow
- Intentionally designed for unlimited voting (no per-user restrictions)
- Real-time vote counting and statistics
- OneKitty payment integration (M-Pesa, Airtel Money, and Card)
- CSRF protection for all form submissions
- Rate limiting to prevent API abuse
- Input validation and sanitization
- Comprehensive error handling and logging

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React Context API
- **Database**: PostgreSQL with Prisma ORM
- **Validation**: Zod
- **Payment Gateway**: OneKitty API (direct integration via Axios)

## OneKitty Payment Integration

### Environment Variables
Add the following to your `.env` file:

```
ONEKITTY_CHANNEL_CODE=********
ONEKITTY_AUTH_CODE=********
ONEKITTY_CALLBACK_URL=https://apisalticon.onekitty.co.ke/kitty/api/contribute/callback
```

### Usage
- Use the `contributeToKitty` utility in `lib/onekitty.ts` to send contributions to the OneKitty API.
- Or, POST to the `/app/contribute.ts` endpoint with the following JSON body:

```
{
  "amount": 1,
  "kitty_id": *******,
  "phone_number": "2547xxxxxx03",
  "first_name": "Nganga",
  "second_name": "Ngash",
  "show_names": true,
  "show_number": true
}
```

### Example Response
```
{
  "status": true,
  "message": "MPESA STK sent. Enter your PIN to complete transaction",
  "data": {
    "checkout_request_id": "...",
    "payment_gateway": "MPESA",
    "customer_message": "...",
    "detail": "...",
    "response_description": "Success. STK PUSH SENT",
    "checkout_url": ""
  }
}
```

See the OneKitty API docs for more details on error and callback responses.

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- PostgreSQL database

### Installation

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/DavidRimui/voting-system.git
   cd voting-system
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   # or
   yarn install
   \`\`\`

3. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:
   \`\`\`
   DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}?schema=public"
   DB_NAME=********
   DB_USER=********
   DB_PASSWORD=********
  DB_HOST=******
   \`\`\`

4. Initialize the database:
   \`\`\`bash
   npx prisma migrate dev --name init
   npm run init-db
   \`\`\`

5. Run the development server:
   \`\`\`bash
   npm run dev
   # or
   yarn dev
   \`\`\`

6. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Project Structure

- `/app`: Next.js App Router pages
- `/components`: Reusable React components
  - `/admin`: Admin-specific components
  - `/auth`: Authentication components
  - `/layout`: Layout components like header
  - `/ui`: UI components from shadcn/ui
  - `/voting`: Voting-related components
- `/lib`: Utility functions and context providers
- `/prisma`: Database schema and migrations

## Production Deployment

Follow these steps to securely deploy the voting system to production:

### 1. Environment Configuration

Create a `.env.production` file with the following variables (replace with your secure values):

```env
# Database configuration
DATABASE_URL="postgresql://db_user:secure_password@db_host:5432/voting_system"

# Authentication secrets
JWT_SECRET="use_a_secure_random_string_at_least_32_chars_long"
SESSION_COOKIE_NAME="voting_session"

# OneKitty Payment API credentials
ONEKITTY_CHANNEL_CODE="your_channel_code"
ONEKITTY_AUTH_CODE="your_auth_code"
ONEKITTY_CALLBACK_URL="https://your-domain.com/api/payment/callback"

# Application settings (important for security)
NEXT_PUBLIC_TEST_MODE="false"
NODE_ENV="production"
```

### 2. Database Setup

1. Create a production PostgreSQL database
2. Update the DATABASE_URL in your environment variables
3. Run migrations to set up the database schema:

```bash
npx prisma migrate deploy
```

### 3. Build and Deploy

#### Option 1: Deploy to Vercel

1. Connect your GitHub repository to Vercel
2. Configure all environment variables in the Vercel dashboard
3. Deploy the application

#### Option 2: Deploy to a Custom Server

1. Build the application:

```bash
npm run build
```

2. Start the production server:

```bash
npm run start
```

### 4. Security Checklist

Before going live, verify these security measures:

- [x] Environment variables are properly set and not exposed
- [x] JWT_SECRET is a strong, unique value used only for this application
- [x] TEST_MODE is set to false in production
- [x] Database credentials are secure and database is properly configured
- [x] HTTPS is enabled for all production traffic
- [x] CORS policies are properly configured
- [x] Rate limiting is enabled to prevent abuse

## Deployment on Vercel

1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com) and sign up or log in.
3. Click "New Project" and import your GitHub repository.
4. Add the environment variables:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `DB_NAME`: Your database name
   - `DB_USER`: Your database username
   - `DB_PASSWORD`: Your database password
   - `DB_HOST`: Your database host
5. Click "Deploy".

## Usage

### Voting Flow

1. Visit the home page and click "Vote Now".
2. Browse the list of candidates organized by categories.
3. Use filters and search to find specific candidates.
4. Click the "Vote" button on a candidate card to cast your vote.
5. Receive confirmation of your vote.

### Admin Flow

1. Log in through the admin login page (default credentials: admin@example.com / password).
2. Access the admin dashboard to view voting statistics.
3. Monitor vote counts for all candidates.
4. Use filters and search to analyze specific candidate data.
5. Toggle between table and grid views for different data visualization.

## Database Schema

The application uses PostgreSQL with Prisma ORM. The schema includes:

- `Candidate`: Stores candidate information and vote counts
- `Admin`: Stores admin user credentials

## Authentication

For demonstration purposes, this application uses client-side authentication with localStorage. In a production environment, you would implement:

- Server-side authentication
- JWT or session-based auth
- Secure password hashing
- CSRF protection

## Customization

### Styling

The application uses Tailwind CSS for styling. You can customize the theme by modifying the `tailwind.config.js` file and the CSS variables in `app/globals.css`.

### Adding Features

To extend the application:

1. Add new components in the appropriate directories
2. Update the authentication context if needed
3. Create new routes in the `/app` directory

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Prisma](https://www.prisma.io/)
- [PostgreSQL](https://www.postgresql.org/)
- [Lucide Icons](https://lucide.dev/)
\`\`\`

