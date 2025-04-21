import { Box, Button, TextField, Typography, useTheme } from "@mui/material";
import axios from "axios";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { server } from "server";

const ActivationPage = () => {
  const theme = useTheme();

  const { user } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const { activation_token } = useParams();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (activation_token) {
      const sendRequest = async () => {
        await axios
          .post(`${server}/user/activation`, {
            activation_token,
          })
          .then((res) => {
            console.log(res);
          })
          .catch((err) => {
            setError(true);
          });
      };
      sendRequest();
    }
  }, []);

  const toLoginPage = () => {
    ("/login");
  };

  return (
    <div>
      <Box
        display="flex"
        maxWidth={"350px"}
        padding={"12px"}
        marginX={"auto"}
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

        <Box
          display="flex"
          maxWidth={"350px"}
          margin={"auto"}
          flexDirection="column"
          alignItems={"center"}
          justifyContent={"center"}
        >
          <Typography
            variant="h4"
            fontWeight={""}
            color={theme.palette.secondary[100]}
          >
            {error ? (
              <>Token has expired ! </>
            ) : (
              <>Account created Successfully!</>
            )}
          </Typography>
          <Typography
            variant="h5"
            fontWeight={""}
            color={theme.palette.secondary[100]}
          >
            {error ? <>Contact your boss.</> : <> Welcome {user?.name}</>}
          </Typography>
        </Box>
        <Box display={"flex"} flexDirection={"column"}>
          <Button
            type="submit"
            margin="normal"
            onClick={toLoginPage}
            variant="contained"
            fontWeight="bold"
            size="large"
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
            Go to Login
          </Button>
        </Box>
      </Box>
    </div>
  );
};

export default ActivationPage;
