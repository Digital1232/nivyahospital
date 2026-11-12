// Keeps doctor cards and profile pages in step with the reception panel's booking settings
// (fees, booking type, OP hours). The page's own text stays as the fallback if this cannot load.
//   data-booking-row="Dr. X" data-book-url="/booking-1?..."  -> fee blocks, hours line and button
//   data-booking-hours="Dr. X"                               -> "OP consultation hours: ..."
(function () {
	var rows = document.querySelectorAll('[data-booking-row]');
	var hours = document.querySelectorAll('[data-booking-hours]');
	if (!rows.length && !hours.length) return;
	var API_BASE = /(^|\.)vercel\.app$|^localhost$/.test(window.location.hostname) ? '' : 'https://nivyahospital.vercel.app';
	var PHONE = '+919566443300';
	var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
	var time = function (m) { var h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0'); return ((h % 12) || 12) + ':' + mm + ' ' + (h < 12 ? 'AM' : 'PM'); };
	var hoursText = function (d) { return d.opHours || (d.schedule ? time(d.schedule.start_min) + '–' + time(d.schedule.end_min) : ''); };
	var feeSet = function (d) { return d.feeStatus !== 'pending' && d.fees && ['new', 'old'].every(function (k) { return Number(d.fees[k]) > 0; }); };
	var rupees = function (n) { return '₹' + Number(n).toLocaleString('en-IN'); };
	var block = function (label, value) {
		return '<div class="me-4 border-end pe-4"><p class="mb-1 text-muted fs-13">' + label + '</p>' + value + '</div>';
	};

	function renderRow(row, d) {
		var group = row.firstElementChild;
		var cta = row.querySelector('a.btn');
		if (!group || !cta) return;
		var fees = !feeSet(d)
			? block('Consultation', '<p class="text-primary fw-semibold mb-0">Contact for<br>consultation fee</p>')
			: d.fees.new === d.fees.old
				? block('Consultation', '<h3 class="text-orange mb-0">' + rupees(d.fees.new) + '</h3>')
				: block('New Patient', '<h3 class="text-orange mb-0">' + rupees(d.fees.new) + '</h3>') + block('Old Patient', '<h3 class="text-orange mb-0">' + rupees(d.fees.old) + '</h3>');
		var when = d.bookingMode === 'request'
			? 'Appointment time<br><strong>Confirmed by the hospital</strong>'
			: 'OP consultation hours<br><strong>' + esc(hoursText(d)).replace(/ and /g, '<br>') + '</strong>';
		group.innerHTML = fees + '<p class="mb-0 fs-14 text-dark"><i class="isax isax-calendar-tick me-2 text-success"></i>' + when + '</p>';

		var online = !d.schedule || d.schedule.online;
		var label, href;
		if (d.bookingMode === 'request') { label = 'Request Appointment'; href = row.getAttribute('data-book-url'); }
		else if (!feeSet(d) || !online) { label = 'Call to Book'; href = 'tel:' + PHONE; }
		else { label = 'Book Appointment Now'; href = row.getAttribute('data-book-url'); }
		cta.setAttribute('href', href);
		cta.innerHTML = '<i class="isax isax-calendar-1 me-2"></i>' + label;
	}

	fetch(API_BASE + '/api/availability?all=1', { cache: 'no-store' })
		.then(function (r) { return r.ok ? r.json() : null; })
		.then(function (data) {
			if (!data || !data.configured || !data.doctors) return;
			rows.forEach(function (row) {
				var d = data.doctors[row.getAttribute('data-booking-row')];
				if (d) renderRow(row, d);
			});
			hours.forEach(function (el) {
				var d = data.doctors[el.getAttribute('data-booking-hours')];
				if (!d) return;
				el.textContent = d.bookingMode === 'request' ? 'Appointment time confirmed by the hospital' : 'OP consultation hours: ' + hoursText(d);
			});
		})
		.catch(function () { /* keep the page's own text */ });
})();
