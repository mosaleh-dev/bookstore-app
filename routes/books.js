import express from "express";
import { books, generateNewId } from "../models/books.js";

const router = express.Router();

router.use((req, res, next) => {
  console.log(
    `([Books Router Middleware] Processing request for path: ${req.originalUrl})`,
  );
  next();
});

router.get("/", (req, res) => {
  console.log(`('[Books Router] Handling GET /')`);
  res.json(books);
});

router.get("/:id", (req, res) => {
  const bookId = parseInt(req.params.id, 10);
  console.log(`([Books Router] Handling GET /${bookId})`);

  const book = books.find((book) => book.id === bookId);

  if (book) {
    res.json(book);
  } else {
    res.status(404).json({ error: "Book not found" });
  }
});

router.post("/", (req, res) => {
  console.log(`('[Books Router] Handling POST /')`);
  const newBook = {
    id: generateNewId(),
    title: req.body.title,
    author: req.body.author,
    year: req.body.year,
  };

  if (!newBook.title || !newBook.author) {
    return res
      .status(400)
      .json({ error: "Missing required fields: title, author" });
  }
  if (newBook.year !== undefined && typeof newBook.year !== "number") {
    return res.status(400).json({ error: "Year must be a number if provided" });
  }

  books.push(newBook);
  res.status(201).json(newBook);
});

router.put("/:id", (req, res) => {
  const bookId = parseInt(req.params.id, 10);
  console.log(`([Books Router] Handling PUT /${bookId})`);

  const bookIndex = books.findIndex((book) => book.id === bookId);

  if (bookIndex !== -1) {
    if (req.body.year !== undefined && typeof req.body.year !== "number") {
      return res
        .status(400)
        .json({ error: "Year must be a number if provided" });
    }

    books[bookIndex] = {
      ...books[bookIndex],
      ...req.body,
      id: bookId,
    };

    res.json(books[bookIndex]);
  } else {
    res.status(404).json({ error: "Book not found" });
  }
});

router.delete("/:id", (req, res) => {
  const bookId = parseInt(req.params.id, 10);
  console.log(`([Books Router] Handling DELETE /${bookId})`);

  const bookIndex = books.findIndex((book) => book.id === bookId);

  if (bookIndex !== -1) {
    const [deletedBook] = books.splice(bookIndex, 1);
    res.status(200).json({ message: "Book deleted successfully", deletedBook });
  } else {
    res.status(404).json({ error: "Book not found" });
  }
});

export default router;
