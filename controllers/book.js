import { Book } from "../models/book.js";
import mongoose from "mongoose";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getAllBooks = async (req, res) => {
  console.log(`('[Book Controller] Handling GET /')`);
  try {
    const books = await Book.find();
    res.json(books);
  } catch (err) {
    console.error("[Book Controller] Error fetching books:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getBookById = async (req, res) => {
  const bookId = req.params.id;
  console.log(`([Book Controller] Handling GET /${bookId})`);

  if (!isValidObjectId(bookId)) {
    return res.status(400).json({ error: "Invalid Book ID format" });
  }

  try {
    const book = await Book.findById(bookId);
    if (book) {
      res.json(book);
    } else {
      res.status(404).json({ error: "Book not found" });
    }
  } catch (err) {
    console.error(`[Book Controller] Error fetching book ${bookId}:`, err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const createBook = async (req, res) => {
  console.log(`('[Book Controller] Handling POST /')`);
  const { title, author, year, coverImage } = req.body;

  // Basic validation moved to controller
  if (!title || !author) {
    return res
      .status(400)
      .json({ error: "Missing required fields: title, author" });
  }
  if (year !== undefined && typeof year !== "number") {
    return res.status(400).json({ error: "Year must be a number if provided" });
  }

  try {
    const newBook = new Book({
      title,
      author,
      year,
      coverImage,
    });
    await newBook.save();
    res.status(201).json(newBook);
  } catch (err) {
    console.error("[Book Controller] Error creating book:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const updateBook = async (req, res) => {
  const bookId = req.params.id;
  console.log(`([Book Controller] Handling PUT /${bookId})`);
  const updateData = req.body;

  if (!isValidObjectId(bookId)) {
    return res.status(400).json({ error: "Invalid Book ID format" });
  }

  // Validation for update data
  if (updateData.year !== undefined && typeof updateData.year !== "number") {
    return res.status(400).json({ error: "Year must be a number if provided" });
  }

  try {
    const updatedBook = await Book.findByIdAndUpdate(bookId, updateData, {
      new: true,
      runValidators: true,
    });

    if (updatedBook) {
      res.json(updatedBook);
    } else {
      res.status(404).json({ error: "Book not found" });
    }
  } catch (err) {
    console.error(`[Book Controller] Error updating book ${bookId}:`, err);
    // Handle Mongoose validation errors on update if necessary
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const deleteBook = async (req, res) => {
  const bookId = req.params.id;
  console.log(`([Book Controller] Handling DELETE /${bookId})`);

  if (!isValidObjectId(bookId)) {
    return res.status(400).json({ error: "Invalid Book ID format" });
  }

  try {
    const deletedBook = await Book.findByIdAndDelete(bookId);

    if (deletedBook) {
      res
        .status(200)
        .json({ message: "Book deleted successfully", deletedBook });
    } else {
      res.status(404).json({ error: "Book not found" });
    }
  } catch (err) {
    console.error(`[Book Controller] Error deleting book ${bookId}:`, err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export { getAllBooks, getBookById, createBook, updateBook, deleteBook };
