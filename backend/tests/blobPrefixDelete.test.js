jest.mock("@vercel/blob", () => ({
  list: jest.fn(),
  del: jest.fn(async () => undefined),
}));
const blob = require("@vercel/blob");
const storage = require("../services/fileStorage");

const ID = "a".repeat(24);

describe("deleting a company's files from Vercel Blob", () => {
  beforeEach(() => {
    process.env.BLOB_STORE_ID = "store_test";
    jest.clearAllMocks();
  });
  afterEach(() => delete process.env.BLOB_STORE_ID);

  test("lists only the company's prefix, follows every page, deletes them all", async () => {
    blob.list
      .mockResolvedValueOnce({ blobs: [{ pathname: `tenants/${ID}/driver-id/1.jpg` }, { pathname: `tenants/${ID}/driver-id/2.jpg` }], hasMore: true, cursor: "c1" })
      .mockResolvedValueOnce({ blobs: [{ pathname: `tenants/${ID}/driver-id/3.jpg` }], hasMore: false });
    const n = await storage.deleteTenantFiles(ID);
    expect(n).toBe(3);
    expect(blob.list.mock.calls[0][0].prefix).toBe(`tenants/${ID}/`);
    expect(blob.list.mock.calls[1][0].cursor).toBe("c1");
    expect(blob.del).toHaveBeenCalledTimes(2);
  });

  test("a bad id never reaches the store", async () => {
    await expect(storage.deleteTenantFiles("..")).rejects.toThrow();
    await expect(storage.deleteTenantFiles("")).rejects.toThrow();
    expect(blob.list).not.toHaveBeenCalled();
  });
});
