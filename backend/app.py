import os
import uuid
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector
from mysql.connector import pooling, Error

app = Flask(__name__)
CORS(app)

db_pool = pooling.MySQLConnectionPool(
    pool_name="booking_pool",
    pool_size=10,
    host=os.getenv("DB_HOST", "localhost"),
    port=int(os.getenv("DB_PORT", "3306")),
    user=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASSWORD", ""),
    database=os.getenv("DB_NAME", "seat_booking"),
    autocommit=False
)

def get_conn():
    return db_pool.get_connection()

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "seat-booking-api"})

@app.get("/api/seats")
def list_seats():
    conn = get_conn()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT id, seat_number, status FROM seats ORDER BY id")
        return jsonify(cur.fetchall())
    finally:
        cur.close()
        conn.close()

@app.post("/api/book")
def book_seat():
    data = request.get_json(silent=True) or {}
    seat_id = data.get("seat_id")
    user_name = (data.get("user_name") or "").strip()
    # Client supplies an idempotency key; retries with the same key won't create
    # a second booking. Generate one if the client omitted it.
    request_key = (data.get("request_key") or str(uuid.uuid4())).strip()

    if not isinstance(seat_id, int) or not user_name:
        return jsonify({"success": False, "message": "seat_id (integer) and user_name are required"}), 400

    conn = get_conn()
    cur = conn.cursor(dictionary=True)
    try:
        # First handle a network retry of a request that already succeeded.
        cur.execute("SELECT id, seat_id, user_name, booking_reference FROM bookings WHERE request_key=%s",
                    (request_key,))
        previous = cur.fetchone()
        if previous:
            conn.rollback()
            return jsonify({"success": True, "message": "Booking already confirmed",
                            "booking": previous}), 200

        # Atomic conditional update: only one transaction can change AVAILABLE to BOOKED.
        cur.execute(
            "UPDATE seats SET status='BOOKED' WHERE id=%s AND status='AVAILABLE'",
            (seat_id,)
        )
        if cur.rowcount != 1:
            conn.rollback()
            return jsonify({"success": False,
                            "message": "Sorry, this seat is no longer available. Please choose another seat."}), 409

        reference = "BK-" + uuid.uuid4().hex[:10].upper()
        cur.execute(
            """INSERT INTO bookings (seat_id, user_name, booking_reference, request_key, created_at)
               VALUES (%s, %s, %s, %s, %s)""",
            (seat_id, user_name, reference, request_key, datetime.utcnow())
        )
        booking_id = cur.lastrowid
        conn.commit()
        return jsonify({
            "success": True,
            "message": "Seat booked successfully",
            "booking": {
                "id": booking_id, "seat_id": seat_id,
                "user_name": user_name, "booking_reference": reference
            }
        }), 201
    except Error:
        conn.rollback()
        app.logger.exception("Booking transaction failed")
        return jsonify({"success": False, "message": "Booking could not be completed. Please retry."}), 500
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
