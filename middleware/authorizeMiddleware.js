export const authorizeMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res
        .status(401)
        .json({ error: "Unauthorized: User role not available" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({
          error: "Forbidden: You do not have permission to perform this action",
        });
    }
    next();
  };
};
