// ==== START ./app.test.js ====
import { describe, it, expect, beforeEach, afterAll } from "vitest"; // Import afterAll
import request from "supertest";
import app from "./app.js";
import { Book } from "./models/book.js"; // Import the Mongoose Book model
import mongoose from "mongoose"; // Import mongoose to manage connection in tests

// Original data structure for seeding the database
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

// Use a separate test database or clear carefully
// Connecting happens in app.js, ensure it's connected before tests run
// We'll use the connection established by app.js

beforeEach(async () => {
  // Clear the test database collection
  await Book.deleteMany({});
  // Insert initial data
  await Book.insertMany(initialBooksData);
});

// Optional: Close the Mongoose connection after all tests are done
afterAll(async () => {
  await mongoose.connection.close();
});

describe("Bookstore App API CRUD Tests with MongoDB", () => {
  it("GET /books should return all books", async () => {
    const response = await request(app).get("/books");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(initialBooksData.length);
    response.body.forEach((book) => {
      expect(book).toHaveProperty("_id"); // Expect _id from Mongoose
      expect(book).toHaveProperty("title");
      expect(book).toHaveProperty("author");
    });
  });

  it("GET /books/:id should return a specific book for a valid ID", async () => {
    const book = await Book.findOne({ title: "The Prophet" });
    const validBookId = book._id.toString(); // Get Mongoose ObjectId string

    const response = await request(app).get(`/books/${validBookId}`);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toHaveProperty("_id", validBookId); // Expect _id
    expect(response.body).toHaveProperty("title", "The Prophet");
  });

  it("GET /books/:id should return 404 for a non-existent book ID", async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const response = await request(app).get(`/books/${nonExistentId}`);
    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({ error: "Book not found" });
  });

  it("GET /books/:id should return 400 for an invalid ID format", async () => {
    const invalidBookId = "not-a-valid-mongoose-id";
    const response = await request(app).get(`/books/${invalidBookId}`);
    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({ error: "Invalid Book ID format" });
  });

  it("POST /books should create a new book", async () => {
    const newBookData = {
      title: "A New Book Title DB",
      author: "A New Author DB",
      year: 2024,
    };
    const initialCount = await Book.countDocuments();

    const response = await request(app)
      .post("/books")
      .send(newBookData)
      .set("Accept", "application/json");

    expect(response.status).toBe(201);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toHaveProperty("_id"); // Expect _id
    expect(response.body).toHaveProperty("title", newBookData.title);
    expect(response.body).toHaveProperty("author", newBookData.author);
    expect(response.body).toHaveProperty("year", newBookData.year);

    const finalCount = await Book.countDocuments();
    expect(finalCount).toBe(initialCount + 1);

    // Verify the book exists in the database
    const createdBook = await Book.findById(response.body._id);
    expect(createdBook).toBeTruthy();
    expect(createdBook.title).toBe(newBookData.title);
  });

  it("POST /books should create a new book without year", async () => {
    const newBookData = {
      title: "Book Without Year",
      author: "Author C",
    };
    const initialCount = await Book.countDocuments();

    const response = await request(app)
      .post("/books")
      .send(newBookData)
      .set("Accept", "application/json");

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("_id");
    expect(response.body).toHaveProperty("title", newBookData.title);
    expect(response.body).toHaveProperty("author", newBookData.author);
    expect(response.body).not.toHaveProperty("year"); // Expect year to be missing

    const finalCount = await Book.countDocuments();
    expect(finalCount).toBe(initialCount + 1);
  });

  it("POST /books should create a new book with coverImage (string path)", async () => {
    const newBookData = {
      title: "Book With Cover",
      author: "Author D",
      coverImage: "/uploads/book-cover-123.jpg", // Include coverImage
    };
    const initialCount = await Book.countDocuments();

    const response = await request(app)
      .post("/books")
      .send(newBookData)
      .set("Accept", "application/json");

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("_id");
    expect(response.body).toHaveProperty("title", newBookData.title);
    expect(response.body).toHaveProperty("author", newBookData.author);
    expect(response.body).toHaveProperty("coverImage", newBookData.coverImage); // Check coverImage

    const finalCount = await Book.countDocuments();
    expect(finalCount).toBe(initialCount + 1);
  });

  it("POST /books should return 400 if required fields are missing", async () => {
    const invalidBookData = { author: "No Title Author DB" };
    const response = await request(app)
      .post("/books")
      .send(invalidBookData)
      .set("Accept", "application/json");

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({
      error: "Missing required fields: title, author",
    });
  });

  it("POST /books should return 400 if year is not a number", async () => {
    const invalidBookData = {
      title: "Title DB",
      author: "Author DB",
      year: "not a number",
    };
    const response = await request(app)
      .post("/books")
      .send(invalidBookData)
      .set("Accept", "application/json");

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({
      error: "Year must be a number if provided",
    });
  });

  it("PUT /books/:id should update an existing book", async () => {
    const bookToUpdate = await Book.findOne({
      title: "Season of Migration to the North",
    });
    const bookToUpdateId = bookToUpdate._id.toString();

    const updatedData = {
      title: "Season of Migration to the South DB",
      year: 2001,
      coverImage: "/uploads/new-cover.png",
    };

    const response = await request(app)
      .put(`/books/${bookToUpdateId}`)
      .send(updatedData)
      .set("Accept", "application/json");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toHaveProperty("_id", bookToUpdateId); // Expect _id
    expect(response.body).toHaveProperty("title", updatedData.title);
    expect(response.body).toHaveProperty("author", bookToUpdate.author); // Author should remain the same if not updated
    expect(response.body).toHaveProperty("year", updatedData.year);
    expect(response.body).toHaveProperty("coverImage", updatedData.coverImage);

    const getResponse = await request(app).get(`/books/${bookToUpdateId}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.title).toBe(updatedData.title);
    expect(getResponse.body.year).toBe(updatedData.year);
    expect(getResponse.body.coverImage).toBe(updatedData.coverImage);
  });

  it("PUT /books/:id should return 404 for a non-existent book ID", async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const updatedData = { title: "Should Not Update" };

    const response = await request(app)
      .put(`/books/${nonExistentId}`)
      .send(updatedData)
      .set("Accept", "application/json");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({ error: "Book not found" });
  });

  it("PUT /books/:id should return 400 for an invalid ID format", async () => {
    const invalidBookId = "another-invalid-id";
    const updatedData = { title: "Should Not Update" };
    const response = await request(app)
      .put(`/books/${invalidBookId}`)
      .send(updatedData);
    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({ error: "Invalid Book ID format" });
  });

  it("PUT /books/:id should return 400 if year is not a number", async () => {
    const bookToUpdate = await Book.findOne({});
    const bookToUpdateId = bookToUpdate._id.toString();

    const updatedData = { year: "bad year" };

    const response = await request(app)
      .put(`/books/${bookToUpdateId}`)
      .send(updatedData)
      .set("Accept", "application/json");

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toContain("application/json");
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
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toHaveProperty(
      "message",
      "Book deleted successfully",
    );
    expect(response.body).toHaveProperty("deletedBook");
    // Mongoose deleted document might have extra fields, check key properties
    expect(response.body.deletedBook).toHaveProperty("_id", bookToDeleteId);
    expect(response.body.deletedBook).toHaveProperty(
      "title",
      bookToDelete.title,
    );

    const finalCount = await Book.countDocuments();
    expect(finalCount).toBe(initialCount - 1);

    const getResponse = await request(app).get(`/books/${bookToDeleteId}`);
    expect(getResponse.status).toBe(404);
  });

  it("DELETE /books/:id should return 404 for a non-existent book ID", async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const response = await request(app).delete(`/books/${nonExistentId}`);
    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({ error: "Book not found" });
  });

  it("DELETE /books/:id should return 400 for an invalid ID format", async () => {
    const invalidBookId = "totally-invalid-id";
    const response = await request(app).delete(`/books/${invalidBookId}`);
    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({ error: "Invalid Book ID format" });
  });

  it("GET /nonexistent-route should return 404", async () => {
    const response = await request(app).get("/nonexistent-route");
    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({ error: "Route not found" });
  });

  it("POST /nonexistent-route should return 404", async () => {
    const response = await request(app).post("/nonexistent-route").send({});
    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({ error: "Route not found" });
  });
});
