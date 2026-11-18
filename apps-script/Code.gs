/**
 * ลูกเทพศิลปศึกษา — API ระหว่างหน้าเว็บ (GitHub Pages) กับ Google Sheets
 *
 * วิธีติดตั้ง: ดู apps-script/README.md
 * หน้าเว็บส่งคำขอแบบ POST (Content-Type: text/plain) เป็น JSON {action, token, ...}
 * ทุกคำตอบเป็น JSON {ok: true, ...} หรือ {ok: false, code, message}
 */

var APP_VERSION = '1.3.0';
var CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
/** Client ID ของ Google Sign-In (ค่าเดียวกับในหน้าเว็บ) ว่างไว้ = ปิดการเข้าสู่ระบบด้วย Google */
var GOOGLE_CLIENT_ID = '';
var SESSION_SECONDS = 6 * 60 * 60;   // อยู่ในระบบได้ 6 ชั่วโมง (สูงสุดของ CacheService)
var MAX_LOGIN_FAILS = 5;             // ใส่รหัสผิดเกินนี้ ล็อก 15 นาที
var HASH_ROUNDS = 300;

var STATUS = { normal: 'ปกติ', watch: 'เฝ้าระวัง', active: 'กำลังติดตาม', done: 'ติดตามแล้ว' };
var STAGE = { none: 'ยังไม่เริ่ม', doing: 'กำลังดำเนินการ', pass: 'ผ่าน', fail: 'ไม่ผ่าน' };

/** โครงสร้างชีต: [คีย์ที่ใช้ในโค้ด, หัวคอลัมน์ภาษาไทยในชีต] */
var SHEETS = {
  students: { name: 'นักศึกษา', cols: [
    ['id', 'รหัสนักศึกษา'], ['name', 'ชื่อ–นามสกุล'], ['year', 'ชั้นปี'], ['term', 'เทอม'],
    ['school', 'โรงเรียนที่จบมา'], ['gpa', 'เกรดเฉลี่ยเดิม'], ['gpaNow', 'เกรดเฉลี่ยปัจจุบัน'],
    ['attendance', 'เข้าเรียน (%)'], ['observe', 'สังเกตการสอน'], ['practice', 'ทดลองสอน'],
    ['status', 'สถานะติดตาม'], ['due', 'นัดติดตามครั้งถัดไป'], ['contact', 'ช่องทางติดต่อ'],
    ['advisor', 'ผู้รับผิดชอบ'], ['issue', 'ประเด็นติดตาม'], ['demo', 'ข้อมูลตัวอย่าง'],
    ['updatedAt', 'แก้ไขล่าสุด'], ['updatedBy', 'แก้ไขโดย'],
    ['englishScore', 'คะแนนภาษาอังกฤษ'], ['englishLevel', 'ระดับภาษาอังกฤษ (CEFR)'], ['photo', 'รูปนักศึกษา']] }, // คอลัมน์ใหม่ต่อท้ายเสมอ ข้อมูลเดิมไม่เลื่อน
  notes: { name: 'บันทึกติดตาม', cols: [
    ['studentId', 'รหัสนักศึกษา'], ['at', 'เวลา'], ['text', 'บันทึก'], ['byName', 'ผู้บันทึก']] },
  users: { name: 'ผู้ใช้', cols: [
    ['username', 'อีเมลหรือชื่อผู้ใช้'], ['name', 'ชื่อที่แสดง'], ['role', 'บทบาท (อาจารย์/นักศึกษา)'],
    ['tempPassword', 'รหัสผ่านชั่วคราว'], ['active', 'ปิดการใช้งาน (ใส่ ปิด)'], ['salt', 'salt (ระบบใช้)'], ['hash', 'hash (ระบบใช้)']] },
  enrollments: { name: 'ลงทะเบียนเรียน', cols: [
    ['studentId', 'รหัสนักศึกษา'], ['code', 'รหัสวิชา'], ['name', 'ชื่อวิชา'], ['term', 'ภาคเรียน/ปีการศึกษา'], ['section', 'หมู่เรียน']] },
  accounts: { name: 'บัญชีนักศึกษา', cols: [
    ['email', 'อีเมล'], ['studentId', 'รหัสนักศึกษา'], ['linkedAt', 'สมัครเมื่อ'], ['method', 'วิธีสมัคร']] },
  settings: { name: 'ตั้งค่า', cols: [['key', 'คีย์ (ระบบใช้)'], ['value', 'ค่า'], ['label', 'คำอธิบาย']] },
  // ชีตสำหรับฟีเจอร์ระยะถัดไป (สร้างหัวคอลัมน์ไว้ก่อน)
  assignments: { name: 'งาน', cols: [
    ['id', 'รหัสงาน'], ['title', 'ชื่องาน'], ['detail', 'รายละเอียด'], ['year', 'ชั้นปี'], ['term', 'เทอม'],
    ['dueAt', 'กำหนดส่ง'], ['maxScore', 'คะแนนเต็ม'], ['createdBy', 'สร้างโดย']] },
  submissions: { name: 'การส่งงาน', cols: [
    ['assignmentId', 'รหัสงาน'], ['studentId', 'รหัสนักศึกษา'], ['submittedAt', 'เวลาส่ง'], ['fileUrl', 'ลิงก์ไฟล์'],
    ['score', 'คะแนน'], ['feedback', 'ความเห็นอาจารย์'], ['checkedBy', 'ตรวจโดย']] },
  checkins: { name: 'เช็คชื่อ', cols: [
    ['sessionId', 'รหัสคาบ'], ['date', 'วันที่'], ['studentId', 'รหัสนักศึกษา'], ['at', 'เวลาเช็คชื่อ'], ['method', 'วิธี']] },
  leaves: { name: 'ใบลา', cols: [
    ['id', 'รหัสใบลา'], ['studentId', 'รหัสนักศึกษา'], ['from', 'ตั้งแต่'], ['to', 'ถึง'], ['reason', 'เหตุผล'],
    ['fileUrl', 'หลักฐาน'], ['status', 'สถานะ'], ['reviewedBy', 'อนุมัติโดย']] },
  scores: { name: 'คะแนน', cols: [
    ['studentId', 'รหัสนักศึกษา'], ['item', 'รายการ'], ['score', 'คะแนน'], ['maxScore', 'คะแนนเต็ม'], ['term', 'เทอม'], ['updatedAt', 'แก้ไขล่าสุด']] }
};

/* ======================= ติดตั้งครั้งแรก ======================= */

/** กด ▶ Run ฟังก์ชันนี้ 1 ครั้งจากหน้า Apps Script หลังวางโค้ด */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('ต้องเปิด Apps Script จากเมนู ส่วนขยาย → Apps Script ของ Google Sheets');
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  Object.keys(SHEETS).forEach(function (key) { sheet_(key); });
  Logger.log('สร้างชีตเรียบร้อย: ' + Object.keys(SHEETS).map(function (k) { return SHEETS[k].name; }).join(', '));
}

/* ======================= จุดรับคำขอ ======================= */

function doGet() {
  return json_({ ok: true, app: 'lukthep', version: APP_VERSION });
}

function doPost(e) {
  var out;
  try {
    var p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    out = route_(p);
    out.ok = true;
  } catch (x) {
    out = x && x.code
      ? { ok: false, code: x.code, message: x.message }
      : { ok: false, code: 'server_error', message: 'เกิดข้อผิดพลาดในระบบ: ' + (x && x.message) };
  }
  return json_(out);
}

function route_(p) {
  switch (p.action) {
    case 'login': return login_(p);
    case 'googleLogin': return googleLogin_(p);
    case 'logout': CacheService.getScriptCache().remove('s:' + p.token); return {};
  }
  var s = session_(p.token);
  if (p.action === 'me') return { name: s.name, role: s.role };
  if (p.action === 'studentHome') return studentHome_(s);
  if (p.action === 'changePassword') return withLock_(function () { return changePassword_(s, p); });
  if (s.role !== 'teacher') throw fail_('forbidden', 'บัญชีนี้ไม่มีสิทธิ์ใช้งานส่วนของอาจารย์');
  switch (p.action) {
    case 'bootstrap': return bootstrap_();
    case 'getSettings': return { settings: readSettings_() };
    case 'saveSettings': return withLock_(function () { return { settings: saveSettings_(p.settings || {}) }; });
    case 'saveStudent': return withLock_(function () { saveStudent_(s, p); return bootstrap_(); });
    case 'deleteStudents': return withLock_(function () { deleteStudents_(p.ids); return bootstrap_(); });
    case 'importStudents': return withLock_(function () { importStudents_(s, p.rows); return bootstrap_(); });
  }
  throw fail_('unknown_action', 'ไม่รู้จักคำสั่ง ' + p.action);
}

/* ======================= ล็อกอิน ======================= */

function login_(p) {
  var username = str_(p.username, 200).toLowerCase();
  var password = String(p.password || '');
  var cache = CacheService.getScriptCache();
  var failKey = 'fail:' + username;
  var fails = Number(cache.get(failKey) || 0);
  if (fails >= MAX_LOGIN_FAILS) throw fail_('locked', 'ใส่รหัสผ่านผิดหลายครั้ง โปรดลองใหม่อีกครั้งใน 15 นาที');

  return withLock_(function () {
    var users = readTable_('users');
    var i = users.findIndex(function (u) {
      return String(u.username).trim().toLowerCase() === username && String(u.active).trim() !== 'ปิด';
    });
    var u = i >= 0 ? users[i] : null;
    var viaTemp = false, ok = false;
    if (u && u.hash) ok = hash_(u.salt, password) === u.hash;
    else if (u && u.tempPassword) ok = viaTemp = password === String(u.tempPassword);
    if (!ok) {
      cache.put(failKey, String(fails + 1), 900);
      throw fail_('auth_failed', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
    if (viaTemp) { // เข้าครั้งแรกด้วยรหัสชั่วคราว ต้องตั้งรหัสใหม่
      var next = String(p.newPassword || '');
      if (!next) throw fail_('must_change', 'เข้าสู่ระบบครั้งแรก โปรดตั้งรหัสผ่านใหม่');
      checkPassword_(next);
      setPassword_(users, i, next);
    }
    cache.remove(failKey);
    return startSession_(u, username, '');
  });
}

/** เข้าสู่ระบบด้วย Google: ตรวจ ID token กับ Google แล้วจับคู่อีเมลกับชีต "ผู้ใช้" */
function googleLogin_(p) {
  if (!GOOGLE_CLIENT_ID) throw fail_('not_setup', 'ยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วย Google');
  var credential = String(p.credential || '');
  if (!credential) throw fail_('auth_failed', 'ไม่ได้รับข้อมูลบัญชี Google');
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw fail_('auth_failed', 'ยืนยันตัวตนกับ Google ไม่สำเร็จ โปรดลองอีกครั้ง');
  var info = JSON.parse(res.getContentText());
  var issuerOk = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
  if (info.aud !== GOOGLE_CLIENT_ID || !issuerOk || String(info.email_verified) !== 'true' || Number(info.exp) * 1000 < Date.now()) {
    throw fail_('auth_failed', 'ยืนยันตัวตนกับ Google ไม่สำเร็จ โปรดลองอีกครั้ง');
  }
  var email = String(info.email).trim().toLowerCase();
  return withLock_(function () { return googleAccount_(email, str_(info.name, 120), p); });
}

function googleAccount_(email, googleName, p) {
  var settings = readSettings_();
  var u = readTable_('users').filter(function (x) {
    return String(x.username).trim().toLowerCase() === email && String(x.active).trim() !== 'ปิด';
  })[0];
  if (u) return startSession_(u, email, googleName);
  if (settings.teacherEmails.indexOf(email) >= 0) return startSession_({ role: 'อาจารย์', name: '' }, email, googleName);

  var at = email.lastIndexOf('@'), local = email.slice(0, at), domain = email.slice(at + 1);
  if (settings.studentDomains.indexOf(domain) < 0) {
    throw fail_('no_access', 'บัญชี ' + email + ' ยังไม่มีสิทธิ์ใช้งาน นักศึกษาโปรดใช้อีเมลมหาวิทยาลัย'
      + (settings.studentDomains.length ? ' (@' + settings.studentDomains.join(', @') + ')' : '') + ' อาจารย์โปรดแจ้งผู้ดูแลให้เพิ่มอีเมลนี้');
  }
  var accounts = readTable_('accounts');
  var linked = accounts.filter(function (a) { return a.email === email; })[0];
  var students = readTable_('students');
  var byId = {};
  students.forEach(function (st) { byId[st.id] = st; });
  var link = function (studentId, method) {
    if (accounts.some(function (a) { return a.studentId === studentId && a.email !== email; })) {
      throw fail_('taken', 'รหัสนักศึกษา ' + studentId + ' สมัครด้วยบัญชีอื่นไปแล้ว หากไม่ใช่คุณ โปรดแจ้งอาจารย์ทันที');
    }
    appendRow_('accounts', { email: email, studentId: studentId, linkedAt: new Date().toISOString(), method: method });
    return studentSession_(byId[studentId], email);
  };
  if (linked && byId[linked.studentId]) return studentSession_(byId[linked.studentId], email);
  if (/^\d{5,15}$/.test(local) && byId[local]) return link(local, 'อีเมลรหัสนักศึกษา');
  if (/^\d{5,15}$/.test(local)) throw fail_('not_enrolled', 'ไม่พบรหัสนักศึกษา ' + local + ' ในรายชื่อ โปรดแจ้งอาจารย์ให้นำเข้ารายชื่อก่อน');
  if (!settings.allowSelfRegister) throw fail_('no_access', 'โปรดเข้าสู่ระบบด้วยอีเมลมหาวิทยาลัยรูปแบบ รหัสนักศึกษา@' + domain);
  var sid = str_(p.studentId, 15).replace(/\s/g, '');
  if (!sid) throw fail_('need_register', 'บัญชีนี้ยังไม่ได้สมัคร กรอกรหัสนักศึกษาและชื่อ–นามสกุลเพื่อสมัคร');
  var st = byId[sid];
  if (!st || normName_(st.name) !== normName_(p.fullName)) throw fail_('need_register', 'รหัสนักศึกษาหรือชื่อ–นามสกุลไม่ตรงกับรายชื่อ โปรดตรวจอีกครั้ง');
  return link(sid, 'สมัครด้วยรหัส + ชื่อ');
}

function normName_(v) {
  return String(v || '').replace(/^(นาย|นางสาว|นาง|น\.ส\.|mr\.?|mrs\.?|ms\.?|miss)\s*/i, '').replace(/\s+/g, '').toLowerCase();
}

function studentSession_(st, email) {
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var s = { username: email, name: st.name, role: 'student', studentId: st.id };
  CacheService.getScriptCache().put('s:' + token, JSON.stringify(s), SESSION_SECONDS);
  return { token: token, name: s.name, role: s.role };
}

function studentHome_(s) {
  if (s.role !== 'student') throw fail_('forbidden', 'สำหรับนักศึกษาเท่านั้น');
  var st = readTable_('students').map(fromSheet_).filter(function (x) { return x.id === s.studentId; })[0];
  if (!st) throw fail_('not_enrolled', 'ไม่พบข้อมูลของคุณในรายชื่อ โปรดติดต่ออาจารย์');
  return { student: { id: st.id, name: st.name, year: st.year, term: st.term,
    enroll: readTable_('enrollments').filter(function (e) { return e.studentId === st.id; }).map(enrollOut_) } };
}

/* ======================= ตั้งค่าการเข้าถึง ======================= */

var SETTING_LABELS = {
  teacherEmails: 'อีเมลอาจารย์ (บรรทัดละ 1)',
  studentDomains: 'โดเมนอีเมลมหาวิทยาลัยที่นักศึกษาใช้ล็อกอิน',
  maxFileMB: 'ขนาดไฟล์สูงสุดต่อไฟล์ (MB)',
  allowSelfRegister: 'ให้บัญชีที่ไม่ใช่ <รหัส>@โดเมน สมัครด้วยรหัส + ชื่อ-นามสกุลได้'
};

function readSettings_() {
  var raw = {};
  readTable_('settings').forEach(function (r) { raw[r.key] = r.value; });
  var list = function (v) { return String(v || '').split(/[\s,;]+/).map(function (x) { return x.trim().toLowerCase().replace(/^@/, ''); }).filter(Boolean); };
  var mb = Number(raw.maxFileMB);
  return {
    teacherEmails: list(raw.teacherEmails),
    studentDomains: list(raw.studentDomains),
    maxFileMB: mb >= 1 && mb <= 50 ? mb : 20,
    allowSelfRegister: String(raw.allowSelfRegister) === 'ใช่'
  };
}

function saveSettings_(input) {
  var list = function (v) { return (Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).map(function (x) { return String(x).trim().toLowerCase().replace(/^@/, ''); }).filter(Boolean); };
  var emails = list(input.teacherEmails), domains = list(input.studentDomains);
  var badEmail = emails.filter(function (e) { return !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e); })[0];
  if (badEmail) throw fail_('invalid', 'อีเมลไม่ถูกต้อง: ' + badEmail);
  var badDomain = domains.filter(function (d) { return !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d); })[0];
  if (badDomain) throw fail_('invalid', 'โดเมนไม่ถูกต้อง: ' + badDomain + ' (ใส่แบบ cmru.ac.th)');
  var mb = Math.round(Number(input.maxFileMB));
  if (!(mb >= 1 && mb <= 50)) throw fail_('invalid', 'ขนาดไฟล์ต้องอยู่ระหว่าง 1–50 MB (ข้อจำกัดของ Apps Script)');
  var values = { teacherEmails: emails.join('\n'), studentDomains: domains.join('\n'), maxFileMB: String(mb), allowSelfRegister: input.allowSelfRegister ? 'ใช่' : '' };
  writeTable_('settings', Object.keys(SETTING_LABELS).map(function (k) { return { key: k, value: values[k], label: SETTING_LABELS[k] }; }));
  return readSettings_();
}

function startSession_(u, username, fallbackName) {
  var role = /นักศึกษา|student/i.test(String(u.role)) ? 'student' : 'teacher';
  var s = { username: username, name: str_(u.name, 120) || fallbackName || username, role: role };
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('s:' + token, JSON.stringify(s), SESSION_SECONDS);
  return { token: token, name: s.name, role: s.role };
}

function changePassword_(s, p) {
  var users = readTable_('users');
  var i = users.findIndex(function (u) { return String(u.username).trim().toLowerCase() === s.username; });
  if (i < 0 || hash_(users[i].salt, String(p.password || '')) !== users[i].hash) throw fail_('auth_failed', 'รหัสผ่านเดิมไม่ถูกต้อง');
  checkPassword_(String(p.newPassword || ''));
  setPassword_(users, i, String(p.newPassword));
  return {};
}

function checkPassword_(pw) {
  if (pw.length < 8) throw fail_('weak_password', 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร');
}

function setPassword_(users, i, pw) {
  var salt = Utilities.getUuid();
  users[i].salt = salt;
  users[i].hash = hash_(salt, pw);
  users[i].tempPassword = '';
  writeTable_('users', users);
}

function hash_(salt, pw) {
  var h = salt + ':' + pw;
  for (var i = 0; i < HASH_ROUNDS; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8));
  }
  return h;
}

function session_(token) {
  var raw = token && CacheService.getScriptCache().get('s:' + token);
  if (!raw) throw fail_('auth', 'โปรดเข้าสู่ระบบ');
  return JSON.parse(raw);
}

/* ======================= ข้อมูลนักศึกษา ======================= */

function bootstrap_() {
  var notes = {};
  readTable_('notes').forEach(function (n) {
    (notes[n.studentId] = notes[n.studentId] || []).push({ at: n.at, text: n.text, byName: n.byName });
  });
  var enroll = {};
  readTable_('enrollments').forEach(function (e) { (enroll[e.studentId] = enroll[e.studentId] || []).push(enrollOut_(e)); });
  var accounts = {};
  readTable_('accounts').forEach(function (a) { accounts[a.studentId] = true; });
  var students = readTable_('students').map(fromSheet_).filter(function (s) { return s.id && s.name; });
  students.forEach(function (s) { s.notes = notes[s.id] || []; s.enroll = enroll[s.id] || []; s.hasAccount = !!accounts[s.id]; });
  return { students: students, serverTime: new Date().toISOString() };
}

function enrollOut_(e) { return { code: e.code, name: e.name, term: e.term, section: e.section }; }

/** แทนที่รายวิชาของนักศึกษาที่ระบุด้วยรายการใหม่ (ไม่แตะคนอื่น) */
function setEnrollments_(map) {
  var ids = Object.keys(map);
  if (!ids.length) return;
  var keep = readTable_('enrollments').filter(function (e) { return !map.hasOwnProperty(e.studentId); });
  ids.forEach(function (id) {
    (map[id] || []).slice(0, 60).forEach(function (e) {
      if (!e || !e.code) return;
      keep.push({ studentId: id, code: str_(e.code, 20), name: str_(e.name, 150), term: str_(e.term, 10), section: str_(e.section, 10) });
    });
  });
  writeTable_('enrollments', keep);
}

function saveStudent_(s, p) {
  var st = cleanStudent_(p.student || {});
  if (!st.id || !st.name) throw fail_('invalid', 'กรุณาระบุรหัสและชื่อนักศึกษา');
  var prevId = p.prevId ? String(p.prevId) : null;
  var rows = readTable_('students').map(fromSheet_);
  if (rows.some(function (r) { return r.id === st.id && r.id !== prevId; })) throw fail_('duplicate', 'รหัสนักศึกษานี้มีอยู่แล้ว');
  var i = prevId ? rows.findIndex(function (r) { return r.id === prevId; }) : -1;
  if (prevId && i < 0) throw fail_('not_found', 'ไม่พบนักศึกษาคนนี้ อาจถูกลบไปแล้ว โปรดกดรีเฟรช');
  var now = new Date().toISOString();
  st.updatedAt = now; st.updatedBy = s.name;
  if (i >= 0 && p.student.photo === undefined) st.photo = rows[i].photo;
  if (i >= 0) rows[i] = st; else rows.push(st);
  writeTable_('students', rows.map(toSheet_));
  if (prevId && prevId !== st.id) {
    writeTable_('notes', readTable_('notes').map(function (n) { if (n.studentId === prevId) n.studentId = st.id; return n; }));
    writeTable_('accounts', readTable_('accounts').map(function (a) { if (a.studentId === prevId) a.studentId = st.id; return a; }));
    var gone = {}; gone[prevId] = [];
    setEnrollments_(gone);
  }
  if (Array.isArray(p.student.enroll)) { var m = {}; m[st.id] = p.student.enroll; setEnrollments_(m); }
  var note = str_(p.note, 2000);
  if (note) appendRow_('notes', { studentId: st.id, at: now, text: note, byName: s.name });
}

function deleteStudents_(ids) {
  var drop = {};
  (ids || []).forEach(function (id) { drop[String(id)] = true; });
  writeTable_('students', readTable_('students').filter(function (r) { return !drop[r.id]; }));
  writeTable_('notes', readTable_('notes').filter(function (n) { return !drop[n.studentId]; }));
  writeTable_('enrollments', readTable_('enrollments').filter(function (e) { return !drop[e.studentId]; }));
  writeTable_('accounts', readTable_('accounts').filter(function (a) { return !drop[a.studentId]; }));
}

function importStudents_(s, list) {
  if (!Array.isArray(list) || !list.length) throw fail_('invalid', 'ไม่มีข้อมูลให้นำเข้า');
  if (list.length > 3000) throw fail_('invalid', 'นำเข้าได้ครั้งละไม่เกิน 2,000 คน');
  var rows = readTable_('students').map(fromSheet_);
  var index = {};
  rows.forEach(function (r, i) { index[r.id] = i; });
  var now = new Date().toISOString(), enrollMap = {};
  list.forEach(function (item) {
    var st = cleanStudent_(item && item.student || {});
    if (!st.id || !st.name) return;
    if (Array.isArray(item.student.enroll)) enrollMap[st.id] = item.student.enroll;
    st.updatedAt = now; st.updatedBy = s.name;
    if (index[st.id] != null) {
      st.photo = rows[index[st.id]].photo;
      rows[index[st.id]] = st;
    }
    else { index[st.id] = rows.length; rows.push(st); }
  });
  writeTable_('students', rows.map(toSheet_));
  setEnrollments_(enrollMap);
}

function cleanStudent_(r) {
  var photo = typeof r.photo === 'string' ? r.photo : '';
  return {
    photo: photo.length <= 45000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo) ? photo : '',
    id: str_(r.id, 30), name: str_(r.name, 120),
    year: [1, 2, 3, 4].indexOf(Number(r.year)) >= 0 ? Number(r.year) : '',
    term: [1, 2].indexOf(Number(r.term)) >= 0 ? Number(r.term) : '',
    school: str_(r.school, 150), gpa: num_(r.gpa, 0, 4), gpaNow: num_(r.gpaNow, 0, 4),
    englishScore: num_(r.englishScore, 0, 100),
    englishLevel: CEFR.indexOf(str_(r.englishLevel, 2).toUpperCase()) >= 0 ? str_(r.englishLevel, 2).toUpperCase() : '',
    attendance: num_(r.attendance, 0, 100),
    observe: keyOf_(STAGE, r.observe, 'none'), practice: keyOf_(STAGE, r.practice, 'none'),
    status: keyOf_(STATUS, r.status, 'normal'),
    due: /^\d{4}-\d{2}-\d{2}$/.test(String(r.due)) ? String(r.due) : '',
    contact: str_(r.contact, 150), advisor: str_(r.advisor, 120), issue: str_(r.issue, 200),
    demo: r.demo === true || r.demo === 'ใช่'
  };
}

function fromSheet_(r) {
  var s = cleanStudent_(r);
  s.updatedAt = r.updatedAt; s.updatedBy = r.updatedBy;
  return s;
}

function toSheet_(s) {
  var o = {};
  Object.keys(s).forEach(function (k) { o[k] = s[k]; });
  o.status = STATUS[s.status]; o.observe = STAGE[s.observe]; o.practice = STAGE[s.practice];
  o.demo = s.demo ? 'ใช่' : '';
  return o;
}

/* ======================= ชีต ======================= */

function spreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw fail_('not_setup', 'ยังไม่ได้ติดตั้งระบบ โปรดรันฟังก์ชัน setup ใน Apps Script');
  return SpreadsheetApp.openById(id);
}

function sheet_(key) {
  var def = SHEETS[key];
  var ss = PropertiesService.getScriptProperties().getProperty('SHEET_ID') ? spreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, sh.getMaxRows(), def.cols.length).setNumberFormat('@'); // เก็บทุกช่องเป็นข้อความ ไม่ให้ชีตแปลงวันที่/ตัวเลขเอง
    sh.getRange(1, 1, 1, def.cols.length)
      .setValues([def.cols.map(function (c) { return c[1]; })])
      .setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < def.cols.length) { // อัปเดตจากเวอร์ชันเก่า: เติมหัวคอลัมน์ใหม่
    var from = sh.getLastColumn() + 1, extra = def.cols.slice(from - 1);
    sh.getRange(1, from, sh.getMaxRows(), extra.length).setNumberFormat('@');
    sh.getRange(1, from, 1, extra.length).setValues([extra.map(function (c) { return c[1]; })]).setFontWeight('bold');
  }
  return sh;
}

function readTable_(key) {
  var def = SHEETS[key], sh = sheet_(key), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, def.cols.length).getDisplayValues()
    .filter(function (row) { return row.some(function (v) { return String(v).trim() !== ''; }); })
    .map(function (row) {
      var o = {};
      def.cols.forEach(function (c, i) { o[c[0]] = String(row[i]).trim(); });
      return o;
    });
}

function writeTable_(key, objs) {
  var def = SHEETS[key], sh = sheet_(key), n = def.cols.length, last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, n).clearContent();
  if (!objs.length) return;
  var range = sh.getRange(2, 1, objs.length, n);
  range.setNumberFormat('@');
  range.setValues(objs.map(function (o) { return def.cols.map(function (c) { return cell_(o[c[0]]); }); }));
}

function appendRow_(key, obj) {
  var def = SHEETS[key], sh = sheet_(key);
  var range = sh.getRange(sh.getLastRow() + 1, 1, 1, def.cols.length);
  range.setNumberFormat('@');
  range.setValues([def.cols.map(function (c) { return cell_(obj[c[0]]); })]);
}

/** กันไม่ให้ข้อความที่ขึ้นต้นด้วย = + - @ กลายเป็นสูตรในชีต */
function cell_(v) {
  if (v == null) return '';
  v = String(v);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

/* ======================= เครื่องมือ ======================= */

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw fail_('busy', 'มีผู้ใช้บันทึกข้อมูลพร้อมกันหลายคน โปรดลองอีกครั้ง');
  try { return fn(); } finally { lock.releaseLock(); }
}

function str_(v, max) { return (v == null ? '' : String(v)).trim().slice(0, max || 2000); }

function num_(v, min, max) {
  if (v === '' || v == null) return '';
  var n = Number(String(v).replace('%', '').trim());
  if (!isFinite(n) || n < min || (max != null && n > max)) return '';
  return n;
}

function keyOf_(map, v, def) {
  v = String(v == null ? '' : v).trim();
  if (map.hasOwnProperty(v)) return v;
  for (var k in map) if (map[k] === v) return k;
  return def;
}

function fail_(code, message) { var e = new Error(message); e.code = code; return e; }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
