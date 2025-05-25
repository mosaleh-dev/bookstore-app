import express from "express";
import {
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
} from "../controllers/book.js";

const router = express.Router();

router.use((req, res, next) => {
  console.log(
    `([Books Router Middleware] Processing request for path: ${req.originalUrl})`,
  );
  next();
});

router.get("/", getAllBooks);

router.get("/:id", getBookById);

router.post("/", createBook);

router.put("/:id", updateBook);

router.delete("/:id", deleteBook);

export default router;
