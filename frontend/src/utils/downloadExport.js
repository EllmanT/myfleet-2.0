import axios from "axios";
import { server } from "server";

// Fetches the company export with the app's own sign-in and saves it as a file.
export async function downloadCompanyExport() {
  try {
    const response = await axios.get(`${server}/tenant/export`, {
      responseType: "blob",
      withCredentials: true,
      timeout: 5 * 60 * 1000,
    });
    const disposition = response.headers["content-disposition"] || "";
    const match = /filename="([^"]+)"/.exec(disposition);
    const name = match ? match[1] : "myfleet-export.zip";
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
    return name;
  } catch (error) {
    const status = error.response && error.response.status;
    if (status === 429) throw new Error("An export is already being prepared. Try again in a minute.");
    if (status === 403) throw new Error("Only company admins can download the company's data.");
    throw new Error("The download failed. Check your connection and try again.");
  }
}
