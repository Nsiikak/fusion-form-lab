# Plagohive Backend API

FastAPI backend for the Plagohive platform with PostgreSQL database and Argon2 password hashing.

## Setup

### Prerequisites

- Python 3.9+
- PostgreSQL database running locally or remotely
- Database credentials:
  - User: `postgres`
  - Password: `maritime`
  - Database: `plagohive`

### Installation

1. Create a virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

4. Make sure PostgreSQL is running and the database exists:

```bash
# Create database if it doesn't exist
createdb -U postgres plagohive
```

5. Run the application:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

## API Documentation

Once the server is running, you can access:

- Interactive API docs: `http://localhost:8000/docs`
- Alternative docs: `http://localhost:8000/redoc`

## Authentication Endpoints

### Register User

- **POST** `/api/auth/register`
- Body: `{ "email": "user@example.com", "password": "password123", "full_name": "John Doe", "phone_number": "+1234567890", "role": "customer" }`
- Returns: User object (without password)

### Login (OAuth2 Form)

- **POST** `/api/auth/login`
- Form data: `username` (email) and `password`
- Returns: `{ "access_token": "...", "token_type": "bearer" }`

### Login (JSON)

- **POST** `/api/auth/login-json`
- Body: `{ "email": "user@example.com", "password": "password123" }`
- Returns: `{ "access_token": "...", "token_type": "bearer" }`

### Get Current User

- **GET** `/api/auth/me`
- Headers: `Authorization: Bearer <token>`
- Returns: Current user information

## Features

- ✅ FastAPI with async support
- ✅ PostgreSQL database with SQLAlchemy ORM
- ✅ Argon2 password hashing (via passlib)
- ✅ JWT token authentication
- ✅ CORS enabled for frontend integration
- ✅ User roles (customer, vendor, admin)
- ✅ Email validation
- ✅ Password verification

## Development

The database tables are automatically created when the application starts. To reset the database, you can drop and recreate the tables.

## Security Notes

- Change the `SECRET_KEY` in production
- Use environment variables for sensitive configuration
- Consider adding rate limiting for authentication endpoints
- Implement email verification for production use
