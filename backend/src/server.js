import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { requireAuth } from "./middleware/auth.js";
import friendsRouter from "./routes/friends.js";
import graphRouter from "./routes/graph.js";
import groupsRouter from "./routes/groups.js";
import locationRouter from "./routes/location.js";
import placesRouter from "./routes/places.js";
import recommendationsRouter from "./routes/recommendations.js";
import tripsRouter from "./routes/trips.js";
import usersRouter from "./routes/users.js";
import { connectMongo } from "./services/mongoService.js";
import { ensurePlacesCatalog } from "./services/placesCatalogService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : path.resolve(__dirname, "../../frontend/dist");
const isProd = process.env.NODE_ENV === "production";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "drift-backend" });
});

if (!isProd) {
  app.get("/", (_req, res) => {
    res.json({ ok: true, service: "drift-backend" });
  });
}

app.use("/api/trips", requireAuth, tripsRouter);
app.use("/api/location", requireAuth, locationRouter);
app.use("/api/places", requireAuth, placesRouter);
app.use("/api/recommendations", requireAuth, recommendationsRouter);
app.use("/api/friends", requireAuth, friendsRouter);
app.use("/api/groups", requireAuth, groupsRouter);
app.use("/api/groups", graphRouter);
app.use("/api/users", requireAuth, usersRouter);

if (isProd && fs.existsSync(path.join(frontendDist, "index.html"))) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

async function start() {
  try {
    await connectMongo();
    await ensurePlacesCatalog();
  } catch (err) {
    console.warn("[mongo] Skipping connect on boot:", err.message);
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Drift API listening on http://0.0.0.0:${port}`);
    if (isProd) console.log("[static] frontend dist:", frontendDist);
  });
}

start();
