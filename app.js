const form = document.querySelector("#form");
const statusEl = document.querySelector("#status");
const frame = document.querySelector("#pdfFrame");
const openPdfLink = document.querySelector("#openPdfLink");
const submitBtn = document.querySelector("#submitBtn");
const clearBtn = document.querySelector("#clearBtn");
const sampleBtn = document.querySelector("#sampleBtn");
const overviewImageInput = document.querySelector("#overviewImageInput");
const detailImageInput = document.querySelector("#detailImageInput");

const STORAGE_KEY = "garage-certificate-gas-form";

function field(name) {
  return form.elements[name];
}

function setDeep(target, path, value) {
  const parts = path.split(".");
  let current = target;
  for (const part of parts.slice(0, -1)) {
    current[part] ||= {};
    current = current[part];
  }
  current[parts.at(-1)] = value;
}

function collectForm() {
  const data = {};
  for (const item of form.elements) {
    if (!item.name) continue;
    if (item.type === "checkbox") {
      setDeep(data, item.name, item.checked);
      continue;
    }
    setDeep(data, item.name, item.value);
  }
  return data;
}

function fillForm(data) {
  for (const item of form.elements) {
    if (!item.name) continue;
    const value = item.name.split(".").reduce((obj, key) => (obj ? obj[key] : undefined), data);
    if (value === undefined) continue;
    if (item.type === "checkbox") item.checked = Boolean(value);
    else item.value = value;
  }
}

function saveForm() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collectForm()));
}

function loadForm() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved) fillForm(saved);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  if (!field("application_date").value) {
    field("application_date").value = new Date().toISOString().slice(0, 10);
  }
}

function addYears(dateValue, years) {
  if (!dateValue) return "";
  const [year, month, day] = dateValue.split("-").map(Number);
  const result = new Date(year + years, month - 1, day);
  if (result.getMonth() !== month - 1) result.setDate(0);
  return result.toISOString().slice(0, 10);
}

async function fileToDataUrl(input) {
  const file = input?.files?.[0];
  if (!file) return "";
  const image = await createImageBitmap(file);
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function collectForSubmit() {
  const data = collectForm();
  data.parking ||= {};
  if (data.parking.use_from && !data.parking.use_to) {
    data.parking.use_to = addYears(data.parking.use_from, 3);
  }
  const [overviewImage, detailImage] = await Promise.all([
    fileToDataUrl(overviewImageInput),
    fileToDataUrl(detailImageInput)
  ]);
  if (overviewImage) data.parking.overview_image = overviewImage;
  if (detailImage) data.parking.detail_image = detailImage;
  return {
    password: window.GARAGE_CERTIFICATE_CONFIG?.APP_PASSWORD || "",
    data
  };
}

async function createPdf() {
  const endpoint = window.GARAGE_CERTIFICATE_CONFIG?.GAS_ENDPOINT;
  if (!endpoint || endpoint.includes("PASTE_GAS_WEB_APP_URL_HERE")) {
    throw new Error("github-pages/config.js に GAS のウェブアプリURLを設定してください。");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(await collectForSubmit())
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || "PDF作成に失敗しました。");
  return result;
}

form.addEventListener("input", saveForm);
form.addEventListener("change", saveForm);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  openPdfLink.hidden = true;
  statusEl.textContent = "PDFを作成しています...";
  try {
    const result = await createPdf();
    openPdfLink.href = result.url;
    openPdfLink.hidden = false;
    frame.src = result.url;
    statusEl.textContent = `${result.name || "PDF"} を作成しました。`;
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
  }
});

clearBtn.addEventListener("click", () => {
  form.reset();
  overviewImageInput.value = "";
  detailImageInput.value = "";
  openPdfLink.hidden = true;
  frame.src = "about:blank";
  localStorage.removeItem(STORAGE_KEY);
  field("application_date").value = new Date().toISOString().slice(0, 10);
  statusEl.textContent = "入力をクリアしました。";
});

sampleBtn.addEventListener("click", () => {
  const today = new Date().toISOString().slice(0, 10);
  fillForm({
    police_station: "前橋",
    application_date: today,
    request_type: "new",
    authority: "other",
    applicant: {
      postal: "371-0000",
      address: "群馬県前橋市大手町1丁目1番1号",
      name: "群馬 太郎",
      phone: "027-000-0000",
      base_address: "群馬県前橋市大手町1丁目1番1号"
    },
    vehicle: {
      maker: "トヨタ",
      model: "6AA-XXXX",
      chassis_no: "ABC123-4567890",
      length_cm: "469",
      width_cm: "184",
      height_cm: "154"
    },
    parking: {
      location: "群馬県前橋市大手町1丁目1番2号",
      name: "大手町駐車場",
      space_no: "12",
      use_from: today,
      use_to: addYears(today, 3),
      shutter: "no",
      map_note: "別紙地図または画像を添付",
      layout_note: "駐車区画 幅2.5m 長さ5.0m"
    },
    owner: {
      postal: "371-0000",
      address: "群馬県前橋市大手町1丁目1番3号",
      name: "株式会社サンプル管理",
      phone: "027-111-2222"
    },
    contact: {
      name: "群馬 太郎",
      phone: "090-0000-0000"
    },
    documents: {
      application: true,
      map: true,
      self: true,
      permission: true
    }
  });
  saveForm();
});

loadForm();
