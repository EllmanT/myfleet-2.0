// Treat user search text as literal text, never as a regular expression.
// Unescaped input lets a caller send patterns like (a+)+$ that hang the
// database (ReDoS), or ones that match far more than they should.
function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { escapeRegex };
