import express from "express";
import multer from "multer";
import path from "node:path";
import {
  getAllBooksController,
  getBookByIdController,
  createBookController,
  updateBookController,
  deleteBookController,
} from "../controllers/bookController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { authorizeMiddleware } from "../middleware/authorizeMiddleware.js";
import {
  validateBookCreation,
  validateBookUpdate,
} from "../middleware/validationRules.js";
import { handleValidationErrors } from "../middleware/validationResultHandler.js";
import process from "node:process";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`,
    );
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      (process.env.NODE_ENV === "test" &&
        /\.(png|jpg|jpeg|gif)$/i.test(file.originalname))
    ) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

router.use((req, res, next) => {
  console.log(
    `[Books Router Middleware] Processing request for path: ${req.originalUrl}`,
  );
  next();
});

// Protect all book routes
router.use(authMiddleware);

router.get("/", getAllBooksController);
router.get("/:id", getBookByIdController);

router.post(
  "/",
  upload.single("coverImage"),
  validateBookCreation,
  handleValidationErrors,
  createBookController,
);

router.put(
  "/:id",
  upload.single("coverImage"),
  validateBookUpdate,
  handleValidationErrors,
  updateBookController,
);

// Only admins can delete books
router.delete("/:id", authorizeMiddleware(["admin"]), deleteBookController);

export default router;
