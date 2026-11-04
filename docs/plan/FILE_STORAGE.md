# File storage (Vercel Blob, private)

Uploaded documents (today: each driver's ID and licence) are kept in a **private Vercel Blob store**. Nothing is public. A document only leaves storage through `GET /api/v2/files/<key>`, which requires sign-in and checks the file belongs to the caller's company.

## What you need to do once (about 5 minutes, in the Vercel dashboard)

1. Open the Vercel project for the app, then **Storage**, then **Create Storage**, then **Blob**.
2. Set the access to **Private**. This cannot be changed later, so check it before you continue.
3. Choose the region closest to your customers and to your MongoDB Atlas region (it also cannot be changed later). Record the region in your data-protection notes: it is where identity documents are stored.
4. **Connect the store to the project** for Production and Preview. Vercel then adds `BLOB_STORE_ID` and the OIDC settings automatically. No secret has to be copied anywhere.
5. Redeploy. That is all; the backend switches to Blob by itself when `BLOB_STORE_ID` (or `BLOB_READ_WRITE_TOKEN`) is present.

Until the store is connected, a deployed app has nowhere durable to keep files: on Vercel the disk is wiped between requests, so uploads would be lost. Connect the store **before** any driver documents are uploaded in production.

## Local development

With no Blob settings, files go to `backend/uploads/private/` (git-ignored). To test against a real store locally, run `vercel env pull` in `backend/` once, or set `BLOB_READ_WRITE_TOKEN` in `backend/config/.env`.

## How it works

- Key format: `tenants/<companyId>/<kind>/<random uuid>.<ext>`. The name of the uploaded file is never used.
- The type is decided by the file's first bytes (JPEG, PNG, WebP, PDF), not by what the browser says.
- Limit: 4 MB per file (Vercel rejects request bodies over about 4.5 MB). The browser shrinks photos to at most 1600 px before sending, so a phone photo is normally 300-700 KB.
- Replacing a document or deleting a driver deletes the stored file.
- Another company asking for your key, a made-up key, or a key with `..` in it all get 404.

## Older records

Before this change, driver documents were saved to a temporary disk that Vercel wipes, so those files no longer exist. Their records still hold an old path. The Drivers page shows "The file for this record was not kept. Upload it again." and the Replace button fixes it. Nothing needs migrating.

## Code

`backend/services/fileStorage.js` (storage and checks), `backend/controller/files.js` (download route), `frontend/src/component/deliverer/DocumentField.jsx` (the control), `frontend/src/utils/shrinkImage.js` and `openStoredFile.js`. Tests: `backend/tests/fileStorage.test.js`.
