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
	// optional extras (shown when provided)
	citizenName?: string;
	citizenEmail?: string;
	department?: string;
	service?: string;
};

const fmt = (d: Date | null) => (d ? d.toLocaleString("en-GB") : "—");

const draw = (doc: PDFKit.PDFDocument, p: ReceiptPayment) => {
	doc.fontSize(24).text("Nagar Sheba", { align: "center" });
	doc.fontSize(12).fillColor("#555").text("Payment Receipt", { align: "center" });
	doc.moveDown(2).fillColor("#000");

	const rows: [string, string][] = [
		["Receipt No", p.id],
		...(p.citizenName ? ([["Citizen", p.citizenName]] as [string, string][]) : []),
		...(p.citizenEmail ? ([["Email", p.citizenEmail]] as [string, string][]) : []),
		["Request", `${p.request.trackingRef} - ${p.request.title}`],
		...(p.service ? ([["Service", p.service]] as [string, string][]) : []),
		...(p.department ? ([["Department", p.department]] as [string, string][]) : []),
		["Payment Method", p.provider],
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
};

// Used by GET /payments/:id/receipt (streamed to the response)
export const buildReceiptPdf = (p: ReceiptPayment) => {
	const doc = new PDFDocument({ size: "A4", margin: 50 });
	draw(doc, p);
	doc.end();
	return doc;
};

// Used for the email attachment (in memory)
export const buildReceiptPdfBuffer = (p: ReceiptPayment): Promise<Buffer> =>
	new Promise((resolve, reject) => {
		const doc = new PDFDocument({ size: "A4", margin: 50 });
		const chunks: Buffer[] = [];
		doc.on("data", (c: Buffer) => chunks.push(c));
		doc.on("end", () => resolve(Buffer.concat(chunks)));
		doc.on("error", reject);
		draw(doc, p);
		doc.end();
	});