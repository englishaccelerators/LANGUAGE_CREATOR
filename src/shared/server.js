// server.js
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" })); // allow big batches

// DEMO store (replace with your DB)
const DB = new Map(); // key = identifiercode

// POST /stage1/text:upsert
app.post("/stage1/text:upsert", async (req, res) => {
  try {
    const { language, tenant, reason, rows } = req.body || {};
    if (!language || !reason || !Array.isArray(rows)) {
      return res.status(400).json({ ok:false, error:"Bad payload" });
    }
    let saved = 0;
    for (const r of rows) {
      if (!r?.identifiercode) continue;
      DB.set(r.identifiercode, {
        ...r,
        language,
        tenant,
        reason,
        updatedAt: Date.now(),
      });
      saved++;
    }
    return res.json({ ok:true, saved });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:String(e) });
  }
});

// Start on 8000 (StackBlitz will expose it)
const PORT = 8000;
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
