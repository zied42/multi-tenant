// src/app.ts
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";

const app: Application = express();

app.use(helmet());
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

export default app;