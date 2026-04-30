import express from "express";
import { sql } from "@vercel/postgres";

const app = express();
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", db: !!process.env.POSTGRES_URL, version: "1.0.12-vercel" });
});

app.get("/api/rooms", async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM rooms ORDER BY "order" ASC`;
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/rooms/sync", async (req, res) => {
  try {
    const rooms = req.body;
    if (!Array.isArray(rooms)) return res.status(400).json({ error: "Expected array" });
    
    for (const r of rooms) {
      await sql`INSERT INTO rooms (id, name, color, capacity, "order") VALUES (${r.id}, ${r.name}, ${r.color}, ${r.capacity}, ${r.order}) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, color=EXCLUDED.color, capacity=EXCLUDED.capacity, "order"=EXCLUDED."order"`;
    }
    
    if (rooms.length > 0) {
      const roomIds = rooms.map(r => r.id);
      await sql`DELETE FROM rooms WHERE NOT (id = ANY(${roomIds}))`;
    } else {
      await sql`DELETE FROM rooms`;
    }
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/bookings", async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM bookings`;
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/bookings", async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await sql`INSERT INTO bookings (title, room_id, start_time, end_time, organizer, description, color) VALUES (${b.title}, ${b.room_id}, ${b.start_time}, ${b.end_time}, ${b.organizer}, ${b.description}, ${b.color}) RETURNING *`;
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/bookings/:id", async (req, res) => {
  try {
    const b = req.body;
    await sql`UPDATE bookings SET title=${b.title}, room_id=${b.room_id}, start_time=${b.start_time}, end_time=${b.end_time}, organizer=${b.organizer}, description=${b.description}, color=${b.color} WHERE id=${req.params.id}`;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/bookings/:id", async (req, res) => {
  try {
    await sql`DELETE FROM bookings WHERE id=${req.params.id}`;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/holidays", async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM holidays`;
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/holidays/sync", async (req, res) => {
  try {
    const holidays = req.body;
    if (!Array.isArray(holidays)) return res.status(400).json({ error: "Expected array" });
    for (const h of holidays) {
      await sql`INSERT INTO holidays (id, name, date) VALUES (${h.id}, ${h.name}, ${h.date}) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, date=EXCLUDED.date`;
    }
    if (holidays.length > 0) {
      const holidayIds = holidays.map(h => h.id);
      await sql`DELETE FROM holidays WHERE NOT (id = ANY(${holidayIds}))`;
    } else {
      await sql`DELETE FROM holidays`;
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.all("/api/*", (req, res) => {
  res.status(404).json({ error: "API Route Not Found" });
});

export default app;
