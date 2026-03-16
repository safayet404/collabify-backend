require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const connectDB = require('./db');

const seed = async () => {
  await connectDB();

  const User = require('../modules/auth/user.model');

  const users = [
    { name: 'Alice Johnson',  email: 'alice@collabify.io',  password: 'Password1' },
    { name: 'Bob Smith',      email: 'bob@collabify.io',    password: 'Password1' },
    { name: 'Carol Williams', email: 'carol@collabify.io',  password: 'Password1' },
    { name: 'Dave Brown',     email: 'dave@collabify.io',   password: 'Password1' },
    { name: 'Eve Davis',      email: 'eve@collabify.io',    password: 'Password1' },
  ];

  for (const u of users) {
    const existing = await User.findOne({ email: u.email });
    if (!existing) {
      await User.create(u);
      console.log(`✅ Created: ${u.email}`);
    } else {
      console.log(`⏭️  Exists: ${u.email}`);
    }
  }

  console.log('\n🎉 Seed complete!');
  console.log('Demo password for all accounts: Password1\n');
  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });
