//creating the token and storing as cookies

const sendToken = (user, statusCode, res) => {
  const token = user.getJwtToken();

  // SameSite=None is only accepted together with Secure; plain-http dev/test falls back to Lax.
  const secure = /^production$/i.test(process.env.NODE_ENV || "") || process.env.COOKIE_SECURE === "true";
  const options = {
    expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: secure ? "none" : "lax",
    secure,
  };

  res.status(statusCode).cookie("token", token, options).json({
    success: true,

    user,
    token,
  });
};

module.exports = sendToken;
