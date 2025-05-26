import express from "express";
import morgan from "morgan";
import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

import requestLogger from "./middleware/requestLogger.js";
import booksRouter from "./routes/books.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`Created directory: ${UPLOADS_DIR}`);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

app.use(morgan("dev"));
app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/books", booksRouter);

app.get("/", (req, res) => {
  const indexPath = path.join(__dirname, "index.html");
  res.sendFile(indexPath);
});

app.use((req, res) => {
  console.warn(`[App] 404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("[App] Unhandled error:", err);
  res.status(500).json({ error: "Something went wrong!" });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
