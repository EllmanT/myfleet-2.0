import { Box, Button, TextField, Typography, useTheme } from "@mui/material";
import axios from "axios";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { server } from "server";

const DelRegisterPage = () => {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [check, setCheck] = useState("");
  const navigate = useNavigate();
  const [disable, setDisable] = useState(false);

  console.log(disable);
  const config = { Headers: { "Content-Type": "multipart/form-data" } };
  const newForm = new FormData();

  newForm.append("name", name);
  newForm.append("email", email);
  newForm.append("password", password);
  newForm.append("check", check);

  const handleSubmit = async (e) => {
    setDisable(true);

    e.preventDefault();

    if (password === check) {
      await axios
        .post(`${server}/user/create-user`, newForm, config)
        .then((res) => {
          toast.success(res.data.message);
          setName("");
          setEmail("");
          setPassword("");
          setCheck("");
          setDisable(false);
        })
        .catch((error) => {
          toast.error(error.response.data.message);
          setDisable(false);
        });
    } else {
      toast.error("Passwords do not match");
      setDisable(false);
    }
  };

  const toLoginPage = () => {
    navigate("/del-login");
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
            <Typography variant="h2" fontWeight={"bold"} color={theme.palette.secondary[100]}>
              myFleet
            </Typography>
          </Box>
          <Box display={"flex"} flexDirection={"column"}>
            <TextField
              required
              variant="outlined"
              color="info"
              type="text"
              label="Name"
              margin="normal"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              required
              color="info"
              variant="outlined"
              type="email"
              label="Email"
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              required
              color={check === password && password !== "" ? "success" : "info"}
              variant="outlined"
              type="password"
              label="Password"
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <TextField
              required
              color={check !== "" && check === password ? "success" : "error"}
              variant="outlined"
              type="password"
              label="Reenter Password"
              margin="normal"
              value={check}
              onChange={(e) => setCheck(e.target.value)}
            />
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
              size="large"
              disabled={disable}
              sx={{
                color: theme.palette.secondary[100],
                backgroundColor: theme.palette.secondary[300],
                margin: "1rem 1rem 0rem ",
                border: "solid 0.5px",
                ":hover": {
                  backgroundColor: theme.palette.secondary[300],
                },
              }}
            >
              Register
            </Button>
            <Button
              onClick={toLoginPage}
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
              }}
            >
              Login
            </Button>

            </Box>
          
          </Box>
        </Box>
      </form>
    </div>
  );
};

export default DelRegisterPage;
