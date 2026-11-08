/*
 * Direct HTTP client for the API, signed in as one user with the same cookie the browser would
 * hold. Used to arrange data quickly and to attack the API with a second tenant's session.
 */
const { BASE_URL } = require("./env");

// A 1x1 JPEG and a tiny PDF: the server decides file type from the bytes.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("JFIF-e2e-picture-bytes")]);

class Api {
  constructor(token = null) {
    this.token = token;
  }

  static async login(email, password) {
    const res = await fetch(`${BASE_URL}/api/v2/user/login-user`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status >= 300) throw new Error(`login ${email} failed: ${res.status} ${JSON.stringify(body)}`);
    return new Api(body.token);
  }

  // A client that sends no credentials at all.
  static anonymous() {
    return new Api(null);
  }

  // A client holding an arbitrary cookie value (expired, forged, from another secret...).
  static withToken(token) {
    return new Api(token);
  }

  async request(method, path, { json, form, headers = {}, raw = false, bearer } = {}) {
    const h = { ...headers };
    if (this.token) h.cookie = `token=${this.token}`;
    if (bearer) h.authorization = `Bearer ${bearer}`;
    let body;
    if (json !== undefined) {
      h["content-type"] = "application/json";
      body = JSON.stringify(json);
    } else if (form) {
      body = form;
    }
    const res = await fetch(`${BASE_URL}${path}`, { method, headers: h, body });
    if (raw) return { status: res.status, headers: res.headers, buffer: Buffer.from(await res.arrayBuffer()) };
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = text;
    }
    return { status: res.status, body: parsed, headers: res.headers, text };
  }

  get(path, opts) {
    return this.request("GET", path, opts);
  }
  post(path, json, opts) {
    return this.request("POST", path, { ...opts, json });
  }
  put(path, json, opts) {
    return this.request("PUT", path, { ...opts, json });
  }
  del(path, opts) {
    return this.request("DELETE", path, opts);
  }

  // ---- arranging data (each throws on failure so a broken arrange step is loud) ----
  async mustPost(path, body, opts) {
    const r = await this.post(path, body, opts);
    if (r.status >= 300) throw new Error(`POST ${path} -> ${r.status} ${r.text}`);
    return r;
  }

  async me() {
    const r = await this.get("/api/v2/user/get-user");
    if (r.status !== 200) throw new Error(`get-user -> ${r.status} ${r.text}`);
    return r.body;
  }

  async createVehicle(companyId, { make = "DAF", regNumber, size = "horse" }) {
    return this.mustPost("/api/v2/vehicle/create-vehicle", { make, regNumber, size, companyId });
  }

  async createCustomer(companyId, { name, address = "1 Customer Road", city = "Harare", phoneNumber = "0771111111" }) {
    return this.mustPost("/api/v2/customer/create-customer", { name, address, city, phoneNumber, companyId });
  }

  async createContractor(companyId, { companyName, prefix = "ZZ" }) {
    const form = new FormData();
    for (const [k, v] of Object.entries({
      companyName,
      address: "1 Road",
      city: "Harare",
      contact: "0771",
      goodsTypes: "general",
      vehiclesTypes: "small",
      deliveryTypes: "standard",
      companyId,
      prefix,
      lastOrder: "0",
      vrates: "[]",
    })) {
      form.append(k, v);
    }
    const r = await this.request("POST", "/api/v2/contractor/create-contractor", { form });
    if (r.status >= 300) throw new Error(`create-contractor -> ${r.status} ${r.text}`);
    return r;
  }

  async createDriver(companyId, { name, idNumber }) {
    const form = new FormData();
    for (const [k, v] of Object.entries({ name, phoneNumber: "0772222222", address: "2 Road", city: "Harare", idNumber, companyId })) {
      form.append(k, v);
    }
    form.append("license", new Blob([JPEG], { type: "image/jpeg" }), "licence.jpg");
    form.append("id", new Blob([JPEG], { type: "image/jpeg" }), "id.jpg");
    const r = await this.request("POST", "/api/v2/driver/create-driver", { form });
    if (r.status >= 300) throw new Error(`create-driver -> ${r.status} ${r.text}`);
    return r;
  }

  async createJob(job) {
    return this.mustPost("/api/v2/job/create-job", [job]);
  }

  async createInvoice({ customerName, amount = 100 }) {
    return this.mustPost("/api/v2/invoice/create-invoice", {
      customerName,
      issueDate: new Date().toISOString().slice(0, 10),
      lines: [{ description: "Haulage", quantity: 1, unitPrice: amount }],
    });
  }
}

module.exports = { Api, JPEG };
