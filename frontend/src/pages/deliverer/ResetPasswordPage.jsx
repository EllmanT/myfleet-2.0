import { Box, Button, Link, TextField, Typography, useTheme } from "@mui/material";
import axios from "axios";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { server } from "server";

const ResetPasswordPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [check, setCheck] = useState("");
  const [disable, setDisable] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tokenFromUrl) {
      toast.error("Missing reset token. Open the link from your email.");
      return;
    }
    if (password !== check) {
      toast.error("Passwords do not match.");
      return;
    }
    setDisable(true);
    try {
      await axios.post(`${server}/user/reset-password`, {
        token: tokenFromUrl,
        password,
      });
      toast.success("Password updated. You can sign in.");
      navigate("/login");
    } catch (error) {
      toast.error(error.response?.data?.message || "Reset failed.");
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
            sx={{ mb: 2 }}
          >
            New password
          </Typography>
          <TextField
            fullWidth
            variant="outlined"
            type="password"
            label="New password"
            color="info"
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            inputProps={{ minLength: 8 }}
            helperText="At least 8 characters"
          />
          <TextField
            fullWidth
            variant="outlined"
            type="password"
            label="Confirm password"
            color="info"
            margin="normal"
            value={check}
            onChange={(e) => setCheck(e.target.value)}
            required
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={disable || !tokenFromUrl}
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
            Update password
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

export default ResetPasswordPage;
