import PDFDocument from "pdfkit";

export type ReceiptPayment = {
	id: string;
	provider: string;
	providerRef: string;
	amount: { toString(): string };
	status: string;
	paidAt: Date | null;
	refundedAt: Date | null;
	request: { trackingRef: string; title: string };
};

const fmt = (d: Date | null) => (d ? d.toLocaleString("en-GB") : "—");

export const buildReceiptPdf = (p: ReceiptPayment) => {
	const doc = new PDFDocument({ size: "A4", margin: 50 });

	doc.fontSize(24).text("Nagar Sheba", { align: "center" });
	doc.fontSize(12).fillColor("#555").text("Payment Receipt", { align: "center" });
	doc.moveDown(2).fillColor("#000");

	const rows: [string, string][] = [
		["Receipt No", p.id],
		["Request", `${p.request.trackingRef} - ${p.request.title}`],
		["Provider", p.provider],
		["Transaction Ref", p.providerRef],
		["Amount", `BDT ${Number(p.amount.toString()).toFixed(2)}`],
		["Status", p.status],
		["Paid at", fmt(p.paidAt)],
		...(p.refundedAt ? ([["Refunded at", fmt(p.refundedAt)]] as [string, string][]) : []),
	];

	for (const [label, value] of rows) {
		doc.fontSize(10).fillColor("#777").text(label.toUpperCase());
		doc.fontSize(13).fillColor("#000").text(value);
		doc.moveDown(0.8);
	}

	doc.moveDown(2).fontSize(9).fillColor("#999").text(
		"This is a system-generated receipt and does not require a signature.",
		{ align: "center" },
	);

	doc.end();
	return doc;
};