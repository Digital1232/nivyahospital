(function () {
	const encoder = new TextEncoder();

	function receiptPdf(jpeg, width, height) {
		const scale = Math.min(515 / width, 762 / height);
		const drawWidth = (width * scale).toFixed(2);
		const drawHeight = (height * scale).toFixed(2);
		const drawY = (802 - height * scale).toFixed(2);
		const drawing = 'q ' + drawWidth + ' 0 0 ' + drawHeight + ' 40 ' + drawY + ' cm /Receipt Do Q\n';
		const objects = [
			['<< /Type /Catalog /Pages 2 0 R >>'],
			['<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
			['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
				'/Resources << /XObject << /Receipt 4 0 R >> >> /Contents 5 0 R >>'],
			['<< /Type /XObject /Subtype /Image /Width ' + width + ' /Height ' + height +
				' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length +
				' >>\nstream\n', jpeg, '\nendstream'],
			['<< /Length ' + drawing.length + ' >>\nstream\n' + drawing + 'endstream']
		];
		const parts = [];
		let position = 0;
		function append(part) {
			const bytes = typeof part === 'string' ? encoder.encode(part) : part;
			parts.push(bytes);
			position += bytes.length;
		}
		append('%PDF-1.4\n');
		const offsets = objects.map((object, index) => {
			const offset = position;
			append((index + 1) + ' 0 obj\n');
			object.forEach(append);
			append('\nendobj\n');
			return offset;
		});
		const xref = position;
		append('xref\n0 6\n0000000000 65535 f \n');
		offsets.forEach((offset) => append(String(offset).padStart(10, '0') + ' 00000 n \n'));
		append('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
		return new Blob(parts, { type: 'application/pdf' });
	}

	window.downloadBookingReceipt = function (receipt) {
		const canvas = document.createElement('canvas');
		canvas.width = 1240;
		canvas.height = 1200;
		const context = canvas.getContext('2d');
		const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: receipt.currency }).format(receipt.amountPaise / 100);
		context.fillStyle = '#fff';
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = '#0b56a0';
		context.font = 'bold 52px Arial, sans-serif';
		context.fillText('Nivya Hospitals', 64, 88);
		context.fillStyle = '#172b43';
		context.font = 'bold 34px Arial, sans-serif';
		context.fillText(receipt.test ? 'Test payment receipt' : 'Appointment payment receipt', 64, 147);
		const rows = [
			['Booking ID', receipt.bookingId],
			['Razorpay payment ID', receipt.paymentId],
			['Patient', receipt.patient],
			['Doctor', receipt.doctor],
			['Appointment', receipt.appointment],
			['Services', receipt.services],
			[receipt.test ? 'Test amount' : 'Amount paid', amount]
		];
		let y = 222;
		rows.forEach(([label, value]) => {
			context.fillStyle = '#455c74';
			context.font = '25px Arial, sans-serif';
			context.fillText(label, 64, y);
			context.fillStyle = '#172b43';
			context.font = 'bold 28px Arial, sans-serif';
			const words = String(value).split(/\s+/);
			let line = '';
			words.forEach((word) => {
				const next = line ? line + ' ' + word : word;
				if (line && context.measureText(next).width > 715) {
					context.fillText(line, 450, y, 715);
					y += 34;
					line = word;
				} else {
					line = next;
				}
			});
			context.fillText(line, 450, y, 715);
			y += 83;
		});
		context.fillStyle = '#455c74';
		context.font = '25px Arial, sans-serif';
		context.fillText(receipt.test ? 'Test mode. No money was charged.' : 'Keep this receipt for your hospital visit.', 64, y + 12);
		context.fillText('Vannarpettai, Tirunelveli  |  +91 95664 43300', 64, y + 52);
		const jpeg = Uint8Array.from(atob(canvas.toDataURL('image/jpeg', 0.93).split(',')[1]), (byte) => byte.charCodeAt(0));
		const url = URL.createObjectURL(receiptPdf(jpeg, canvas.width, canvas.height));
		const link = document.createElement('a');
		link.href = url;
		link.download = 'Nivya-Receipt-' + String(receipt.bookingId).replace(/[^a-z\d_-]/gi, '') + '.pdf';
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 30000);
	};
})();
