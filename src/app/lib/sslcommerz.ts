import SSLCommerzPayment from "sslcommerz-lts";
import config from "../config";

export const createSSLCommerzInstance = () =>
	new SSLCommerzPayment(
		config.sslcommerz.store_id,
		config.sslcommerz.store_password,
		config.sslcommerz.is_live,
	);
