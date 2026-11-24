require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const MedicalService = require("../modules/medicalService/medicalService.model");
const User = require("../modules/User/user.model");
const Doctor = require("../modules/Doctor/doctor.model");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/clinic_management";

const SAMPLE_SERVICES = [
  {
    name: "كشف جديد (General Consultation)",
    code: "CONS-001",
    category: "استشارات (Consultation)",
    price: 250,
    duration: 20,
    description: "كشف وفحص سريري شامل للمريض لأول مرة مع كتابة الروشتة وتحديد الخطة العلاجية.",
  },
  {
    name: "إعادة كشف (Follow-up Consultation)",
    code: "CONS-002",
    category: "استشارات (Consultation)",
    price: 100,
    duration: 15,
    description: "متابعة الحالة وتقييم الاستجابة للعلاج وإجراء الفحوصات الدورية.",
  },
  {
    name: "كشف مستعجل (Urgent Consultation)",
    code: "CONS-003",
    category: "استشارات (Consultation)",
    price: 400,
    duration: 25,
    description: "كشف فوري ذو أولوية للحالات الطارئة والمستعجلة خارج أوقات المواعيد العادية.",
  },
  {
    name: "رسم قلب (ECG Test)",
    code: "DIAG-001",
    category: "فحوصات وتشخيص (Diagnostics)",
    price: 150,
    duration: 15,
    description: "تخطيط كهربية القلب 12-Lead مع قراءة التقرير وتشخيص الاضطرابات النبضية.",
  },
  {
    name: "سونار بطن وحوض (Abdominal Ultrasound)",
    code: "DIAG-002",
    category: "فحوصات وتشخيص (Diagnostics)",
    price: 350,
    duration: 25,
    description: "فحص الموجات فوق الصوتية لأعضاء البطن والحوض مع تقرير تصويري دقيق.",
  },
  {
    name: "قياس سكر عشوائي (Random Blood Sugar)",
    code: "DIAG-003",
    category: "فحوصات وتشخيص (Diagnostics)",
    price: 30,
    duration: 5,
    description: "فحص سريع لنسبة الجلوكوز في الدم عن طريق وخز الإصبع بالجهاز الرقمي.",
  },
  {
    name: "تغيير على جرح (Wound Dressing)",
    code: "PROC-001",
    category: "إجراءات وتمريض (Procedures)",
    price: 90,
    duration: 15,
    description: "تنظيف وتعقيم الجروح الجراحية والسطحية وتغيير الضمادات بمواد معقمة.",
  },
  {
    name: "فك غرز جراحية (Suture Removal)",
    code: "PROC-002",
    category: "إجراءات وتمريض (Procedures)",
    price: 120,
    duration: 15,
    description: "إزالة الغرز أو الدبابيس الجراحية بطريقة آمنة مع تعقيم مكان الجرح.",
  },
  {
    name: "حقنة عضل أو وريد (IM / IV Injection)",
    code: "PROC-003",
    category: "إجراءات وتمريض (Procedures)",
    price: 40,
    duration: 10,
    description: "إعطاء الحقن العضلية أو الوريدية المقررة في الروشتة بواسطة التمريض المعتمد.",
  },
  {
    name: "جلسة استنشاق (Nebulizer Session)",
    code: "PROC-004",
    category: "إجراءات وتمريض (Procedures)",
    price: 80,
    duration: 20,
    description: "جلسة نيبولايزر موسع للشعب ومذيب للمخاط مع متابعة نسبة تشبع الأكسجين.",
  },
  {
    name: "تركيب كانيولا ومحلول (IV Cannula & Infusion)",
    code: "PROC-005",
    category: "إجراءات وتمريض (Procedures)",
    price: 150,
    duration: 30,
    description: "تركيب كانيولا وريدية وتعليق المحاليل الوريدية الوريدية الموصوفة.",
  },
];

async function seedServices(targetDoctorIdOrEmail) {
  console.log("Connecting to MongoDB:", MONGO_URI);
  await mongoose.connect(MONGO_URI);

  let doctorUser = null;

  if (targetDoctorIdOrEmail) {
    if (mongoose.Types.ObjectId.isValid(targetDoctorIdOrEmail)) {
      doctorUser = await User.findOne({
        _id: targetDoctorIdOrEmail,
        role: "doctor",
      });
      if (!doctorUser) {
        const docProfile = await Doctor.findById(targetDoctorIdOrEmail);
        if (docProfile) {
          doctorUser = await User.findById(docProfile.user);
        }
      }
    }
    if (!doctorUser) {
      doctorUser = await User.findOne({
        email: targetDoctorIdOrEmail,
        role: "doctor",
      });
    }
  }

  if (!doctorUser) {
    doctorUser = await User.findOne({ role: "doctor", isActive: true });
  }

  if (!doctorUser) {
    console.error("No active doctor user found in database to seed services for!");
    await mongoose.disconnect();
    return;
  }

  console.log(`Seeding sample medical services for Doctor: ${doctorUser.firstName} ${doctorUser.lastName} (${doctorUser.email}, ID: ${doctorUser._id})`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const item of SAMPLE_SERVICES) {
    const existing = await MedicalService.findOne({
      doctor: doctorUser._id,
      code: item.code,
    });

    if (existing) {
      console.log(`- Service code ${item.code} already exists for this doctor, skipping.`);
      skippedCount++;
    } else {
      await MedicalService.create({
        ...item,
        doctor: doctorUser._id,
        priceHistory: [
          {
            price: item.price,
            changedAt: new Date(),
            changedBy: doctorUser._id,
          },
        ],
        createdBy: doctorUser._id,
      });
      console.log(`+ Created service: ${item.name} (${item.code}) - ${item.price} EGP`);
      createdCount++;
    }
  }

  console.log(`\nSeeding completed: ${createdCount} created, ${skippedCount} skipped.`);
  await mongoose.disconnect();
}

if (require.main === module) {
  const arg = process.argv[2];
  seedServices(arg)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}

module.exports = seedServices;
