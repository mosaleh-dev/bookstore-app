import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "./app.js";
import { books } from "./models/books.js";

let originalBooksData;

beforeEach(() => {
  originalBooksData = JSON.parse(JSON.stringify(books));
  books.length = 0;
  books.push(...originalBooksData);
});

describe("Bookstore App API CRUD Tests", () => {
  it("GET /books should return all books", async () => {
    const response = await request(app).get("/books");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(originalBooksData.length);
  });

  it("GET /books/:id should return a specific book for a valid ID", async () => {
    const validBookId = 1;

    const response = await request(app).get(`/books/${validBookId}`);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toHaveProperty("id", validBookId);
    expect(response.body).toHaveProperty("title", "The Prophet");
  });

  it("GET /books/:id should return 404 for a non-existent book ID", async () => {
    const invalidBookId = 999;
    const response = await request(app).get(`/books/${invalidBookId}`);
    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({ error: "Book not found" });
  });

  it("POST /books should create a new book", async () => {
    const newBookData = {
      title: "A New Book Title",
      author: "A New Author",
      year: 2023,
    };
    const response = await request(app)
      .post("/books")
      .send(newBookData)
      .set("Accept", "application/json");

    expect(response.status).toBe(201);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toHaveProperty("id");
    expect(response.body).toHaveProperty("title", newBookData.title);
    expect(response.body).toHaveProperty("author", newBookData.author);
    expect(response.body).toHaveProperty("year", newBookData.year);

    const getResponse = await request(app).get("/books");
    expect(getResponse.body.length).toBe(originalBooksData.length + 1);
    expect(
      getResponse.body.find((book) => book.id === response.body.id),
    ).toBeTruthy();
  });

  it("POST /books should return 400 if required fields are missing", async () => {
    const invalidBookData = { author: "No Title Author" };
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
      title: "Title",
      author: "Author",
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
    const bookToUpdateId = 2;
    const updatedData = {
      title: "Season of Migration to the South",
      year: 2000,
    };

    const response = await request(app)
      .put(`/books/${bookToUpdateId}`)
      .send(updatedData)
      .set("Accept", "application/json");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toHaveProperty("id", bookToUpdateId);
    expect(response.body).toHaveProperty("title", updatedData.title);
    expect(response.body).toHaveProperty("author", "Tayeb Salih");
    expect(response.body).toHaveProperty("year", updatedData.year);

    const getResponse = await request(app).get(`/books/${bookToUpdateId}`);
    expect(getResponse.body.title).toBe(updatedData.title);
    expect(getResponse.body.year).toBe(updatedData.year);
  });

  it("PUT /books/:id should return 400 if year is not a number", async () => {
    const bookToUpdateId = 1;
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
    const bookToDeleteId = 3;
    const bookBeforeDelete = books.find((book) => book.id === bookToDeleteId);

    const response = await request(app).delete(`/books/${bookToDeleteId}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toHaveProperty(
      "message",
      "Book deleted successfully",
    );
    expect(response.body).toHaveProperty("deletedBook");
    expect(response.body.deletedBook).toEqual(bookBeforeDelete);
    const getResponse = await request(app).get(`/books/${bookToDeleteId}`);
    expect(getResponse.status).toBe(404);
  });

  it("DELETE /books/:id should return 404 for a non-existent book ID", async () => {
    const invalidBookId = 999;
    const response = await request(app).delete(`/books/${invalidBookId}`);
    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({ error: "Book not found" });
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
