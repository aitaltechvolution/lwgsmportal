declare module "@paystack/inline-js" {
  export interface PaystackTransactionResponse {
    id?: string;
    reference: string;
    message?: string;
    status?: string;
  }

  export interface PaystackErrorResponse {
    message: string;
  }

  export interface PaystackCustomField {
    display_name: string;
    variable_name: string;
    value: string;
  }

  export interface PaystackNewTransactionOptions {
    key: string;
    email: string;
    amount: number; // kobo
    currency?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    reference?: string;
    metadata?: {
      custom_fields?: PaystackCustomField[];
      [key: string]: unknown;
    };
    onSuccess?: (transaction: PaystackTransactionResponse) => void;
    onCancel?: () => void;
    onError?: (error: PaystackErrorResponse) => void;
    onLoad?: (response: { id: number; customer: unknown; accessCode: string }) => void;
  }

  export default class PaystackPop {
    constructor();
    newTransaction(options: PaystackNewTransactionOptions): unknown;
    static isLoaded(): boolean;
  }
}
