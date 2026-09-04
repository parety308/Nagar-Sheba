declare module "sslcommerz-lts" {
    interface SSLCommerzInitResponse {
        status: string;
        GatewayPageURL?: string;
        failedreason?: string;
        sessionkey?: string;
        tran_date?: string;
        tran_id?: string;
    }

    interface SSLCommerzRefundResponse {
        status: string;
        errorReason?: string;
        bank_tran_id?: string;
        refund_ref_id?: string;
    }

    interface SSLCommerzTransactionRecord {
        bank_tran_id?: string;
        tran_date?: string;
        tran_id?: string;
        amount?: string;
        status?: string;
        currency?: string;
        card_type?: string;
    }

    interface SSLCommerzTransactionQueryResponse {
        status?: string;
        errorReason?: string;
        element?: SSLCommerzTransactionRecord[];
    }

    interface SSLCommerzPayment {
    init(data: Record<string, unknown>): Promise<SSLCommerzInitResponse>;

    initiateRefund(
        data: Record<string, unknown>,
    ): Promise<SSLCommerzRefundResponse>;

    refundQuery(
        data: Record<string, unknown>,
    ): Promise<unknown>;

    transactionQueryByTransactionId(
        data: Record<string, unknown>,
    ): Promise<SSLCommerzTransactionQueryResponse>;

    transactionQueryBySessionKey(
        data: Record<string, unknown>,
    ): Promise<SSLCommerzTransactionQueryResponse>;

    validate(
        data: Record<string, unknown>,
    ): Promise<SSLCommerzValidationResponse>;
}

    const SSLCommerzPayment: new (
        storeId: string,
        storePassword: string,
        isLive: boolean,
    ) => SSLCommerzPayment;

    export default SSLCommerzPayment;
}