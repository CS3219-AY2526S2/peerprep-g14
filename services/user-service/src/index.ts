import express, { type Application } from "express";
import cors, { type CorsOptions } from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import userRouter from "./routes/user.js";
import adminRouter from "./routes/admin.js";
import authRouter from "./routes/auth.js";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3001;

const corsOptions: CorsOptions = {
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

// Mount route modules
app.use(userRouter);
app.use(adminRouter);
app.use(authRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
