import express from "express";
import morgan from "morgan";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

import requestLogger from "./middleware/requestLogger.js";
import booksRouter from "./routes/books.js";

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('("MongoDB connected successfully")'))
  .catch((err) => {
    console.error('("MongoDB connection error:", err)');
    process.exit(1);
  });

app.use(morgan("dev"));
app.use(requestLogger);
app.use(express.json());

app.use("/books", booksRouter);

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
    console.log(`("Server running on http://localhost:${PORT}")`);
  });
}

export default app;
