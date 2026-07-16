require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI;

const employees = [
  { name: "Raj Kumar", employeeId: "9" },
  { name: "Ruchira Verma", employeeId: "181" },
  { name: "Sumit Kumar", employeeId: "215" },
  { name: "Ekta", employeeId: "214" },
  { name: "Shubhankar Chakraborty", employeeId: "203" },
  { name: "Monu Yadav", employeeId: "217" },
  { name: "Chirag Singh Shekhawat", employeeId: "255" },
  { name: "Anuj Kumar", employeeId: "67" },
  { name: "Sameer Khan", employeeId: "231" },
  { name: "Mohit Kumar Garg", employeeId: "229" },
  { name: "Riya Sharma", employeeId: "250" },
  { name: "Shivajeet Mandal", employeeId: "254" },
  { name: "Faizal Khan", employeeId: "179" },
  { name: "Nihal Dhiman", employeeId: "192" },
  { name: "Ayush Jaiswal", employeeId: "223" },
  { name: "Kamal Singh", employeeId: "12" },
  { name: "Rajinder Kumar", employeeId: "100" },
  { name: "Jis Pious", employeeId: "22" },
  { name: "Madhukar Kumar", employeeId: "23" },
  { name: "Irshad Ahmad", employeeId: "10" },
  { name: "PS Musthafa", employeeId: "64" },
  { name: "Rahul Mittal", employeeId: "21" },
  { name: "Khushi Gupta", employeeId: "228" },
  { name: "Nivedita Sharma", employeeId: "236" },
  { name: "Jasveer Singh", employeeId: "222" },
  { name: "Malkit Singh", employeeId: "211" },
  { name: "Mohit Gaba", employeeId: "216" },
  { name: "Nilesh Poddar", employeeId: "221" },
  { name: "Wasim Akhtar", employeeId: "248" },
  { name: "Anil Balotia", employeeId: "152" },
  { name: "Roshan Kumar Singh", employeeId: "237" }
];

async function seed() {
  if (!MONGO_URI) {
    console.error("No MONGO_URI in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

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
          employeeId: emp.employeeId
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
