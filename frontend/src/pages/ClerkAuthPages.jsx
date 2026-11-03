import React from "react";
import { SignIn, SignUp, CreateOrganization, OrganizationSwitcher } from "@clerk/clerk-react";

const Center = ({ children }) => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      padding: 16,
    }}
  >
    {children}
  </div>
);

export const ClerkSignInPage = () => (
  <Center>
    <SignIn routing="path" path="/login" signUpUrl="/sign-up" fallbackRedirectUrl="/del-dashboard" />
  </Center>
);

export const ClerkSignUpPage = () => (
  <Center>
    <SignUp routing="path" path="/sign-up" signInUrl="/login" fallbackRedirectUrl="/create-organization" />
  </Center>
);

// A new customer names their company here; it becomes their own workspace.
export const CreateOrganizationPage = () => (
  <Center>
    <CreateOrganization afterCreateOrganizationUrl="/del-dashboard" skipInvitationScreen />
    <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/del-dashboard" />
  </Center>
);
