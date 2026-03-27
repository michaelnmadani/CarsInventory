/**
 * Client-side image compression using Canvas API.
 * Resizes and converts images to WebP (or JPEG fallback) for efficient storage.
 */

/**
 * Compress an image file to a smaller WebP/JPEG blob.
 * @param {File|Blob} file - The image file to compress
 * @param {number} maxWidth - Maximum width in pixels (default 800)
 * @param {number} quality - Compression quality 0-1 (default 0.7)
 * @returns {Promise<Blob>} Compressed image blob
 */
export function compressImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate new dimensions preserving aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Try WebP first, fall back to JPEG
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            // WebP not supported, try JPEG
            canvas.toBlob(
              (jpegBlob) => {
                if (jpegBlob) resolve(jpegBlob);
                else reject(new Error('Image compression failed'));
              },
              'image/jpeg',
              quality
            );
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Get the file extension for a blob's MIME type.
 */
export function blobExtension(blob) {
  if (blob.type === 'image/webp') return 'webp';
  if (blob.type === 'image/jpeg') return 'jpg';
  if (blob.type === 'image/png') return 'png';
  return 'jpg';
}
