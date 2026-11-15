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
  } catch (error) {
    // `unknown` obliga a acotar antes de leer: `error.message` directo en
    // un catchAny es uno de los any mas famosos de TypeScript. El mensaje
    // del fallo de conexion vive en Error, pero nada garantiza que lo que
    // se lanzo sea uno: se degrada con gracia si no lo es
    console.log(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};
