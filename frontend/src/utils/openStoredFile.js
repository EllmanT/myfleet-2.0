import axios from "axios";
import { server } from "server";

// Stored documents (driver IDs and licences) are private: the address alone shows nothing, and a
// plain link cannot carry the sign-in. So the file is fetched with the app's own authenticated
// request and opened from memory.
//
// Keys we stored look like  tenants/<company>/<kind>/<name>.<ext>.  Anything else is an older
// value from before documents were kept properly, and has no file behind it.
export const isStoredFile = (value) => typeof value === "string" && value.startsWith("tenants/");

export async function openStoredFile(key) {
  // open the tab straight away, inside the click, so the browser's pop-up blocker allows it
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null;
  try {
    const { data } = await axios.get(`${server}/files/${key.split("/").map(encodeURIComponent).join("/")}`, {
      responseType: "blob",
      withCredentials: true,
    });
    const url = URL.createObjectURL(data);
    if (tab) tab.location.href = url;
    else window.location.href = url;
    // the tab has loaded it by then; free the memory
    setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
  } catch (error) {
    if (tab) tab.close();
    const status = error.response && error.response.status;
    throw new Error(
      status === 404
        ? "That document is no longer available. Upload it again."
        : "Could not open the document. Check your connection and try again."
    );
  }
}
