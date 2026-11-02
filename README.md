# POD Register

React + Spring Boot + Postgres. Enter POD series, save to Postgres, view by month, download Excel, print.

## Run (3 terminals)

1. Database (needs Docker):
   `docker compose up -d`

2. Backend (Java 17+, Maven):
   `cd backend && mvn spring-boot:run`
   Runs on http://localhost:8080. The `pod_entry` table is created on startup from `schema.sql`.

3. Frontend (Node 18+):
   `cd frontend && npm install && npm run dev`
   Open http://localhost:5173

## API

| Method | URL | What it does |
|---|---|---|
| POST | `/api/entries/bulk` | Save all rows (all or none). Amount is recalculated on the server. 409 with the list if a POD number already exists. |
| GET | `/api/entries?month=2026-11&search=madurai` | List records. Leave `month` out for all months. |
| GET | `/api/entries/export.xlsx?month=2026-11` | Excel file for the same filter. |

## Rules

- POD number: 11 digits, last digit 0 to 6, must be unique.
- Series: each row adds 1 to the first 10 digits; the last digit rotates 0..6 from the starting digit.
- Amount (Tamil Nadu): Rs 25 up to 300 g, plus Rs 7 for every further 300 g or part of it.

## Print

The Records page has a Print button (clean print layout). The Excel file is also set to fit A4 width with the header repeated on every page.
