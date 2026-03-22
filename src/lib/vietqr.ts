/**
 * Utility for generating VietQR payment URLs using the VietQR.io image API.
 * 
 * Reference: https://vietqr.io/
 */

export interface VietQRParams {
    bankId: string;
    accountNo: string;
    template?: string; // e.g., 'compact2', 'qr_only', 'compact'
    amount: number;
    description: string;
    accountName: string;
}

/**
 * Generates a VietQR image URL with the encoded payment details.
 * 
 * @param params Object containing bank ID, account number, amount, description, and account name.
 * @returns A full URL to the generated VietQR image.
 */
export function generateVietQRUrl(params: VietQRParams): string {
    const {
        bankId,
        accountNo,
        template = "compact2",
        amount,
        description,
        accountName
    } = params;

    // Base URL format: https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-<TEMPLATE>.png
    const baseUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png`;

    const url = new URL(baseUrl);

    // Append query parameters for amount, additional info (description), and account name
    url.searchParams.set("amount", Math.floor(amount).toString());
    url.searchParams.set("addInfo", description);
    url.searchParams.set("accountName", accountName);

    return url.toString();
}
