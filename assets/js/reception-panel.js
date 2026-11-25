// Reception panel (reception.html). Kept in its own file so the page can forbid inline scripts (Content-Security-Policy).
(function () {
	'use strict';
	var HOSPITAL_PHONE = '+91 95664 43300';
	var $ = function (id) { return document.getElementById(id); };
	var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
	var me = null, doctors = [], today = '', current = 'dashboard', timer = null, settings = null, report = null;
	var STATUS_LABEL = { booked: 'Booked', confirmed: 'Confirmed', arrived: 'Waiting', in_consult: 'In consultation', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };
	var DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	function toast(msg, kind) {
		var el = document.createElement('div');
		el.className = 'alert alert-' + (kind || 'success') + ' shadow-sm py-2 mb-2';
		el.textContent = msg;
		$('toast').appendChild(el);
		setTimeout(function () { el.remove(); }, kind === 'warning' ? 9000 : kind === 'danger' ? 6000 : 3000);
	}

	async function api(action, data) {
		var res = await fetch('/api/reception', {
			method: 'POST', credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json', 'X-Nivya': '1' },
			body: JSON.stringify(Object.assign({ action: action }, data || {}))
		});
		var out = await res.json().catch(function () { return {}; });
		if (res.status === 401 && action !== 'login') { showLogin(); throw new Error('Please sign in again.'); }
		if (res.status === 503 && out.setup) { showSetup(out.error); throw new Error(out.error); }
		if (!res.ok) {
			// The reply stays on the error, e.g. { confirm: 'leave' } when the server wants a yes first.
			var err = new Error(out.error || 'Request failed (' + res.status + ').');
			err.status = res.status; err.data = out;
			throw err;
		}
		return out;
	}
	var run = function (p) { return p.catch(function (e) { toast(e.message, 'danger'); }); };
	// Ignores a second click or Enter while the first one is still being saved.
	function once(btn, work) {
		if (btn.dataset.busy) return Promise.resolve();
		btn.dataset.busy = '1'; btn.disabled = true;
		return run(Promise.resolve().then(work)).finally(function () { delete btn.dataset.busy; btn.disabled = false; });
	}

	var fmtDate = function (iso) { return iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
	var minToTime = function (m) { var h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0'); return ((h % 12) || 12) + ':' + mm + ' ' + (h < 12 ? 'AM' : 'PM'); };
	var badge = function (st) { return '<span class="badge-st st-' + st + '">' + esc(STATUS_LABEL[st] || st) + '</span>'; };
	// Marks a doctor who has visits on record but is no longer on the website.
	var formerTag = function (r) { return r && r.former ? ' <span class="badge bg-light text-dark border fw-normal">former doctor</span>' : ''; };
	// A booking paid with Razorpay test keys: not a real patient or payment.
	var testTag = function (a) { return a && a.is_test ? ' <span class="badge bg-warning text-dark" title="Paid with Razorpay test keys: not a real patient or payment">TEST</span>' : ''; };
	var money = function (p) { return p ? 'Rs ' + (p / 100).toLocaleString('en-IN') : ''; };
	var addDays = function (iso, n) { return new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); };
	var store = {
		get: function (k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
		set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
	};

	function downloadCsv(filename, header, rows) {
		var cell = function (v) {
			var s = String(v == null ? '' : v);
			if (/^[=+\-@]/.test(s)) s = "'" + s; // stop spreadsheet formulas
			return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
		};
		var csv = '﻿' + [header].concat(rows).map(function (r) { return r.map(cell).join(','); }).join('\r\n');
		var a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		a.download = filename;
		document.body.appendChild(a); a.click();
		setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
	}
	var APPT_CSV_HEAD = ['Booking ID', 'Date', 'Time', 'Token', 'Doctor', 'Patient', 'Phone', 'Age', 'Gender', 'Type', 'Visit', 'Status', 'Paid (Rs)', 'Payment ID', 'Reason', 'Notes'];
	var apptCsvRow = function (a) {
		return [a.booking_id, a.date, a.time, a.token_no, a.doctor, a.name, a.phone, a.age, a.gender, a.source === 'online' ? (a.is_test ? 'Online (test)' : 'Online') : 'Walk-in',
			a.visit_type === 'old' ? 'Follow-up' : 'New', STATUS_LABEL[a.status] || a.status, a.amount_paise ? a.amount_paise / 100 : '', a.payment_id, a.reason, a.notes];
	};

	function setReportRange(kind) {
		var from = today;
		if (kind === '7') from = addDays(today, -6);
		if (kind === '30') from = addDays(today, -29);
		if (kind === 'month') from = today.slice(0, 8) + '01';
		$('rp-from').value = from; $('rp-to').value = today;
	}

	/* ---------- WhatsApp messages (reception presses Send) ---------- */
	function waLink(a, kind, extra) {
		var s = settings || {};
		var tpl = (s.templates && s.templates[kind]) || '';
		var vals = {
			name: a.name || 'Patient', doctor: a.doctor, when: fmtDate(a.date) + (a.time ? ' at ' + a.time : ''),
			id: a.booking_id, token: a.token_no == null ? '' : a.token_no, reason: extra ? ' (' + extra + ')' : '',
			phone: s.hospitalPhone || HOSPITAL_PHONE, address: s.address || ''
		};
		var text = tpl.replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(vals, k) ? vals[k] : m; });
		return 'https://wa.me/91' + String(a.phone || '').replace(/\D/g, '').slice(-10) + '?text=' + encodeURIComponent(text);
	}
	function waKindFor(a) {
		if (a.status === 'cancelled') return ['cancel', 'Cancellation'];
		if (a.status === 'arrived' || a.status === 'in_consult') return ['token', 'Token'];
		if (a.date > today) return ['reminder', 'Reminder'];
		return ['confirm', 'Confirmation'];
	}

	/* ---------- Views ---------- */
	function showLogin() {
		stopTimer();
		$('app').hidden = true; $('setup-view').hidden = true;
		// Leaving a signed-in screen: reload so nothing from this account stays in the page for the next person.
		if (me) { me = null; location.reload(); return; }
		$('login-view').hidden = false; $('lg-user').focus();
	}
	function showSetup(msg) { stopTimer(); $('app').hidden = true; $('login-view').hidden = true; $('setup-view').hidden = false; $('setup-msg').textContent = msg; }
	function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

	// Reception accounts work with the last 7 days and the next 30 (the server checks this too).
	function applyDateLimits() {
		if (me.role !== 'admin') ['ap-date', 'ap-from', 'ap-to', 'rm-date'].forEach(function (id) { $(id).min = addDays(today, -7); $(id).max = addDays(today, 30); });
	}

	/* ---------- New day while the panel is open ---------- */
	// The server's clock, not this computer's, decides the hospital day (IST).
	var clockSkew = 0;
	var hospitalToday = function () { return new Date(Date.now() + clockSkew + 330 * 60000).toISOString().slice(0, 10); };
	// A panel left open overnight moves to the new day by itself: dates that showed "today"
	// (or "tomorrow" for reminders) move forward, and the open screen reloads.
	function checkDay() {
		if (!me || !today) return;
		var now = hospitalToday();
		if (now <= today) return;
		var old = today;
		today = now;
		if ($('ap-date').value === old) $('ap-date').value = today;
		if ($('rm-date').value === addDays(old, 1)) $('rm-date').value = addDays(today, 1);
		['ap-to', 'rp-to', 'ac-to'].forEach(function (id) { if ($(id).value === old) $(id).value = today; });
		applyDateLimits();
		toast('A new day has started (' + fmtDate(today) + '). The panel now shows today.', 'info');
		show(current);
	}
	setInterval(checkDay, 60000);
	document.addEventListener('visibilitychange', function () { if (!document.hidden) checkDay(); });

	function startApp(data) {
		me = data.user; doctors = data.doctors; today = data.today; settings = data.settings;
		clockSkew = typeof data.now === 'number' ? data.now - Date.now() : 0;
		$('pw-admin').hidden = me.username !== 'admin';
		$('pw-fields').hidden = me.username === 'admin';
		$('rm-date').value = addDays(today, 1);
		$('ap-from').value = addDays(today, me.role === 'admin' ? -30 : -7); $('ap-to').value = today;
		applyDateLimits();
		setReportRange('30');
		$('who').textContent = me.name + (me.role === 'admin' ? ' (admin)' : '');
		document.querySelectorAll('[data-admin]').forEach(function (el) { el.hidden = me.role !== 'admin'; });
		document.querySelectorAll('select[data-doctors]').forEach(function (sel) {
			var first = sel.dataset.doctors === 'all' ? '<option value="">All doctors</option>' : '<option value="">Select doctor</option>';
			sel.innerHTML = first + doctors.map(function (d) { return '<option value="' + esc(d.name) + '">' + esc(d.name) + ' (' + esc(d.speciality) + ')</option>'; }).join('');
		});
		$('ap-date').value = today;
		$('login-view').hidden = true; $('setup-view').hidden = true; $('app').hidden = false;
		show(current);
	}

	function show(view) {
		var tab = document.querySelector('#tabs button[data-view="' + view + '"]');
		if (tab && tab.hasAttribute('data-admin') && (!me || me.role !== 'admin')) view = 'dashboard';
		current = view;
		document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === view); });
		document.querySelectorAll('[data-section]').forEach(function (s) { s.hidden = s.dataset.section !== view; });
		stopTimer();
		var loader = loaders[view];
		if (loader) {
			run(loader());
			if (view === 'dashboard' || view === 'tokens') timer = setInterval(function () { if (!document.hidden) loader().catch(function () {}); }, 20000);
		}
	}

	var loaders = {
		dashboard: async function () {
			var d = await api('dashboard');
			$('dash-date').textContent = fmtDate(d.date);
			renderIssues(d.paymentIssues || []);
			var t = d.totals;
			var cards = [['Online bookings', t.online, 'fa-globe'], ['Walk-ins', t.walkin, 'fa-person-walking'], ['Yet to arrive', t.expected, 'fa-hourglass-half'],
				['Waiting', t.waiting, 'fa-chair'], ['In consultation', t.inConsult, 'fa-stethoscope'], ['Completed', t.completed, 'fa-circle-check']];
			$('dash-stats').innerHTML = cards.map(function (c) {
				return '<div class="col-6 col-md-4 col-xl-2"><div class="stat"><div class="l"><i class="fa-solid ' + c[2] + ' me-1"></i>' + c[0] + '</div><div class="n">' + c[1] + '</div></div></div>';
			}).join('');
			$('dash-leave').innerHTML = d.leave.map(function (l) {
				return '<div class="alert alert-warning py-2"><i class="fa-solid fa-plane-departure me-1"></i>' + esc(l.doctor) + ' is on leave today' + (l.reason ? ': ' + esc(l.reason) : '') + '.</div>';
			}).join('');
			$('dash-doctors').innerHTML = d.perDoctor.map(function (p) {
				return '<tr><td class="fw-semibold">' + esc(p.doctor) + formerTag(p) + '</td>' +
					'<td>' + (p.current ? '<span class="token">' + p.current + '</span>' : '<span class="muted">-</span>') + '</td>' +
					'<td>' + (p.next ? '<span class="token" style="background:#8a5a00">' + p.next + '</span>' : '<span class="muted">-</span>') + '</td>' +
					'<td>' + p.waiting + '</td><td>' + p.expected + '</td><td>' + p.completed + '</td>' +
					'<td class="text-end">' + (p.waiting ? '<button class="btn btn-xs btn-primary" data-callnext="' + esc(p.doctor) + '">Call next</button>' : '') + '</td></tr>';
			}).join('');

			var ex = d.expectedList || [];
			$('dash-expected').innerHTML = ex.length ? ex.map(function (a) {
				return '<div class="d-flex flex-wrap align-items-center gap-2 border-bottom py-2">' +
					'<span class="fw-semibold text-nowrap" style="min-width:76px">' + esc(a.time || '-') + '</span>' +
					'<span class="flex-grow-1">' + esc(a.name) + ' <span class="muted small">' + esc(a.phone) + '</span>' + testTag(a) + '<br><span class="small muted">' + esc(a.doctor) + ' &middot; ' + esc(a.booking_id) + '</span></span>' +
					badge(a.status) +
					'<button class="btn btn-xs btn-primary" data-op="arrive" data-id="' + a.id + '"><i class="fa-solid fa-ticket me-1"></i>Check in</button></div>';
			}).join('') : '<div class="text-center py-4 muted"><i class="fa-regular fa-calendar-check fs-3 d-block mb-2"></i>No online bookings waiting to arrive today.</div>';

			var tm = d.tomorrow;
			if (tm) {
				$('dash-tomorrow-date').textContent = fmtDate(tm.date);
				var total = tm.perDoctor.reduce(function (s, p) { return s + p.booked; }, 0);
				$('dash-tomorrow').innerHTML = tm.perDoctor.map(function (p) {
					var off = tm.leave.indexOf(p.doctor) >= 0;
					return '<div class="d-flex align-items-center gap-2 py-1 small"><span class="flex-grow-1">' + esc(p.doctor) + formerTag(p) + '</span>' +
						(off ? '<span class="badge bg-warning text-dark">On leave</span>' : '<span class="fw-semibold">' + p.booked + '</span>' +
						(p.unconfirmed ? '<span class="badge-st st-booked">' + p.unconfirmed + ' to confirm</span>' : '')) + '</div>';
				}).join('') +
					(total ? '<button type="button" class="btn btn-sm btn-success w-100 mt-2" data-goto="reminders"><i class="fa-brands fa-whatsapp me-1"></i>Send reminders (' + total + ')</button>'
						: '<p class="small muted mb-0 mt-2">No bookings yet for tomorrow.</p>');
			}

			var ul = d.upcomingLeave || [];
			$('dash-upleave').innerHTML = ul.length ? ul.map(function (l) {
				return '<div class="d-flex align-items-center gap-2 py-1 small"><i class="fa-solid fa-plane-departure muted"></i><span class="flex-grow-1">' + esc(l.doctor) +
					(l.reason ? ' <span class="muted">(' + esc(l.reason) + ')</span>' : '') + '</span><span class="text-nowrap">' + fmtDate(l.date).replace(/ \d{4}$/, '') + '</span></div>';
			}).join('') : '<p class="small muted mb-0">No leave in the next 30 days.</p>';
		},

		appointments: async function () {
			var d = await api('appointments', apptFilter());
			var list = d.appointments;
			if ($('ap-range').value === 'upcoming') list.sort(function (a, b) { return a.date === b.date ? (a.time_min || 0) - (b.time_min || 0) : a.date < b.date ? -1 : 1; });
			$('ap-count').textContent = list.length + ' appointment' + (list.length === 1 ? '' : 's') +
				(list.length >= d.limit ? ' (showing the latest ' + d.limit + (me.role === 'admin' ? '; use Export CSV for all' : '') + ')' : '') +
				(d.staffRange ? '. Reception accounts see the last 7 days and upcoming dates; for an older visit, find the patient in Patients.' : '');
			$('ap-list').innerHTML = list.length ? list.map(apptCard).join('') : '<div class="panel muted">No appointments found.</div>';
		},

		patients: async function () {
			var d = await api('patientSearch', { search: $('pt-search').value });
			if (d.needSearch) { $('pt-list').innerHTML = '<p class="small muted mb-0">Type at least 3 letters or digits of the name or mobile number.</p>'; return; }
			$('pt-list').innerHTML = d.patients.length ? d.patients.map(function (p) {
				return '<button type="button" class="appt w-100 text-start d-block" data-patient="' + p.id + '">' +
					'<div class="fw-semibold">' + esc(p.name) + ' <span class="muted fw-normal">' + esc(p.phone) + '</span></div>' +
					'<div class="meta">' + (p.age != null ? p.age + ' yrs ' : '') + esc(p.gender || '') + ' &middot; ' + p.bookings + ' booking' + (p.bookings === 1 ? '' : 's') +
					', ' + p.visits + ' completed' + (p.last_visit ? ' &middot; last ' + fmtDate(p.last_visit) : '') + '</div></button>';
			}).join('') : '<p class="muted mb-0">No patients found.</p>';
		},

		reminders: async function () {
			var date = $('rm-date').value || addDays(today, 1);
			var d = await api('appointments', { date: date, doctor: $('rm-doctor').value });
			var list = d.appointments.filter(function (a) { return (a.status === 'booked' || a.status === 'confirmed') && a.phone; });
			list.sort(function (a, b) { return a.doctor === b.doctor ? (a.time_min || 0) - (b.time_min || 0) : a.doctor < b.doctor ? -1 : 1; });
			var sent = store.get('nv_reminded') || {};
			var done = list.filter(function (a) { return sent[a.booking_id]; }).length;
			$('rm-count').textContent = list.length ? done + ' of ' + list.length + ' reminded for ' + fmtDate(date) + '.' : '';
			$('rm-list').innerHTML = list.length ? list.map(function (a) {
				var ok = !!sent[a.booking_id];
				return '<div class="appt d-flex flex-wrap align-items-center gap-2' + (ok ? ' opacity-75' : '') + '">' +
					'<div class="flex-grow-1"><div class="fw-semibold">' + (ok ? '<i class="fa-solid fa-circle-check text-success me-1"></i>' : '') + esc(a.name) +
					' <span class="muted fw-normal">' + esc(a.phone) + '</span>' + testTag(a) + '</div>' +
					'<div class="meta">' + esc(a.doctor) + ' &middot; ' + esc(a.time || '') + ' &middot; ' + esc(a.booking_id) + ' &middot; ' + badge(a.status) + '</div></div>' +
					'<a class="btn btn-sm ' + (ok ? 'btn-outline-success' : 'btn-success') + '" target="_blank" rel="noopener" data-remind="' + esc(a.booking_id) + '" href="' +
					esc(waLink(a, 'reminder')) + '"><i class="fa-brands fa-whatsapp me-1"></i>' + (ok ? 'Send again' : 'Send reminder') + '</a></div>';
			}).join('') : '<div class="panel muted">No booked appointments to remind on ' + fmtDate(date) + '.</div>';
		},

		reports: async function () {
			var d = report = await api('reports', { from: $('rp-from').value, to: $('rp-to').value });
			var t = d.totals;
			var rev = !!d.showRevenue; // admins only
			var cards = [['Appointments', t.total], ['Online', t.online], ['Walk-ins', t.walkin], ['Completed', t.completed],
				['Cancelled', t.cancelled], ['No-shows', t.noShow], ['New patients', d.newRegistrations]]
				.concat(rev ? [['Paid online', money(t.paidPaise) || 'Rs 0'], ['Cancelled after paying (check refund)', money(t.cancelledPaidPaise) || 'Rs 0']] : [])
				.concat([['Avg. wait', d.avgWaitMin == null ? '-' : d.avgWaitMin + ' min']]);
			$('rp-paid-head').hidden = !rev;
			$('rp-stats').innerHTML = cards.map(function (c) {
				return '<div class="col-6 col-md-4 col-xl"><div class="stat"><div class="l">' + c[0] + '</div><div class="n" style="font-size:22px">' + esc(c[1]) + '</div></div></div>';
			}).join('') + (d.testBookings ? '<div class="col-12 small muted">' + d.testBookings + ' test booking' + (d.testBookings === 1 ? '' : 's') +
				' (paid with Razorpay test keys) not counted.</div>' : '');
			$('rp-doctors').innerHTML = d.byDoctor.map(function (r) {
				return '<tr><td class="fw-semibold">' + esc(r.doctor) + formerTag(r) + '</td><td>' + r.total + '</td><td>' + r.online + '</td><td>' + r.walkin + '</td><td>' + r.completed +
					'</td><td>' + r.cancelled + '</td><td>' + r.noShow + '</td><td>' + r.newPatients + '</td><td>' + r.followUps + '</td>' +
					(rev ? '<td>' + (money(r.paidPaise) || '-') + '</td>' : '') + '</tr>';
			}).join('');
			var max = Math.max.apply(null, [1].concat(d.byDay.map(function (r) { return r.total; })));
			$('rp-days').innerHTML = d.byDay.length ? d.byDay.slice().reverse().map(function (r) {
				var pct = function (n) { return (n / max * 100).toFixed(1) + '%'; };
				return '<div class="d-flex align-items-center gap-2 mb-1 small"><span style="width:110px" class="text-nowrap">' + fmtDate(r.date).replace(/ \d{4}$/, '') + '</span>' +
					'<span class="flex-grow-1 d-flex" style="height:14px;background:#eef1f6;border-radius:4px;overflow:hidden" title="Online ' + r.online + ', walk-in ' + r.walkin + '">' +
					'<span style="width:' + pct(r.online) + ';background:#0b56a0"></span><span style="width:' + pct(r.walkin) + ';background:#c518ca"></span></span>' +
					'<span style="width:36px" class="text-end fw-semibold">' + r.total + '</span></div>';
			}).join('') + '<div class="small muted mt-2"><span style="display:inline-block;width:10px;height:10px;background:#0b56a0;border-radius:2px"></span> Online &nbsp; ' +
				'<span style="display:inline-block;width:10px;height:10px;background:#c518ca;border-radius:2px"></span> Walk-in</div>' : '<p class="muted mb-0">No appointments in this range.</p>';
		},

		settings: async function () {
			if (me.role !== 'admin') return;
			var s = (await api('me')).settings;
			settings = s;
			$('st-phone').value = s.hospitalPhone; $('st-address').value = s.address;
			var LABEL = { confirm: 'Appointment confirmed', reminder: 'Reminder (day before)', reschedule: 'Rescheduled', cancel: 'Cancelled', token: 'Walk-in / check-in token' };
			$('st-templates').innerHTML = Object.keys(s.templates).map(function (k) {
				return '<label class="form-label small mb-1" for="st-t-' + k + '">' + esc(LABEL[k] || k) + '</label>' +
					'<textarea class="form-control form-control-sm mb-2" rows="2" id="st-t-' + k + '" data-template="' + k + '" maxlength="600">' + esc(s.templates[k]) + '</textarea>';
			}).join('');
		},

		walkin: async function () {},

		tokens: async function () {
			var d = await api('queue');
			// A doctor who has left still gets a column if a patient of theirs is in today's queue.
			var cols = doctors.slice();
			d.queue.forEach(function (a) {
				if (!cols.some(function (c) { return c.name === a.doctor; })) cols.push({ name: a.doctor, speciality: 'No longer on the website', former: true });
			});
			$('tk-cols').innerHTML = cols.map(function (doc) {
				var mine = d.queue.filter(function (a) { return a.doctor === doc.name; });
				var now = mine.filter(function (a) { return a.status === 'in_consult'; });
				var waiting = mine.filter(function (a) { return a.status === 'arrived'; });
				var done = mine.filter(function (a) { return a.status === 'completed' || a.status === 'no_show'; });
				return '<div class="col-md-6 col-xl-3"><div class="queue-col">' +
					'<h3 class="h6 mb-1">' + esc(doc.name) + '</h3><p class="small muted mb-2">' + esc(doc.speciality) + '</p>' +
					'<div class="now-serving mb-3"><div class="small muted mb-1">Now serving</div>' +
					(now.length ? now.map(function (a) {
						return '<div class="d-flex align-items-center gap-2 mb-1"><span class="token">' + a.token_no + '</span><span class="flex-grow-1">' + esc(a.name) + '</span>' +
							'<button class="btn btn-xs btn-success" data-op="complete" data-id="' + a.id + '">Done</button>' +
							'<button class="btn btn-xs btn-outline-secondary" data-op="requeue" data-id="' + a.id + '" title="Send back to waiting"><i class="fa-solid fa-rotate-left"></i></button></div>';
					}).join('') : '<span class="muted">Nobody</span>') + '</div>' +
					(waiting.length ? '<button class="btn btn-primary btn-sm w-100 mb-2" data-callnext="' + esc(doc.name) + '"><i class="fa-solid fa-bullhorn me-1"></i>Call next (' + waiting[0].token_no + ')</button>' : '') +
					'<div class="small muted mb-1">Waiting (' + waiting.length + ')</div>' +
					(waiting.map(function (a) {
						return '<div class="d-flex align-items-center gap-2 border-bottom py-2"><span class="token" style="background:#8a5a00">' + a.token_no + '</span>' +
							'<span class="flex-grow-1 small">' + esc(a.name) + '<br><span class="muted">' + (a.source === 'online' ? 'Online ' + esc(a.time || '') : 'Walk-in') + '</span></span>' +
							'<button class="btn btn-xs btn-outline-primary" data-op="start" data-id="' + a.id + '">Call</button>' +
							'<button class="btn btn-xs btn-outline-secondary" data-op="no_show" data-id="' + a.id + '" title="No-show"><i class="fa-solid fa-user-slash"></i></button></div>';
					}).join('') || '<p class="small muted">No one waiting.</p>') +
					(done.length ? '<div class="small muted mt-2">Finished: ' + done.map(function (a) { return a.token_no + (a.status === 'no_show' ? ' (absent)' : ''); }).join(', ') + '</div>' : '') +
					'</div></div>';
			}).join('');
		},

		schedule: async function () { renderSchedule((await api('schedule')).schedule); },

		booking: async function () { renderBooking((await api('booking')).booking); },

		staff: async function () { renderStaff((await api('staff')).staff); },

		activity: function () { return loadActivity(false); }
	};

	/* ---------- Activity log (admin) ---------- */
	var activityLast = null;
	var ACT_LABEL = {
		login: 'Signed in', walkin: 'Registered walk-in', confirm: 'Confirmed appointment', arrive: 'Checked in',
		start: 'Called in to doctor', requeue: 'Sent back to queue', complete: 'Marked consultation done',
		cancel: 'Cancelled appointment', no_show: 'Marked no-show', reschedule: 'Rescheduled appointment', note: 'Edited appointment note',
		patient_edit: 'Edited patient', patient_delete: 'Deleted patient', schedule: 'Changed doctor timings',
		leave_add: 'Added doctor leave', day_set: 'Changed one day timing', leave_remove: 'Removed doctor leave', booking_save: 'Changed fees / booking settings',
		booking_reset: 'Reset fees / booking settings', settings: 'Changed hospital details / messages',
		settings_reset: 'Reset hospital details / messages', staff_add: 'Added staff account', staff_update: 'Updated staff account',
		password_change: 'Changed own password', patient_view: 'Opened patient record', export: 'Exported appointments',
		bulk_blocked: 'Blocked: too many patient look-ups', payment_booked: 'Booked a paid patient on a new time', payment_refunded: 'Marked payment as refunded'
	};
	function activityDetail(e) {
		var d = e.detail || {};
		var mins = function (m) { var h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0'); return ((h % 12) || 12) + ':' + mm + ' ' + (h < 12 ? 'AM' : 'PM'); };
		switch (e.action) {
			case 'reschedule': return 'From ' + d.from + ' to ' + d.to;
			case 'schedule': return d.doctor + ': ' + (d.days || []).map(function (x) { return DAY[x]; }).join(', ') + ', ' + mins(d.start) + '–' + mins(d.end) +
				(d.cap ? ', limit ' + d.cap + '/slot' : '') + (d.online === false ? ', online booking paused' : '');
			case 'leave_add': case 'leave_remove': return d.doctor + ' on ' + fmtDate(d.date);
			case 'day_set': return d.doctor + ' on ' + fmtDate(d.date) + ': ' + (d.mode === 'off' ? 'off' : d.mode === 'custom' ? mins(d.start) + '–' + mins(d.end) : 'usual timing');
			case 'booking_save': case 'booking_reset': return d.doctor || '';
			case 'walkin': return (d.doctor || '') + (d.doctorOnLeave ? ' (doctor was on leave; token given after confirming)' : '');
			case 'staff_add': case 'staff_update': return d.username + ' (' + (d.role === 'admin' ? 'admin' : 'staff') + (d.active === false ? ', disabled' : '') + ')';
			case 'patient_delete': return d.appointments + ' visit(s) removed' + (d.kept ? ', ' + d.kept + ' paid visit(s) kept for accounts' : '');
			case 'export': return d.rows + ' row(s)';
			case 'bulk_blocked': return 'Limit: ' + d.limit + ' per hour';
			case 'payment_booked': return (d.doctor || '') + ', moved to ' + (d.to || '') + ', ' + money(d.amount) + (d.payment ? ', ' + d.payment : '');
			case 'payment_refunded': return (d.doctor || '') + ', ' + money(d.amount) + (d.payment ? ', ' + d.payment : '');
			default: return d.from ? 'Was ' + (STATUS_LABEL[d.from] || d.from) : '';
		}
	}
	async function loadActivity(more) {
		if (!$('ac-from').value) { $('ac-to').value = today; $('ac-from').value = addDays(today, -6); }
		var d = await api('activity', { from: $('ac-from').value, to: $('ac-to').value, actor: $('ac-actor').value, before: more && activityLast ? activityLast : undefined });
		var sel = $('ac-actor'), keep = sel.value;
		sel.innerHTML = '<option value="">Everyone</option>' + d.actors.map(function (a) { return '<option' + (a === keep ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('');
		var html = d.entries.map(function (e) {
			var when = new Date(e.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
			var who = e.patient_name ? esc(e.patient_name) : (e.action === 'patient_delete' ? '<span class="muted">Patient #' + esc(e.detail && e.detail.patient) + ' (deleted)</span>' : '');
			var booking = e.booking_id ? '<div class="small muted">' + esc(e.booking_id) + (e.appt_doctor ? ' &middot; ' + esc(e.appt_doctor) : '') + (e.appt_date ? ' &middot; ' + fmtDate(e.appt_date) + ' ' + esc(e.appt_time || '') : '') + '</div>'
				: (e.appointment_id && !e.patient_name ? '<span class="muted small">Appointment deleted</span>' : '');
			var detail = activityDetail(e);
			return '<tr><td class="small text-nowrap">' + esc(when) + '</td><td class="fw-semibold">' + esc(e.actor) + '</td>' +
				'<td>' + esc(ACT_LABEL[e.action] || e.action) + (detail ? '<div class="small muted">' + esc(detail) + '</div>' : '') + '</td>' +
				'<td>' + who + booking + '</td></tr>';
		}).join('');
		if (more) $('ac-list').insertAdjacentHTML('beforeend', html);
		else $('ac-list').innerHTML = html || '<tr><td colspan="4" class="muted">No activity in these dates.</td></tr>';
		if (d.entries.length) activityLast = d.entries[d.entries.length - 1].id;
		$('ac-more').hidden = !d.more;
	}

	function apptFilter() {
		var mode = $('ap-range').value;
		return {
			date: mode === 'day' ? $('ap-date').value : '',
			from: mode === 'upcoming' ? today : mode === 'range' ? $('ap-from').value : '',
			to: mode === 'range' ? $('ap-to').value : '',
			doctor: $('ap-doctor').value, status: $('ap-status').value, source: $('ap-source').value, search: $('ap-search').value
		};
	}

	async function showPatient(id) {
		var d = await api('patient', { id: Number(id) });
		var p = d.patient;
		var opt = function (v) { return '<option' + (p.gender === v ? ' selected' : '') + '>' + v + '</option>'; };
		$('pt-detail').classList.remove('muted');
		$('pt-detail').innerHTML =
			'<form id="pt-form" data-id="' + p.id + '" autocomplete="off">' +
			'<div class="d-flex align-items-center gap-2 mb-3"><h2 class="h5 mb-0 me-auto">' + esc(p.name) + '</h2>' +
			'<a class="btn btn-sm btn-outline-success" target="_blank" rel="noopener" href="https://wa.me/91' + esc(p.phone) + '"><i class="fa-brands fa-whatsapp me-1"></i>Chat</a>' +
			'<a class="btn btn-sm btn-outline-primary" href="tel:+91' + esc(p.phone) + '"><i class="fa-solid fa-phone me-1"></i>Call</a></div>' +
			'<div class="row g-2">' +
			'<div class="col-sm-6"><label class="form-label small" for="pt-f-name">Name</label><input class="form-control form-control-sm" id="pt-f-name" name="name" value="' + esc(p.name) + '" required></div>' +
			'<div class="col-sm-6"><label class="form-label small" for="pt-f-phone">Mobile</label><input class="form-control form-control-sm" id="pt-f-phone" name="phone" value="' + esc(p.phone) + '" inputmode="numeric" maxlength="10" required></div>' +
			'<div class="col-4 col-sm-2"><label class="form-label small" for="pt-f-age">Age</label><input type="number" min="0" max="120" class="form-control form-control-sm" id="pt-f-age" name="age" value="' + (p.age == null ? '' : p.age) + '"></div>' +
			'<div class="col-8 col-sm-4"><label class="form-label small" for="pt-f-gender">Gender</label><select class="form-select form-select-sm" id="pt-f-gender" name="gender"><option value="">-</option>' + opt('Female') + opt('Male') + opt('Other') + '</select></div>' +
			'<div class="col-12"><label class="form-label small" for="pt-f-notes">Notes (allergies, conditions, anything staff should know)</label><textarea class="form-control form-control-sm" id="pt-f-notes" name="notes" rows="2" maxlength="1000">' + esc(p.notes || '') + '</textarea></div>' +
			'</div><button class="btn btn-sm btn-primary mt-2" type="submit">Save patient</button>' +
			(me && me.role === 'admin' ? '<button class="btn btn-sm btn-outline-danger mt-2 ms-2" type="button" data-delete-patient="' + p.id + '" data-name="' + esc(p.name) + '" data-visits="' + d.visits.length + '" data-paid="' + d.visits.filter(function (a) { return a.payment_id; }).length + '"><i class="fa-solid fa-trash me-1"></i>Delete patient</button>' : '') +
			'</form>' +
			'<hr><h3 class="h6 mb-2">Visit history (' + d.visits.length + ')</h3>' +
			(d.visits.length ? d.visits.map(function (a) {
				return '<div class="d-flex flex-wrap align-items-center gap-2 border-bottom py-2 small"><span class="text-nowrap fw-semibold" style="min-width:120px">' + fmtDate(a.date) + '</span>' +
					'<span class="flex-grow-1">' + esc(a.doctor) + (a.time ? ' &middot; ' + esc(a.time) : '') + ' &middot; ' + (a.source === 'online' ? 'Online' : 'Walk-in') + testTag(a) +
					(a.token_no ? ' &middot; Token ' + a.token_no : '') + (a.reason ? '<br><span class="muted">' + esc(a.reason) + '</span>' : '') + '</span>' + badge(a.status) + '</div>';
			}).join('') : '<p class="muted small">No visits yet.</p>');
		if (window.innerWidth < 992) $('pt-detail').scrollIntoView({ behavior: 'smooth' });
	}

	function apptCard(a) {
		var b = [];
		var st = a.status;
		if (st === 'booked') b.push('<button class="btn btn-xs btn-outline-success" data-op="confirm" data-id="' + a.id + '">Confirm</button>');
		if ((st === 'booked' || st === 'confirmed') && a.date === today) b.push('<button class="btn btn-xs btn-primary" data-op="arrive" data-id="' + a.id + '"><i class="fa-solid fa-ticket me-1"></i>Check in</button>');
		if (st === 'arrived') b.push('<button class="btn btn-xs btn-primary" data-op="start" data-id="' + a.id + '">Call in</button>');
		if (st === 'in_consult' || st === 'arrived') b.push('<button class="btn btn-xs btn-success" data-op="complete" data-id="' + a.id + '">Done</button>');
		if (st === 'booked' || st === 'confirmed') b.push('<button class="btn btn-xs btn-outline-primary" data-resched="' + a.id + '" data-doctor="' + esc(a.doctor) + '">Reschedule</button>');
		if (st === 'booked' || st === 'confirmed' || st === 'arrived') {
			b.push('<button class="btn btn-xs btn-outline-secondary" data-op="no_show" data-id="' + a.id + '">No-show</button>');
			b.push('<button class="btn btn-xs btn-outline-danger" data-op="cancel" data-id="' + a.id + '">Cancel</button>');
		}
		var wa = waKindFor(a);
		if (a.phone && st !== 'completed' && st !== 'no_show') {
			b.push('<a class="btn btn-xs btn-outline-success" target="_blank" rel="noopener" href="' + esc(waLink(a, wa[0], a.notes)) + '"><i class="fa-brands fa-whatsapp me-1"></i>' + wa[1] + '</a>');
		}
		return '<div class="appt" id="appt-' + a.id + '">' +
			'<div class="d-flex flex-wrap align-items-start gap-2">' +
			(a.token_no ? '<span class="token">' + a.token_no + '</span>' : '') +
			'<div class="flex-grow-1"><div class="fw-semibold">' +
			(a.patient_id ? '<button type="button" class="btn btn-link p-0 fw-semibold align-baseline text-decoration-none" data-patientnav="' + a.patient_id + '" title="Open patient history">' + esc(a.name) + '</button>' : esc(a.name || 'Patient record removed')) +
			' <span class="muted fw-normal">' + esc(a.phone) + '</span>' + testTag(a) + '</div>' +
			'<div class="meta">' + esc(a.doctor) + ' &middot; ' + fmtDate(a.date) + (a.time ? ' ' + esc(a.time) : '') + ' &middot; ' +
			(a.source === 'online' ? '<i class="fa-solid fa-globe"></i> Online' : '<i class="fa-solid fa-person-walking"></i> Walk-in') +
			' &middot; ' + (a.visit_type === 'old' ? 'Follow-up' : 'New') + (a.amount_paise ? ' &middot; Paid ' + money(a.amount_paise) : '') + '</div>' +
			'<div class="meta">' + esc(a.booking_id) + (a.age ? ' &middot; ' + a.age + ' yrs' : '') + (a.gender ? ' ' + esc(a.gender) : '') +
			(a.reason ? ' &middot; ' + esc(a.reason) : '') + (a.notes ? ' &middot; <em>' + esc(a.notes) + '</em>' : '') + '</div></div>' +
			badge(st) + '</div>' +
			(b.length ? '<div class="d-flex flex-wrap gap-1 mt-2">' + b.join('') + '</div>' : '') +
			'<div data-resched-box="' + a.id + '"></div></div>';
	}

	/* ---------- Picking a new date and time (reschedule, or a paid patient who lost their slot) ---------- */
	var timeFormSeq = 0;
	function timeForm(attr, id, doctor) {
		var k = 'tf' + (++timeFormSeq);
		return '<form class="row g-2 mt-2 align-items-end" ' + attr + '="' + esc(id) + '" data-doctor="' + esc(doctor) + '">' +
			'<div class="col-6 col-sm-4"><label class="form-label small" for="' + k + '-date">New date</label><input type="date" class="form-control form-control-sm" id="' + k + '-date" name="date" min="' + today + '" required></div>' +
			'<div class="col-6 col-sm-4"><label class="form-label small" for="' + k + '-time">New time</label><select class="form-select form-select-sm" id="' + k + '-time" name="time" required disabled><option value="">Pick a date first</option></select></div>' +
			'<div class="col-12 col-sm-4"><button class="btn btn-sm btn-primary" type="submit" disabled>Save new time</button></div>' +
			'<div class="col-12 small text-danger" data-time-hint></div></form>';
	}
	// Offers only the times this doctor can really see a patient on the chosen date.
	async function fillTimes(f) {
		var sel = f.time, save = f.querySelector('[type=submit]'), hint = f.querySelector('[data-time-hint]'), date = f.date.value;
		var closed = function (msg) { sel.innerHTML = '<option value="">Not available</option>'; hint.textContent = msg; };
		sel.disabled = save.disabled = true; hint.textContent = '';
		sel.innerHTML = '<option value="">' + (date ? 'Loading...' : 'Pick a date first') + '</option>';
		if (!date) return;
		var d;
		try { d = await api('dayOptions', { doctor: f.dataset.doctor, date: date }); }
		catch (err) { if (f.date.value === date) closed(err.message); return; }
		if (f.date.value !== date) return; // the date was changed again meanwhile
		if (!d.open) return closed(d.message);
		if (!d.slots.some(function (t) { return d.full.indexOf(t) < 0; })) return closed('No free times left that day. Pick another date.');
		sel.innerHTML = '<option value="">Choose time</option>' + d.slots.map(function (t) {
			var full = d.full.indexOf(t) >= 0;
			return '<option value="' + esc(t) + '"' + (full ? ' disabled' : '') + '>' + esc(t) + (full ? ' (full)' : '') + '</option>';
		}).join('');
		sel.disabled = save.disabled = false;
	}
	document.addEventListener('change', function (e) {
		if (e.target.name !== 'date') return;
		var f = e.target.closest('form[data-resched-form],form[data-issue-form]');
		if (f) run(fillTimes(f));
	});

	/* ---------- Paid online but the slot could not be booked ---------- */
	var ISSUE_REASON = { slot_full: 'Slot was taken by another patient', doctor_leave: 'Doctor is on leave that day', timing_changed: 'Doctor timing changed', time_passed: 'Paid after the appointment time', released: 'Charged after the website told the patient "not charged"' };
	function renderIssues(list, force) {
		var box = $('dash-issues');
		if (!force && box.querySelector('form')) return; // someone is choosing a new time: don't wipe it
		box.innerHTML = list.length ? '<div class="panel mb-3" style="border-left:4px solid #dc3545">' +
			'<h3 class="h6 text-danger mb-1"><i class="fa-solid fa-triangle-exclamation me-1"></i>Payments needing action (' + list.length + ')</h3>' +
			'<p class="small muted mb-2">These patients paid but did not get their slot. Call them, then book a new time or refund them from the Razorpay Dashboard.</p>' +
			list.map(function (p) {
				return '<div class="border-top py-2" data-issue="' + esc(p.order_id) + '"><div class="d-flex flex-wrap align-items-center gap-2"><div class="flex-grow-1">' +
					'<div class="fw-semibold">' + esc(p.name) + ' <span class="muted fw-normal">' + esc(p.phone) + '</span> <span class="text-danger">' + esc(money(p.amount_paise)) + ' paid</span>' + testTag(p) + '</div>' +
					'<div class="small muted">' + esc(p.doctor) + ' &middot; ' + fmtDate(p.date) + ' ' + esc(p.time) + ' &middot; ' + esc(ISSUE_REASON[p.reason] || p.reason) + '</div>' +
					'<div class="small muted">Payment ID: ' + esc(p.payment_id || 'see Razorpay order ' + p.order_id) + (p.booking_id ? ' &middot; ' + esc(p.booking_id) : '') + '</div></div>' +
					'<a class="btn btn-xs btn-outline-primary" href="tel:+91' + esc(p.phone) + '"><i class="fa-solid fa-phone me-1"></i>Call</a>' +
					'<button type="button" class="btn btn-xs btn-primary" data-issue-book="' + esc(p.order_id) + '" data-doctor="' + esc(p.doctor) + '">Book a time</button>' +
					(me && me.role === 'admin' ? '<button type="button" class="btn btn-xs btn-outline-danger" data-issue-refund="' + esc(p.order_id) + '" data-name="' + esc(p.name) + '" data-amount="' + Number(p.amount_paise) + '">Mark refunded</button>' : '') +
					'</div><div data-issue-box></div></div>';
			}).join('') + '</div>' : '';
	}

	// Told after a doctor is marked off: someone may be paying for that day right now.
	function payingNote(d) {
		return d.paying ? ' ' + d.paying + ' patient' + (d.paying === 1 ? ' is' : 's are') + ' on the payment screen now; if they pay, it shows on the Dashboard under Payments needing action.' : '';
	}

	async function doOp(id, op, extra) {
		var data = Object.assign({ id: Number(id), op: op }, extra || {});
		if (op === 'cancel') {
			var reason = window.prompt('Reason for cancelling (shown in the WhatsApp message, optional):', '');
			if (reason === null) return;
			data.reason = reason;
			if (!window.confirm('Cancel this appointment? If it was paid online, refund it from the Razorpay Dashboard if needed.')) return;
		}
		if (op === 'no_show' && !window.confirm('Mark as no-show?')) return;
		var out = await api('update', data);
		var a = out.appointment;
		if (op === 'arrive') toast('Checked in. Token ' + a.token_no + ' for ' + a.doctor + '.');
		else toast('Updated: ' + (STATUS_LABEL[a.status] || a.status) + '.');
		if (op === 'cancel' || op === 'reschedule') {
			var kind = op === 'cancel' ? 'cancel' : 'reschedule';
			var box = document.createElement('div');
			box.className = 'alert alert-info py-2 d-flex flex-wrap align-items-center gap-2';
			box.innerHTML = '<span>Let the patient know:</span><a class="btn btn-xs btn-success" target="_blank" rel="noopener" href="' + esc(waLink(a, kind, data.reason)) + '"><i class="fa-brands fa-whatsapp me-1"></i>Send on WhatsApp</a>';
			await loaders[current]();
			var host = document.querySelector('#appt-' + a.id) || document.querySelector('main');
			host.appendChild(box);
			return;
		}
		await loaders[current]();
	}

	async function callNext(doctor) {
		var q = (await api('queue')).queue.filter(function (a) { return a.doctor === doctor; });
		var busy = q.filter(function (a) { return a.status === 'in_consult'; });
		if (busy.length && !window.confirm('Token ' + busy[0].token_no + ' is still with the doctor. Mark it done and call the next patient?')) return;
		for (var i = 0; i < busy.length; i++) await api('update', { id: busy[i].id, op: 'complete' });
		var next = q.filter(function (a) { return a.status === 'arrived'; })[0];
		if (!next) { toast('No one waiting.', 'warning'); return loaders[current](); }
		await api('update', { id: next.id, op: 'start' });
		toast('Calling token ' + next.token_no + ': ' + next.name);
		await loaders[current]();
	}

	/* ---------- Schedule ---------- */
	function timeOptions(sel) {
		var o = '';
		for (var m = 360; m <= 1380; m += 15) o += '<option value="' + m + '"' + (m === sel ? ' selected' : '') + '>' + minToTime(m) + '</option>';
		return o;
	}
	// One row per online-booking day: usual timing / a different timing / off.
	function dayRow(s, i, d) {
		var usualOpen = s.days.indexOf(new Date(d.date + 'T00:00:00').getDay()) >= 0;
		var mode = d.leave ? 'off' : d.custom ? 'custom' : 'normal';
		var usual = usualOpen ? minToTime(s.start_min) + '–' + minToTime(s.end_min) : 'closed, not an OP day';
		var status = d.leave ? '<span class="badge bg-warning text-dark">Off</span>'
			: !d.open ? '<span class="badge bg-secondary">Closed</span>'
			: '<span class="badge ' + (d.custom ? 'bg-info text-dark' : 'bg-success') + '">' + minToTime(d.start_min) + '–' + minToTime(d.end_min) + (d.custom ? ' (changed)' : '') + '</span>';
		var day = new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
		var label = d.date === today ? 'Today' : '';
		var k = i + '-' + d.date;
		return '<div class="border rounded p-2 mb-2" data-dayrow="' + k + '">' +
			'<div class="d-flex flex-wrap align-items-center gap-2 mb-2 small"><strong>' + (label ? label + ', ' : '') + esc(day) + '</strong>' + status +
			(d.booked ? '<span class="muted">' + d.booked + ' booked</span>' : '') + '</div>' +
			'<div class="row g-2 align-items-end">' +
			'<div class="col-12"><select class="form-select form-select-sm" name="dmode" aria-label="Timing for ' + esc(day) + '">' +
			'<option value="normal"' + (mode === 'normal' ? ' selected' : '') + '>Usual timing (' + usual + ')</option>' +
			'<option value="custom"' + (mode === 'custom' ? ' selected' : '') + '>Different timing this day</option>' +
			'<option value="off"' + (mode === 'off' ? ' selected' : '') + '>Off / leave this day</option></select></div>' +
			'<div class="col-4" data-dtime' + (mode === 'custom' ? '' : ' hidden') + '><select class="form-select form-select-sm" name="dstart" aria-label="Starts">' + timeOptions(d.start_min) + '</select></div>' +
			'<div class="col-4" data-dtime' + (mode === 'custom' ? '' : ' hidden') + '><select class="form-select form-select-sm" name="dend" aria-label="Ends">' + timeOptions(d.end_min) + '</select></div>' +
			'<div class="col-4 ms-auto"><button type="button" class="btn btn-sm btn-outline-primary w-100" data-setday="' + i + '|' + d.date + '">Save day</button></div>' +
			'</div></div>';
	}
	document.addEventListener('change', function (e) {
		if (e.target.name !== 'dmode') return;
		var row = e.target.closest('[data-dayrow]');
		row.querySelectorAll('[data-dtime]').forEach(function (el) { el.hidden = e.target.value !== 'custom'; });
	});
	function scheduleCard(s, i) {
		return '<div class="col-lg-6" data-sched-col="' + i + '"><form class="panel h-100" data-sched="' + i + '">' +
			'<h3 class="h6 mb-3">' + esc(s.doctor) + '</h3>' +
			'<div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="sc-on-' + i + '" name="online"' + (s.online ? ' checked' : '') + '>' +
			'<label class="form-check-label" for="sc-on-' + i + '">Accept online bookings</label></div>' +
			'<div class="small muted mb-1" id="sc-days-' + i + '">OP days</div><div class="day-pills d-flex flex-wrap mb-2" role="group" aria-labelledby="sc-days-' + i + '">' +
			DAY.map(function (d, n) { return '<label><input type="checkbox" name="day" value="' + n + '"' + (s.days.indexOf(n) >= 0 ? ' checked' : '') + '>' + d + '</label>'; }).join('') + '</div>' +
			'<div class="row g-2 mb-2"><div class="col-6"><label class="form-label small" for="sc-start-' + i + '">OP starts</label><select class="form-select form-select-sm" id="sc-start-' + i + '" name="start">' + timeOptions(s.start_min) + '</select></div>' +
			'<div class="col-6"><label class="form-label small" for="sc-end-' + i + '">OP ends</label><select class="form-select form-select-sm" id="sc-end-' + i + '" name="end">' + timeOptions(s.end_min) + '</select></div></div>' +
			(s.fixedSlots ? '<p class="small muted mb-2"><i class="fa-solid fa-circle-info me-1"></i>Website shows: ' + esc(s.opHours || 'fixed time slots') +
				'. Patients book the exact slots set in <strong>Booking &amp; Fees</strong>; these timings are the overall OP hours.</p>' : '') +
			'<label class="form-label small" for="sc-cap-' + i + '">Online bookings per time slot <span class="muted">(empty = 1)</span></label>' +
			'<input type="number" min="1" max="200" class="form-control form-control-sm mb-2" id="sc-cap-' + i + '" name="capacity" value="' + (s.capacity == null ? '' : s.capacity) + '">' +
			'<label class="form-label small" for="sc-note-' + i + '">Note for staff</label><input class="form-control form-control-sm mb-3" id="sc-note-' + i + '" name="note" maxlength="200" value="' + esc(s.note) + '">' +
			'<button class="btn btn-sm btn-primary" type="submit">Save timings</button>' +
			'<hr><div class="small fw-semibold mb-1">Next 3 days (online booking)</div>' +
			'<p class="small muted mb-2">Change one day only, e.g. the doctor comes late, leaves early, takes the day off, or sees patients on a Sunday. The other days keep the usual timing.</p>' +
			(s.next || []).map(function (d) { return dayRow(s, i, d); }).join('') +
			'<hr><div class="small fw-semibold mb-2">Leave</div>' +
			(s.leave.length ? s.leave.map(function (l) {
				return '<div class="d-flex align-items-center gap-2 mb-1 small"><i class="fa-solid fa-plane-departure muted"></i><span class="flex-grow-1">' + fmtDate(l.date) +
					(l.reason ? ' &middot; ' + esc(l.reason) : '') + (l.affected ? ' <span class="badge bg-warning text-dark">' + l.affected + ' booking(s) to reschedule</span>' : '') + '</span>' +
					'<button type="button" class="btn btn-xs btn-outline-danger" data-unleave="' + l.id + '">Remove</button></div>';
			}).join('') : '<p class="small muted">No upcoming leave.</p>') +
			'<div class="row g-2 mt-1"><div class="col-5"><label class="visually-hidden" for="sc-ldate-' + i + '">Leave date</label><input type="date" class="form-control form-control-sm" id="sc-ldate-' + i + '" name="ldate" min="' + today + '"></div>' +
			'<div class="col-4"><label class="visually-hidden" for="sc-lreason-' + i + '">Leave reason</label><input class="form-control form-control-sm" id="sc-lreason-' + i + '" name="lreason" placeholder="Reason" maxlength="120"></div>' +
			'<div class="col-3"><button type="button" class="btn btn-sm btn-outline-primary w-100" data-leave="' + i + '">Add</button></div></div>' +
			'</form></div>';
	}
	function renderSchedule(list) {
		$('sc-list').innerHTML = list.map(scheduleCard).join('');
		$('sc-list').dataset.doctors = JSON.stringify(list.map(function (s) { return s.doctor; }));
	}
	// After a save, redraw only that doctor's card, so changes not yet saved on the other doctors stay.
	function refreshSchedule(list, doctor) {
		var i = JSON.parse($('sc-list').dataset.doctors || '[]').indexOf(doctor);
		var s = list.filter(function (x) { return x.doctor === doctor; })[0];
		var col = document.querySelector('[data-sched-col="' + i + '"]');
		if (!s || !col) return run(loaders.schedule());
		col.outerHTML = scheduleCard(s, i);
	}
	// Which doctor a button or form inside a schedule card belongs to.
	var scheduleDoctor = function (el) {
		var f = el.closest('form[data-sched]');
		return f ? JSON.parse($('sc-list').dataset.doctors || '[]')[Number(f.dataset.sched)] : null;
	};
	var shortDate = function (iso) { return fmtDate(iso).replace(/ \d{4}$/, ''); };

	/* ---------- Booking & fees ---------- */
	function sessionRow(s) {
		return '<div class="row g-2 mb-2" data-session>' +
			'<div class="col-4"><input class="form-control form-control-sm" name="sname" placeholder="Morning" maxlength="20" value="' + esc(s.name || '') + '" aria-label="Session name"></div>' +
			'<div class="col-7"><input class="form-control form-control-sm" name="sslots" placeholder="10:30 AM, 11:15 AM, 12:00 PM" value="' + esc((s.slots || []).join(', ')) + '" aria-label="Times, separated by commas"></div>' +
			'<div class="col-1"><button type="button" class="btn btn-sm btn-outline-danger w-100 px-0" data-rmrow title="Remove"><i class="fa-solid fa-xmark"></i></button></div></div>';
	}
	function addonRow(a) {
		return '<div class="row g-2 mb-2" data-addon data-id="' + esc(a.id || '') + '">' +
			'<div class="col-7"><input class="form-control form-control-sm" name="aname" placeholder="Service name, e.g. ECG" maxlength="60" value="' + esc(a.name || '') + '" aria-label="Service name"></div>' +
			'<div class="col-4"><div class="input-group input-group-sm"><span class="input-group-text">&#8377;</span><input type="number" min="1" max="100000" class="form-control" name="aprice" value="' + (a.price || '') + '" aria-label="Price"></div></div>' +
			'<div class="col-1"><button type="button" class="btn btn-sm btn-outline-danger w-100 px-0" data-rmrow title="Remove"><i class="fa-solid fa-xmark"></i></button></div></div>';
	}
	function bookingPreview(f) {
		var mode = f.mode.value, pending = f.feestatus.value === 'pending';
		var n = Number(f.feenew.value), o = Number(f.feeold.value);
		var fee = pending || !(n > 0 && o > 0) ? 'Fee: "Contact for consultation fee"' : n === o ? 'Fee: &#8377;' + n : 'New &#8377;' + n + ' / Follow-up &#8377;' + o;
		var how = mode === 'request' ? 'Patients send a request on WhatsApp; the hospital confirms the time.'
			: pending || !(n > 0 && o > 0) ? 'No online payment: the button says "Call to Book".'
			: 'Patients pick a time and pay online.';
		f.querySelector('[data-preview]').innerHTML = '<i class="fa-regular fa-eye me-1"></i>Website shows: ' + fee + '. ' + how;
		f.querySelector('[data-fees]').hidden = pending;
	}
	function renderBooking(list) {
		$('bk-list').innerHTML = list.map(function (d, i) {
			return '<div class="col-xl-6"><form class="panel h-100" data-booking="' + esc(d.doctor) + '" autocomplete="off">' +
				'<div class="d-flex align-items-start gap-2 mb-3"><div class="me-auto"><h3 class="h6 mb-0">' + esc(d.doctor) + '</h3><span class="small muted">' + esc(d.speciality) + '</span></div>' +
				(d.customised ? '<span class="badge bg-primary-subtle text-primary-emphasis">Changed in panel</span>' : '<span class="badge bg-light text-dark border">Website default</span>') + '</div>' +
				'<label class="form-label small" for="bk-mode-' + i + '">Booking type</label>' +
				'<select class="form-select form-select-sm mb-2" id="bk-mode-' + i + '" name="mode">' +
				'<option value="online"' + (d.bookingMode === 'online' ? ' selected' : '') + '>Online booking: patient picks a time and pays</option>' +
				'<option value="request"' + (d.bookingMode === 'request' ? ' selected' : '') + '>Request only: hospital confirms the time (WhatsApp)</option></select>' +
				'<div class="d-flex flex-wrap gap-3 small mb-2">' +
				'<label><input type="radio" name="feestatus" value="set"' + (d.feeStatus !== 'pending' ? ' checked' : '') + '> Fee is fixed</label>' +
				'<label><input type="radio" name="feestatus" value="pending"' + (d.feeStatus === 'pending' ? ' checked' : '') + '> Fee to be confirmed (patients call)</label></div>' +
				'<div class="row g-2 mb-2" data-fees>' +
				'<div class="col-6"><label class="form-label small" for="bk-feenew-' + i + '">New patient fee</label><div class="input-group input-group-sm"><span class="input-group-text">&#8377;</span><input type="number" min="0" max="100000" class="form-control" id="bk-feenew-' + i + '" name="feenew" value="' + (d.fees.new == null ? '' : d.fees.new) + '"></div></div>' +
				'<div class="col-6"><label class="form-label small" for="bk-feeold-' + i + '">Follow-up (old patient) fee</label><div class="input-group input-group-sm"><span class="input-group-text">&#8377;</span><input type="number" min="0" max="100000" class="form-control" id="bk-feeold-' + i + '" name="feeold" value="' + (d.fees.old == null ? '' : d.fees.old) + '"></div></div></div>' +
				'<label class="form-label small" for="bk-hours-' + i + '">OP hours text on the website <span class="muted">(same as Doctor Schedule = ' + minToTime(d.schedule.start_min) + '&ndash;' + minToTime(d.schedule.end_min) + ', follows it automatically)</span></label>' +
				'<input class="form-control form-control-sm mb-3" id="bk-hours-' + i + '" name="ophours" maxlength="120" placeholder="10:30 AM-12:30 PM and 4:00 PM-5:00 PM" value="' + esc(d.opHours) + '">' +
				'<div class="small fw-semibold mb-1">Appointment times</div>' +
				'<p class="small muted mb-2">Leave empty to offer every hour within the OP hours. Otherwise list the exact times, separated by commas.</p>' +
				'<div data-sessions>' + d.bookingSessions.map(sessionRow).join('') + '</div>' +
				'<button type="button" class="btn btn-xs btn-outline-primary mb-3" data-addsession><i class="fa-solid fa-plus me-1"></i>Add session</button>' +
				'<div class="small fw-semibold mb-1">Extra paid services (optional)</div>' +
				'<div data-addons>' + d.addons.map(addonRow).join('') + '</div>' +
				'<button type="button" class="btn btn-xs btn-outline-primary mb-3" data-addaddon><i class="fa-solid fa-plus me-1"></i>Add service</button>' +
				'<div class="alert alert-light border small py-2 mb-3" data-preview></div>' +
				'<div class="d-flex flex-wrap gap-2"><button class="btn btn-sm btn-primary" type="submit">Save</button>' +
				(d.customised ? '<button class="btn btn-sm btn-outline-secondary" type="button" data-bkreset>Use website default</button>' : '') + '</div>' +
				'</form></div>';
		}).join('');
		document.querySelectorAll('form[data-booking]').forEach(bookingPreview);
	}
	function bookingPayload(f) {
		return {
			doctor: f.dataset.booking, bookingMode: f.mode.value, feeStatus: f.feestatus.value,
			fees: { new: f.feenew.value, old: f.feeold.value }, opHours: f.ophours.value,
			bookingSessions: Array.prototype.map.call(f.querySelectorAll('[data-session]'), function (r) {
				return { name: r.querySelector('[name=sname]').value, slots: r.querySelector('[name=sslots]').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean) };
			}).filter(function (s) { return s.slots.length; }),
			addons: Array.prototype.map.call(f.querySelectorAll('[data-addon]'), function (r) {
				return { id: r.dataset.id, name: r.querySelector('[name=aname]').value, price: r.querySelector('[name=aprice]').value };
			}).filter(function (a) { return a.name.trim() || a.price; })
		};
	}
	document.addEventListener('input', function (e) { var f = e.target.closest('form[data-booking]'); if (f) bookingPreview(f); });
	document.addEventListener('change', function (e) { var f = e.target.closest('form[data-booking]'); if (f) bookingPreview(f); });
	document.addEventListener('click', function (e) {
		var f = e.target.closest('form[data-booking]');
		if (!f) return;
		if (e.target.closest('[data-addsession]')) f.querySelector('[data-sessions]').insertAdjacentHTML('beforeend', sessionRow({}));
		else if (e.target.closest('[data-addaddon]')) f.querySelector('[data-addons]').insertAdjacentHTML('beforeend', addonRow({}));
		else if (e.target.closest('[data-rmrow]')) e.target.closest('[data-session],[data-addon]').remove();
		else if (e.target.closest('[data-bkreset]')) {
			if (!window.confirm('Go back to the website\'s original settings for ' + f.dataset.booking + '?')) return;
			run(api('saveBooking', { doctor: f.dataset.booking, reset: true }).then(function (d) { renderBooking(d.booking); toast('Restored the website default.'); }));
		}
	});
	document.addEventListener('submit', function (e) {
		var f = e.target;
		if (!f.dataset || !f.dataset.booking) return;
		e.preventDefault();
		run(api('saveBooking', bookingPayload(f)).then(function (d) { renderBooking(d.booking); toast('Saved. The website now shows the new settings.'); }));
	});

	/* ---------- Staff ---------- */
	function renderStaff(list) {
		$('sf-list').innerHTML = (list.length ? list.map(function (s) {
			return '<div class="d-flex align-items-center gap-2 border-bottom py-2"><div class="flex-grow-1"><div class="fw-semibold">' + esc(s.name) + '</div>' +
				'<div class="small muted">' + esc(s.username) + ' &middot; ' + (s.role === 'admin' ? 'Admin' : 'Reception staff') + (s.active ? '' : ' &middot; <span class="text-danger">Disabled</span>') + '</div></div>' +
				'<button class="btn btn-xs btn-outline-secondary" data-editstaff=\'' + esc(JSON.stringify(s)) + '\'>Edit</button>' +
				'<button class="btn btn-xs ' + (s.active ? 'btn-outline-danger' : 'btn-outline-success') + '" data-togglestaff=\'' + esc(JSON.stringify(s)) + '\'>' + (s.active ? 'Disable' : 'Enable') + '</button></div>';
		}).join('') : '<p class="muted">No staff accounts yet. Add one on the left.</p>') +
			'<p class="small muted mt-3 mb-0">The "admin" login uses the password set in Vercel (RECEPTION_ADMIN_PASSWORD).</p>';
	}

	/* ---------- Events ---------- */
	$('tabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-view]'); if (b) show(b.dataset.view); });
	document.addEventListener('click', function (e) {
		var t = e.target.closest('[data-op],[data-callnext],[data-refresh],[data-resched],[data-unleave],[data-setday],[data-leave],[data-editstaff],[data-togglestaff],[data-match],[data-patient],[data-patientnav],[data-remind],[data-rprange],[data-goto],[data-issue-book],[data-issue-refund]');
		if (!t) return;
		if (t.dataset.goto) {
			show(t.dataset.goto);
			if (t.dataset.goto === 'reminders') { $('rm-date').value = addDays(today, 1); run(loaders.reminders()); }
			if (t.dataset.goto === 'walkin') setTimeout(function () { $('wk-phone').focus(); }, 50);
			if (t.dataset.goto === 'patients') setTimeout(function () { $('pt-search').focus(); }, 50);
			return window.scrollTo(0, 0);
		}
		if (t.dataset.patient) return run(showPatient(t.dataset.patient));
		if (t.dataset.patientnav) {
			show('patients');
			return run(showPatient(t.dataset.patientnav));
		}
		if (t.dataset.remind) {
			var sent = store.get('nv_reminded') || {};
			sent[t.dataset.remind] = Date.now();
			// Keep the list small: forget ticks older than 30 days.
			Object.keys(sent).forEach(function (k) { if (Date.now() - sent[k] > 30 * 86400000) delete sent[k]; });
			store.set('nv_reminded', sent);
			setTimeout(function () { loaders.reminders().catch(function () {}); }, 300);
			return; // the link itself opens WhatsApp
		}
		if (t.dataset.rprange) { setReportRange(t.dataset.rprange); return run(loaders.reports()); }
		if (t.dataset.op) return once(t, function () { return doOp(t.dataset.id, t.dataset.op); });
		if (t.dataset.callnext) return once(t, function () { return callNext(t.dataset.callnext); });
		if (t.hasAttribute('data-refresh')) return run(loaders[current]());
		if (t.dataset.resched) {
			var box = document.querySelector('[data-resched-box="' + t.dataset.resched + '"]');
			box.innerHTML = timeForm('data-resched-form', t.dataset.resched, t.dataset.doctor);
			return;
		}
		if (t.dataset.issueBook) {
			var issueBox = t.closest('[data-issue]').querySelector('[data-issue-box]');
			issueBox.innerHTML = issueBox.firstChild ? '' : timeForm('data-issue-form', t.dataset.issueBook, t.dataset.doctor);
			return;
		}
		if (t.dataset.issueRefund) {
			if (!window.confirm('Mark ' + t.dataset.name + '\'s payment of ' + money(Number(t.dataset.amount)) + ' as refunded?\n\nDo this only after the refund is done in the Razorpay Dashboard.')) return;
			return once(t, function () {
				return api('resolvePayment', { order_id: t.dataset.issueRefund, how: 'refunded' }).then(function (d) { renderIssues(d.paymentIssues, true); toast('Marked as refunded.'); });
			});
		}
		if (t.dataset.setday) {
			var parts = t.dataset.setday.split('|'), docList = JSON.parse($('sc-list').dataset.doctors);
			var row = t.closest('[data-dayrow]'), dmode = row.querySelector('[name=dmode]').value;
			var body = { doctor: docList[Number(parts[0])], date: parts[1], mode: dmode };
			if (dmode === 'custom') { body.start_min = Number(row.querySelector('[name=dstart]').value); body.end_min = Number(row.querySelector('[name=dend]').value); }
			return once(t, function () { return api('setDay', body).then(function (d) {
				refreshSchedule(d.schedule, body.doctor);
				var msg = d.mode === 'off' ? 'Saved: off on ' + fmtDate(d.dayDate) + '. Online booking is closed that day.'
					: d.mode === 'custom' ? 'Saved: special timing on ' + fmtDate(d.dayDate) + '. The booking page shows only these times that day.'
					: 'Saved: usual timing on ' + fmtDate(d.dayDate) + '.';
				if (d.clash) {
					toast(msg + ' ' + d.clash + ' booked patient' + (d.clash === 1 ? ' does' : 's do') + ' not fit' + (d.clashPaid ? ' (' + d.clashPaid + ' paid online)' : '') +
						'. Open Appointments for ' + d.dayDate + ' and call them to reschedule.' + payingNote(d), 'warning');
				} else toast(msg + payingNote(d), d.paying ? 'warning' : 'success');
			}); });
		}
		if (t.dataset.unleave) {
			var leaveDoctor = scheduleDoctor(t);
			return once(t, function () { return api('removeLeave', { id: Number(t.dataset.unleave), doctor: leaveDoctor }).then(function (d) {
				refreshSchedule(d.schedule, leaveDoctor);
				toast(d.removed ? 'Leave removed.' : 'This leave was already removed.', d.removed ? 'success' : 'warning');
			}); });
		}
		if (t.dataset.leave) {
			var f = t.closest('form'), docs = JSON.parse($('sc-list').dataset.doctors), leaveFor = docs[Number(t.dataset.leave)];
			if (!f.ldate.value) return toast('Pick the leave date.', 'warning');
			return once(t, function () { return api('addLeave', { doctor: leaveFor, date: f.ldate.value, reason: f.lreason.value }).then(function (d) {
				refreshSchedule(d.schedule, leaveFor);
				if (d.booked) {
					toast('Leave added. ' + d.booked + ' patient' + (d.booked === 1 ? ' is' : 's are') + ' already booked that day' +
						(d.bookedPaid ? ' (' + d.bookedPaid + ' paid online)' : '') + '. Open Appointments for ' + d.leaveDate + ' and call them to reschedule.' + payingNote(d), 'warning');
				} else toast('Leave added. Online booking is closed for that day. No patients were booked.' + payingNote(d), d.paying ? 'warning' : 'success');
			}); });
		}
		if (t.dataset.editstaff) {
			var s = JSON.parse(t.dataset.editstaff);
			staffFormMode(s);
			$('sf-user').value = s.username; $('sf-name').value = s.name; $('sf-role').value = s.role; $('sf-pass').value = ''; $('sf-pass').focus();
			return;
		}
		if (t.dataset.togglestaff) {
			var st = JSON.parse(t.dataset.togglestaff);
			return once(t, function () { return api('saveStaff', { mode: 'edit', username: st.username, role: st.role, active: !st.active }).then(function (d) { renderStaff(d.staff); toast('Saved.'); }); });
		}
		if (t.dataset.match) {
			var p = JSON.parse(t.dataset.match);
			$('wk-phone').value = p.phone; $('wk-name').value = p.name; $('wk-age').value = p.age == null ? '' : p.age; $('wk-gender').value = p.gender || '';
			$('wk-type').value = p.visits ? 'old' : 'new'; $('wk-matches').innerHTML = '';
		}
	});

	document.addEventListener('submit', function (e) {
		var f = e.target;
		if (f.dataset.reschedForm) {
			e.preventDefault();
			return once(f.querySelector('[type=submit]'), function () { return doOp(f.dataset.reschedForm, 'reschedule', { date: f.date.value, time: f.time.value }); });
		}
		if (f.dataset.issueForm) {
			e.preventDefault();
			return once(f.querySelector('[type=submit]'), function () {
				return api('resolvePayment', { order_id: f.dataset.issueForm, how: 'book', date: f.date.value, time: f.time.value }).then(function (d) {
					renderIssues(d.paymentIssues, true);
					toast('Booked. The patient now shows in Appointments. Please tell them the new time.');
					return loaders.dashboard();
				});
			});
		}
		if (f.dataset.sched != null) {
			e.preventDefault();
			var doctor = scheduleDoctor(f);
			var days = Array.prototype.map.call(f.querySelectorAll('input[name=day]:checked'), function (x) { return Number(x.value); });
			var body = { doctor: doctor, days: days, start_min: Number(f.start.value), end_min: Number(f.end.value),
				capacity: f.capacity.value, online: f.online.checked, note: f.note.value };
			return once(f.querySelector('[type=submit]'), function () { return api('saveSchedule', body).then(function (d) {
				refreshSchedule(d.schedule, doctor);
				if (!d.clash) return toast('Timings saved.');
				// Patients already booked at times the new weekly timing no longer covers.
				var dates = d.clashDates || [];
				toast('Timings saved. ' + d.clash + ' booked patient' + (d.clash === 1 ? ' is' : 's are') + ' outside the new timing' +
					(d.clashPaid ? ' (' + d.clashPaid + ' paid online)' : '') + ' on ' + dates.slice(0, 4).map(shortDate).join(', ') +
					(dates.length > 4 ? ' and ' + (dates.length - 4) + ' more day(s)' : '') +
					'. Open Appointments for ' + (dates.length === 1 ? 'that date' : 'those dates') + ' and call them to reschedule.', 'warning');
			}); });
		}
	});

	$('login-form').addEventListener('submit', function (e) {
		e.preventDefault();
		$('lg-msg').hidden = true;
		api('login', { username: $('lg-user').value, password: $('lg-pass').value }).then(function (d) {
			$('lg-pass').value = ''; startApp(d);
		}).catch(function (err) { $('lg-msg').textContent = err.message; $('lg-msg').hidden = false; });
	});
	$('logout').addEventListener('click', function () {
		api('logout').then(showLogin).catch(function () { toast('Could not sign out. Check the connection and try again.', 'danger'); });
	});
	// Enter in the leave date or reason adds the leave (it used to press "Save timings" instead).
	document.addEventListener('keydown', function (e) {
		if (e.key !== 'Enter' || !e.target.matches('input[name=lreason],input[name=ldate]')) return;
		e.preventDefault();
		var add = e.target.closest('form').querySelector('[data-leave]');
		if (add) add.click();
	});

	['ap-date', 'ap-doctor', 'ap-status', 'ap-source', 'ap-range', 'ap-from', 'ap-to'].forEach(function (id) { $(id).addEventListener('change', function () { run(loaders.appointments()); }); });
	$('ap-range').addEventListener('change', function () {
		$('ap-range-box').hidden = this.value !== 'range';
		$('ap-date').disabled = this.value !== 'day';
	});
	$('ap-export').addEventListener('click', function () {
		run(api('appointments', Object.assign(apptFilter(), { export: 1 })).then(function (d) {
			if (!d.appointments.length) return toast('Nothing to export.', 'warning');
			downloadCsv('nivya-appointments-' + today + '.csv', APPT_CSV_HEAD, d.appointments.map(apptCsvRow));
		}));
	});

	var ptTimer;
	$('pt-search').addEventListener('input', function () { clearTimeout(ptTimer); ptTimer = setTimeout(function () { run(loaders.patients()); }, 300); });
	['rm-date', 'rm-doctor'].forEach(function (id) { $(id).addEventListener('change', function () { run(loaders.reminders()); }); });
	['rp-from', 'rp-to'].forEach(function (id) { $(id).addEventListener('change', function () { run(loaders.reports()); }); });
	['ac-from', 'ac-to', 'ac-actor'].forEach(function (id) { $(id).addEventListener('change', function () { run(loadActivity(false)); }); });
	$('ac-week').addEventListener('click', function () { $('ac-to').value = today; $('ac-from').value = addDays(today, -6); $('ac-actor').value = ''; run(loadActivity(false)); });
	$('ac-more').addEventListener('click', function () { run(loadActivity(true)); });
	$('rp-export').addEventListener('click', function () {
		if (!report || !me || me.role !== 'admin') return;
		var rev = !!report.showRevenue;
		var head = ['Date', 'Total', 'Online', 'Walk-in', 'Completed', 'Cancelled', 'No-show', 'New', 'Follow-up'].concat(rev ? ['Paid online (Rs)', 'Cancelled after paying (Rs)'] : []);
		var row = function (label, r) { return [label, r.total, r.online, r.walkin, r.completed, r.cancelled, r.noShow, r.newPatients, r.followUps].concat(rev ? [r.paidPaise / 100, (r.cancelledPaidPaise || 0) / 100] : []); };
		var rows = report.byDay.map(function (r) { return row(r.date, r); });
		rows.push(row('TOTAL', report.totals), []);
		rows.push(['Doctor'].concat(head.slice(1)));
		report.byDoctor.forEach(function (r) { rows.push(row(r.doctor + (r.former ? ' (former doctor)' : ''), r)); });
		downloadCsv('nivya-report-' + report.from + '-to-' + report.to + '.csv', head, rows);
	});

	// Admin only: removes a patient and all their visits for good (test entries, duplicates, data-removal requests).
	document.addEventListener('click', function (e) {
		var btn = e.target.closest('[data-delete-patient]');
		if (!btn) return;
		var paid = Number(btn.dataset.paid);
		var msg = 'Permanently delete ' + btn.dataset.name + ' and all ' + btn.dataset.visits + ' visit(s)? This cannot be undone.' +
			(paid ? '\n\n' + paid + ' of these visits were paid online. Their payment records stay for accounts, without the name or phone, and any upcoming ones are cancelled. Deleting does not refund the money; refund in the Razorpay Dashboard if needed.' : '');
		if (!window.confirm(msg)) return;
		run(api('deletePatient', { id: Number(btn.dataset.deletePatient) }).then(function (d) {
			toast('Deleted ' + d.deleted.appointments + ' visit(s) and the patient record.' + (d.deleted.kept ? ' ' + d.deleted.kept + ' paid visit(s) kept for accounts.' : ''));
			$('pt-detail').classList.add('muted');
			$('pt-detail').textContent = 'Select a patient to see details and visit history.';
			return loaders.patients();
		}));
	});

	document.addEventListener('submit', function (e) {
		if (e.target.id !== 'pt-form') return;
		e.preventDefault();
		var f = e.target;
		run(api('savePatient', {
			id: Number(f.dataset.id), name: f.name.value, phone: f.phone.value, age: f.age.value, gender: f.gender.value, notes: f.notes.value
		}).then(function () { toast('Patient saved.'); return Promise.all([showPatient(f.dataset.id), loaders.patients()]); }));
	});

	$('st-form').addEventListener('submit', function (e) {
		e.preventDefault();
		var templates = {};
		document.querySelectorAll('[data-template]').forEach(function (t) { templates[t.dataset.template] = t.value; });
		run(api('saveSettings', { hospitalPhone: $('st-phone').value, address: $('st-address').value, templates: templates }).then(function (d) {
			settings = d.settings; toast('Settings saved.');
		}));
	});
	$('st-reset').addEventListener('click', function () {
		if (!window.confirm('Restore the original hospital phone, address and WhatsApp messages?')) return;
		run(api('resetSettings').then(function (d) { settings = d.settings; toast('Defaults restored.'); return loaders.settings(); }));
	});
	$('pw-form').addEventListener('submit', function (e) {
		e.preventDefault();
		if ($('pw-new').value !== $('pw-new2').value) return toast('The new passwords do not match.', 'warning');
		run(api('changePassword', { current: $('pw-current').value, password: $('pw-new').value }).then(function () {
			$('pw-form').reset();
			toast('Password changed. Please sign in with the new password.');
			setTimeout(showLogin, 1500);
		}));
	});
	var searchTimer;
	$('ap-search').addEventListener('input', function () { clearTimeout(searchTimer); searchTimer = setTimeout(function () { run(loaders.appointments()); }, 350); });

	var phoneTimer;
	$('wk-phone').addEventListener('input', function () {
		var v = this.value.replace(/\D/g, '');
		this.value = v;
		clearTimeout(phoneTimer);
		if (v.length < 4) { $('wk-matches').innerHTML = ''; return; }
		phoneTimer = setTimeout(function () {
			api('patients', { phone: v }).then(function (d) {
				$('wk-matches').innerHTML = d.patients.length ? '<div class="small muted mb-1">Existing patients:</div>' + d.patients.map(function (p) {
					return '<button type="button" class="btn btn-xs btn-outline-secondary me-1 mb-1" data-match=\'' + esc(JSON.stringify(p)) + '\'>' + esc(p.name) + ' &middot; ' + esc(p.phone) +
						(p.last_visit ? ' &middot; last ' + fmtDate(p.last_visit) : '') + '</button>';
				}).join('') : '';
			}).catch(function () {});
		}, 300);
	});

	// One id per registration: a repeated submit (double-click, retry after a dropped connection) returns the same token.
	var walkinRequest = null;
	var newRequestId = function () { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2); };
	['input', 'change'].forEach(function (ev) { $('wk-form').addEventListener(ev, function () { walkinRequest = null; }); });
	$('wk-form').addEventListener('submit', function (e) {
		e.preventDefault();
		walkinRequest = walkinRequest || newRequestId();
		var body = {
			phone: $('wk-phone').value, name: $('wk-name').value, age: $('wk-age').value, gender: $('wk-gender').value,
			doctor: $('wk-doctor').value, visit_type: $('wk-type').value, reason: $('wk-reason').value, request_id: walkinRequest
		};
		// Doctor on leave today: the server asks first, and the token is given only if reception says yes.
		var send = function (confirmed) {
			return api('walkin', confirmed ? Object.assign({ confirm: true }, body) : body).catch(function (err) {
				if (confirmed || !err.data || err.data.confirm !== 'leave') throw err;
				return window.confirm(err.message + '\n\nGive this patient a token anyway?') ? send(true) : null;
			});
		};
		once(this.querySelector('[type=submit]'), function () { return send(false).then(function (d) {
			if (!d) return toast('Not registered.', 'warning');
			walkinRequest = null;
			var a = d.appointment;
			$('wk-result').hidden = false;
			$('wk-result').innerHTML = '<div class="small muted mb-2">Token for ' + esc(a.doctor) + '</div><div class="token big mb-3">' + a.token_no + '</div>' +
				'<div class="fw-semibold">' + esc(a.name) + '</div><div class="small muted mb-3">' + esc(a.phone) + ' &middot; ' + esc(a.booking_id) + '</div>' +
				'<div class="d-flex justify-content-center flex-wrap gap-2 no-print">' +
				'<a class="btn btn-sm btn-success" target="_blank" rel="noopener" href="' + esc(waLink(a, 'token')) + '"><i class="fa-brands fa-whatsapp me-1"></i>Send token</a>' +
				'<button class="btn btn-sm btn-outline-primary" type="button" id="wk-print"><i class="fa-solid fa-print me-1"></i>Print token</button></div>';
			$('wk-print').onclick = function () { printToken(a); };
			$('wk-form').reset(); $('wk-matches').innerHTML = '';
			toast('Registered. Token ' + a.token_no + '.');
		}); });
	});

	// "Add" only creates a new account. "Edit" changes one account and leaves it enabled or disabled as it was.
	var staffEditing = null;
	function staffFormMode(s) {
		staffEditing = s ? s.username : null;
		$('sf-title').textContent = s ? 'Edit ' + s.name : 'Add staff';
		$('sf-user').readOnly = !!s;
		$('sf-cancel').hidden = !s;
		$('sf-pass-hint').textContent = s ? '(min 8; leave empty to keep. Staff forgot theirs? Type a new one here)' : '(min 8)';
		if (!s) $('sf-form').reset();
	}
	$('sf-cancel').addEventListener('click', function () { staffFormMode(null); });
	$('sf-form').addEventListener('submit', function (e) {
		e.preventDefault();
		var body = { mode: staffEditing ? 'edit' : 'add', username: staffEditing || $('sf-user').value, name: $('sf-name').value, password: $('sf-pass').value, role: $('sf-role').value };
		once(this.querySelector('[type=submit]'), function () {
			return api('saveStaff', body).then(function (d) { renderStaff(d.staff); staffFormMode(null); toast('Staff saved.'); });
		});
	});

	function printToken(a) {
		var w = window.open('', '_blank', 'width=360,height=480');
		if (!w) return toast('Allow pop-ups to print the token.', 'warning');
		w.document.write('<!doctype html><meta charset="utf-8"><title>Token ' + a.token_no + '</title><body style="font-family:Arial;text-align:center;padding:20px">' +
			'<div style="font-weight:700;color:#0b56a0">Nivya Hospitals</div><div style="font-size:13px;color:#555">' + esc(a.doctor) + '</div>' +
			'<div style="font-size:84px;font-weight:700;margin:16px 0">' + a.token_no + '</div><div>' + esc(a.name) + '</div>' +
			'<div style="font-size:12px;color:#555;margin-top:6px">' + fmtDate(a.date) + ' &middot; ' + esc(a.time || '') + '</div></body>');
		w.document.close();
		// Printed from here: the page's security policy (no inline scripts) also covers the pop-up.
		w.focus();
		w.print();
	}

	/* ---------- Start ---------- */
	api('me').then(startApp).catch(function () { /* login or setup view already shown */ });
})();
