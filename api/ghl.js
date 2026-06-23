// Proxy serverless GHL pour la Call Console Klientea.
// Le token reste cote serveur (variable d'env GHL_TOKEN). Contourne le CORS.
// Variables d'environnement Vercel requises : GHL_TOKEN, GHL_LOCATION.

const BASE = "https://services.leadconnectorhq.com";

function headers() {
  return {
    Authorization: "Bearer " + process.env.GHL_TOKEN,
    Version: "2021-07-28",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return await new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => {
      try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); }
    });
  });
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const LOC = process.env.GHL_LOCATION;
  if (!process.env.GHL_TOKEN || !LOC) {
    return res.status(500).json({ error: "Config manquante : definis GHL_TOKEN et GHL_LOCATION dans Vercel." });
  }

  try {
    const url = new URL(req.url, "http://x");
    const action = url.searchParams.get("action") || (req.method === "POST" ? "post" : "");

    // --- LECTURES (GET) ---
    if (action === "pipelines") {
      const r = await fetch(`${BASE}/opportunities/pipelines?locationId=${LOC}`, { headers: headers() });
      return res.status(r.status).json(await r.json());
    }

    if (action === "queue") {
      const pipelineId = url.searchParams.get("pipelineId") || "";
      const stageId = url.searchParams.get("stageId") || "";
      let q = `${BASE}/opportunities/search?location_id=${LOC}&limit=50`;
      if (pipelineId) q += `&pipeline_id=${pipelineId}`;
      if (stageId) q += `&pipeline_stage_id=${stageId}`;
      const r = await fetch(q, { headers: headers() });
      return res.status(r.status).json(await r.json());
    }

    if (action === "contact") {
      const id = url.searchParams.get("id");
      const r = await fetch(`${BASE}/contacts/${id}`, { headers: headers() });
      return res.status(r.status).json(await r.json());
    }

    // --- ECRITURES (POST) ---
    if (req.method === "POST") {
      const b = await readBody(req);

      if (b.action === "note") {
        const r = await fetch(`${BASE}/contacts/${b.contactId}/notes`, {
          method: "POST", headers: headers(), body: JSON.stringify({ body: b.body }),
        });
        return res.status(r.status).json(await r.json());
      }

      if (b.action === "stage") {
        const r = await fetch(`${BASE}/opportunities/${b.opportunityId}`, {
          method: "PUT", headers: headers(), body: JSON.stringify({ pipelineStageId: b.stageId }),
        });
        return res.status(r.status).json(await r.json());
      }

      if (b.action === "tag") {
        const r = await fetch(`${BASE}/contacts/${b.contactId}/tags`, {
          method: "POST", headers: headers(), body: JSON.stringify({ tags: b.tags }),
        });
        return res.status(r.status).json(await r.json());
      }

      return res.status(400).json({ error: "action POST inconnue" });
    }

    return res.status(400).json({ error: "action inconnue" });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
};
