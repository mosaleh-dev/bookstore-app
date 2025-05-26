import mongoose from "mongoose";

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    author: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: false,
    },
    coverImage: {
      type: String, // Stores the path to the image, e.g., "uploads/coverImage-12345.jpg"
      required: false,
    },
  },
  { timestamps: true },
);

const Book = mongoose.model("Book", bookSchema);

export { Book };
