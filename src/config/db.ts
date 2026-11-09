import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error(
        'MONGODB_URI no definida: revisá tu archivo .env y que dotenv esté cargado',
      );
    }
    const connection = await mongoose.connect(uri);
    console.log(
      `MongoDB connected: ${connection.connection.host}:${connection.connection.port}`,
    );
  } catch (error: any) {
    console.log(error.message);
    process.exit(1);
  }
};
