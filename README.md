# ลูกเทพศิลปศึกษา

ระบบติดตามนักศึกษา สาขาศิลปศึกษา มหาวิทยาลัยราชภัฏเชียงใหม่

เว็บไซต์: https://supernat9911.github.io/lukthep-arted-CMRU70/

## ลิงก์
- หน้าแรก: https://supernat9911.github.io/lukthep-arted-CMRU70/
- อาจารย์: https://supernat9911.github.io/lukthep-arted-CMRU70/teacher.html
- นักศึกษา: https://supernat9911.github.io/lukthep-arted-CMRU70/student.html
- คู่มือ: https://supernat9911.github.io/lukthep-arted-CMRU70/guide.html

## ไฟล์
- `src/` ต้นฉบับ: `home.html` หน้าแรก, `app.html` ระบบ (ใช้ทั้งหน้าอาจารย์และนักศึกษา), `guide.html` คู่มือ
- `docs/` เว็บที่ GitHub Pages ใช้ สร้างด้วย `node scripts/build.mjs` ห้ามแก้ไฟล์ใน docs/ ตรง ๆ
- `apps-script/` โค้ดฝั่ง Google Sheets และคู่มือติดตั้ง

## การเก็บข้อมูล
- **Google Sheets (แนะนำ สำหรับ GitHub Pages):** ติดตั้งตาม [apps-script/README.md](apps-script/README.md) แล้วใส่ URL ใน `const SHEETS_API` ใน `src/app.html` อาจารย์ต้องล็อกอินก่อนใช้งาน
- เปิด `docs/index.html` ตรง ๆ หรือผ่าน GitHub Pages: ข้อมูลเก็บใน localStorage ของเบราว์เซอร์นั้น
- เผยแพร่เป็น Claude Artifact: ใช้ฐานข้อมูลร่วม (`db`) ผู้ที่ได้รับสิทธิ์ Contributor ขึ้นไปจะเห็นและแก้ข้อมูลชุดเดียวกัน ส่วนผู้มีสิทธิ์ดูอย่างเดียวจะไม่เห็นข้อมูลนักศึกษา

## นำเข้า CSV
แถวแรกเป็นหัวคอลัมน์ ต้องมี `รหัสนักศึกษา` และ `ชื่อ–นามสกุล` (หัวคอลัมน์อื่นใช้ชื่อเดียวกับไฟล์ที่ดาวน์โหลด)
รหัสที่มีอยู่แล้วจะถูกอัปเดตเฉพาะคอลัมน์ที่อยู่ในไฟล์ (ช่องว่างหมายถึงไม่เปลี่ยน) โดยประวัติการติดตามเดิมยังอยู่ครบ
วันที่รองรับทั้ง `2026-11-18` และ `18/11/2569`
