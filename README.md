root .env file:
NEXTAUTH_URL=http://localhost:3000
BACKEND_URL=http://backend:4000
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

DATABASE_URL=
JWT_SECRET=
FRONTEND_URL=http://localhost:3000

POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=pictio

First, run docker build backend
Then, run docker build frontend
Lastly, run docker compose up
