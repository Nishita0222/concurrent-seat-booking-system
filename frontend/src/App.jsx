import React, { useState, useEffect, useMemo } from 'react';

const API = "http://localhost:5000/api";

export default function App() {

  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [booking, setBooking] = useState(null);

  async function refresh(initial = false) {
    if (initial) setLoading(true);
    try {
      const res = await fetch(`${API}/seats`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSeats(data);
      setSelected(old => old && data.find(s => s.id === old.id)?.status === "AVAILABLE"
        ? data.find(s => s.id === old.id) : null);
    } catch {
      setNotice({ type: "error", text: "Can't connect to the server. Make sure Flask is running on port 5000." });
    } finally { setLoading(false); }
  }

  useEffect(() => {
    refresh(true);
    const timer = setInterval(() => refresh(), 5000);
    return () => clearInterval(timer);
  }, []);

  const available = useMemo(() => seats.filter(s => s.status === "AVAILABLE").length, [seats]);
  const reserved = seats.length - available;

  async function submit(e) {
    e.preventDefault();
    if (!selected || !name.trim()) return;
    setBusy(true); setNotice(null); setBooking(null);
    const key = crypto.randomUUID?.() || `req-${Date.now()}`;
    try {
      const res = await fetch(`${API}/book`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seat_id: selected.id, user_name: name.trim(), request_key: key })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBooking(data.booking);
        setNotice({ type: "success", text: "Your reservation is confirmed. Have a lovely time." });
      } else {
        setNotice({ type: "error", text: data.message || "That seat has just been taken. Please choose another." });
      }
      setSelected(null);
      await refresh();
    } catch {
      setNotice({ type: "error", text: "The request could not be completed. Refresh the seat plan before retrying." });
    } finally { setBusy(false); }
  }

  return <div className="app">
    <nav className="nav">
      <a className="brand" href="#"><span className="brand-icon">s</span> seatwise</a>
      <div className="live"><i /> Live availability</div>
    </nav>

    <main className="wrap">
      <section className="hero">
        <div>
          <p className="eyebrow">A MORE THOUGHTFUL WAY TO BOOK</p>
          <h1>Make room<br />for <em>something good.</em></h1>
          <p className="hero-copy">Choose the seat you like. We'll check it in real time and confirm your reservation securely.</p>
          <p className="promise"><span>✓</span> One seat. One confirmed booking. Every time.</p>
        </div>
        <div className="visual-card">
          <div className="visual-art">
            <span className="art-label">YOUR NEXT EXPERIENCE</span>
            <div className="art-lines"></div>
            <div className="art-title">A place<br />to be.</div>
          </div>
          <div className="visual-bottom"><div><small>RESERVATIONS</small><b>Now open</b></div><span className="open-pill">● Available now</span></div>
        </div>
      </section>

      <section className="content">
        <div className="seat-card">
          <div className="section-top">
            <div><p className="eyebrow">01 / SEATING PLAN</p><h2>Find your seat</h2></div>
            <button className="refresh" onClick={() => refresh(true)} type="button">↻ Refresh</button>
          </div>
          <div className="stats">
            <div><b>{available}</b><span>Available</span></div><div className="stat-rule"/>
            <div><b>{reserved}</b><span>Reserved</span></div>
            <span className="auto"><i/> Auto-updates every 5 sec</span>
          </div>
          <div className="screen-area"><div className="screen">SCREEN</div><span>FRONT</span></div>
          <div className="legend">
            <span><i className="key free"/> Available</span><span><i className="key used"/> Reserved</span><span><i className="key chosen"/> Selected</span>
          </div>
          {loading ? <p className="empty">Loading seats…</p> : seats.length === 0 ? <p className="empty">No seats found. Add seats to your MySQL database.</p> :
            <div className="seats">
              {seats.map(s => <button key={s.id} disabled={s.status !== "AVAILABLE"}
                className={`seat ${s.status === "AVAILABLE" ? "free-seat" : "used-seat"} ${selected?.id === s.id ? "is-selected" : ""}`}
                onClick={() => { setSelected(s); setNotice(null); setBooking(null); }}>
                {s.seat_number}
              </button>)}
            </div>}
          <p className="hint">Green seats are available. Grey seats have already been reserved.</p>
        </div>

        <aside className="checkout">
          <p className="eyebrow">02 / YOUR DETAILS</p>
          <h2>Nearly there.</h2>
          <p className="checkout-copy">A few details and the seat is yours.</p>
          <form onSubmit={submit}>
            <label htmlFor="guest">Your name</label>
            <input id="guest" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alex Morgan" maxLength="120" />
            <div className="chosen-box"><small>SELECTED SEAT</small><strong>{selected?.seat_number || "—"}</strong><span>{selected ? "Ready for confirmation" : "Choose a seat from the plan"}</span></div>
            <button className="confirm" disabled={!selected || !name.trim() || busy}>{busy ? "Checking seat…" : "Confirm reservation"} <b>→</b></button>
          </form>
          {notice && <div className={`notice ${notice.type}`} role="status"><b>{notice.type === "success" ? "✓" : "!"}</b>{notice.text}</div>}
          {booking && <div className="receipt"><small>CONFIRMATION REFERENCE</small><strong>{booking.booking_reference}</strong><span>Save this reference for your records.</span></div>}
          <div className="assurance"><span>◇</span><p><b>Fair booking, by design.</b><br/>The server checks availability before confirming any reservation.</p></div>
        </aside>
      </section>
      <footer><b>seatwise</b><span>Simple booking. No double bookings.</span></footer>
    </main>
  </div>;
}

