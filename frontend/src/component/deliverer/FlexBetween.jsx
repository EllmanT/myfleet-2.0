const { styled } = require("@mui/system");
const { Box } = require("@mui/material");

const FlexBetween = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

export default FlexBetween;
