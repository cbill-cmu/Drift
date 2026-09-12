/**
 * Apply synthetic fog coverage to an existing Atlas group without wiping
 * accounts. Only deletes prior rows tagged source: "seed" for that group's
 * members, then inserts fresh traces + cells. Live GPS rows are left alone.
 *
 * Usage:
 *   npm run seed:coverage
 *   npm run seed:coverage -- --group "CMU CREW"
 */
import "dotenv/config";
import { MongoClient } from "mongodb";
import { COLLECTIONS, DB_NAME, INDEXES } from "../mongodb-schema.js";
import { generateCoverage } from "./generate-coverage.js";

function argValue(flag, fallback) {
  const args = process.argv.slice(2);
  const i = args.indexOf(flag);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return fallback;
}

async function ensureIndexes(db) {
  for (const spec of INDEXES.location_traces || []) {
    await db.collection(COLLECTIONS.LOCATION_TRACES).createIndex(spec.key, {
      unique: Boolean(spec.unique),
    });
  }
  for (const spec of INDEXES.user_visited_cells || []) {
    await db.collection(COLLECTIONS.USER_VISITED_CELLS).createIndex(spec.key, {
      unique: Boolean(spec.unique),
    });
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Set MONGODB_URI in shared/mongodb-seed/.env");
    process.exit(1);
  }

  const groupName = argValue("--group", "CMU CREW");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || DB_NAME);

  const group = await db.collection(COLLECTIONS.GROUPS).findOne({ name: groupName });
  if (!group) {
    const names = await db.collection(COLLECTIONS.GROUPS).find({}).project({ name: 1 }).toArray();
    console.error(`No group named "${groupName}". Existing:`, names.map((g) => g.name));
    process.exit(1);
  }

  const memberIds = group.member_ids || [];
  if (!memberIds.length) {
    console.error("Group has no members");
    process.exit(1);
  }

  const users = memberIds.map((id, i) => ({ _localId: `user_${i}`, _id: id }));
  const coverage = generateCoverage(users);
  const byLocal = new Map(users.map((u) => [u._localId, u._id]));

  await ensureIndexes(db);

  const tracesColl = db.collection(COLLECTIONS.LOCATION_TRACES);
  const cellsColl = db.collection(COLLECTIONS.USER_VISITED_CELLS);
  const seedFilter = { source: "seed", user_id: { $in: memberIds } };
  const deletedTraces = await tracesColl.deleteMany(seedFilter);
  const deletedCells = await cellsColl.deleteMany(seedFilter);

  const traces = coverage.location_traces.map((row) => {
    const { _localId, ...rest } = row;
    return {
      ...rest,
      user_id: byLocal.get(row.user_id),
      started_at: new Date(row.started_at),
      ended_at: new Date(row.ended_at),
      created_at: new Date(),
    };
  });
  const cells = coverage.user_visited_cells.map((row) => ({
    ...row,
    user_id: byLocal.get(row.user_id),
    first_visited_at: new Date(row.first_visited_at),
    last_visited_at: new Date(row.last_visited_at),
  }));

  if (traces.length) await tracesColl.insertMany(traces);
  if (cells.length) {
    try {
      await cellsColl.insertMany(cells);
    } catch (err) {
      if (err?.code !== 11000) throw err;
      for (const cell of cells) {
        await cellsColl.updateOne(
          { user_id: cell.user_id, h3_cell: cell.h3_cell },
          {
            $inc: { visit_count: cell.visit_count },
            $max: { last_visited_at: cell.last_visited_at },
            $setOnInsert: {
              first_visited_at: cell.first_visited_at,
              user_id: cell.user_id,
              h3_cell: cell.h3_cell,
              source: "seed",
            },
          },
          { upsert: true }
        );
      }
    }
  }

  const uniqueCells = new Set(cells.map((c) => c.h3_cell));
  console.log("[seed:coverage] group", groupName, String(group._id));
  console.log("[seed:coverage] members", memberIds.length);
  console.log("[seed:coverage] removed old seed rows", {
    traces: deletedTraces.deletedCount,
    cells: deletedCells.deletedCount,
  });
  console.log("[seed:coverage] inserted", {
    traces: traces.length,
    cells: cells.length,
    unique_h3: uniqueCells.size,
  });
  console.log("[seed:coverage] Live GPS rows were not deleted. Lawrenceville / South Side stay fogged.");

  await client.close();
}

main().catch((err) => {
  console.error("[seed:coverage] FAILED:", err);
  process.exit(1);
});
