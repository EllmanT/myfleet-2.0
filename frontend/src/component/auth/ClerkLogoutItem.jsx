import React from "react";
import { MenuItem } from "@mui/material";
import { useClerk } from "@clerk/clerk-react";

// Only rendered when Clerk is enabled (it needs ClerkProvider above it).
const ClerkLogoutItem = ({ onDone }) => {
  const { signOut } = useClerk();
  return (
    <MenuItem
      onClick={async () => {
        if (onDone) onDone();
        await signOut({ redirectUrl: "/login" });
      }}
    >
      Logout
    </MenuItem>
  );
};

export default ClerkLogoutItem;
