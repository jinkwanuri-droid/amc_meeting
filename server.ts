import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { sql } from "@vercel/postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. JSON Middleware
  app.use(express.json());

  // 2. Logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // 3. DB Initialization
  async function initDB() {
    if (!process.env.POSTGRES_URL) {
      console.warn("⚠️ POSTGRES_URL missing.");
      return;
    }
    try {
      await sql`CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT, capacity INTEGER, "order" INTEGER DEFAULT 0);`;
      await sql`CREATE TABLE IF NOT EXISTS bookings (id SERIAL PRIMARY KEY, title TEXT NOT NULL, room_id TEXT NOT NULL, start_time TIMESTAMP WITH TIME ZONE NOT NULL, end_time TIMESTAMP WITH TIME ZONE NOT NULL, organizer TEXT, description TEXT, color TEXT);`;
      await sql`CREATE TABLE IF NOT EXISTS holidays (id TEXT PRIMARY KEY, name TEXT NOT NULL, date DATE NOT NULL);`;
      console.log("✅ DB Init Success");
    } catch (e) {
      console.error("❌ DB Init Error:", e);
    }
  }
  await initDB();

  // --- API Routes ---
  const api = express.Router();

  api.get("/health", (req, res) => res.json({ status: "ok", db: !!process.env.POSTGRES_URL, version: "1.0.5-router" }));

  api.get("/rooms", async (req, res) => {
    try {
      const { rows } = await sql`SELECT * FROM rooms ORDER BY "order" ASC`;
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  api.post("/rooms/sync", async (req, res) => {
    try {
      const rooms = req.body;
      if (!Array.isArray(rooms)) throw new Error("Expected array");
      await sql`DELETE FROM rooms`;
      for (const r of rooms) {
        await sql`INSERT INTO rooms (id, name, color, capacity, "order") VALUES (${r.id}, ${r.name}, ${r.color}, ${r.capacity}, ${r.order})`;
      }
      res.json({ success: true });
    } catch (e: any) { console.error(e); res.status(500).json({ error: e.message }); }
  });

  api.get("/bookings", async (req, res) => {
    try {
      const { rows } = await sql`SELECT * FROM bookings`;
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  api.post("/bookings", async (req, res) => {
    try {
      const b = req.body;
      const { rows } = await sql`INSERT INTO bookings (title, room_id, start_time, end_time, organizer, description, color) VALUES (${b.title}, ${b.room_id}, ${b.start_time}, ${b.end_time}, ${b.organizer}, ${b.description}, ${b.color}) RETURNING *`;
      res.json(rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  api.put("/bookings/:id", async (req, res) => {
    try {
      const b = req.body;
      await sql`UPDATE bookings SET title=${b.title}, room_id=${b.room_id}, start_time=${b.start_time}, end_time=${b.end_time}, organizer=${b.organizer}, description=${b.description}, color=${b.color} WHERE id=${req.params.id}`;
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  api.delete("/bookings/:id", async (req, res) => {
    try {
      await sql`DELETE FROM bookings WHERE id=${req.params.id}`;
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  api.get("/holidays", async (req, res) => {
    try {
      const { rows } = await sql`SELECT * FROM holidays`;
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  api.post("/holidays/sync", async (req, res) => {
    try {
      const holidays = req.body;
      for (const h of holidays) {
        await sql`INSERT INTO holidays (id, name, date) VALUES (${h.id}, ${h.name}, ${h.date}) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, date=EXCLUDED.date`;
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Mount API router
  app.use("/api", api);

  // API 404 handler
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `Not Found: ${req.method} ${req.originalUrl}` });
  });

  // --- Vite / Static ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server on port ${PORT}`);
  });
}

startServer();
