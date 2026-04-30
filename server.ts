import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { sql } from "@vercel/postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// --- API Routes (Vercel Postgres) ---

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.method === 'POST') {
    // Note: avoid logging sensitive payload, but keys are helpful
    console.log("POST Body keys:", Object.keys(req.body || {}));
  }
  next();
});

console.log("Environment check:");
console.log("- POSTGRES_URL:", process.env.POSTGRES_URL ? "Defined (Starts with " + process.env.POSTGRES_URL.substring(0, 10) + "...)" : "UNDEFINED");
console.log("- NODE_ENV:", process.env.NODE_ENV);
console.log("- VERCEL:", process.env.VERCEL);

// Debug routes
app.get("/api/ping", (req, res) => res.send("pong"));
app.post("/api/ping", (req, res) => res.json({ method: "POST" }));

// DB 초기화 함수
async function initDB() {
  if (!process.env.POSTGRES_URL) {
    console.warn("⚠️ POSTGRES_URL is missing. Database features will not work.");
    return { success: false, error: "POSTGRES_URL missing" };
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
    console.log("✅ Database tables initialized");
    return { success: true };
  } catch (error: any) {
    console.error("❌ Database initialization failed:", error);
    return { success: false, error: error.message };
  }
}

// 서버 시작 시 DB 초기화 시도
initDB();

// 수동 초기화 엔드포인트
app.get("/api/init-db", async (req, res) => {
  const result = await initDB();
  if (result.success) {
    res.json({ message: "Database tables created or already exist." });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// 1. 회의실 목록 조회
app.get("/api/rooms", async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM rooms ORDER BY "order" ASC`;
    res.json(rows);
  } catch (error: any) {
    console.error("GET /api/rooms error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// 2. 예약 목록 조회
app.get("/api/bookings", async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM bookings`;
    res.json(rows);
  } catch (error: any) {
    console.error("GET /api/bookings error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// 8. 공휴일 조회
app.get("/api/holidays", async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM holidays`;
    res.json(rows);
  } catch (error: any) {
    console.error("GET /api/holidays error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// 3. 예약 추가
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

// 4. 예약 수정
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

// 5. 예약 삭제
app.delete("/api/bookings/:id", async (req, res) => {
  try {
    await sql`DELETE FROM bookings WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. 회의실 동기화
app.post("/api/rooms/sync", async (req, res) => {
  try {
    const rooms = req.body;
    if (!Array.isArray(rooms)) throw new Error("Invalid payload: expected array");
    
    if (!process.env.POSTGRES_URL) throw new Error("Database connection not configured (POSTGRES_URL missing)");

    const currentIds = rooms.map(r => r.id);
    const { rows: existingRooms } = await sql`SELECT id FROM rooms`;
    const idsToDelete = existingRooms.map(r => r.id).filter(id => !currentIds.includes(id));
    
    for (const id of idsToDelete) {
      await sql`DELETE FROM rooms WHERE id = ${id}`;
    }

    for (const room of rooms) {
      await sql`
        INSERT INTO rooms (id, name, color, capacity, "order")
        VALUES (${room.id}, ${room.name}, ${room.color}, ${room.capacity}, ${room.order})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          color = EXCLUDED.color,
          capacity = EXCLUDED.capacity,
          "order" = EXCLUDED."order"
      `;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Room sync error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 7. 공휴일 동기화
app.post("/api/holidays/sync", async (req, res) => {
  try {
    const holidays = req.body;
    if (!Array.isArray(holidays)) throw new Error("Invalid payload: expected array");
    
    if (!process.env.POSTGRES_URL) throw new Error("Database connection not configured (POSTGRES_URL missing)");

    const currentIds = holidays.map(h => h.id);
    const { rows: existingHolidays } = await sql`SELECT id FROM holidays`;
    const idsToDelete = existingHolidays.map(h => h.id).filter(id => !currentIds.includes(id));

    for (const id of idsToDelete) {
      await sql`DELETE FROM holidays WHERE id = ${id}`;
    }

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
    console.error("Holiday sync error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 구버전 호환용
app.post("/api/rooms/upsert", async (req, res) => {
  req.url = "/api/rooms/sync";
  app.handle(req, res);
});
app.post("/api/holidays/upsert", async (req, res) => {
  req.url = "/api/holidays/sync";
  app.handle(req, res);
});

// --- Vite & Static Files ---
async function setupVite() {
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
}

setupVite();

// Local listen logic
if (process.env.NODE_ENV !== "production" || process.env.RENDER || process.env.RUN_LOCAL || !process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

export default app;
