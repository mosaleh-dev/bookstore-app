import { body } from "express-validator";

export const validateRegistration = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("Username is required.")
    .isLength({ min: 3 })
    .withMessage("Username must be at least 3 characters long."),
  body("password")
    .notEmpty()
    .withMessage("Password is required.")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long."),
];

export const validateLogin = [
  body("username").trim().notEmpty().withMessage("Username is required."),
  body("password").notEmpty().withMessage("Password is required."),
];

export const validateBookCreation = [
  body("title").trim().notEmpty().withMessage("Title is required."),
  body("author").trim().notEmpty().withMessage("Author is required."),
  body("year")
    .optional({ checkFalsy: true })
    .if(body("year").notEmpty())
    .isInt({ min: -4000, max: new Date().getFullYear() + 5 })
    .withMessage("Year must be a valid integer."),
];

export const validateBookUpdate = [
  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Title cannot be empty if provided."),
  body("author")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Author cannot be empty if provided."),
  body("year")
    .optional({ checkFalsy: true })
    .if(body("year").notEmpty())
    .isInt({ min: -4000, max: new Date().getFullYear() + 5 })
    .withMessage("Year must be a valid integer."),
];
