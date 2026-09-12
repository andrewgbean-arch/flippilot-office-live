export interface UserData {
    lockedDevice: string | null;
    dailyUses: number;
    monthlyUses: number;
    dailyLimit: number;
    monthlyLimit: number;
    lastScanDate: string;
    lastScanMonth: string;
    tier: "free" | "pro";
    barcodeUses: number;
    visionUses: number;
    createdAt: string;
}
export declare function getUser(userId: string): UserData;
export declare function saveUser(userId: string, data: UserData): void;
export declare function incrementUsage(userId: string, type: "barcode" | "vision"): void;
export declare function isOverLimit(userId: string): boolean;
export declare function lockDevice(userId: string, deviceId: string): void;
export declare function isDeviceAllowed(userId: string, deviceId: string): boolean;
//# sourceMappingURL=userstore.d.ts.map