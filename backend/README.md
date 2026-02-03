# LoonCamp Backend API

Node.js + PostgreSQL backend for LoonCamp property booking system.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
PORT=5001
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/looncamp
JWT_SECRET=your-super-secret-key
JWT_EXPIRY=24h
```

### 3. Initialize Database

```bash
# Make sure PostgreSQL is running
npm run init-db
```

### 4. Start Server

```bash
# Development
npm run dev

# Production
npm start
```

## Default Credentials

```
Email: admin@looncamp.com
Password: admin123
```

## API Endpoints

### Auth
- POST `/api/auth/login` - Login
- POST `/api/auth/logout` - Logout
- GET `/api/auth/verify` - Verify token

### Properties (Protected)
- GET `/api/properties/list` - Get all
- GET `/api/properties/:id` - Get one
- POST `/api/properties/create` - Create
- PUT `/api/properties/update/:id` - Update
- DELETE `/api/properties/delete/:id` - Delete
- PATCH `/api/properties/toggle-status/:id` - Toggle status

### Properties (Public)
- GET `/api/properties/public-list` - Get active properties

## Database Schema

See `schema.sql` for complete schema.

Tables:
- `admins` - Admin users
- `properties` - Property listings
- `property_images` - Property images

## Environment Variables

- `PORT` - Server port (default: 5001)
- `NODE_ENV` - Environment (development/production)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `JWT_EXPIRY` - Token expiry time (default: 24h)

## Deployment

### Hostinger
1. Upload backend folder
2. Set environment variables
3. Run `npm run init-db`
4. Start with `npm start`

### Replit
1. Upload files
2. Configure secrets
3. Initialize PostgreSQL
4. Run `node server.js`

See main README for detailed deployment instructions.
