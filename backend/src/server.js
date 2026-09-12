import "dotenv/config";
import cors from "cors";
import express from "express";

import { requireAuth } from "./middleware/auth.js";
import friendsRouter from "./routes/friends.js";
import graphRouter from "./routes/graph.js";
import tripsRouter from "./routes/trips.js";
import { connectMongo } from "./services/mongoService.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "drift-backend" });
});

// Protected MVP routes (Person 1 implements handlers)
app.use("/api/trips", requireAuth, tripsRouter);
app.use("/api/friends", requireAuth, friendsRouter);
app.use("/api/groups", graphRouter);

async function start() {
  try {
    await connectMongo();
  } catch (err) {
    console.warn("[mongo] Skipping connect on boot:", err.message);
  }

  app.listen(port, () => {
    console.log(`Drift API listening on http://localhost:${port}`);
  });
}

start();
