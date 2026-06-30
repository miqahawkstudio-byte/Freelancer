export interface CompressedImage {
  base64: string;
  mediaType: string;
  dataUrl: string;
  originalName: string;
}

export function compressImage(
  file: File,
  maxDim = 1920,
  quality = 0.82,
): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Nie można odczytać pliku'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Nie można wczytać obrazu'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas niedostępny'));
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mediaType: 'image/jpeg', dataUrl, originalName: file.name });
      };
      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
