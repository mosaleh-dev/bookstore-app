import { Book } from "../models/book.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getAllBooks = async (req, res) => {
  console.log("[Book Controller] Handling GET /");
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
  console.log(`[Book Controller] Handling GET /${bookId}`);

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
  console.log("[Book Controller] Handling POST /");
  const { title, author, year: yearStr } = req.body;

  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }

  if (!title || !author) {
    return res
      .status(400)
      .json({ error: "Missing required fields: title, author" });
  }

  let parsedYear;
  if (yearStr?.trim()) {
    parsedYear = Number(yearStr);
    if (isNaN(parsedYear)) {
      if (req.file)
        fs.unlink(
          req.file.path,
          (err) => err && console.error("Error deleting uploaded file:", err),
        );
      return res
        .status(400)
        .json({ error: "Year must be a number if provided" });
    }
  }

  try {
    const newBookData = { title, author, year: parsedYear };
    if (req.file) newBookData.coverImage = req.file.path.replace(/\\/g, "/");

    const newBook = new Book(newBookData);
    await newBook.save();
    res.status(201).json(newBook);
  } catch (err) {
    if (req.file)
      fs.unlink(
        req.file.path,
        (unlinkErr) =>
          unlinkErr &&
          console.error("Error deleting uploaded file:", unlinkErr),
      );
    console.error("[Book Controller] Error creating book:", err);
    res
      .status(err.name === "ValidationError" ? 400 : 500)
      .json({ error: err.message || "Internal Server Error" });
  }
};

const updateBook = async (req, res) => {
  const bookId = req.params.id;
  console.log(`[Book Controller] Handling PUT /${bookId}`);
  const updateDataFromRequest = req.body;

  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }

  if (!isValidObjectId(bookId)) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Invalid Book ID format" });
  }

  const finalUpdateData = {};
  if (updateDataFromRequest.title !== undefined)
    finalUpdateData.title = updateDataFromRequest.title;
  if (updateDataFromRequest.author !== undefined)
    finalUpdateData.author = updateDataFromRequest.author;

  if (updateDataFromRequest.year !== undefined) {
    if (!updateDataFromRequest.year?.trim()) {
      finalUpdateData.year = undefined;
    } else {
      const parsedYear = Number(updateDataFromRequest.year);
      if (isNaN(parsedYear)) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res
          .status(400)
          .json({ error: "Year must be a number if provided" });
      }
      finalUpdateData.year = parsedYear;
    }
  }

  let oldImagePath = null;

  try {
    if (req.file) {
      const existingBook = await Book.findById(bookId)
        .select("coverImage")
        .lean();
      if (existingBook?.coverImage) oldImagePath = existingBook.coverImage;
      finalUpdateData.coverImage = req.file.path.replace(/\\/g, "/");
    } else if (
      updateDataFromRequest.coverImage === null ||
      updateDataFromRequest.coverImage === ""
    ) {
      const existingBook = await Book.findById(bookId)
        .select("coverImage")
        .lean();
      if (existingBook?.coverImage) oldImagePath = existingBook.coverImage;
      finalUpdateData.coverImage = undefined;
    }

    if (!Object.keys(finalUpdateData).length && !req.file) {
      return res.status(400).json({ error: "No update data provided" });
    }

    const updatedBook = await Book.findByIdAndUpdate(
      bookId,
      { $set: finalUpdateData },
      { new: true, runValidators: true },
    );

    if (updatedBook) {
      if (
        oldImagePath &&
        (!finalUpdateData.coverImage ||
          oldImagePath !== finalUpdateData.coverImage)
      ) {
        fs.unlink(
          path.resolve(oldImagePath),
          (err) =>
            err &&
            console.error(`[Book Controller] Error deleting old image:`, err),
        );
      }
      res.json(updatedBook);
    } else {
      if (req.file)
        fs.unlink(
          req.file.path,
          (err) => err && console.error("Error deleting uploaded file:", err),
        );
      res.status(404).json({ error: "Book not found" });
    }
  } catch (err) {
    if (req.file)
      fs.unlink(
        req.file.path,
        (unlinkErr) =>
          unlinkErr &&
          console.error("Error deleting uploaded file:", unlinkErr),
      );
    console.error(`[Book Controller] Error updating book ${bookId}:`, err);
    res
      .status(err.name === "ValidationError" ? 400 : 500)
      .json({ error: err.message || "Internal Server Error" });
  }
};

const deleteBook = async (req, res) => {
  const bookId = req.params.id;
  console.log(`[Book Controller] Handling DELETE /${bookId}`);

  if (!isValidObjectId(bookId)) {
    return res.status(400).json({ error: "Invalid Book ID format" });
  }

  try {
    const deletedBook = await Book.findByIdAndDelete(bookId);

    if (deletedBook) {
      if (deletedBook.coverImage) {
        fs.unlink(
          path.resolve(deletedBook.coverImage),
          (err) =>
            err &&
            console.error(`[Book Controller] Error deleting cover image:`, err),
        );
      }
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
