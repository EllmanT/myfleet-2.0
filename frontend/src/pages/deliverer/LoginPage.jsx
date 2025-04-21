import { Box, Button, TextField, Typography, useTheme } from "@mui/material";
import axios from "axios";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { server } from "server";

const DelLoginPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [disable, setDisable] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setDisable(true);

    await axios
      .post(
        `${server}/user/login-user`,
        {
          email,
          password,
        },
        { withCredentials: true }
      )
      .then((res) => {
        toast.success("Login successfull!");
        navigate("/del-dashboard");
        window.location.reload(false);
        setDisable(false);
      })
      .catch((error) => {
        toast.error(error.response.data.message);
        setDisable(false);
      });
  };

  const toRegisterPage = () => {
    navigate("/del-register");
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
          <Box
            display="flex"
            maxWidth={"350px"}
            margin={"auto"}
            flexDirection="column"
            alignItems={"center"}
            justifyContent={"center"}
          >
            <Typography
              variant="h2"
              fontWeight={"bold"}
              color={theme.palette.secondary[100]}
            >
              myFleet
            </Typography>
          </Box>
          <Box display={"flex"} flexDirection={"column"}>
            <TextField
              variant="outlined"
              type="email"
              label="Email"
              color="info"
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              variant="outlined"
              type="password"
              label="Password"
              margin="normal"
              color="info"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p>Demo email : tmuranda1@gmail.com</p>
            <p>Demo Password: tapiwa1234</p>
            <Box
              display={"flex"}
              flexDirection={"column"}
              sx={{
                cursor: disable ? "not-allowed" : "pointer",
              }}
            >
              <Button
                type="submit"
                margin="normal"
                variant="contained"
                fontWeight="bold"
                disabled={disable}
                size="large"
                sx={{
                  color: theme.palette.secondary[100],
                  backgroundColor: theme.palette.secondary[300],
                  margin: "1rem 1rem 0rem ",
                  border: "solid 0.5px",
                  ":hover": {
                    backgroundColor: theme.palette.secondary[300],
                  },
                  ":disabled": {
                    backgroundColor: theme.palette.secondary[300],
                  },
                }}
              >
                Login
              </Button>
              <Button
                onClick={toRegisterPage}
                variant="contained"
                disabled={disable}
                size="large"
                sx={{
                  color: theme.palette.secondary[300],

                  margin: "1rem",
                  border: "solid 1px",
                  ":hover": {
                    backgroundColor: theme.palette.secondary[800],
                  },
                  ":disabled": {
                    backgroundColor: theme.palette.secondary[800],
                  },
                }}
              >
                Register
              </Button>
            </Box>
          </Box>
        </Box>
      </form>
    </div>
  );
};

export default DelLoginPage;
