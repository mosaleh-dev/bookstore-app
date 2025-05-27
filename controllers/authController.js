import * as userService from "../services/userService.js";

export const register = async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await userService.registerUser(username, password);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res
      .status(201)
      .json({
        message: "User registered successfully",
        userId: result.user._id,
      });
  } catch (error) {
    console.error("[AuthController] Registration error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Username already exists." });
    }
    res.status(500).json({ error: "Registration failed" });
  }
};

export const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await userService.loginUser(username, password);
    if (result.error) {
      return res.status(401).json({ error: result.error });
    }
    res.json({
      message: "Login successful",
      token: result.token,
      userId: result.userId,
      role: result.role,
    });
  } catch (error) {
    console.error("[AuthController] Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};
