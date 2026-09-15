// A real phone camera photo is routinely several MB and several
// thousand pixels wide. There's no separate image storage/CDN in this
// app yet — vehicle photos are stored as base64 data URIs directly
// inside the vehicle record, and InventoryProvider rewrites the WHOLE
// vehicles array on every single save (adding a car, editing its
// mileage, anything). A handful of uncompressed real phone photos
// across a dealer's real stock would bloat that payload fast enough
// to start hitting the backend's request-size limit well before a
// dealer's inventory looks "full" by any normal measure. Downscaling
// and re-encoding client-side before a photo ever reaches state keeps
// this practical without needing new backend infrastructure.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image"));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // No canvas support — fall back to the original rather than
          // losing the photo entirely.
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
