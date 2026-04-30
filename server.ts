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

  // JSON Middleware
  app.use(express.json());

  // Request Logging
  app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.path} (Original: ${req.originalUrl}) - ${new Date().toISOString()}`);
    next();
  });

  // DB Initialization
  async function initDB() {
    console.log("Checking environment...");
    const hasUrl = !!process.env.POSTGRES_URL;
    console.log(`POSTGRES_URL present: ${hasUrl}`);
    if (hasUrl) {
       console.log(`URL starts with: ${process.env.POSTGRES_URL?.substring(0, 15)}...`);
    }

    if (!hasUrl) {
      console.warn("⚠️ POSTGRES_URL IS NOT DEFINED");
      return;
    }
    console.log("Attempting DB initialization...");
    try {
      await sql`CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT, capacity INTEGER, "order" INTEGER DEFAULT 0);`;
      await sql`CREATE TABLE IF NOT EXISTS bookings (id SERIAL PRIMARY KEY, title TEXT NOT NULL, room_id TEXT NOT NULL, start_time TIMESTAMP WITH TIME ZONE NOT NULL, end_time TIMESTAMP WITH TIME ZONE NOT NULL, organizer TEXT, description TEXT, color TEXT);`;
      await sql`CREATE TABLE IF NOT EXISTS holidays (id TEXT PRIMARY KEY, name TEXT NOT NULL, date DATE NOT NULL);`;
      console.log("✅ DB Initialization successful");
    } catch (e: any) {
      console.error("❌ DB Initialization failed:", e.message);
    }
  }
  await initDB();

  // --- API Routes ---
  const apiRouter = express.Router();
  
  apiRouter.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      db: !!process.env.POSTGRES_URL, 
      version: "1.0.9-full-paths" 
    });
  });

  apiRouter.get("/api/rooms", async (req, res) => {
    try {
      const { rows } = await sql`SELECT * FROM rooms ORDER BY "order" ASC`;
      res.json(rows);
    } catch (e: any) {
      console.error("[API ERROR] GET /api/rooms:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.post("/api/rooms/sync", async (req, res) => {
    try {
      const rooms = req.body;
      if (!Array.isArray(rooms)) return res.status(400).json({ error: "Expected array" });
      await sql`DELETE FROM rooms`;
      for (const r of rooms) {
        await sql`INSERT INTO rooms (id, name, color, capacity, "order") VALUES (${r.id}, ${r.name}, ${r.color}, ${r.capacity}, ${r.order})`;
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error("[API ERROR] POST /api/rooms/sync:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.get("/api/bookings", async (req, res) => {
    try {
      const { rows } = await sql`SELECT * FROM bookings`;
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.post("/api/bookings", async (req, res) => {
    try {
      const b = req.body;
      const { rows } = await sql`INSERT INTO bookings (title, room_id, start_time, end_time, organizer, description, color) VALUES (${b.title}, ${b.room_id}, ${b.start_time}, ${b.end_time}, ${b.organizer}, ${b.description}, ${b.color}) RETURNING *`;
      res.json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.put("/api/bookings/:id", async (req, res) => {
    try {
      const b = req.body;
      await sql`UPDATE bookings SET title=${b.title}, room_id=${b.room_id}, start_time=${b.start_time}, end_time=${b.end_time}, organizer=${b.organizer}, description=${b.description}, color=${b.color} WHERE id=${req.params.id}`;
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.delete("/api/bookings/:id", async (req, res) => {
    try {
      await sql`DELETE FROM bookings WHERE id=${req.params.id}`;
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.get("/api/holidays", async (req, res) => {
    try {
      const { rows } = await sql`SELECT * FROM holidays`;
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.post("/api/holidays/sync", async (req, res) => {
    try {
      const holidays = req.body;
      if (!Array.isArray(holidays)) return res.status(400).json({ error: "Expected array" });
      for (const h of holidays) {
        await sql`INSERT INTO holidays (id, name, date) VALUES (${h.id}, ${h.name}, ${h.date}) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, date=EXCLUDED.date`;
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Mount API router
  app.use("/", apiRouter);

  // API 404 fallthrough
  app.all("/api/*", (req, res) => {
    console.warn(`[API 404] No match for ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: "API Route Not Found" });
  });

  // --- Vite ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server started on port ${PORT}`);
  });
}

startServer();
