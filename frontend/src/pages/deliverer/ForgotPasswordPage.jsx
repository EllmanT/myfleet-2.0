import { Box, Button, Link, TextField, Typography, useTheme } from "@mui/material";
import axios from "axios";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { server } from "server";

const ForgotPasswordPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [disable, setDisable] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setDisable(true);
    try {
      const { data } = await axios.post(`${server}/user/forgot-password`, { email });
      if (data.devResetUrl) {
        toast.success(
          "Local dev: use the reset link (email is not configured). Redirecting…",
          { duration: 6000 }
        );
        try {
          const url = new URL(data.devResetUrl);
          navigate(`${url.pathname}${url.search}`);
        } catch {
          navigate("/login");
        }
      } else {
        toast.success("Check your email for reset instructions.");
        navigate("/login");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong.");
    } finally {
      setDisable(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <Box
          display="flex"
          maxWidth={"350px"}
          padding={"12px"}
          margin={"auto"}
          flexDirection="column"
          alignItems={"center"}
          justifyContent={"center"}
          borderRadius={"20px"}
          border="solid 1px"
          borderColor={"#cca752"}
          boxShadow={"1px 1px 2px #cca752"}
        >
          <Typography
            variant="h2"
            fontWeight={"bold"}
            color={theme.palette.secondary[100]}
            sx={{ mb: 1 }}
          >
            Reset password
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: "center" }}>
            Enter your account email. If it exists, we will send a reset link.
          </Typography>
          <TextField
            fullWidth
            variant="outlined"
            type="email"
            label="Email"
            color="info"
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={disable}
            size="large"
            sx={{
              color: theme.palette.secondary[100],
              backgroundColor: theme.palette.secondary[300],
              marginTop: "1rem",
              border: "solid 0.5px",
              ":hover": { backgroundColor: theme.palette.secondary[300] },
              ":disabled": { backgroundColor: theme.palette.secondary[300] },
            }}
          >
            Send reset link
          </Button>
          <Link
            component={RouterLink}
            to="/login"
            sx={{ mt: 2 }}
            color={theme.palette.secondary[300]}
          >
            Back to login
          </Link>
        </Box>
      </form>
    </div>
  );
};

export default ForgotPasswordPage;
