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

  app.use(express.json());

  // --- API Routes (Vercel Postgres) ---

  // DB 초기화 지원 (테이블 생성)
  app.get("/api/init-db", async (req, res) => {
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
      res.json({ message: "Database tables created or already exist." });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 1. 회의실 목록 조회
  app.get("/api/rooms", async (req, res) => {
    try {
      const { rows } = await sql`SELECT * FROM rooms ORDER BY "order" ASC`;
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 2. 예약 목록 조회
  app.get("/api/bookings", async (req, res) => {
    try {
      const { rows } = await sql`SELECT * FROM bookings`;
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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

  // 6. 회의실 추가/업데이트 (Upsert)
  app.post("/api/rooms/upsert", async (req, res) => {
    try {
      const rooms = req.body; // Expecting array
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
      res.status(500).json({ error: error.message });
    }
  });

  // 7. 회의실 삭제
  app.delete("/api/rooms/:id", async (req, res) => {
    try {
      await sql`DELETE FROM rooms WHERE id = ${req.params.id}`;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 8. 공휴일 조회
  app.get("/api/holidays", async (req, res) => {
    try {
      const { rows } = await sql`SELECT * FROM holidays`;
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 9. 공휴일 추가/업데이트
  app.post("/api/holidays/upsert", async (req, res) => {
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

  // 10. 공휴일 삭제
  app.delete("/api/holidays/:id", async (req, res) => {
    try {
      await sql`DELETE FROM holidays WHERE id = ${req.params.id}`;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Vite & Static Files ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // 프로덕션 환경에서는 빌드된 정적 파일 서빙
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  return app;
}

export default startServer();
