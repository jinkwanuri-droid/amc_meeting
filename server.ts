import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { sql } from "@vercel/postgres";
import apiApp from "./api/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Middleware
  app.use(express.json());

  const debugLogs: string[] = [];
  function logDebug(msg: string) {
    console.log(msg);
    debugLogs.unshift(msg);
    if (debugLogs.length > 50) debugLogs.pop();
  }

  // Request Logging
  app.use((req, res, next) => {
    logDebug(`[REQ] ${req.method} ${req.path} (Original: ${req.originalUrl}) - ${new Date().toISOString()}`);
    next();
  });

  app.get("/debug/logs", (req, res) => {
    res.json({ logs: debugLogs });
  });

  // DB Initialization
  async function initDB() {
    console.log("Checking environment...");
    const hasUrl = !!process.env.POSTGRES_URL;
    if (!hasUrl) {
      console.warn("⚠️ POSTGRES_URL IS NOT DEFINED");
      return;
    }
    try {
      await sql`CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT, capacity INTEGER, "order" INTEGER DEFAULT 0);`;
      await sql`CREATE TABLE IF NOT EXISTS bookings (id SERIAL PRIMARY KEY, title TEXT NOT NULL, room_id TEXT NOT NULL, start_time TIMESTAMP WITH TIME ZONE NOT NULL, end_time TIMESTAMP WITH TIME ZONE NOT NULL, organizer TEXT, project_name TEXT, description TEXT, color TEXT);`;
      
      // Migration: Add project_name if it doesn't exist
      try {
        await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS project_name TEXT;`;
      } catch (err) {
        console.warn("Migration notice: project_name column might already exist or table is empty.");
      }

      await sql`CREATE TABLE IF NOT EXISTS holidays (id TEXT PRIMARY KEY, name TEXT NOT NULL, date DATE NOT NULL);`;
      await sql`CREATE TABLE IF NOT EXISTS activity_log (id SERIAL PRIMARY KEY, action TEXT NOT NULL, timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);`;
      console.log("✅ DB Initialization successful");
    } catch (e: any) {
      console.error("❌ DB Initialization failed:", e.message);
    }
  }
  await initDB();

  // Mount API from api/index.ts to avoid duplication and ensure consistency
  // apiApp internally defines routes with `/api/...` prefix
  app.use(apiApp);

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
