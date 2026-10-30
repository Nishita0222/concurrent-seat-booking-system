# Concurrent Seat Booking System

A learning/demo seat-booking application built with React, Flask and MySQL.

## Requirements
- Python 3.10+
- Node.js 18+
- MySQL 8+

## 1. Database setup
Run `database/schema.sql` in MySQL Workbench or the MySQL CLI. It creates the `seat_booking` database, tables and sample seats.

## 2. Start the Flask backend
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate
pip install -r requirements.txt
```
Set database environment variables before starting. Windows PowerShell example:
```powershell
$env:DB_HOST="localhost"
$env:DB_USER="root"
$env:DB_PASSWORD="your_mysql_password"
$env:DB_NAME="seat_booking"
python app.py
```
Backend runs at `http://localhost:5000`.

## 3. Start the React frontend
Open another terminal:
```bash
cd frontend
npm install
npm run dev
```
Open the local URL printed by Vite (usually `http://localhost:5173`).

## API
- `GET /api/health` - health check
- `GET /api/seats` - current seat list
- `POST /api/book` - book one seat. JSON example:
```json
{"seat_id": 1, "user_name": "Asha", "request_key": "unique-request-id"}
```

## How double booking is prevented
The backend executes this conditional SQL statement:
```sql
UPDATE seats
SET status = 'BOOKED'
WHERE id = ? AND status = 'AVAILABLE';
```
MySQL InnoDB locks the affected row while the transaction is running. If two requests target the same last seat, one update changes the row and commits. The competing update then sees that the seat is no longer AVAILABLE and affects zero rows. The API checks `cursor.rowcount`: exactly one means the request won; zero means the seat was already taken. The booking insert and seat update are committed together, or rolled back together.

The unique `request_key` prevents a retried request from creating a duplicate booking. The unique booking reference identifies the confirmed reservation.

## Important production improvements
This is a runnable educational prototype, not a production-certified high-traffic service. Before public deployment:
- Run Flask behind Gunicorn/uWSGI and a reverse proxy/load balancer; do not use Flask's development server.
- Use managed MySQL with backups, monitoring, connection-pool sizing and tested failover.
- Add authentication, authorization, input validation, rate limiting and audit logs.
- Add temporary seat holds with expiry if users need time to pay; release expired holds safely.
- Use payment-provider webhooks and idempotency keys for payment confirmation.
- Add load tests and monitor database lock waits, latency, error rates and pool saturation.
- Scale application instances horizontally; keep booking correctness enforced in MySQL, not only in frontend state or Redis.

## Suggested demonstration
1. Open the site in two browser windows.
2. Refresh both and select the same available seat.
3. Click Confirm booking in both windows nearly simultaneously.
4. One should receive a booking reference; the other should receive a conflict message.
5. Refresh the seat list: the seat is BOOKED.
