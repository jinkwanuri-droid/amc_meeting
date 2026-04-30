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

  // DB 초기화 함수
  async function initDB() {
    if (!process.env.POSTGRES_URL) {
      console.warn("⚠️ POSTGRES_URL is missing. Database features will not work.");
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
      console.log("✅ Database tables initialized");
    } catch (error) {
      console.error("❌ Database initialization failed:", error);
    }
  }

  // 서버 시작 시 DB 초기화 시도
  initDB();

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

  // 8. 공휴일 조회 (RESTORED)
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

  // 6. 회의실 동기화 (전체 목록을 받아 삭제/추가/수정 한꺼번에 처리)
  app.post("/api/rooms/sync", async (req, res) => {
    try {
      const rooms = req.body;
      if (!Array.isArray(rooms)) throw new Error("Invalid payload: expected array");
      
      if (!process.env.POSTGRES_URL) throw new Error("Database connection not configured (POSTGRES_URL missing)");

      // 1. 모든 회의실 삭제 (트랜잭션 대신)
      // 데이터가 적고 예약 데이터는 room_id(TEXT)를 참조하므로 
      // ON CONFLICT를 쓰기 전에 먼저 현재 세션에 없는 것들을 지움
      const currentIds = rooms.map(r => r.id);
      
      // 안전한 삭제를 위해 루프를 돌거나 복잡한 쿼리 대신 단순화:
      // 먼저 모든 회의실을 가져와서 삭제할 대상을 찾음
      const { rows: existingRooms } = await sql`SELECT id FROM rooms`;
      const idsToDelete = existingRooms
        .map(r => r.id)
        .filter(id => !currentIds.includes(id));
      
      for (const id of idsToDelete) {
        await sql`DELETE FROM rooms WHERE id = ${id}`;
      }

      // 2. 전달된 목록 Upsert
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
      const idsToDelete = existingHolidays
        .map(h => h.id)
        .filter(id => !currentIds.includes(id));

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

  // 구버전 호환성을 위해 upsert 라우트 유지 (내부적으로 sync가 이미 같은 로직이므로 공용 사용 가능하나, TS 에러 방지를 위해 간단히 래핑)
  app.post("/api/rooms/upsert", async (req, res) => {
    try {
      const rooms = req.body;
      if (!Array.isArray(rooms)) throw new Error("Invalid payload: expected array");
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
            name = EXCLUDED.name, color = EXCLUDED.color, capacity = EXCLUDED.capacity, "order" = EXCLUDED."order"
        `;
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/holidays/upsert", async (req, res) => {
    try {
      const holidays = req.body;
      if (!Array.isArray(holidays)) throw new Error("Invalid payload: expected array");
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
            name = EXCLUDED.name, date = EXCLUDED.date
        `;
      }
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
