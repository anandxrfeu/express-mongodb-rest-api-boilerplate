import { v2 as cloudinary } from 'cloudinary'
import multer from 'multer'
import streamifier from 'streamifier'

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Multer config – store in memory
const upload = multer({ storage: multer.memoryStorage() })

// Helper function to upload buffer using async/await
const uploadToCloudinary = async (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'uploads' }, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    });

    streamifier.createReadStream(fileBuffer).pipe(stream)
  })
};

export {upload, uploadToCloudinary}
