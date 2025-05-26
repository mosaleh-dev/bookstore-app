import { describe, it, expect, beforeEach, afterAll, beforeAll } from "vitest";
import request from "supertest";
import app from "./app.js";
import { Book } from "./models/book.js";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = __dirname;
const uploadsDir = path.join(projectRoot, "uploads");
const testAssetsDir = path.join(__dirname, "test-assets");
const testAssetImageName = "dummy-cover.png";
const testAssetImagePath = path.join(testAssetsDir, testAssetImageName);

const initialBooksData = [
  { title: "The Prophet", author: "Kahlil Gibran", year: 1923 },
  {
    title: "Season of Migration to the North",
    author: "Tayeb Salih",
    year: 1966,
  },
  { title: "Palace Walk", author: "Naguib Mahfouz", year: 1956 },
  { title: "Cities of Salt", author: "Abdul Rahman Munif", year: 1984 },
];

beforeAll(async () => {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(testAssetsDir)) {
    fs.mkdirSync(testAssetsDir, { recursive: true });
  }
  fs.writeFileSync(testAssetImagePath, "dummy image content for testing");
});

beforeEach(async () => {
  await Book.deleteMany({});
  await Book.insertMany(initialBooksData);
  const filesInUploads = fs.readdirSync(uploadsDir);
  for (const file of filesInUploads) {
    try {
      fs.unlinkSync(path.join(uploadsDir, file));
    } catch (err) {
      console.warn(`Could not delete file ${file} during cleanup: ${err}`);
    }
  }
});

afterAll(async () => {
  await mongoose.connection.close();
  if (fs.existsSync(testAssetImagePath)) {
    fs.unlinkSync(testAssetImagePath);
  }
  if (
    fs.existsSync(testAssetsDir) &&
    fs.readdirSync(testAssetsDir).length === 0
  ) {
    fs.rmdirSync(testAssetsDir);
  }
  const filesInUploads = fs.readdirSync(uploadsDir);
  for (const file of filesInUploads) {
    try {
      fs.unlinkSync(path.join(uploadsDir, file));
    } catch (err) {
      console.warn(
        `Could not delete file ${file} during final cleanup: ${err}`,
      );
    }
  }
});

describe("Bookstore App API CRUD Tests", () => {
  it("GET /books should return all books", async () => {
    const response = await request(app).get("/books");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(initialBooksData.length);
    response.body.forEach((book) => {
      expect(book).toHaveProperty("_id");
      expect(book).toHaveProperty("title");
      expect(book).toHaveProperty("author");
    });
  });

  it("GET /books/:id should return a specific book for a valid ID", async () => {
    const book = await Book.findOne({ title: "The Prophet" });
    const validBookId = book._id.toString();
    const response = await request(app).get(`/books/${validBookId}`);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toHaveProperty("_id", validBookId);
    expect(response.body).toHaveProperty("title", "The Prophet");
  });

  it("GET /books/:id should return 404 for a non-existent book ID", async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const response = await request(app).get(`/books/${nonExistentId}`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Book not found" });
  });

  it("GET /books/:id should return 400 for an invalid ID format", async () => {
    const invalidBookId = "not-a-valid-mongoose-id";
    const response = await request(app).get(`/books/${invalidBookId}`);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid Book ID format" });
  });

  it("POST /books should create a new book with title, author, and year", async () => {
    const newBookData = {
      title: "A New Book Title DB",
      author: "A New Author DB",
      year: "2024",
    };
    const initialCount = await Book.countDocuments();
    const response = await request(app)
      .post("/books")
      .field("title", newBookData.title)
      .field("author", newBookData.author)
      .field("year", newBookData.year)
      .set("Accept", "application/json");
    expect(response.status).toBe(201);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toHaveProperty("_id");
    expect(response.body).toHaveProperty("title", newBookData.title);
    expect(response.body).toHaveProperty("author", newBookData.author);
    expect(response.body).toHaveProperty("year", parseInt(newBookData.year));
    const finalCount = await Book.countDocuments();
    expect(finalCount).toBe(initialCount + 1);
    const createdBook = await Book.findById(response.body._id);
    expect(createdBook).toBeTruthy();
    expect(createdBook.title).toBe(newBookData.title);
  });

  it("POST /books should create a new book with an uploaded cover image", async () => {
    const newBookData = {
      title: "Book With Image",
      author: "Author Img",
      year: "2023",
    };
    const initialCount = await Book.countDocuments();
    const response = await request(app)
      .post("/books")
      .field("title", newBookData.title)
      .field("author", newBookData.author)
      .field("year", newBookData.year)
      .attach("coverImage", testAssetImagePath)
      .set("Accept", "application/json");
    expect(response.status).toBe(201);
    expect(response.body.title).toBe(newBookData.title);
    expect(response.body.year).toBe(parseInt(newBookData.year));
    expect(response.body).toHaveProperty("coverImage");
    expect(response.body.coverImage).toMatch(
      /^uploads[\\/]coverImage-\d+\.(png|jpg|jpeg|gif)$/i,
    );
    const imageDiskPath = path.join(projectRoot, response.body.coverImage);
    expect(fs.existsSync(imageDiskPath)).toBe(true);
    const finalCount = await Book.countDocuments();
    expect(finalCount).toBe(initialCount + 1);
    const dbBook = await Book.findById(response.body._id);
    expect(dbBook.coverImage).toBe(response.body.coverImage);
  });

  it("POST /books should create a new book without year", async () => {
    const newBookData = { title: "Book Without Year", author: "Author C" };
    const initialCount = await Book.countDocuments();
    const response = await request(app)
      .post("/books")
      .field("title", newBookData.title)
      .field("author", newBookData.author)
      .set("Accept", "application/json");
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("title", newBookData.title);
    expect(response.body).not.toHaveProperty("year");
    const finalCount = await Book.countDocuments();
    expect(finalCount).toBe(initialCount + 1);
  });

  it("POST /books should return 400 if required fields are missing", async () => {
    const response = await request(app)
      .post("/books")
      .field("author", "No Title Author DB")
      .set("Accept", "application/json");
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Missing required fields: title, author",
    });
  });

  it("POST /books should return 400 if year is not a number", async () => {
    const response = await request(app)
      .post("/books")
      .field("title", "Title DB")
      .field("author", "Author DB")
      .field("year", "not-a-number")
      .set("Accept", "application/json");
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Year must be a number if provided",
    });
  });

  it("PUT /books/:id should update an existing book's text fields and add a cover image", async () => {
    const bookToUpdate = await Book.findOne({
      title: "Season of Migration to the North",
    });
    const bookToUpdateId = bookToUpdate._id.toString();
    const updatedData = {
      title: "Season of Migration to the South (with Image)",
      year: "2001",
    };
    const response = await request(app)
      .put(`/books/${bookToUpdateId}`)
      .field("title", updatedData.title)
      .field("year", updatedData.year)
      .attach("coverImage", testAssetImagePath)
      .set("Accept", "application/json");
    expect(response.status).toBe(200);
    expect(response.body.title).toBe(updatedData.title);
    expect(response.body.year).toBe(parseInt(updatedData.year));
    expect(response.body.author).toBe(bookToUpdate.author);
    expect(response.body).toHaveProperty("coverImage");
    expect(response.body.coverImage).toMatch(
      /^uploads[\\/]coverImage-\d+\.(png|jpg|jpeg|gif)$/i,
    );
    const imageDiskPath = path.join(projectRoot, response.body.coverImage);
    expect(fs.existsSync(imageDiskPath)).toBe(true);
    const getResponse = await request(app).get(`/books/${bookToUpdateId}`);
    expect(getResponse.body.title).toBe(updatedData.title);
    expect(getResponse.body.year).toBe(parseInt(updatedData.year));
    expect(getResponse.body.coverImage).toBe(response.body.coverImage);
  });

  it("PUT /books/:id should update text fields without changing existing cover image if no new image is uploaded", async () => {
    const initialPostResponse = await request(app)
      .post("/books")
      .field("title", "Book With An Image")
      .field("author", "Image Author")
      .attach("coverImage", testAssetImagePath);
    expect(initialPostResponse.status).toBe(201);
    const bookId = initialPostResponse.body._id;
    const originalCoverImage = initialPostResponse.body.coverImage;
    expect(originalCoverImage).toBeDefined();
    const updatedTextData = { title: "Book With An Image (Title Updated)" };
    const putResponse = await request(app)
      .put(`/books/${bookId}`)
      .field("title", updatedTextData.title)
      .set("Accept", "application/json");
    expect(putResponse.status).toBe(200);
    expect(putResponse.body.title).toBe(updatedTextData.title);
    expect(putResponse.body.author).toBe("Image Author");
    expect(putResponse.body.coverImage).toBe(originalCoverImage);
    const imageDiskPath = path.join(projectRoot, originalCoverImage);
    expect(fs.existsSync(imageDiskPath)).toBe(true);
  });

  it("PUT /books/:id should return 404 for a non-existent book ID", async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const response = await request(app)
      .put(`/books/${nonExistentId}`)
      .field("title", "Should Not Update")
      .set("Accept", "application/json");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Book not found" });
  });

  it("PUT /books/:id should return 400 for an invalid ID format", async () => {
    const response = await request(app)
      .put("/books/another-invalid-id")
      .field("title", "Should Not Update");
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid Book ID format" });
  });

  it("PUT /books/:id should return 400 if year is not a number", async () => {
    const bookToUpdate = await Book.findOne({});
    const bookToUpdateId = bookToUpdate._id.toString();
    const response = await request(app)
      .put(`/books/${bookToUpdateId}`)
      .field("year", "bad-year-format")
      .set("Accept", "application/json");
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Year must be a number if provided",
    });
  });

  it("DELETE /books/:id should delete an existing book", async () => {
    const bookToDelete = await Book.findOne({ title: "Palace Walk" });
    const bookToDeleteId = bookToDelete._id.toString();
    const initialCount = await Book.countDocuments();
    const response = await request(app).delete(`/books/${bookToDeleteId}`);
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Book deleted successfully");
    expect(response.body.deletedBook._id).toBe(bookToDeleteId);
    const finalCount = await Book.countDocuments();
    expect(finalCount).toBe(initialCount - 1);
    const getResponse = await request(app).get(`/books/${bookToDeleteId}`);
    expect(getResponse.status).toBe(404);
  });

  it("DELETE /books/:id should return 404 for a non-existent book ID", async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const response = await request(app).delete(`/books/${nonExistentId}`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Book not found" });
  });

  it("DELETE /books/:id should return 400 for an invalid ID format", async () => {
    const response = await request(app).delete("/books/totally-invalid-id");
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid Book ID format" });
  });

  it("GET /nonexistent-route should return 404", async () => {
    const response = await request(app).get("/nonexistent-route");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Route not found" });
  });
});
