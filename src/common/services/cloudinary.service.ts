import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import config from '../config/app.config';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: config.cloudinary_cloud_name,
      api_key: config.cloudinary_api_key,
      api_secret: config.cloudinary_api_secret,
    });
  }

  async uploadImage(
    fileBuffer: Buffer,
    folder = 'business-gallery',
  ): Promise<{ url: string; publicId: string }> {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
        },
        (error, uploaded) => {
          if (error) {
            reject(new Error('Cloudinary upload failed'));
            return;
          }
          if (!uploaded) {
            reject(new Error('Cloudinary returned no upload result'));
            return;
          }
          resolve(uploaded);
        },
      );

      stream.end(fileBuffer);
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }
}
