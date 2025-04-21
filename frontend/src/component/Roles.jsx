import { InputLabel, Menu, MenuItem, Select } from "@mui/material";

const roles = [
  {
    value: "Super Admin",
  },
  {
    value: "Site Admin",
  },
  {
    value: "Deliverer Manager",
  },
  {
    value: "Contractor Manager",
  },
  {
    value: "Deliverer Admin",
  },
  {
    value: "Contractor Admin",
  },
];
export default function Roles({ name, onChange, disabled }) {
  return (
    <>
      <InputLabel id="demo-simple-select-autowidth-label">Role</InputLabel>

      <Select
        disabled={disabled}
        labelId="simple-select-autowidth-label"
        id="demo-simple-select-autowidth"
        color="info"
        value={name}
        onChange={onChange}
        autoWidth
        label="Role"
      >
        {roles.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.value}
          </MenuItem>
        ))}
      </Select>
    </>
  );
}
