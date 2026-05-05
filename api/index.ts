import express from "express";
import { sql } from "@vercel/postgres";

const app = express();
app.use(express.json());

async function logActivity(action: string, roomId?: string, bookingId?: string, details?: any) {
  try {
    const detailsStr = details ? JSON.stringify(details) : null;
    if (bookingId) {
      await sql`INSERT INTO activity_log (action, room_id, booking_id, details) VALUES (${action}, ${roomId || null}, ${bookingId}, ${detailsStr})`;
    } else if (roomId) {
      await sql`INSERT INTO activity_log (action, room_id, details) VALUES (${action}, ${roomId}, ${detailsStr})`;
    } else {
      await sql`INSERT INTO activity_log (action, details) VALUES (${action}, ${detailsStr})`;
    }
  } catch (e) {
    // Attempt migrations
    try {
      await sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS room_id TEXT`;
      await sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS booking_id TEXT`;
      await sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS details TEXT`;
      
      const detailsStr = details ? JSON.stringify(details) : null;
      if (bookingId) {
        await sql`INSERT INTO activity_log (action, room_id, booking_id, details) VALUES (${action}, ${roomId || null}, ${bookingId}, ${detailsStr})`;
      } else if (roomId) {
        await sql`INSERT INTO activity_log (action, room_id, details) VALUES (${action}, ${roomId}, ${detailsStr})`;
      } else {
        await sql`INSERT INTO activity_log (action, details) VALUES (${action}, ${detailsStr})`;
      }
    } catch (inner) {
      console.warn("Failed to log activity after column add:", inner);
    }
  }
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", db: !!process.env.POSTGRES_URL, version: "1.0.12-vercel" });
});

app.post("/api/visit", async (req, res) => {
  await logActivity('visit');
  res.json({ success: true });
});

app.get("/api/stats", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const stats = {
      visitors: {
        today: 0,
        week: 0,
        month: 0,
        three_months: 0,
        all: 0
      },
      actions: {
        today: { create: 0, update: 0, delete: 0 },
        week: { create: 0, update: 0, delete: 0 },
        month: { create: 0, update: 0, delete: 0 },
        three_months: { create: 0, update: 0, delete: 0 },
        all: { create: 0, update: 0, delete: 0 },
      }
    };

    // Visitors history
    const getVisitStats = async (period: 'today' | 'week' | 'month' | 'three_months' | 'all') => {
      let query;
      if (period === 'today') query = sql`SELECT count(*) FROM activity_log WHERE action = 'visit' AND timestamp >= CURRENT_DATE`;
      else if (period === 'week') query = sql`SELECT count(*) FROM activity_log WHERE action = 'visit' AND timestamp >= CURRENT_DATE - INTERVAL '7 days'`;
      else if (period === 'month') query = sql`SELECT count(*) FROM activity_log WHERE action = 'visit' AND timestamp >= CURRENT_DATE - INTERVAL '30 days'`;
      else if (period === 'three_months') query = sql`SELECT count(*) FROM activity_log WHERE action = 'visit' AND timestamp >= CURRENT_DATE - INTERVAL '90 days'`;
      else query = sql`SELECT count(*) FROM activity_log WHERE action = 'visit'`;
      const res = await query;
      return parseInt(res.rows[0].count);
    };

    // Helper for period counts
    const getPeriodStats = async (period: 'today' | 'week' | 'month' | 'three_months' | 'all') => {
      let query;
      if (period === 'today') query = sql`SELECT action, count(*) FROM activity_log WHERE timestamp >= CURRENT_DATE AND action != 'visit' GROUP BY action`;
      else if (period === 'week') query = sql`SELECT action, count(*) FROM activity_log WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days' AND action != 'visit' GROUP BY action`;
      else if (period === 'month') query = sql`SELECT action, count(*) FROM activity_log WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days' AND action != 'visit' GROUP BY action`;
      else if (period === 'three_months') query = sql`SELECT action, count(*) FROM activity_log WHERE timestamp >= CURRENT_DATE - INTERVAL '90 days' AND action != 'visit' GROUP BY action`;
      else query = sql`SELECT action, count(*) FROM activity_log WHERE action != 'visit' GROUP BY action`;
      
      const res = await query;
      const counts = { create: 0, update: 0, delete: 0 };
      res.rows.forEach(r => {
        if (r.action === 'create_booking') counts.create = parseInt(r.count);
        if (r.action === 'update_booking') counts.update = parseInt(r.count);
        if (r.action === 'delete_booking') counts.delete = parseInt(r.count);
      });
      return counts;
    };

    const [
      visToday, visWeek, visMonth, vis3Months, visAll,
      actToday, actWeek, actMonth, act3Months, actAll
    ] = await Promise.all([
      getVisitStats('today'),
      getVisitStats('week'),
      getVisitStats('month'),
      getVisitStats('three_months'),
      getVisitStats('all'),
      getPeriodStats('today'),
      getPeriodStats('week'),
      getPeriodStats('month'),
      getPeriodStats('three_months'),
      getPeriodStats('all')
    ]);

    stats.visitors.today = visToday;
    stats.visitors.week = visWeek;
    stats.visitors.month = visMonth;
    stats.visitors.three_months = vis3Months;
    stats.visitors.all = visAll;

    stats.actions.today = actToday;
    stats.actions.week = actWeek;
    stats.actions.month = actMonth;
    stats.actions.three_months = act3Months;
    stats.actions.all = actAll;

    // Ensure room_id exists before querying
    try {
      await sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS room_id TEXT`;
    } catch (e) {
      console.warn("Migration failed or column already exists:", e);
    }

    // Room-specific actions for total (all time)
    try {
      const roomActionsRes = await sql`SELECT room_id, action, count(*) FROM activity_log WHERE action != 'visit' GROUP BY room_id, action`;
      (stats as any).roomActions = roomActionsRes.rows;
    } catch (e) {
      console.warn("Failed to fetch room actions:", e);
    }

    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
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
      await sql`DELETE FROM rooms WHERE NOT (id = ANY(${roomIds as any}))`;
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
    const { rows } = await sql`INSERT INTO bookings (title, room_id, start_time, end_time, organizer, project_name, description, color) VALUES (${b.title}, ${b.room_id}, ${b.start_time}, ${b.end_time}, ${b.organizer}, ${b.project_name}, ${b.description}, ${b.color}) RETURNING *`;
    await logActivity('create_booking', b.room_id, rows[0].id?.toString(), { title: b.title, organizer: b.organizer, project_name: b.project_name, start_time: b.start_time, end_time: b.end_time });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/bookings/:id", async (req, res) => {
  try {
    const b = req.body;
    await sql`UPDATE bookings SET title=${b.title}, room_id=${b.room_id}, start_time=${b.start_time}, end_time=${b.end_time}, organizer=${b.organizer}, project_name=${b.project_name}, description=${b.description}, color=${b.color} WHERE id=${req.params.id}`;
    await logActivity('update_booking', b.room_id, req.params.id, { title: b.title, organizer: b.organizer, project_name: b.project_name, start_time: b.start_time, end_time: b.end_time });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/bookings/:id", async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM bookings WHERE id=${req.params.id}`;
    const booking = rows[0];
    await sql`DELETE FROM bookings WHERE id=${req.params.id}`;
    await logActivity('delete_booking', booking?.room_id, req.params.id, { title: booking?.title, organizer: booking?.organizer, project_name: booking?.project_name, start_time: booking?.start_time, end_time: booking?.end_time });
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
      await sql`DELETE FROM holidays WHERE NOT (id = ANY(${holidayIds as any}))`;
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
