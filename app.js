import express from "express";
import morgan from "morgan";
import requestLogger from "./middleware/requestLogger.js";
import booksRouter from "./routes/books.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(morgan("dev"));
app.use(requestLogger);
app.use(express.json());

app.use("/books", booksRouter);

app.use((req, res) => {
  console.warn(`[App] 404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Route not found" });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`("Server running on http://localhost:${PORT}")`);
  });
}

export default app;
