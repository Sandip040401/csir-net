import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/csir_net_tracker';
    const conn = await mongoose.connect(mongoUri);
    console.log(`[DB] Connected to MongoDB: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[DB Error] ${error.message}`);
    process.exit(1);
  }
};
