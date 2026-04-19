const jwt = require("jsonwebtoken");

function getToken(req) {
  let token = req.cookies?.token;
  const authHeader = req.headers.authorization;
  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }
  return token;
}

/** JWT payload may use id, _id, or userId depending on issuer */
function getUserIdFromPayload(verified) {
  if (!verified) return null;
  const raw = verified.id ?? verified._id ?? verified.userId;
  return raw != null ? String(raw) : null;
}

/**
 * Verifies JWT from cookie or Authorization Bearer, sets req.userId (string) and req.authPayload.
 */
function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ message: "not authenticated", authenticated: false });
  }
  try {
    const verified = jwt.verify(token, process.env.SECRET_KEY);
    const userId = getUserIdFromPayload(verified);
    if (!userId) {
      return res.status(401).json({ message: "invalid token", authenticated: false });
    }
    req.userId = userId;
    req.authPayload = verified;
    next();
  } catch (err) {
    return res.status(401).json({ message: "not authenticated", authenticated: false });
  }
}

module.exports = { getToken, getUserIdFromPayload, requireAuth };
