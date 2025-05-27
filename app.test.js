// ./app.test.js
import { describe, it, expect, beforeEach, afterAll, beforeAll } from "vitest";
import request from "supertest";
import app from "./app.js"; // Your Express app
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { User } from "./models/user.js";
import { Book } from "./models/book.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = __dirname; // Assuming app.test.js is in the project root
const uploadsDir = path.join(projectRoot, "uploads");
const testAssetsDir = path.join(projectRoot, "test-assets");
const testImageName = "test-cover.png";
const testImagePath = path.join(testAssetsDir, testImageName);

// Helper function to register and login a user
async function registerAndLogin(userData) {
  // Register user
  await request(app).post("/auth/register").send(userData);

  // Login user
  const loginResponse = await request(app).post("/auth/login").send({
    username: userData.username,
    password: userData.password,
  });
  expect(loginResponse.status).toBe(200);
  expect(loginResponse.body.token).toBeDefined();
  return {
    token: loginResponse.body.token,
    userId: loginResponse.body.userId,
    role: loginResponse.body.role,
  };
}

beforeAll(async () => {
  // Ensure test directories exist
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(testAssetsDir)) {
    fs.mkdirSync(testAssetsDir, { recursive: true });
  }
  // Create a dummy image file for testing uploads
  if (!fs.existsSync(testImagePath)) {
    fs.writeFileSync(testImagePath, "dummy image content for testing");
  }
});

beforeEach(async () => {
  // Clear database collections
  await User.deleteMany({});
  await Book.deleteMany({});

  // Clear uploads directory
  const filesInUploads = fs.readdirSync(uploadsDir);
  for (const file of filesInUploads) {
    try {
      fs.unlinkSync(path.join(uploadsDir, file));
    } catch (err) {
      console.warn(
        `Could not delete file ${file} during beforeEach cleanup: ${err.message}`,
      );
    }
  }
});

afterAll(async () => {
  // Clean up test assets
  if (fs.existsSync(testImagePath)) {
    try {
      fs.unlinkSync(testImagePath);
    } catch (err) {
      console.warn(
        `Could not delete test image ${testImagePath}: ${err.message}`,
      );
    }
  }
  if (
    fs.existsSync(testAssetsDir) &&
    fs.readdirSync(testAssetsDir).length === 0
  ) {
    try {
      fs.rmdirSync(testAssetsDir);
    } catch (err) {
      console.warn(
        `Could not remove test assets dir ${testAssetsDir}: ${err.message}`,
      );
    }
  }
  // Keep uploads directory for next runs, but it should be empty due to beforeEach

  // Close MongoDB connection
  await mongoose.connection.close();
});

describe("Authentication API", () => {
  it("POST /auth/register - should register a new user successfully", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ username: "testuser", password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("User registered successfully");
    expect(res.body.userId).toBeDefined();
  });

  it("POST /auth/register - should fail to register with an existing username", async () => {
    await request(app)
      .post("/auth/register")
      .send({ username: "testuser", password: "password123" }); // First registration
    const res = await request(app)
      .post("/auth/register")
      .send({ username: "testuser", password: "password456" }); // Second attempt
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Username already exists.");
  });

  it("POST /auth/register - should fail with validation errors (e.g., short password)", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ username: "newuser", password: "123" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeInstanceOf(Array);
    expect(res.body.errors[0].msg).toContain(
      "Password must be at least 6 characters long",
    );
  });

  it("POST /auth/login - should login an existing user and return a token", async () => {
    await request(app)
      .post("/auth/register")
      .send({ username: "loginuser", password: "password123" });
    const res = await request(app)
      .post("/auth/login")
      .send({ username: "loginuser", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Login successful");
    expect(res.body.token).toBeDefined();
    expect(res.body.userId).toBeDefined();
    expect(res.body.role).toBe("user");
  });

  it("POST /auth/login - should fail with incorrect credentials", async () => {
    await request(app)
      .post("/auth/register")
      .send({ username: "loginuser", password: "password123" });
    const res = await request(app)
      .post("/auth/login")
      .send({ username: "loginuser", password: "wrongpassword" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials.");
  });
});

describe("Book CRUD API", () => {
  let regularUser, adminUser;
  let regularUserBook;

  beforeEach(async () => {
    regularUser = await registerAndLogin({
      username: "testuser",
      password: "password123",
    });
    // Manually create an admin user in DB for testing admin routes
    const adminData = {
      username: "admin",
      password: "password123",
      role: "admin",
    };
    await User.create(adminData); // Password will be hashed by pre-save hook
    const adminLoginRes = await request(app)
      .post("/auth/login")
      .send({ username: "admin", password: "password123" });
    adminUser = {
      token: adminLoginRes.body.token,
      userId: adminLoginRes.body.userId,
      role: adminLoginRes.body.role,
    };

    // Create a book for the regular user
    const bookRes = await request(app)
      .post("/books")
      .set("Authorization", `Bearer ${regularUser.token}`)
      .field("title", "User's First Book")
      .field("author", "Test User")
      .field("year", "2023");
    expect(bookRes.status).toBe(201);
    regularUserBook = bookRes.body;
  });

  describe("POST /books", () => {
    it("should create a new book with title, author, and year (with image)", async () => {
      const res = await request(app)
        .post("/books")
        .set("Authorization", `Bearer ${regularUser.token}`)
        .field("title", "My New Book with Image")
        .field("author", "Test Author")
        .field("year", "2024")
        .attach("coverImage", testImagePath);

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("My New Book with Image");
      expect(res.body.author).toBe("Test Author");
      expect(res.body.year).toBe(2024);
      expect(res.body.createdBy).toBe(regularUser.userId);
      expect(res.body.coverImage).toMatch(/^uploads[\\/]coverImage-\d+\.png$/);
      expect(fs.existsSync(path.join(projectRoot, res.body.coverImage))).toBe(
        true,
      );
    });

    it("should create a new book without year and without image", async () => {
      const res = await request(app)
        .post("/books")
        .set("Authorization", `Bearer ${regularUser.token}`)
        .field("title", "Book No Year No Image")
        .field("author", "Another Author");

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("Book No Year No Image");
      expect(res.body).not.toHaveProperty("year");
      expect(res.body).not.toHaveProperty("coverImage");
      expect(res.body.createdBy).toBe(regularUser.userId);
    });

    it("should return 401 if not authenticated", async () => {
      const res = await request(app)
        .post("/books")
        .field("title", "Unauthorized Book")
        .field("author", "No User");
      expect(res.status).toBe(401);
    });

    it("should return 400 for missing required fields (e.g., title)", async () => {
      const res = await request(app)
        .post("/books")
        .set("Authorization", `Bearer ${regularUser.token}`)
        .field("author", "Author Only");
      expect(res.status).toBe(400);
      expect(res.body.errors[0].path).toBe("title");
    });
  });

  describe("GET /books", () => {
    it("regular user should get only their own books", async () => {
      // Create a book for admin to ensure it's not fetched by regular user
      await request(app)
        .post("/books")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .field("title", "Admin's Book")
        .field("author", "Admin User");

      const res = await request(app)
        .get("/books")
        .set("Authorization", `Bearer ${regularUser.token}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1); // Only regularUserBook
      expect(res.body[0].title).toBe("User's First Book");
      expect(res.body[0].createdBy.username).toBe("testuser");
    });

    it("admin user should get all books", async () => {
      await request(app) // Admin creates one more book
        .post("/books")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .field("title", "Admin's Book")
        .field("author", "Admin User");

      const res = await request(app)
        .get("/books")
        .set("Authorization", `Bearer ${adminUser.token}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2); // regularUserBook + Admin's Book
      const titles = res.body.map((b) => b.title);
      expect(titles).toContain("User's First Book");
      expect(titles).toContain("Admin's Book");
    });

    it("should return 401 if not authenticated", async () => {
      const res = await request(app).get("/books");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /books/:id", () => {
    it("regular user should get their own book by ID", async () => {
      const res = await request(app)
        .get(`/books/${regularUserBook._id}`)
        .set("Authorization", `Bearer ${regularUser.token}`);
      expect(res.status).toBe(200);
      expect(res.body.title).toBe(regularUserBook.title);
    });

    it("regular user should get 404 (or 403) for another user's book ID", async () => {
      const adminBookRes = await request(app)
        .post("/books")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .field("title", "Admin's Secret Book")
        .field("author", "Admin");
      const adminBookId = adminBookRes.body._id;

      const res = await request(app)
        .get(`/books/${adminBookId}`)
        .set("Authorization", `Bearer ${regularUser.token}`);
      // Service returns null, controller returns 404 if book not found or access denied
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Book not found or access denied");
    });

    it("admin should get any book by ID", async () => {
      const res = await request(app)
        .get(`/books/${regularUserBook._id}`)
        .set("Authorization", `Bearer ${adminUser.token}`);
      expect(res.status).toBe(200);
      expect(res.body.title).toBe(regularUserBook.title);
    });

    it("should return 400 for invalid book ID format", async () => {
      const res = await request(app)
        .get("/books/invalid-id-format")
        .set("Authorization", `Bearer ${regularUser.token}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid Book ID format");
    });

    it("should return 404 for non-existent book ID", async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/books/${nonExistentId}`)
        .set("Authorization", `Bearer ${regularUser.token}`);
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /books/:id", () => {
    it("regular user should update their own book (text fields)", async () => {
      const res = await request(app)
        .put(`/books/${regularUserBook._id}`)
        .set("Authorization", `Bearer ${regularUser.token}`)
        .field("title", "User's Updated Title")
        .field("year", "2025");
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("User's Updated Title");
      expect(res.body.year).toBe(2025);
      expect(res.body.author).toBe(regularUserBook.author); // Author should remain
    });

    it("regular user should update their own book (add cover image)", async () => {
      const res = await request(app)
        .put(`/books/${regularUserBook._id}`)
        .set("Authorization", `Bearer ${regularUser.token}`)
        .field("title", "Title with New Image")
        .attach("coverImage", testImagePath);
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Title with New Image");
      expect(res.body.coverImage).toMatch(/^uploads[\\/]coverImage-\d+\.png$/);
      expect(fs.existsSync(path.join(projectRoot, res.body.coverImage))).toBe(
        true,
      );
    });

    it("regular user should update their own book (remove cover image)", async () => {
      // First, add an image
      const bookWithImageRes = await request(app)
        .post("/books")
        .set("Authorization", `Bearer ${regularUser.token}`)
        .field("title", "Book to Remove Image From")
        .field("author", "Image Test Author")
        .attach("coverImage", testImagePath);
      const bookWithImageId = bookWithImageRes.body._id;
      const originalImagePath = bookWithImageRes.body.coverImage;
      expect(fs.existsSync(path.join(projectRoot, originalImagePath))).toBe(
        true,
      );

      // Now, remove the image
      const res = await request(app)
        .put(`/books/${bookWithImageId}`)
        .set("Authorization", `Bearer ${regularUser.token}`)
        .field("coverImage", "");
      console.log({ ...res });
      expect(res.status).toBe(200);
      expect(res.body.coverImage).toBeNull();
      expect(fs.existsSync(path.join(projectRoot, originalImagePath))).toBe(
        false,
      );
    });

    it("regular user should fail to update another user's book (403)", async () => {
      const adminBookRes = await request(app)
        .post("/books")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .field("title", "Admin's Book to Protect")
        .field("author", "Admin");
      const adminBookId = adminBookRes.body._id;

      const res = await request(app)
        .put(`/books/${adminBookId}`)
        .set("Authorization", `Bearer ${regularUser.token}`)
        .field("title", "Attempted Update by User");
      expect(res.status).toBe(403); // Access Denied: You do not own this book.
      expect(res.body.error).toContain("Access Denied");
    });

    it("admin user should be able to update their own book", async () => {
      const adminBookRes = await request(app)
        .post("/books")
        .set("Authorization", `Bearer ${adminUser.token}`)
        .field("title", "Admin's Own Book")
        .field("author", "Admin");
      const adminBookId = adminBookRes.body._id;

      const res = await request(app)
        .put(`/books/${adminBookId}`)
        .set("Authorization", `Bearer ${adminUser.token}`)
        .field("title", "Admin's Updated Own Book");
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Admin's Updated Own Book");
    });

    it("should return 401 if not authenticated", async () => {
      const res = await request(app)
        .put(`/books/${regularUserBook._id}`)
        .field("title", "Unauthorized Update");
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /books/:id", () => {
    it("admin user should delete any book (e.g., regular user's book)", async () => {
      // Add an image to the book to test file deletion
      const bookWithImage = await request(app)
        .post("/books")
        .set("Authorization", `Bearer ${regularUser.token}`)
        .field("title", "Book to Delete")
        .field("author", "Test User")
        .attach("coverImage", testImagePath);
      expect(bookWithImage.status).toBe(201);
      const bookIdToDelete = bookWithImage.body._id;
      const imagePathToDelete = bookWithImage.body.coverImage;
      expect(fs.existsSync(path.join(projectRoot, imagePathToDelete))).toBe(
        true,
      );

      const res = await request(app)
        .delete(`/books/${bookIdToDelete}`)
        .set("Authorization", `Bearer ${adminUser.token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Book deleted successfully");
      expect(res.body.deletedBook._id).toBe(bookIdToDelete);

      // Verify book is deleted from DB
      const findRes = await Book.findById(bookIdToDelete);
      expect(findRes).toBeNull();
      // Verify image file is deleted
      expect(fs.existsSync(path.join(projectRoot, imagePathToDelete))).toBe(
        false,
      );
    });

    it("regular user should fail to delete a book (403)", async () => {
      const res = await request(app)
        .delete(`/books/${regularUserBook._id}`)
        .set("Authorization", `Bearer ${regularUser.token}`);
      expect(res.status).toBe(403); // Forbidden by authorizeMiddleware
      expect(res.body.error).toContain("Forbidden");
    });

    it("should return 401 if not authenticated", async () => {
      const res = await request(app).delete(`/books/${regularUserBook._id}`);
      expect(res.status).toBe(401);
    });

    it("should return 404 if admin tries to delete a non-existent book", async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/books/${nonExistentId}`)
        .set("Authorization", `Bearer ${adminUser.token}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Book not found");
    });
  });
});
