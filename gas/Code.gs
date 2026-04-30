const OUTPUT_FOLDER_ID = "";
const APP_PASSWORD = "";

function doGet() {
  return jsonOutput({
    ok: true,
    message: "Garage certificate GAS endpoint is ready."
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
    if (APP_PASSWORD && payload.password !== APP_PASSWORD) {
      throw new Error("パスワードが違います。");
    }
    const data = payload.data || {};
    const result = createPdf(data);
    return jsonOutput({
      ok: true,
      url: result.url,
      name: result.name,
      fileId: result.fileId
    });
  } catch (error) {
    return jsonOutput({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function jsonOutput(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function createPdf(data) {
  const folder = getOutputFolder();
  const name = "garage_certificate_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  const doc = DocumentApp.create(name);
  const docFile = DriveApp.getFileById(doc.getId());
  folder.addFile(docFile);
  DriveApp.getRootFolder().removeFile(docFile);

  const body = doc.getBody();
  body.setMarginTop(36).setMarginBottom(36).setMarginLeft(36).setMarginRight(36);
  buildDocument(body, data);
  doc.saveAndClose();

  const pdfBlob = DriveApp.getFileById(doc.getId()).getBlob().getAs(MimeType.PDF).setName(name + ".pdf");
  const pdfFile = folder.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  docFile.setTrashed(true);

  return {
    name: pdfFile.getName(),
    fileId: pdfFile.getId(),
    url: "https://drive.google.com/file/d/" + pdfFile.getId() + "/view"
  };
}

function getOutputFolder() {
  if (OUTPUT_FOLDER_ID) {
    return DriveApp.getFolderById(OUTPUT_FOLDER_ID);
  }
  const folders = DriveApp.getFoldersByName("車庫証明PDF出力");
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder("車庫証明PDF出力");
}

function buildDocument(body, data) {
  const applicant = data.applicant || {};
  const vehicle = data.vehicle || {};
  const parking = data.parking || {};
  const owner = data.owner || {};
  const contact = data.contact || {};
  const docs = data.documents || {};

  addTitle(body, "車庫証明 申請用PDF");
  addMeta(body, data);

  if (docs.application !== false) {
    addSection(body, "自動車保管場所証明申請書");
    addTable(body, [
      ["警察署", value(data.police_station)],
      ["申請日", value(data.application_date)],
      ["申請区分", label(data.request_type, { "new": "新規", "replace": "代替", "notification": "届出" })],
      ["使用権原", label(data.authority, { "self": "自己所有", "other": "他人所有", "shared": "共有" })],
      ["車名", value(vehicle.maker)],
      ["型式", value(vehicle.model)],
      ["車台番号", value(vehicle.chassis_no)],
      ["車両寸法", [vehicle.length_cm, vehicle.width_cm, vehicle.height_cm].filter(Boolean).join(" x ") + " cm"],
      ["使用の本拠の位置", value(applicant.base_address)],
      ["保管場所の位置", value(parking.location)],
      ["申請者", joinLines([applicant.postal, applicant.address, applicant.name, applicant.phone])],
      ["連絡先", joinLines([contact.name, contact.phone])]
    ]);
  }

  if (docs.map !== false) {
    addSection(body, "保管場所の所在図・配置図");
    addTable(body, [
      ["保管場所", value(parking.location)],
      ["所在図メモ", value(parking.map_note)],
      ["配置図メモ", value(parking.layout_note)],
      ["シャッター", label(parking.shutter, { "yes": "有", "no": "無" })]
    ]);
    if (!addImage(body, "所在図画像", parking.overview_image)) {
      addStaticMap(body, "所在図", parking.map_lat, parking.map_lng, parking.overview_zoom || 15);
    }
    if (!addImage(body, "配置図画像", parking.detail_image)) {
      addStaticMap(body, "配置図", parking.map_lat, parking.map_lng, parking.detail_zoom || 18);
    }
  }

  if ((data.authority === "self" || data.authority === "shared") && docs.self !== false) {
    addSection(body, "保管場所使用権原疎明書面（自認書）");
    addTable(body, [
      ["警察署", value(data.police_station)],
      ["日付", value(data.application_date)],
      ["申請者", joinLines([applicant.postal, applicant.address, applicant.name, applicant.phone])],
      ["保管場所", value(parking.location)]
    ]);
  }

  if ((data.authority === "other" || data.authority === "shared") && docs.permission !== false) {
    addSection(body, "保管場所使用承諾証明書");
    addTable(body, [
      ["駐車場名", value(parking.name)],
      ["駐車位置番号", value(parking.space_no)],
      ["保管場所", value(parking.location)],
      ["使用者", joinLines([applicant.postal, applicant.address, applicant.name, applicant.phone])],
      ["使用期間", value(parking.use_from) + " から " + value(parking.use_to) + " まで"],
      ["承諾者・管理者", joinLines([owner.postal, owner.address, owner.name, owner.phone])]
    ]);
  }
}

function addTitle(body, text) {
  const paragraph = body.appendParagraph(text);
  paragraph.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
}

function addMeta(body, data) {
  const paragraph = body.appendParagraph("作成日時: " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm"));
  paragraph.setFontSize(9);
  paragraph.setForegroundColor("#666666");
  body.appendParagraph("");
}

function addSection(body, title) {
  body.appendParagraph("");
  const paragraph = body.appendParagraph(title);
  paragraph.setHeading(DocumentApp.ParagraphHeading.HEADING2);
}

function addTable(body, rows) {
  const table = body.appendTable(rows.map(function(row) {
    return [row[0], row[1] || ""];
  }));
  table.setBorderWidth(0.5);
  for (let i = 0; i < table.getNumRows(); i++) {
    const row = table.getRow(i);
    row.getCell(0).setWidth(120).setBackgroundColor("#f1f5f9");
    row.getCell(0).editAsText().setBold(true);
    row.getCell(1).setWidth(360);
  }
}

function addImage(body, title, dataUrl) {
  if (!dataUrl || dataUrl.indexOf("data:image/") !== 0) return false;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return false;
  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING3);
  const bytes = Utilities.base64Decode(match[2]);
  const blob = Utilities.newBlob(bytes, match[1], title + ".jpg");
  const image = body.appendImage(blob);
  const width = image.getWidth();
  const height = image.getHeight();
  const maxWidth = 480;
  if (width > maxWidth) {
    image.setWidth(maxWidth);
    image.setHeight(Math.round(height * maxWidth / width));
  }
  return true;
}

function addStaticMap(body, title, lat, lng, zoom) {
  lat = Number(lat);
  lng = Number(lng);
  zoom = Number(zoom || 15);
  if (!isFinite(lat) || !isFinite(lng)) return false;
  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING3);
  const map = Maps.newStaticMap()
    .setSize(640, 420)
    .setMapType(Maps.StaticMap.Type.ROADMAP)
    .setCenter(lat, lng)
    .setZoom(Math.max(1, Math.min(19, zoom)))
    .addMarker(lat, lng);
  const image = body.appendImage(map.getBlob().setName(title + ".png"));
  image.setWidth(480);
  image.setHeight(315);
  return true;
}

function value(input) {
  return String(input || "").trim();
}

function label(input, labels) {
  return labels[input] || value(input);
}

function joinLines(values) {
  return values.map(value).filter(Boolean).join("\n");
}
