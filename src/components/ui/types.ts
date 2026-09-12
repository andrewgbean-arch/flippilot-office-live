export interface ShareFlipBase {
  title: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  roi: number;
  confidence?: number;
  origin?: string;
  description?: string;
  isProFlip?: boolean;
  flipScore?: number;
}
