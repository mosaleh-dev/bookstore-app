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
      type: String,
      required: false,
    },
  },
  { timestamps: true },
);

const Book = mongoose.model("Book", bookSchema);

export { Book };
