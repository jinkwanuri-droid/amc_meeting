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

  // 1. JSON Middleware (MUST be before routes)
  app.use(express.json());

  // 2. Request Logging for Debugging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // 3. Health check & Debugging
  app.get("/api/health", (req, res) => res.json({ status: "ok", env: !!process.env.POSTGRES_URL }));
  app.get("/api/ping", (req, res) => res.send("pong"));

  // 4. DB Initialization
  async function initDB() {
    if (!process.env.POSTGRES_URL) {
      console.warn("⚠️ POSTGRES_URL is missing.");
      return;
    }
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS rooms (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT,
          capacity INTEGER,
          "order" INTEGER DEFAULT 0
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS bookings (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          room_id TEXT NOT NULL,
          start_time TIMESTAMP WITH TIME ZONE NOT NULL,
          end_time TIMESTAMP WITH TIME ZONE NOT NULL,
          organizer TEXT,
          description TEXT,
          color TEXT
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS holidays (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          date DATE NOT NULL
        );
      `;
      console.log("✅ Database initialized successfully");
    } catch (error) {
      console.error("❌ Database initialization failed:", error);
    }
  }
  
  await initDB();

  // --- API Routes ---

  app.get("/api/rooms", async (req, res) => {
    try {
      const { rows } = await sql`SELECT * FROM rooms ORDER BY "order" ASC`;
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/rooms/sync", async (req, res) => {
    try {
      const rooms = req.body;
      if (!Array.isArray(rooms)) throw new Error("Invalid payload");
      
      // 1. Delete all rooms (small data set, safe to re-insert)
      await sql`DELETE FROM rooms`;

      // 2. Insert all
      for (const room of rooms) {
        await sql`
          INSERT INTO rooms (id, name, color, capacity, "order")
          VALUES (${room.id}, ${room.name}, ${room.color}, ${room.capacity}, ${room.order})
        `;
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bookings", async (req, res) => {
    try {
      const { rows } = await sql`SELECT * FROM bookings`;
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bookings", async (req, res) => {
    try {
      const { title, room_id, start_time, end_time, organizer, description, color } = req.body;
      const { rows } = await sql`
        INSERT INTO bookings (title, room_id, start_time, end_time, organizer, description, color)
        VALUES (${title}, ${room_id}, ${start_time}, ${end_time}, ${organizer}, ${description}, ${color})
        RETURNING *
      `;
      res.json(rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/bookings/:id", async (req, res) => {
    try {
      const { title, room_id, start_time, end_time, organizer, description, color } = req.body;
      await sql`
        UPDATE bookings 
        SET title = ${title}, room_id = ${room_id}, start_time = ${start_time}, 
            end_time = ${end_time}, organizer = ${organizer}, description = ${description}, color = ${color}
        WHERE id = ${req.params.id}
      `;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/bookings/:id", async (req, res) => {
    try {
      await sql`DELETE FROM bookings WHERE id = ${req.params.id}`;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/holidays", async (req, res) => {
    try {
      const { rows } = await sql`SELECT * FROM holidays`;
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/holidays/sync", async (req, res) => {
    try {
      const holidays = req.body;
      for (const h of holidays) {
        await sql`
          INSERT INTO holidays (id, name, date)
          VALUES (${h.id}, ${h.name}, ${h.date})
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            date = EXCLUDED.date
        `;
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Vite & Static ---
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
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer();
