import cors from "cors";
import express from "express";
import helmet from "helmet";
import { getConditions, toHttpError } from "./conditions";

const app = express();
const port = Number(process.env.PORT ?? 8080);

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: true }));

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/v1/conditions", async (req, res) => {
  try {
    const data = await getConditions({
      lat: typeof req.query.lat === "string" ? req.query.lat : undefined,
      lon: typeof req.query.lon === "string" ? req.query.lon : undefined,
      apiKey: process.env.GOOGLE_MAPS_API_KEY,
    });

    res.setHeader("Cache-Control", "public, max-age=1800, stale-while-revalidate=3600");
    res.status(200).json(data);
  } catch (err) {
    const { message, status } = toHttpError(err);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Hayfever API listening on port ${port}`);
});
