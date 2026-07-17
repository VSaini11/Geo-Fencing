require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI;

const employees = [
  { name: "Raj Kumar", email: "raj.k@zeronetechnologies.com", employeeId: "9" },
  { name: "Ruchira", email: "ruchira.v@ztpli.com", employeeId: "181" },
  { name: "Sumit Kumar", email: "sumit.k@ztpli.com", employeeId: "215" },
  { name: "Ekta", email: "ekta.1@ztpli.com", employeeId: "214" },
  { name: "Shubhankar Chakraborty", email: "shubhankar.c@ztpli.com", employeeId: "203" },
  { name: "Monu", email: "monu.y@ztpli.com", employeeId: "217" },
  { name: "Chirag Singh Shekhawat", email: "chirag.s@ztpli.com", employeeId: "255" },
  { name: "Anuj Kumar", email: "anuj.k@zeronetechnologies.com", employeeId: "67" },
  { name: "Sameer Khan", email: "sameer.k@ztpli.com", employeeId: "231" },
  { name: "Mohit Kumar Garg", email: "mohit.k@ztpli.com", employeeId: "229" },
  { name: "Riya Sharma", email: "riya.s@ztpli.com", employeeId: "250" },
  { name: "Shivajeet Mandal", email: "shivajeet.m@ztpli.com", employeeId: "254" },
  { name: "Faizal Khan", email: "faizal.k@ztpli.com", employeeId: "179" },
  { name: "Nihal Dhiman", email: "nihal.d@zeronetechnologies.com", employeeId: "192" },
  { name: "Ayush Jaiswal", email: "ayush.j@ztpli.com", employeeId: "223" }, // Fixed from 22 to 223 to avoid duplicate ID with Jis Pious
  { name: "Kamal Singh", email: "kamalsingh.ztpl@gmail.com", employeeId: "12" },
  { name: "Rajinder Kumar", email: "rajinder.k@zeronetechnologies.com", employeeId: "100" },
  { name: "Jis Pious", email: "jis.p@zeronetechnologies.com", employeeId: "22" },
  { name: "Madhukar Kumar", email: "madhukar.k@zeronetechnologies.com", employeeId: "23" },
  { name: "Irshad Ahmad", email: "irshad.a@zeronetechnologies.com", employeeId: "10" },
  { name: "PS Musthafa", email: "musthafa.p@zeronetechnologies.com", employeeId: "64" },
  { name: "Rahul Mittal", email: "mittal.r@zeronetechnologies.com", employeeId: "21" },
  { name: "Khushi Gupta", email: "khushi.g@ztpli.com", employeeId: "228" },
  { name: "Nivedita Sharma", email: "nivedita.s@ztpli.com", employeeId: "236" },
  { name: "Jasveer Singh", email: "jasveer.s@ztpli.com", employeeId: "222" },
  { name: "Malkit Singh", email: "malkit.s@ztpli.com", employeeId: "211" },
  { name: "Mohit Gaba", email: "mohitg.ztpl@gmail.com", employeeId: "216" },
  { name: "Nilesh Poddar", email: "nilesh.p@ztpli.com", employeeId: "221" },
  { name: "Wasim Akhtar", email: "wasim.a@ztpli.com", employeeId: "248" },
  { name: "Anil Bhalothia", email: "anil.b@ztpli.com", employeeId: "152" },
  { name: "Roshan Kumar Singh", email: "roshan.s@ztpli.com", employeeId: "237" },
  { name: "Niraj Kumar Varma", email: "niraj.k@zeronetechnologies.com", employeeId: "36" },
  { name: "Shahid Pravez", email: "shahid.p@ztpli.com", employeeId: "34" },
  { name: "Manoj pandey", email: "manoj.p@ztpli.com", employeeId: "193" },
  { name: "Jai Prakash", email: "jai.p@zeronetechnologies.com", employeeId: "19" },
  { name: "Sabir Ali", email: "sabir.ztpl@gmail.com", employeeId: "171" },
  { name: "Kursed Ali", email: "kursed.ztpl@gmail.com", employeeId: "190" }
];

async function seed() {
  if (!MONGO_URI) {
    console.error("No MONGO_URI in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Remove all existing employees first
    const deleteResult = await User.deleteMany({ role: 'employee' });
    console.log(`Deleted ${deleteResult.deletedCount} existing employees.`);

    for (let emp of employees) {
      const existingUser = await User.findOne({ employeeId: emp.employeeId });

      if (!existingUser) {
        const salt = await bcrypt.genSalt(10);
        // Password is the same as the employeeId
        const hashedPassword = await bcrypt.hash(emp.employeeId, salt);

        await User.create({
          name: emp.name,
          password: hashedPassword,
          role: 'employee',
          employeeId: emp.employeeId,
          email: emp.email // added email here in case we want to use it
        });
        console.log(`Created user ${emp.name} (ID: ${emp.employeeId})`);
      } else {
        console.log(`User ${emp.name} (ID: ${emp.employeeId}) already exists. Skipping.`);
      }
    }

    console.log('Seeding completed successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    mongoose.disconnect();
  }
}

seed();
