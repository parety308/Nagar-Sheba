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
	citizenName?: string;
	citizenEmail?: string;
	department?: string;
	service?: string;
};

// ---------- design tokens ----------
const W = 595.28;
const H = 841.89;
const M = 40;
const CONTENT_W = W - M * 2;

const C = {
	primary: "#0b6ea8",
	primaryDark: "#08537f",
	accent: "#f59e0b",
	ink: "#0f172a",
	muted: "#64748b",
	line: "#e2e8f0",
	zebra: "#f8fafc",
	white: "#ffffff",
};

const STATUS_STYLE: Record<
	string,
	{ label: string; fg: string; bg: string; border: string }
> = {
	COMPLETED: { label: "PAID", fg: "#15803d", bg: "#dcfce7", border: "#86efac" },
	REFUNDED: {
		label: "REFUNDED",
		fg: "#6d28d9",
		bg: "#ede9fe",
		border: "#c4b5fd",
	},
	PENDING: {
		label: "PENDING",
		fg: "#b45309",
		bg: "#fef3c7",
		border: "#fcd34d",
	},
	FAILED: { label: "FAILED", fg: "#b91c1c", bg: "#fee2e2", border: "#fca5a5" },
	CANCELLED: {
		label: "CANCELLED",
		fg: "#475569",
		bg: "#f1f5f9",
		border: "#cbd5e1",
	},
};

const PROVIDER_LABEL: Record<string, string> = {
	SSLCOMMERZ: "SSLCommerz",
	BKASH: "bKash",
	STRIPE: "Stripe",
};

const fmtDate = (d: Date | null) =>
	d
		? d.toLocaleString("en-GB", {
				day: "2-digit",
				month: "short",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			})
		: "—";

const fmtMoney = (v: { toString(): string }) =>
	`BDT ${Number(v.toString()).toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;

// ---------- drawing helpers ----------
const header = (doc: PDFKit.PDFDocument, p: ReceiptPayment) => {
	doc.rect(0, 0, W, 130).fill(C.primary);
	doc.rect(0, 124, W, 6).fill(C.accent);

	// logo mark
	doc.circle(M + 26, 58, 24).fill(C.white);
	doc.fillColor(C.primary).font("Helvetica-Bold").fontSize(18);
	doc.text("NS", M + 2, 50, { width: 48, align: "center", lineBreak: false });

	// brand
	doc.fillColor(C.white).font("Helvetica-Bold").fontSize(26);
	doc.text("Nagar Sheba", M + 64, 38, { lineBreak: false });
	doc.fillColor("#bfe3f7").font("Helvetica").fontSize(10);
	doc.text("SMART CITY SERVICES", M + 65, 70, {
		characterSpacing: 1.5,
		lineBreak: false,
	});

	// right side
	doc.fillColor(C.white).font("Helvetica-Bold").fontSize(15);
	doc.text("PAYMENT RECEIPT", W - M - 220, 40, {
		width: 220,
		align: "right",
		lineBreak: false,
	});
	doc.fillColor("#bfe3f7").font("Helvetica").fontSize(10);
	doc.text(`No. #${p.id.slice(0, 8).toUpperCase()}`, W - M - 220, 64, {
		width: 220,
		align: "right",
		lineBreak: false,
	});
	doc.text(`Issued ${fmtDate(p.paidAt ?? new Date())}`, W - M - 220, 80, {
		width: 220,
		align: "right",
		lineBreak: false,
	});
};

const amountCard = (doc: PDFKit.PDFDocument, p: ReceiptPayment, y: number) => {
	const s = STATUS_STYLE[p.status] ?? STATUS_STYLE.CANCELLED;
	const h = 92;

	doc.roundedRect(M, y, CONTENT_W, h, 12).fill(s.bg);
	doc.roundedRect(M, y, CONTENT_W, h, 12).lineWidth(1).stroke(s.border);
	doc.roundedRect(M, y, 6, h, 3).fill(s.fg);

	doc.fillColor(s.fg).font("Helvetica-Bold").fontSize(9);
	doc.text("TOTAL AMOUNT", M + 28, y + 20, {
		characterSpacing: 1.2,
		lineBreak: false,
	});
	doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(30);
	doc.text(fmtMoney(p.amount), M + 28, y + 38, { lineBreak: false });

	// status pill
	const pillW = 104;
	const pillX = W - M - pillW - 24;
	doc.roundedRect(pillX, y + 30, pillW, 32, 16).fill(s.fg);
	doc.fillColor(C.white).font("Helvetica-Bold").fontSize(12);
	doc.text(s.label, pillX, y + 40, {
		width: pillW,
		align: "center",
		characterSpacing: 1,
		lineBreak: false,
	});

	return y + h;
};

const sectionTitle = (doc: PDFKit.PDFDocument, text: string, y: number) => {
	doc.roundedRect(M, y + 1, 4, 16, 2).fill(C.accent);
	doc.fillColor(C.primaryDark).font("Helvetica-Bold").fontSize(12);
	doc.text(text.toUpperCase(), M + 14, y + 3, {
		characterSpacing: 1,
		lineBreak: false,
	});
	return y + 28;
};

const table = (
	doc: PDFKit.PDFDocument,
	rows: [string, string][],
	startY: number,
) => {
	const labelW = 150;
	const valueX = M + labelW + 16;
	const valueW = CONTENT_W - labelW - 32;
	let y = startY;
	const top = startY;

	rows.forEach(([label, value], i) => {
		doc.font("Helvetica-Bold").fontSize(11);
		const textH = doc.heightOfString(value, { width: valueW });
		const rowH = Math.max(32, textH + 18);

		if (i % 2 === 0) doc.rect(M, y, CONTENT_W, rowH).fill(C.zebra);

		doc.fillColor(C.muted).font("Helvetica").fontSize(9);
		doc.text(label.toUpperCase(), M + 16, y + rowH / 2 - 5, {
			width: labelW,
			characterSpacing: 0.6,
			lineBreak: false,
		});
		doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(11);
		doc.text(value, valueX, y + (rowH - textH) / 2, { width: valueW });

		y += rowH;
	});

	doc
		.roundedRect(M, top, CONTENT_W, y - top, 8)
		.lineWidth(1)
		.stroke(C.line);
	return y;
};

const footer = (doc: PDFKit.PDFDocument) => {
	const y = H - 78;
	doc.rect(0, y, W, 78).fill(C.zebra);
	doc.rect(0, y, W, 3).fill(C.primary);

	doc.fillColor(C.primaryDark).font("Helvetica-Bold").fontSize(11);
	doc.text("Thank you for using Nagar Sheba!", 0, y + 18, {
		width: W,
		align: "center",
		lineBreak: false,
	});
	doc.fillColor(C.muted).font("Helvetica").fontSize(8.5);
	doc.text(
		"This is a system-generated receipt and does not require a signature.",
		0,
		y + 38,
		{ width: W, align: "center", lineBreak: false },
	);
	doc.text(
		`© ${new Date().getFullYear()} Nagar Sheba · Chattogram, Bangladesh`,
		0,
		y + 52,
		{ width: W, align: "center", lineBreak: false },
	);
};

const watermark = (doc: PDFKit.PDFDocument, p: ReceiptPayment) => {
	const s = STATUS_STYLE[p.status] ?? STATUS_STYLE.CANCELLED;
	doc.save();
	doc.rotate(-28, { origin: [W / 2, H / 2] });
	doc.fillColor(s.fg).fillOpacity(0.06).font("Helvetica-Bold").fontSize(120);
	doc.text(s.label, 0, H / 2 - 60, {
		width: W,
		align: "center",
		lineBreak: false,
	});
	doc.restore();
	doc.fillOpacity(1);
};

// ---------- main ----------
const draw = (doc: PDFKit.PDFDocument, p: ReceiptPayment) => {
	header(doc, p);

	let y = amountCard(doc, p, 156) + 26;

	y = sectionTitle(doc, "Payment details", y);
	const paymentRows: [string, string][] = [
		["Receipt No", p.id],
		["Payment method", PROVIDER_LABEL[p.provider] ?? p.provider],
		["Transaction ref", p.providerRef],
		["Paid at", fmtDate(p.paidAt)],
	];
	if (p.refundedAt) paymentRows.push(["Refunded at", fmtDate(p.refundedAt)]);
	y = table(doc, paymentRows, y) + 24;

	y = sectionTitle(doc, "Request details", y);
	const requestRows: [string, string][] = [
		["Tracking ref", p.request.trackingRef],
		["Title", p.request.title],
	];
	if (p.service) requestRows.push(["Service", p.service]);
	if (p.department) requestRows.push(["Department", p.department]);
	y = table(doc, requestRows, y) + 24;

	if (p.citizenName || p.citizenEmail) {
		y = sectionTitle(doc, "Billed to", y);
		const citizenRows: [string, string][] = [];
		if (p.citizenName) citizenRows.push(["Name", p.citizenName]);
		if (p.citizenEmail) citizenRows.push(["Email", p.citizenEmail]);
		table(doc, citizenRows, y);
	}

	watermark(doc, p);
	footer(doc);
};

// Used by GET /payments/:id/receipt (streamed to the response)
export const buildReceiptPdf = (p: ReceiptPayment) => {
	const doc = new PDFDocument({ size: "A4", margin: 0 });
	draw(doc, p);
	doc.end();
	return doc;
};

// Used for the email attachment (in memory)
export const buildReceiptPdfBuffer = (p: ReceiptPayment): Promise<Buffer> =>
	new Promise((resolve, reject) => {
		const doc = new PDFDocument({ size: "A4", margin: 0 });
		const chunks: Buffer[] = [];
		doc.on("data", (c: Buffer) => chunks.push(c));
		doc.on("end", () => resolve(Buffer.concat(chunks)));
		doc.on("error", reject);
		draw(doc, p);
		doc.end();
	});
