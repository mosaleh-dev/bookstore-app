import * as bookService from "../services/bookService.js";
import mongoose from "mongoose";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const createBookController = async (req, res) => {
  console.log("[Book Controller] Handling POST /");
  const { title, author, year } = req.body;
  const userId = req.user.id;
  // Normalize the file path for the uploaded cover image to use forward slashes
  const coverImagePath = req.file
    ? req.file.path.replace(/\\/g, "/")
    : undefined;

  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }

  try {
    const bookData = { title, author, year, coverImage: coverImagePath };
    const newBook = await bookService.createBook(bookData, userId);
    res.status(201).json(newBook);
  } catch (error) {
    if (error.message.includes("Year must be a number")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    console.error("[Book Controller] Error creating book:", error);
    if (coverImagePath) bookService.deleteUploadedFile(coverImagePath);
    res.status(500).json({ error: error.message || "Failed to create book" });
  }
};

export const getAllBooksController = async (req, res) => {
  console.log("[Book Controller] Handling GET /");
  const { id: userId, role: userRole } = req.user;

  try {
    const books = await bookService.getBooks(userId, userRole);
    res.json(books);
  } catch (error) {
    console.error("[Book Controller] Error fetching books:", error);
    res.status(500).json({ error: "Failed to fetch books" });
  }
};

export const getBookByIdController = async (req, res) => {
  const bookId = req.params.id;
  const { id: userId, role: userRole } = req.user;
  console.log(`[Book Controller] Handling GET /${bookId}`);

  if (!isValidObjectId(bookId)) {
    return res.status(400).json({ error: "Invalid Book ID format" });
  }

  try {
    const book = await bookService.getBookByIdForUser(bookId, userId, userRole);
    if (!book) {
      return res.status(404).json({ error: "Book not found or access denied" });
    }
    res.json(book);
  } catch (error) {
    console.error(`[Book Controller] Error fetching book ${bookId}:`, error);
    if (error.message === "Access Denied") {
      return res.status(403).json({ error: "Access Denied" });
    }
    res.status(500).json({ error: "Failed to fetch book" });
  }
};

export const updateBookController = async (req, res) => {
  const bookId = req.params.id;
  console.log(`[Book Controller] Handling PUT /${bookId}`);
  const { title, author, year, coverImage: coverImageAction } = req.body;
  const { id: userId, role: userRole } = req.user;
  const newCoverImagePath = req.file
    ? req.file.path.replace(/\\/g, "/")
    : undefined;

  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }
  if (!isValidObjectId(bookId)) {
    if (newCoverImagePath) bookService.deleteUploadedFile(newCoverImagePath);
    return res.status(400).json({ error: "Invalid Book ID format" });
  }

  try {
    const updateData = { title, author, year, coverImageAction };
    const updatedBook = await bookService.updateBook(
      bookId,
      updateData,
      userId,
      userRole,
      newCoverImagePath,
    );
    if (!updatedBook) {
      if (newCoverImagePath) bookService.deleteUploadedFile(newCoverImagePath);
      return res.status(404).json({ error: "Book not found or update failed" });
    }
    res.json(updatedBook);
  } catch (error) {
    if (newCoverImagePath) bookService.deleteUploadedFile(newCoverImagePath);
    console.error(`[Book Controller] Error updating book ${bookId}:`, error);
    if (error.message === "Book not found" || error.status === 404) {
      return res.status(404).json({ error: "Book not found" });
    }
    if (error.message === "Access Denied" || error.status === 403) {
      return res
        .status(403)
        .json({ error: "Access Denied: You do not own this book." });
    }
    if (
      error.message.includes("Year must be a number") ||
      error.name === "ValidationError"
    ) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Failed to update book" });
  }
};

export const deleteBookController = async (req, res) => {
  const bookId = req.params.id;
  const { role: userRole } = req.user;

  console.log(`[Book Controller] Handling DELETE /${bookId}`);

  if (!isValidObjectId(bookId)) {
    return res.status(400).json({ error: "Invalid Book ID format" });
  }

  try {
    const result = await bookService.deleteBookAsAdmin(bookId, userRole);
    if (!result) {
      return res.status(404).json({ error: "Book not found" });
    }
    res.status(200).json({
      message: "Book deleted successfully",
      deletedBook: result.deletedBook,
    });
  } catch (error) {
    console.error(`[Book Controller] Error deleting book ${bookId}:`, error);
    if (error.message === "Book not found") {
      return res.status(404).json({ error: "Book not found" });
    }
    if (error.message === "Access Denied") {
      return res
        .status(403)
        .json({ error: "Access Denied: Only admins can delete books." });
    }
    res.status(500).json({ error: "Failed to delete book" });
  }
};
