import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { env } from "./config/env.js";
import { requestId } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/error.js";
import { notFoundHandler } from "./middleware/notFound.js";
import authRouter from "./modules/auth/auth.routes.js";

const app: Application = express();

app.use(requestId);
app.use(requestLogger);
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGINS }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;