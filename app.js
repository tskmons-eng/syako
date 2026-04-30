const form = document.querySelector("#form");
const statusEl = document.querySelector("#status");
const frame = document.querySelector("#pdfFrame");
const openPdfLink = document.querySelector("#openPdfLink");
const submitBtn = document.querySelector("#submitBtn");
const printBtn = document.querySelector("#printBtn");
const clearBtn = document.querySelector("#clearBtn");
const sampleBtn = document.querySelector("#sampleBtn");
const overviewImageInput = document.querySelector("#overviewImageInput");
const detailImageInput = document.querySelector("#detailImageInput");
const mapSearchText = document.querySelector("#mapSearchText");
const mapSearchBtn = document.querySelector("#mapSearchBtn");
const baseSameAsAddress = document.querySelector("#baseSameAsAddress");
const parkingSameAsBase = document.querySelector("#parkingSameAsBase");
const ownerSameAsApplicant = document.querySelector("#ownerSameAsApplicant");

const STORAGE_KEY = "garage-certificate-pages-form";
const FONT_URL = "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf";
let overviewMap;
let detailMap;
let overviewMarker;
let detailMarker;
let currentPdfUrl;

function field(name) {
  return form.elements[name];
}

function text(value) {
  return String(value || "").trim();
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
  applyLinkedFields();
  const data = {};
  for (const item of form.elements) {
    if (!item.name) continue;
    if (item.name === "land_building") continue;
    if (item.type === "checkbox") {
      setDeep(data, item.name, item.checked);
      continue;
    }
    setDeep(data, item.name, item.value);
  }
  data.land_building = [...form.querySelectorAll('input[name="land_building"]:checked')].map((item) => item.value);
  return data;
}

function fillForm(data) {
  for (const item of form.elements) {
    if (!item.name) continue;
    if (item.name === "land_building") {
      item.checked = (data.land_building || []).includes(item.value);
      continue;
    }
    const value = item.name.split(".").reduce((obj, key) => (obj ? obj[key] : undefined), data);
    if (value === undefined) continue;
    if (item.type === "checkbox") item.checked = Boolean(value);
    else item.value = value;
  }
  applyLinkedFields();
  updateUseTo();
  syncMapsFromInputs();
  updateDocumentSections();
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
  if (!field("application_date").value) field("application_date").value = new Date().toISOString().slice(0, 10);
  if (!field("parking.overview_zoom").value) field("parking.overview_zoom").value = "15";
  if (!field("parking.detail_zoom").value) field("parking.detail_zoom").value = "18";
  updateUseTo();
}

function splitDate(value) {
  const raw = text(value);
  if (!raw) {
    const today = new Date();
    return [String(today.getFullYear()), String(today.getMonth() + 1), String(today.getDate())];
  }
  const match = raw.match(/(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})/);
  if (match) return [match[1], String(Number(match[2])), String(Number(match[3]))];
  const parts = raw.match(/\d+/g) || [];
  if (parts.length >= 3) return [parts[0], String(Number(parts[1])), String(Number(parts[2]))];
  return [raw, "", ""];
}

function addYears(dateValue, years) {
  if (!dateValue) return "";
  const [year, month, day] = dateValue.split("-").map(Number);
  const result = new Date(year + years, month - 1, day);
  if (result.getMonth() !== month - 1) result.setDate(0);
  return result.toISOString().slice(0, 10);
}

function updateUseTo() {
  const from = field("parking.use_from").value;
  if (from) field("parking.use_to").value = addYears(from, 3);
}

function applyLinkedFields() {
  if (baseSameAsAddress?.checked) {
    field("applicant.base_address").value = field("applicant.address").value;
  }
  if (parkingSameAsBase?.checked) {
    field("parking.location").value = field("applicant.base_address").value;
  }
  if (ownerSameAsApplicant?.checked) {
    field("owner.postal").value = field("applicant.postal").value;
    field("owner.address").value = field("applicant.address").value;
    field("owner.phone").value = field("applicant.phone").value;
    field("owner.name").value = field("applicant.name").value;
  }
  if (mapSearchText && !mapSearchText.value) {
    mapSearchText.value = field("parking.location").value || field("applicant.base_address").value || field("applicant.address").value;
  }
}

function updateDocumentSections() {
  const mapSection = document.getElementById("mapSection");
  const landBuildingSection = document.getElementById("landBuildingSection");
  const ownerSection = document.getElementById("ownerSection");
  if (mapSection) mapSection.hidden = !(field("documents.map")?.checked ?? true);
  if (landBuildingSection) landBuildingSection.hidden = !(field("documents.self")?.checked ?? true);
  if (ownerSection) ownerSection.hidden = !(field("documents.permission")?.checked ?? true);
}

function reiwaYear(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return year;
  if (y >= 2019) return y === 2019 ? "元" : String(y - 2018);
  return String(y);
}

function timestampName() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "_",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
}

function drawText(page, font, value, x, y, size = 11) {
  const body = text(value);
  if (!body) return;
  page.drawText(body, { x, y, size, font, color: PDFLib.rgb(0, 0, 0) });
}

function fitText(page, font, value, x, y, width, size = 11) {
  const body = text(value);
  if (!body) return;
  if (font.widthOfTextAtSize(body, size) <= width) {
    drawText(page, font, body, x, y, size);
    return;
  }
  let current = "";
  let lineY = y;
  for (const char of body) {
    const candidate = current + char;
    if (current && font.widthOfTextAtSize(candidate, size) > width) {
      drawText(page, font, current, x, lineY, size);
      lineY -= size + 2;
      current = char;
    } else {
      current = candidate;
    }
  }
  drawText(page, font, current, x, lineY, size);
}

function drawDate(page, font, value, x, y, options = {}) {
  const { era = true, monthDx = 95, dayDx = 150, size = 11 } = options;
  const [year, month, day] = splitDate(value);
  drawText(page, font, era ? reiwaYear(year) : year, x, y, size);
  drawText(page, font, month, x + monthDx, y, size);
  drawText(page, font, day, x + dayDx, y, size);
}

function drawDigitCells(page, font, value, x, y, cellW = 21, maxDigits = 4, size = 10) {
  const digits = text(value).replace(/\D/g, "").slice(-maxDigits);
  if (!digits) return;
  const start = maxDigits - digits.length;
  for (let index = 0; index < digits.length; index += 1) {
    const digit = digits[index];
    const left = x + (start + index) * cellW;
    drawText(page, font, digit, left + (cellW - font.widthOfTextAtSize(digit, size)) / 2, y, size);
  }
}

function markCircle(page, x, y, w = 28, h = 16) {
  page.drawEllipse({
    x: x + w / 2,
    y: y + h / 2,
    xScale: w / 2,
    yScale: h / 2,
    borderColor: PDFLib.rgb(0, 0, 0),
    borderWidth: 1.4
  });
}

function numberValue(name, fallback) {
  const value = Number(field(name)?.value);
  return Number.isFinite(value) ? value : fallback;
}

function currentLatLng() {
  return [numberValue("parking.map_lat", 36.3895), numberValue("parking.map_lng", 139.0634)];
}

function setMapFields(lat, lng) {
  field("parking.map_lat").value = Number(lat).toFixed(6);
  field("parking.map_lng").value = Number(lng).toFixed(6);
}

function placeMarkers(lat, lng) {
  if (!overviewMap || !detailMap) return;
  const latLng = [lat, lng];
  overviewMarker ||= L.marker(latLng).addTo(overviewMap);
  detailMarker ||= L.marker(latLng).addTo(detailMap);
  overviewMarker.setLatLng(latLng);
  detailMarker.setLatLng(latLng);
}

function setMapCenter(lat, lng) {
  setMapFields(lat, lng);
  placeMarkers(lat, lng);
  if (overviewMap) overviewMap.setView([lat, lng], numberValue("parking.overview_zoom", 15));
  if (detailMap) detailMap.setView([lat, lng], numberValue("parking.detail_zoom", 18));
  saveForm();
}

function initMapPair() {
  if (!window.L) return;
  const [lat, lng] = currentLatLng();
  const tileLayer = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tileOptions = { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" };
  overviewMap = L.map("overviewMap").setView([lat, lng], numberValue("parking.overview_zoom", 15));
  detailMap = L.map("detailMap").setView([lat, lng], numberValue("parking.detail_zoom", 18));
  L.tileLayer(tileLayer, tileOptions).addTo(overviewMap);
  L.tileLayer(tileLayer, tileOptions).addTo(detailMap);
  placeMarkers(lat, lng);

  const clickHandler = (event) => setMapCenter(event.latlng.lat, event.latlng.lng);
  overviewMap.on("click", clickHandler);
  detailMap.on("click", clickHandler);
  overviewMap.on("zoomend", () => {
    field("parking.overview_zoom").value = overviewMap.getZoom();
    saveForm();
  });
  detailMap.on("zoomend", () => {
    field("parking.detail_zoom").value = detailMap.getZoom();
    saveForm();
  });
}

function syncMapsFromInputs() {
  if (!overviewMap || !detailMap) return;
  const [lat, lng] = currentLatLng();
  placeMarkers(lat, lng);
  overviewMap.setView([lat, lng], numberValue("parking.overview_zoom", 15));
  detailMap.setView([lat, lng], numberValue("parking.detail_zoom", 18));
}

async function searchMapAddress() {
  const query = (mapSearchText.value || field("parking.location").value || field("applicant.base_address").value || "").trim();
  if (!query) return;
  statusEl.textContent = "地図の場所を検索しています...";
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const results = await response.json();
    if (!results.length) throw new Error("地図検索で場所が見つかりませんでした。");
    setMapCenter(Number(results[0].lat), Number(results[0].lon));
    statusEl.textContent = "地図の場所を設定しました。";
  } catch (error) {
    statusEl.textContent = error.message;
  }
}

function tilePixel(lat, lng, zoom) {
  const boundedLat = Math.max(Math.min(lat, 85.05112878), -85.05112878);
  const scale = 256 * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const sinLat = Math.sin((boundedLat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return [x, y];
}

async function fetchTileImage(zoom, x, y) {
  const limit = 2 ** zoom;
  if (y < 0 || y >= limit) return null;
  const tileX = ((x % limit) + limit) % limit;
  const response = await fetch(`https://tile.openstreetmap.org/${zoom}/${tileX}/${y}.png`);
  if (!response.ok) return null;
  const blob = await response.blob();
  return createImageBitmap(blob);
}

async function renderOsmMap(lat, lng, zoom, width = 900, height = 720) {
  const [centerX, centerY] = tilePixel(lat, lng, zoom);
  const left = centerX - width / 2;
  const top = centerY - height / 2;
  const firstX = Math.floor(left / 256);
  const firstY = Math.floor(top / 256);
  const lastX = Math.floor((left + width) / 256);
  const lastY = Math.floor((top + height) / 256);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);

  for (let tileX = firstX; tileX <= lastX; tileX += 1) {
    for (let tileY = firstY; tileY <= lastY; tileY += 1) {
      try {
        const image = await fetchTileImage(zoom, tileX, tileY);
        if (image) ctx.drawImage(image, Math.round(tileX * 256 - left), Math.round(tileY * 256 - top));
      } catch {
        // Missing map tiles are left blank.
      }
    }
  }

  const cx = width / 2;
  const cy = height / 2;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 5;
  ctx.fillStyle = "#da2d2d";
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#da2d2d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 24);
  ctx.lineTo(cx, cy + 24);
  ctx.moveTo(cx - 24, cy);
  ctx.lineTo(cx + 24, cy);
  ctx.stroke();
  return canvas.toDataURL("image/png");
}

async function fileToDataUrl(input, targetRatio = null) {
  const file = input?.files?.[0];
  if (!file) return "";
  const image = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  if (targetRatio) {
    let sx = 0;
    let sy = 0;
    let sw = image.width;
    let sh = image.height;
    const sourceRatio = image.width / image.height;
    if (sourceRatio > targetRatio) {
      sw = Math.round(image.height * targetRatio);
      sx = Math.round((image.width - sw) / 2);
    } else {
      sh = Math.round(image.width / targetRatio);
      sy = Math.round((image.height - sh) / 2);
    }
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    canvas.getContext("2d").drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  } else {
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL("image/jpeg", 0.86);
}

async function imageDataUrlToBytes(dataUrl) {
  if (!dataUrl) return null;
  const response = await fetch(dataUrl);
  return new Uint8Array(await response.arrayBuffer());
}

async function embedDataUrlImage(pdfDoc, dataUrl) {
  if (!dataUrl) return null;
  const bytes = await imageDataUrlToBytes(dataUrl);
  if (!bytes) return null;
  if (dataUrl.startsWith("data:image/png")) return pdfDoc.embedPng(bytes);
  return pdfDoc.embedJpg(bytes);
}

async function drawImageBox(pdfDoc, page, dataUrl, x, y, w, h) {
  const image = await embedDataUrlImage(pdfDoc, dataUrl);
  if (!image) return false;
  page.drawImage(image, { x, y, width: w, height: h });
  return true;
}

async function loadPdfPage(pdfDoc, fileName) {
  const bytes = await fetch(`./templates/${fileName}`).then((response) => response.arrayBuffer());
  const templateDoc = await PDFLib.PDFDocument.load(bytes);
  const [page] = await pdfDoc.copyPages(templateDoc, [0]);
  pdfDoc.addPage(page);
  return page;
}

async function loadFont(pdfDoc) {
  pdfDoc.registerFontkit(fontkit);
  const response = await fetch(FONT_URL);
  if (!response.ok) throw new Error("日本語フォントを読み込めませんでした。");
  const bytes = await response.arrayBuffer();
  return pdfDoc.embedFont(bytes, { subset: false });
}

async function fillPage(pdfDoc, templateName, data, fileName, font, images) {
  const page = await loadPdfPage(pdfDoc, fileName);
  const applicant = data.applicant || {};
  const vehicle = data.vehicle || {};
  const parking = data.parking || {};
  const owner = data.owner || {};
  const contact = data.contact || {};
  const commonDate = text(data.application_date);
  const policeStation = text(data.police_station);

  if (templateName === "application") {
    fitText(page, font, vehicle.maker, 82, 463, 70, 11);
    fitText(page, font, vehicle.model, 285, 463, 130, 10);
    fitText(page, font, vehicle.chassis_no, 420, 463, 125, 9);
    drawDigitCells(page, font, vehicle.length_cm, 631, 475);
    drawDigitCells(page, font, vehicle.width_cm, 631, 462);
    drawDigitCells(page, font, vehicle.height_cm, 631, 449);
    fitText(page, font, applicant.base_address, 302, 421, 475, 11);
    fitText(page, font, parking.location, 302, 391, 475, 11);
    drawDate(page, font, commonDate, 520, 350);
    fitText(page, font, policeStation, 143, 328, 38, 11);
    fitText(page, font, applicant.postal, 491, 332, 150, 11);
    fitText(page, font, applicant.address, 475, 304, 255, 10);
    fitText(page, font, applicant.phone, 615, 270, 95, 8);
    fitText(page, font, applicant.name, 475, 246, 220, 11);
    fitText(page, font, contact.name, 452, 109, 130, 8);
    fitText(page, font, contact.phone, 452, 98, 130, 8);
    if (data.authority === "self") markCircle(page, 320, 101, 28, 16);
    if (data.authority === "other") markCircle(page, 347, 101, 28, 16);
    if (data.authority === "shared") markCircle(page, 374, 101, 28, 16);
    if (data.request_type === "new") markCircle(page, 596, 106, 28, 12);
    if (data.request_type === "replace") markCircle(page, 596, 95, 28, 12);
    fitText(page, font, vehicle.previous_registration, 681, 108, 112, 8);
    fitText(page, font, vehicle.current_registration, 681, 97, 112, 8);
  }

  if (templateName === "map") {
    const overviewBox = [62, 139, 357, 348];
    const detailBox = [421, 139, 356, 348];
    let hasOverview = await drawImageBox(pdfDoc, page, images.overview, ...overviewBox);
    let hasDetail = await drawImageBox(pdfDoc, page, images.detail, ...detailBox);
    const lat = Number(parking.map_lat);
    const lng = Number(parking.map_lng);
    const useMapImages = parking.use_map_images === true || text(parking.use_map_images) === "true";
    if (useMapImages && (!hasOverview || !hasDetail) && Number.isFinite(lat) && Number.isFinite(lng)) {
      if (!hasOverview) {
        const mapImage = await renderOsmMap(lat, lng, Math.max(1, Math.min(19, Number(parking.overview_zoom || 15))));
        hasOverview = await drawImageBox(pdfDoc, page, mapImage, ...overviewBox);
      }
      if (!hasDetail) {
        const mapImage = await renderOsmMap(lat, lng, Math.max(1, Math.min(19, Number(parking.detail_zoom || 18))));
        hasDetail = await drawImageBox(pdfDoc, page, mapImage, ...detailBox);
      }
    }
    if (!hasOverview && !hasDetail) {
      fitText(page, font, parking.map_note, 70, 460, 330, 11);
      fitText(page, font, parking.layout_note, 435, 460, 330, 11);
    }
    if (parking.shutter === "yes") markCircle(page, 663, 137, 24, 18);
    if (parking.shutter === "no") markCircle(page, 742, 137, 24, 18);
  }

  if (templateName === "self") {
    markCircle(page, 130, 423, 38, 18);
    const landBuilding = new Set(data.land_building || []);
    if (landBuilding.has("land")) markCircle(page, 309, 423, 28, 18);
    if (landBuilding.has("building")) markCircle(page, 338, 423, 40, 18);
    fitText(page, font, policeStation, 171, 372, 38, 11);
    drawDate(page, font, commonDate, 525, 316);
    fitText(page, font, applicant.postal, 458, 288, 150, 11);
    fitText(page, font, applicant.address, 470, 253, 235, 10);
    fitText(page, font, applicant.phone, 515, 217, 180, 10);
    fitText(page, font, applicant.name, 470, 169, 235, 11);
  }

  if (templateName === "permission") {
    fitText(page, font, parking.name, 530, 428, 120, 11);
    fitText(page, font, parking.space_no, 662, 428, 115, 11);
    fitText(page, font, parking.location, 212, 443, 303, 11);
    fitText(page, font, applicant.postal, 242, 408, 160, 11);
    fitText(page, font, applicant.address, 278, 386, 225, 10);
    fitText(page, font, applicant.phone, 560, 368, 170, 11);
    fitText(page, font, applicant.name, 283, 333, 222, 12);
    drawDate(page, font, text(parking.use_from), 422, 296, { monthDx: 70, dayDx: 138, size: 12 });
    drawDate(page, font, text(parking.use_to), 422, 268, { monthDx: 70, dayDx: 138, size: 12 });
    drawDate(page, font, commonDate, 520, 219, { size: 12 });
    fitText(page, font, owner.postal, 482, 207, 130, 10);
    fitText(page, font, owner.address, 475, 190, 245, 10);
    fitText(page, font, owner.phone, 535, 155, 175, 11);
    fitText(page, font, owner.name, 475, 128, 245, 11);
  }
}

async function createPdf() {
  const data = collectForm();
  data.parking ||= {};
  if (data.parking.use_from && !data.parking.use_to) data.parking.use_to = addYears(data.parking.use_from, 3);
  const images = {
    overview: await fileToDataUrl(overviewImageInput, 357 / 348),
    detail: await fileToDataUrl(detailImageInput, 356 / 348)
  };

  const pdfDoc = await PDFLib.PDFDocument.create();
  const font = await loadFont(pdfDoc);
  const docs = data.documents || {};
  if (docs.application !== false) {
    await fillPage(pdfDoc, "application", data, "application.pdf", font, images);
    await fillPage(pdfDoc, "application", data, "application.pdf", font, images);
  }
  if (docs.map !== false) await fillPage(pdfDoc, "map", data, "map_layout.pdf", font, images);
  if (docs.self !== false) {
    await fillPage(pdfDoc, "self", data, "self_certification.pdf", font, images);
  }
  if (docs.permission !== false) {
    await fillPage(pdfDoc, "permission", data, "permission.pdf", font, images);
  }
  if (pdfDoc.getPageCount() === 0) throw new Error("出力する書類が選択されていません。");
  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
  currentPdfUrl = URL.createObjectURL(blob);
  return {
    url: currentPdfUrl,
    name: `garage_certificate_${timestampName()}.pdf`
  };
}

form.addEventListener("input", saveForm);
form.addEventListener("change", (event) => {
  if (event.target === field("parking.use_from")) updateUseTo();
  applyLinkedFields();
  updateDocumentSections();
  saveForm();
});
baseSameAsAddress?.addEventListener("change", () => {
  applyLinkedFields();
  saveForm();
});
parkingSameAsBase?.addEventListener("change", () => {
  applyLinkedFields();
  saveForm();
});
ownerSameAsApplicant?.addEventListener("change", () => {
  applyLinkedFields();
  saveForm();
});
mapSearchBtn.addEventListener("click", searchMapAddress);
field("parking.overview_zoom").addEventListener("change", syncMapsFromInputs);
field("parking.detail_zoom").addEventListener("change", syncMapsFromInputs);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  printBtn.disabled = true;
  openPdfLink.hidden = true;
  statusEl.textContent = "PDFを作成しています...";
  try {
    const result = await createPdf();
    openPdfLink.href = result.url;
    openPdfLink.download = result.name;
    openPdfLink.hidden = false;
    frame.src = result.url;
    printBtn.disabled = false;
    statusEl.textContent = `${result.name} を作成しました。`;
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
  }
});

printBtn.addEventListener("click", () => {
  if (!frame.src) return;
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
});

clearBtn.addEventListener("click", () => {
  form.reset();
  overviewImageInput.value = "";
  detailImageInput.value = "";
  openPdfLink.hidden = true;
  printBtn.disabled = true;
  frame.src = "about:blank";
  localStorage.removeItem(STORAGE_KEY);
  field("application_date").value = new Date().toISOString().slice(0, 10);
  field("parking.overview_zoom").value = "15";
  field("parking.detail_zoom").value = "18";
  setMapCenter(36.3895, 139.0634);
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
      use_map_images: true,
      map_note: "別紙地図または画像を添付",
      layout_note: "駐車区画 幅2.5m 長さ5.0m",
      map_lat: "36.389500",
      map_lng: "139.063400",
      overview_zoom: "15",
      detail_zoom: "18"
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
    land_building: ["land"],
    documents: {
      application: true,
      map: true,
      self: true,
      permission: true
    }
  });
  saveForm();
  setMapCenter(36.3895, 139.0634);
});

loadForm();
updateDocumentSections();
initMapPair();
