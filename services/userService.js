import { User } from "../models/user.js";
import jwt from "jsonwebtoken";

export const registerUser = async (username, password) => {
  if (!username || !password) {
    return { error: "Username and password are required." };
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return { error: "Username already exists." };
    }

    const newUser = new User({ username, password });
    await newUser.save();
    return { user: newUser };
  } catch (error) {
    console.error("[UserService] Error registering user:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return { error: messages.join(" ") };
    }
    throw error;
  }
};

export const loginUser = async (username, password) => {
  if (!username || !password) {
    return { error: "Username and password are required." };
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return { error: "Invalid credentials." };
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return { error: "Invalid credentials." };
    }

    const payload = {
      userId: user._id,
      username: user.username,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    });

    return { token, userId: user._id, role: user.role };
  } catch (error) {
    console.error("[UserService] Error logging in user:", error);
    throw error;
  }
};
