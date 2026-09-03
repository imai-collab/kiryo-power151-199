import express from "express";
import fs from "fs/promises";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API Route to save puzzles
  app.post("/api/save-puzzles", async (req, res) => {
    try {
      const { puzzles } = req.body;
      const jsonPath = path.join(process.cwd(), "src", "puzzles.json");
      await fs.writeFile(jsonPath, JSON.stringify(puzzles, null, 2), "utf-8");
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to save puzzles:", error);
      res.status(500).json({ error: "Failed to save puzzles" });
    }
  });

  // API Route to load puzzles (optional, but good to ensure latest file data)
  app.get("/api/puzzles", async (req, res) => {
    try {
      const jsonPath = path.join(process.cwd(), "src", "puzzles.json");
      const data = await fs.readFile(jsonPath, "utf-8");
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.send(data);
    } catch (error) {
      res.status(404).json({ error: "No puzzles found" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Note: since this app is SPA but Express v4, we use `app.get('*',`
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
