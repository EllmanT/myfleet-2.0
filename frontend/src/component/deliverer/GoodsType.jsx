import { Box } from "@mui/material";
import React from "react";

const GoodsTypes = ({ selected, onChange ,disabled }) => {
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
      <Box display={"flex"} gap={"0.5rem"}>
        <label className=" border p-4 flex rounded  items-center cursor-pointer">
          <input
            disabled = {disabled}
            type="checkbox"
            checked={selected.includes("furniture")}
            name="furniture"
            onChange={handleCBClick}
          />

          <span>Furniture</span>
        </label>

      
        <label className=" border p-4 flex rounded gap-2 items-center cursor-pointer">
          <input
                      disabled = {disabled}

            type="checkbox"
            checked={selected.includes("building_material")}
            name="building_material"
            onChange={handleCBClick}
          />

          <span>Building material</span>
        </label>
        <label className=" border p-4 flex rounded gap-2 items-center cursor-pointer">
          <input
                      disabled = {disabled}

            type="checkbox"
            checked={selected.includes("dangerous")}
            name="dangerous"
            onChange={handleCBClick}
          />

          <span>Flammable / toxic  </span>
        </label>
        <label className=" border p-4 flex rounded gap-2 items-center cursor-pointer">
          <input
                      disabled = {disabled}

            type="checkbox"
            checked={selected.includes("heavy_machinery")}
            name="heavy_machinery"
            onChange={handleCBClick}
          />

          <span>Heavyy machinery </span>
        </label>
        <label className=" border p-4 flex rounded gap-2 items-center cursor-pointer">
          <input
                      disabled = {disabled}

            type="checkbox"
            checked={selected.includes("animals")}
            name="animals"
            onChange={handleCBClick}
          />

          <span>Animals </span>
        </label>
        <label className=" border p-4 flex rounded gap-2 items-center cursor-pointer">
          <input
                      disabled = {disabled}

            type="checkbox"
            checked={selected.includes("frozen_goods")}
            name="frozen_goods"
            onChange={handleCBClick}
          />

          <span>Frozen goods</span>
        </label>
        <label className=" border p-4 flex rounded-2xl gap-2 items-center cursor-pointer">
          <input
                      disabled = {disabled}

            type="checkbox"
            checked={selected.includes("dry_goods")}
            name="dry_goods"
            onChange={handleCBClick}
          />

          <span>Dry goods</span>
        </label>
      </Box>
    </>
  );
};

export default GoodsTypes;
