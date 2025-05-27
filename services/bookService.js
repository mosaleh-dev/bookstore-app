import { Book } from "../models/book.js";
import { User } from "../models/user.js";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

export const createBook = async (bookData, userId) => {
  const { title, author, year, coverImage } = bookData;

  if (!title || !author) {
    if (coverImage) deleteUploadedFile(coverImage);
    throw new Error("Missing required fields: title, author");
  }

  let parsedYear;
  if (year !== undefined && year !== null && String(year).trim() !== "") {
    parsedYear = Number(year);
    if (isNaN(parsedYear)) {
      if (coverImage) deleteUploadedFile(coverImage);
      throw new Error("Year must be a number if provided");
    }
  }

  const newBook = new Book({
    title,
    author,
    year: parsedYear,
    coverImage,
    createdBy: userId,
  });

  try {
    await newBook.save();
    return newBook;
  } catch (error) {
    if (coverImage) deleteUploadedFile(coverImage);
    console.error("[BookService] Error saving book:", error);
    if (error.name === "ValidationError") {
      throw error;
    }
    throw new Error("Failed to save book to database.");
  }
};

export const getBooks = async (userId, userRole) => {
  try {
    if (userRole === "admin") {
      return await Book.find()
        .populate("createdBy", "username")
        .sort({ createdAt: -1 });
    } else {
      return await Book.find({ createdBy: userId })
        .populate("createdBy", "username")
        .sort({ createdAt: -1 });
    }
  } catch (error) {
    console.error("[BookService] Error fetching books:", error);
    throw new Error("Database query failed while fetching books.");
  }
};

export const getBookByIdForUser = async (bookId, userId, userRole) => {
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    throw new Error("Invalid Book ID format");
  }
  try {
    const book = await Book.findById(bookId).populate("createdBy", "username");
    if (!book) {
      return null;
    }
    if (userRole === "admin") {
      return book;
    }
    if (book.createdBy._id.toString() !== userId) {
      return null;
    }
    return book;
  } catch (error) {
    console.error(`[BookService] Error fetching book ${bookId}:`, error);
    throw new Error("Database query failed while fetching book.");
  }
};

export const updateBook = async (
  bookId,
  updateData,
  userId,
  userRole,
  newCoverImagePath,
) => {
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    if (newCoverImagePath) deleteUploadedFile(newCoverImagePath);
    const err = new Error("Invalid Book ID format");
    err.status = 400;
    throw err;
  }

  const existingBook = await Book.findById(bookId);
  if (!existingBook) {
    if (newCoverImagePath) deleteUploadedFile(newCoverImagePath);
    const err = new Error("Book not found");
    err.status = 404;
    throw err;
  }

  if (existingBook.createdBy.toString() !== userId && userRole !== "admin") {
    if (newCoverImagePath) deleteUploadedFile(newCoverImagePath);
    const err = new Error("Access Denied: You do not own this book.");
    err.status = 403;
    throw err;
  }

  const finalUpdatePayload = {};
  if (updateData.title !== undefined)
    finalUpdatePayload.title = updateData.title;
  if (updateData.author !== undefined)
    finalUpdatePayload.author = updateData.author;

  if (updateData.year !== undefined) {
    if (String(updateData.year).trim() === "") {
      finalUpdatePayload.year = undefined;
    } else {
      const parsedYear = Number(updateData.year);
      if (isNaN(parsedYear)) {
        if (newCoverImagePath) deleteUploadedFile(newCoverImagePath);
        const err = new Error("Year must be a number if provided");
        err.status = 400;
        throw err;
      }
      finalUpdatePayload.year = parsedYear;
    }
  }

  let oldImagePathToDelete = null;

  if (newCoverImagePath) {
    if (existingBook.coverImage) {
      oldImagePathToDelete = existingBook.coverImage;
    }
    finalUpdatePayload.coverImage = newCoverImagePath;
  } else if (
    updateData.coverImageAction === "" ||
    updateData.coverImageAction === null
  ) {
    if (existingBook.coverImage) {
      oldImagePathToDelete = existingBook.coverImage;
    }
    finalUpdatePayload.coverImage = null;
  }

  if (Object.keys(finalUpdatePayload).length === 0) {
    if (!newCoverImagePath && updateData.coverImageAction === undefined) {
      const err = new Error("No update data provided");
      err.status = 400;
      throw err;
    }
  }

  try {
    const updatedBook = await Book.findByIdAndUpdate(
      bookId,
      { $set: finalUpdatePayload },
      { new: true, runValidators: true },
    ).populate("createdBy", "username");

    if (!updatedBook) {
      if (newCoverImagePath) deleteUploadedFile(newCoverImagePath);
      const err = new Error("Book not found after update attempt");
      err.status = 404;
      throw err;
    }

    if (
      oldImagePathToDelete &&
      oldImagePathToDelete !== updatedBook.coverImage
    ) {
      deleteUploadedFile(oldImagePathToDelete);
    }
    return updatedBook;
  } catch (dbError) {
    if (newCoverImagePath) deleteUploadedFile(newCoverImagePath);
    console.error("[BookService] Error updating book in DB:", dbError);
    if (dbError.name === "ValidationError") {
      dbError.status = 400;
      throw dbError;
    }
    const err = new Error("Database query failed while updating book.");
    err.status = 500;
    throw err;
  }
};

export const deleteBookAsAdmin = async (bookId, userRole) => {
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    const err = new Error("Invalid Book ID format");
    err.status = 400;
    throw err;
  }

  try {
    const deletedBook = await Book.findByIdAndDelete(bookId);
    if (!deletedBook) {
      const err = new Error("Book not found");
      err.status = 404;
      throw err;
    }

    if (deletedBook.coverImage) {
      deleteUploadedFile(deletedBook.coverImage);
    }
    return { message: "Book deleted successfully", deletedBook };
  } catch (error) {
    console.error(`[BookService] Error deleting book ${bookId}:`, error);
    const err = error.message
      ? new Error(error.message)
      : new Error("Database query failed while deleting book.");
    err.status = error.status ? error.status : 500;
    throw err;
  }
};

export const deleteUploadedFile = (filePath) => {
  if (!filePath) return;
  const fullPath = path.resolve(filePath);
  fs.unlink(fullPath, (err) => {
    if (err) {
      console.error(`[BookService] Error deleting file ${fullPath}:`, err);
    } else {
      console.log(`[BookService] Deleted file ${fullPath}`);
    }
  });
};
