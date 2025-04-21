import { Box, Button } from "@mui/material";
import React, { useState } from "react";

const DeliveryTypes = ({ selected, onChange, disabled }) => {
  const [small, setSmall] = useState(false)
  function handleCBClick(ev) {
    const { checked, name } = ev.target;
    if (checked) {
      onChange([...selected, name]);
    } else {
      onChange([...selected.filter((selectedName) => selectedName !== name)]);
    }
  }

  return (
    <>
      <Box display={"flex"} gap={"1.5rem"}>
        <label className=" border p-4 flex rounded  items-center cursor-pointer">
          <input
            disabled={disabled}
            type="checkbox"
            checked={selected.includes("local")}
            name="local"
            onChange={handleCBClick}
          >

        
          </input>

          <span>Local<br/> (Inside City)</span>
        </label>

        <label className=" border p-4 flex rounded gap-2 items-center cursor-pointer">
          <input
            disabled={disabled}
            type="checkbox"
            checked={selected.includes("express")}
            name="express"
            onChange={handleCBClick}
          />

          <span>Express <br/> (Outside city)</span>
        </label>
      
          
      
      </Box>
    </>
  );
};

export default DeliveryTypes;
