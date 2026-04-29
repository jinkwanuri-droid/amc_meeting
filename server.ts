import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Server-side client (Admin role)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin: any = null;
if (supabaseUrl && supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // 1. 회의실 목록 조회
  app.get("/api/rooms", async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('rooms')
        .select('*')
        .order('order', { ascending: true });
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 2. 예약 목록 조회
  app.get("/api/bookings", async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.from('bookings').select('*');
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 3. 예약 추가
  app.post("/api/bookings", async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.from('bookings').insert([req.body]).select();
      if (error) throw error;
      res.json(data[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 4. 예약 수정
  app.put("/api/bookings/:id", async (req, res) => {
    try {
      const { error } = await supabaseAdmin.from('bookings').update(req.body).eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 5. 예약 삭제
  app.delete("/api/bookings/:id", async (req, res) => {
    try {
      const { error } = await supabaseAdmin.from('bookings').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 6. 회의실 추가/업데이트 (Upsert)
  app.post("/api/rooms/upsert", async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.from('rooms').upsert(req.body).select();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 7. 회의실 삭제
  app.delete("/api/rooms/:id", async (req, res) => {
    try {
      const { error } = await supabaseAdmin.from('rooms').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 8. 공휴일 조회
  app.get("/api/holidays", async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.from('holidays').select('*');
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 9. 공휴일 추가/업데이트
  app.post("/api/holidays/upsert", async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.from('holidays').upsert(req.body).select();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 10. 공휴일 삭제
  app.delete("/api/holidays/:id", async (req, res) => {
    try {
      const { error } = await supabaseAdmin.from('holidays').delete().eq('id', req.params.id);
      if (error) throw error;
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
