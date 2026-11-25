/* ============================================================
   Nivya Hospital – Built-in Chatbot (Pure JS, No Dependencies)
   ============================================================ */

(function () {
  const esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };

  /* ── Consultation fee per doctor ──
     Built-in values; replaced by the reception panel's values (Booking & Fees) once they load. */
  const CALL_FOR_FEE = "Contact the hospital for the consultation fee. Call <a href='tel:+919566443300'>+91 95664 43300</a>";
  let FEES = {
    "Dr. P. Manimozhian": "New Patient: <strong>₹800</strong> | Old Patient: <strong>₹500</strong>",
    "Dr. M. Nivya": "<strong>₹200</strong>",
    "Dr. M.A. Mathan": "<strong>₹200</strong>",
    "Dentist": CALL_FOR_FEE
  };
  const feeLines = (names) => names.map((n) => "• <strong>" + esc(n) + ":</strong> " + FEES[n]).join("<br>");
  const allFees = () => "💰 <strong>Consultation Fees:</strong><br><br>" + feeLines(Object.keys(FEES));

  /* ── Knowledge Base ──
     `doctor` + `names`: a fee question that names this doctor gets the doctor's fee. */
  const KB = [
    // Greetings
    {
      low: true,
      patterns: ["hello", "hi", "vanakkam", "hey", "good morning", "good evening", "good afternoon", "start", "help"],
      answer: "👋 Hello! Welcome to <strong>Nivya Respiratory & Multispeciality Hospital</strong>.<br><br>How can I help you today? You can ask me about:<br>• 🏥 Our Doctors<br>• 🩺 Specialities<br>• 💰 Consultation Fees<br>• 📅 Appointments<br>• 📍 Location & Timings<br>• 📞 Contact"
    },

    // Doctors
    {
      weight: -4,
      patterns: ["doctor", "doctors", "physician", "specialist", "dr", "who are the doctors", "available doctors"],
      answer: "👨‍⚕️ Our Doctors:<br><br><strong>1. Dr. P. Manimozhian</strong><br>MD (Chest Medicine), DTCD, Dip. in Allergy (UK), FCCP (USA)<br>Consultant Pulmonologist, Bronchoscopist, Allergy & Sleep Physician<br><br><strong>2. Dr. M. Nivya</strong><br>MD (General Medicine), FCD (Diabetology), FCC (Clinical Cardiology)<br>Consultant Diabetologist & General Physician<br><br><strong>3. Dr. M.A. Mathan</strong><br>MBBS, MEM (Emergency & Critical Care Medicine)<br>Emergency Physician & Intensivist<br><br><strong>4. Dentist</strong><br>Dental care. Call to book: <a href='tel:+919566443300'>+91 95664 43300</a>"
    },

    // Manimozhian
    {
      doctor: "Dr. P. Manimozhian",
      names: /\bmanimo|\bpulmonolog|\b(chest|lung) (doctor|specialist)/i,
      patterns: ["manimozhian", "pulmonologist", "lung", "chest", "pulmonology", "bronchoscopy", "allergy", "sleep", "asthma", "copd", "cough", "breath", "breathing", "breathlessness", "wheezing"],
      answer: "🫁 <strong>Dr. P. Manimozhian</strong><br>Specialisation: Pulmonology, Bronchoscopy, Allergy & Sleep Medicine<br>Qualification: MD (Chest Medicine), DTCD, Dip. in Allergy (UK), FCCP (USA)<br>Experience: 21+ Years<br><br>Treats: Asthma, COPD, Lung Infections, Sleep Apnea, Allergies<br><br><a href='/doctor-manimozhiyan-profile'>View Full Profile →</a>"
    },

    // Nivya ("Nivya Hospital" is the hospital, not the doctor)
    {
      doctor: "Dr. M. Nivya",
      names: /\bnivya\b(?!'?s?\s*(hospital|respiratory|multi))|\bdiabetolog|\bgeneral physician/i,
      patterns: ["nivya", "diabetes", "diabetologist", "general physician", "sugar", "general medicine", "cardiology", "fever", "blood pressure", "hypertension"],
      answer: "👩‍⚕️ <strong>Dr. M. Nivya</strong><br>Specialisation: Diabetology & General Medicine<br>Qualification: MD (General Medicine), FCD (Diabetology), FCC (Clinical Cardiology)<br>Experience: 15+ Years<br><br>Treats: Diabetes, General Health, Cardiology Consultations<br><br><a href='/doctor-nivya-profile'>View Full Profile →</a>"
    },

    // Mathan
    {
      doctor: "Dr. M.A. Mathan",
      names: /\bmathan\b|\bintensivist|\bemergency (doctor|physician)/i,
      patterns: ["mathan", "emergency", "emergencies", "ambulance", "critical care", "icu", "intensivist", "trauma", "accident"],
      answer: "🚨 <strong>Dr. M.A. Mathan</strong><br>Specialisation: Emergency & Critical Care Medicine<br>Qualification: MBBS, MEM (Emergency & Critical Care Medicine)<br>Experience: 10+ Years<br><br>Handles: Emergency Cases, ICU Management, Trauma, Acute Medical Emergencies<br><br>🚑 <strong>24x7 Emergency &amp; Ambulance:</strong> <a href='tel:+919566443300'>📞 +91 95664 43300</a><br><br><a href='/doctor-mathan-profile'>View Full Profile →</a>"
    },

    // Dentist
    {
      doctor: "Dentist",
      names: /\bdent(ist|al|istry)\b|\bteeth\b|\btooth\b/i,
      patterns: ["dentist", "dentistry", "dental", "teeth", "tooth", "root canal", "braces", "cavity"],
      answer: "🦷 <strong>Dentist</strong><br>Dental care at Nivya Hospitals.<br><br>📞 Call to book: <a href='tel:+919566443300'>+91 95664 43300</a><br><br><a href='/dentistry'>About Dental Care →</a>"
    },

    // Consultation Fees
    {
      patterns: ["fee", "fees", "cost", "charge", "price", "consultation fee", "how much", "rate", "new patient", "old patient"],
      answer: allFees()
    },

    // Appointment / Booking
    {
      patterns: ["appointment", "book", "booking", "schedule", "visit", "when", "slot"],
      answer: "📅 <strong>Book an Appointment:</strong><br><br>Choose your doctor on our website:<br><a href='/search'>👉 Choose Doctor & Book</a><br><br>• Online booking is open for <strong>today, tomorrow and the day after</strong>. For later dates, please call.<br>• Dr. M.A. Mathan: send an appointment request on WhatsApp from his booking page.<br>• Dentist: call to book.<br><br>📞 <a href='tel:+919566443300'>+91 95664 43300</a><br><br>⏰ Hospital timings: Mon–Sat 9:00 AM – 7:00 PM, Sunday: Emergency Only. Ask me “timings” for each doctor's OP hours."
    },

    // Specialities
    {
      weight: -4,
      patterns: ["speciality", "specialities", "department", "departments", "services", "treatment", "what do you treat"],
      answer: "🏥 <strong>Our Specialities:</strong><br><br>🫁 Pulmonology<br>🚨 Emergency & Critical Care<br>💊 General Medicine<br>❤️ Cardiology<br>🦴 Orthopaedics<br>🦷 Dentistry<br>🔪 General Surgery<br>🧠 Neurology<br>🫃 Gastroenterology<br>🔬 Radiology<br>🎗️ Oncology<br>🧘 Psychiatry<br><br><a href='/#specialities'>View All Specialities →</a>"
    },

    // Orthopaedics
    {
      patterns: ["orthopaedics", "orthopaedic", "orthopedics", "orthopedic", "ortho", "bone", "fracture", "joint", "arthritis", "spine", "knee", "back pain", "sports injury"],
      answer: "🦴 <strong>Orthopaedics:</strong><br><br>• Fractures & Injuries<br>• Arthritis<br>• Joint Pain<br>• Sports Injuries<br>• Spine Disorders<br><br><a href='/orthopaedics'>Learn More →</a>"
    },

    // General Surgery
    {
      patterns: ["surgery", "general surgery", "wound", "thyroid", "breast", "lipoma", "piles", "fissure"],
      answer: "🔪 <strong>General Surgery:</strong><br><br>• Comprehensive Wound Care<br>• Thyroid Mass Surgery<br>• Breast Mass Surgery<br>• Lipoma Surgery<br>• Piles & Fissure<br>• Hernia Repair<br>• Appendix Surgery<br><br><a href='/general-surgery'>Learn More →</a>"
    },

    // Neurology
    {
      patterns: ["neurology", "neuro", "brain", "nerve", "stroke", "epilepsy", "migraine", "parkinson"],
      answer: "🧠 <strong>Neurology:</strong><br><br>• Stroke<br>• Epilepsy<br>• Migraine<br>• Neuropathy<br>• Parkinson's Disease<br><br><a href='/neurology'>Learn More →</a>"
    },

    // Gastroenterology
    {
      patterns: ["gastro", "gastroenterology", "stomach", "gut", "acid", "reflux", "gerd", "ulcer", "liver", "diarrhea", "constipation", "pancreas"],
      answer: "🫃 <strong>Gastroenterology:</strong><br><br>• GERD (Acid Reflux)<br>• Liver Diseases<br>• Gastritis<br>• Ulcers<br>• Diarrhea<br>• Constipation<br>• Pancreatic Disease<br><br><a href='/gastro-enterology'>Learn More →</a>"
    },

    // Radiology
    {
      patterns: ["radiology", "xray", "x-ray", "scan", "ultrasound", "imaging", "doppler"],
      answer: "🔬 <strong>Radiology:</strong><br><br>• X-Ray<br>• Ultrasound<br>• Colour Doppler<br>• MRI & CT Scan Referrals<br><br><a href='/radiology'>Learn More →</a>"
    },

    // Oncology
    {
      patterns: ["oncology", "cancer", "tumor", "tumour", "chemo", "chemotherapy"],
      answer: "🎗️ <strong>Oncology:</strong><br><br>• Cancer Screening<br>• Diagnosis and Staging<br>• Complete Cancer Treatment<br>• Supportive Care<br><br><a href='/oncology'>Learn More →</a>"
    },

    // Psychiatry
    {
      patterns: ["psychiatry", "mental", "anxiety", "anxious", "depression", "depressed", "stress", "sleep disorder", "memory", "schizophrenia"],
      answer: "🧘 <strong>Psychiatry:</strong><br><br>• Anxiety<br>• Depression<br>• Stress Disorders<br>• Sleep Disorders<br>• Schizophrenia<br>• Memory Problems<br><br><a href='/psychiatry'>Learn More →</a>"
    },

    // Location
    {
      patterns: ["location", "address", "where", "directions", "map", "tirunelveli", "how to reach", "vannarpettai"],
      answer: "📍 <strong>Our Location:</strong><br><br>Nivya Respiratory & Multispeciality Hospitals<br>110-F/5 Barani Nagar, Vannarpettai,<br>Tirunelveli, Tamil Nadu 627003<br><br><a href='https://www.google.com/maps?q=8.7303166,77.7227378' target='_blank' rel='noopener'>📌 Open in Google Maps</a>"
    },

    // Contact
    {
      patterns: ["contact", "phone", "call", "number", "email", "reach", "whatsapp"],
      answer: "📞 <strong>Contact Us:</strong><br><br>Phone: <a href='tel:+919566443300'>+91 95664 43300</a><br>Email: <a href='mailto:nivyahospitalstvl@gmail.com'>nivyahospitalstvl@gmail.com</a><br><br>Or visit us at:<br>📍 Vannarpettai, Tirunelveli<br><br><a href='/contact-us'>Contact Page →</a>"
    },

    // Timings
    {
      patterns: ["timing", "timings", "hours", "open", "time", "opd", "working hours", "sunday", "weekend", "today", "tomorrow", "leave", "available today", "available tomorrow", "op time", "op timing"],
      answer: "⏰ <strong>Hospital Timings:</strong><br><br>🗓️ Monday – Saturday: <strong>9:00 AM – 7:00 PM</strong><br>🚨 Sunday: <strong>Emergency Services Only</strong><br><br>For appointments: <a href='/search'>Book Here →</a>"
    },

    // About
    {
      patterns: ["about", "nivya hospital", "who are you", "hospital info", "history", "about us"],
      answer: "🏥 <strong>About Nivya Respiratory & Multispeciality Hospitals:</strong><br><br>A leading hospital in Tirunelveli dedicated to respiratory and multispeciality care. Known for several <em>firsts</em> in Tirunelveli including the 1st Pulmonology hospital, 1st Computerized PFT, 1st Sleep Study Centre and more.<br><br><a href='/about-us'>Read Our Full Story →</a>"
    },

    // TB / PCR
    {
      patterns: ["tb", "tuberculosis", "genexpert", "pcr", "igra", "latent tb"],
      answer: "🧪 <strong>TB Services:</strong><br><br>• TB PCR (GeneXpert) – 1st in Tirunelveli private sector<br>• Latent TB Infection Blood Test (IGRA)<br>• Complete TB Diagnosis & Treatment<br><br><a href='/pulmonology'>Pulmonology Services →</a>"
    },

    // PFT / Lung Test
    {
      patterns: ["pft", "pulmonary function", "feno", "ios", "6mwt", "spirometry", "lung test"],
      answer: "🫁 <strong>Pulmonary Function Tests (PFT):</strong><br><br>We are the 1st hospital in Tirunelveli to have:<br>• FeNO (Fractional Exhaled Nitric Oxide)<br>• IOS (Impulse Oscillometry System)<br>• 6MWT (6-Minute Walk Test)<br>• Computerized PFT<br><br><a href='/pulmonology'>Learn More →</a>"
    },

    // Thank you / bye
    {
      low: true,
      patterns: ["thank", "thanks", "thank you", "bye", "goodbye", "ok thanks", "great", "ok"],
      answer: "😊 You're welcome! Feel free to ask anything else.<br><br>For appointments: <a href='/search'>📅 Book Now</a><br>For emergencies: <a href='tel:+919566443300'>📞 Call Us</a>"
    }
  ];

  /* ── Live data from the reception panel ──
     Fees (Booking & Fees) and doctor OP timings, leave and one-day timing changes (Doctor Schedule).
     The answers above are the fallback; they are replaced once the current data loads. */
  (function liveData() {
    var feeEntry = KB.find(function (k) { return k.patterns.indexOf("fees") !== -1; });
    var timeEntry = KB.find(function (k) { return k.patterns.indexOf("timings") !== -1; });
    if (!feeEntry || !timeEntry || !window.fetch) return;
    var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var hhmm = function (m) { var h = Math.floor(m / 60), mm = m % 60; return ((h % 12) || 12) + ':' + (mm < 10 ? '0' : '') + mm + ' ' + (h < 12 ? 'AM' : 'PM'); };
    var daysText = function (days) {
      var d = [1, 2, 3, 4, 5, 6, 0].filter(function (x) { return days.indexOf(x) >= 0; });
      if (d.length === 7) return 'All days';
      var run = d.length > 2 && d.every(function (x, i) { return i === 0 || x === (d[i - 1] + 1) % 7; });
      return run ? DAYS[d[0]] + '–' + DAYS[d[d.length - 1]] : d.map(function (x) { return DAYS[x]; }).join(', ');
    };
    var dayName = function (iso, i) {
      var label = new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      return (['Today', 'Tomorrow'][i] ? ['Today', 'Tomorrow'][i] + ' (' + label + ')' : label);
    };
    var timings = function (data) {
      var lines = [], changes = [];
      Object.keys(data.doctors).forEach(function (name) {
        var d = data.doctors[name], s = d.schedule;
        if (!s) return;
        var hours = d.opHours || (hhmm(s.start_min) + ' – ' + hhmm(s.end_min));
        var how = d.feeStatus === 'pending' ? ' (call to book)' : d.bookingMode === 'request' ? ' (WhatsApp request)' : '';
        lines.push('• <strong>' + esc(name) + ':</strong> ' + daysText(s.days) + ', ' + esc(hours) + how);
        (d.next || []).forEach(function (n, i) {
          var usual = s.days.indexOf(new Date(n.date + 'T00:00:00').getDay()) >= 0;
          if (n.leave) changes.push('• ' + dayName(n.date, i) + ': <strong>' + esc(name) + '</strong> is on leave');
          else if (n.custom) changes.push('• ' + dayName(n.date, i) + ': <strong>' + esc(name) + '</strong> ' + hhmm(n.start_min) + ' – ' + hhmm(n.end_min) + (usual ? ' (changed timing)' : ' (special OP)'));
        });
      });
      if (!lines.length) return;
      timeEntry.answer = '⏰ <strong>Hospital Timings:</strong><br>🗓️ Monday – Saturday: <strong>9:00 AM – 7:00 PM</strong><br>🚨 Sunday: <strong>Emergency Services Only</strong> (24x7 emergency: <a href=\'tel:+919566443300\'>+91 95664 43300</a>)' +
        '<br><br>👨‍⚕️ <strong>Doctor OP timings:</strong><br>' + lines.join('<br>') +
        '<br><br>📅 <strong>Next 3 days:</strong><br>' + (changes.length ? changes.join('<br>') : 'All doctors are on their usual timings.') +
        '<br><br>For appointments: <a href=\'/search\'>Book Here →</a>';
    };
    var base = /(^|\.)vercel\.app$|^localhost$/.test(window.location.hostname) ? '' : 'https://nivyahospital.vercel.app';
    var rupees = function (n) { return '₹' + Number(n).toLocaleString('en-IN'); };
    fetch(base + '/api/availability?all=1', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.configured || !data.doctors) return;
        var live = {};
        Object.keys(data.doctors).forEach(function (name) {
          var d = data.doctors[name];
          var set = d.feeStatus !== 'pending' && d.fees && Number(d.fees.new) > 0 && Number(d.fees.old) > 0;
          live[name] = !set
            ? CALL_FOR_FEE
            : Number(d.fees.new) === Number(d.fees.old)
              ? '<strong>' + rupees(d.fees.new) + '</strong>'
              : 'New Patient: <strong>' + rupees(d.fees.new) + '</strong> | Old Patient: <strong>' + rupees(d.fees.old) + '</strong>';
        });
        if (Object.keys(live).length) { FEES = live; feeEntry.answer = allFees(); }
        timings(data);
      })
      .catch(function () { /* keep the built-in answer */ });
  })();

  /* ── Match user input to KB ──
     Whole-word matching (so "dr" doesn't fire inside "address", "hi" inside "which",
     "fee" inside "feel"), with an optional plural/-ed/-ing ending. The most specific
     (longest) keyword wins; `weight` lowers generic entries, `low` entries
     (greetings / thanks) only answer when nothing else matched. */
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  KB.forEach((entry) => {
    entry.matchers = entry.patterns.map((p) => ({
      len: p.length,
      re: new RegExp("\\b" + escapeRe(p) + "(?:s|es|ed|ing)?\\b", "i")
    }));
  });

  const FALLBACK = "🤔 I'm not sure about that. Please try asking about:<br><br>• Doctors • Fees • Appointments<br>• Specialities • Location • Timings<br><br>Or call us directly: <a href='tel:+919566443300'>📞 +91 95664 43300</a>";

  // "Fee for Dr. Nivya", "pulmonologist charges": that doctor's fee, not the doctor's profile.
  // "Nivya Hospital fees": every doctor's fee, not the About answer.
  const feeQuestion = KB.find((k) => k.patterns.indexOf("fees") !== -1);
  function doctorFee(text) {
    if (!feeQuestion.matchers.some((m) => m.re.test(text))) return null;
    const named = KB.filter((e) => e.doctor && FEES[e.doctor] && e.names.test(text)).map((e) => e.doctor);
    if (!named.length) return /\bnivya\b/i.test(text) ? allFees() : null;
    return "💰 <strong>Consultation " + (named.length > 1 ? "Fees" : "Fee") + ":</strong><br><br>" + feeLines(named) +
      "<br><br><a href='/search'>📅 Choose Doctor & Book</a> · Ask “fees” for every doctor's fee.";
  }

  function getReply(input) {
    const text = input.toLowerCase().trim();
    const fee = doctorFee(text);
    if (fee) return fee;
    for (const lowPass of [false, true]) {
      let best = null;
      let bestScore = -Infinity;
      for (const entry of KB) {
        if (Boolean(entry.low) !== lowPass) continue;
        for (const m of entry.matchers) {
          const score = m.len + (entry.weight || 0);
          if (score > bestScore && m.re.test(text)) {
            best = entry;
            bestScore = score;
          }
        }
      }
      if (best) return best.answer;
    }
    return FALLBACK;
  }

  /* ── Build UI ── */
  const style = document.createElement("style");
  style.textContent = `
    :root {
      --ncm-right: 28px;
      --ncm-bottom: 28px;
      --ncm-launcher-size: 60px;
      --ncm-control-gap: 12px;
      --ncm-top-size: 35px;
      --ncm-panel-bottom: calc(var(--ncm-bottom) + var(--ncm-launcher-size) + var(--ncm-top-size) + 2 * var(--ncm-control-gap));
    }
    .progress-wrap:not(.progress-four) {
      right: calc(var(--ncm-right) + (var(--ncm-launcher-size) - var(--ncm-top-size)) / 2);
      bottom: calc(var(--ncm-bottom) + var(--ncm-launcher-size) + var(--ncm-control-gap));
      background: #fff;
    }
    #nivya-chat-btn {
      position: fixed;
      bottom: var(--ncm-bottom);
      right: var(--ncm-right);
      width: var(--ncm-launcher-size);
      height: var(--ncm-launcher-size);
      border-radius: 50%;
      background: linear-gradient(135deg, #0d6efd, #0a58ca);
      color: #fff;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 18px rgba(13,110,253,0.45);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #nivya-chat-btn:hover { transform: scale(1.1); box-shadow: 0 6px 24px rgba(13,110,253,0.55); }
    #nivya-chat-btn[aria-expanded="false"] { background: #fff; }
    #nivya-chat-btn[aria-expanded="true"] .ncm-launcher-logo,
    #nivya-chat-btn[aria-expanded="false"] .ncm-launcher-close { display: none; }
    .ncm-launcher-logo { width: 48px; height: 48px; object-fit: contain; }

    #nivya-chat-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #dc3545;
      color: #fff;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #fff;
    }

    #nivya-chat-window {
      position: fixed;
      bottom: var(--ncm-panel-bottom);
      right: var(--ncm-right);
      width: 360px;
      max-width: calc(100vw - 24px);
      max-height: 520px;
      max-height: min(520px, calc(100vh - var(--ncm-panel-bottom) - 20px));
      max-height: min(520px, calc(100dvh - var(--ncm-panel-bottom) - 20px));
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      z-index: 9998;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: 'Segoe UI', sans-serif;
      transform: scale(0.85) translateY(20px);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: all 0.25s cubic-bezier(.4,0,.2,1);
    }
    #nivya-chat-window.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      visibility: visible;
      pointer-events: all;
    }

    #nivya-chat-header {
      background: linear-gradient(135deg, #0d6efd, #0a58ca);
      color: #fff;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    #nivya-chat-header .ncm-header-logo {
      width: 38px; height: 38px;
      border-radius: 50%;
      background: #fff;
      object-fit: contain;
      flex-shrink: 0;
    }
    #nivya-chat-header .info { flex: 1; }
    #nivya-chat-header .info strong { display: block; font-size: 14px; }
    #nivya-chat-header .info span { font-size: 11px; opacity: 0.85; }
    #nivya-chat-close {
      background: none; border: none; color: #fff;
      font-size: 20px; cursor: pointer; padding: 0 4px; line-height: 1;
    }

    #nivya-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f8f9fc;
    }
    .ncm-bubble {
      max-width: 85%;
      padding: 10px 13px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.55;
      animation: ncm-in 0.2s ease;
    }
    @keyframes ncm-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    .ncm-bot {
      background: #fff;
      color: #212529;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      align-self: flex-start;
    }
    .ncm-bot a { color: #0d6efd; text-decoration: none; font-weight: 500; }
    .ncm-bot a:hover { text-decoration: underline; }
    .ncm-user {
      background: linear-gradient(135deg, #0d6efd, #0a58ca);
      color: #fff;
      border-bottom-right-radius: 4px;
      align-self: flex-end;
    }
    .ncm-typing {
      display: flex; gap: 4px; align-items: center; padding: 10px 13px;
    }
    .ncm-typing span {
      width: 7px; height: 7px; background: #adb5bd;
      border-radius: 50%; animation: ncm-bounce 1.2s infinite;
    }
    .ncm-typing span:nth-child(2) { animation-delay: 0.2s; }
    .ncm-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes ncm-bounce { 0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-5px); } }

    #nivya-chat-quick {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 14px;
      background: #f8f9fc;
      border-top: 1px solid #e9ecef;
    }
    .ncm-quick-btn {
      background: #e9f1fe;
      color: #0d6efd;
      border: 1px solid #b6d0fb;
      border-radius: 20px;
      padding: 4px 11px;
      font-size: 11.5px;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .ncm-quick-btn:hover { background: #d0e4fd; }

    #nivya-chat-input-row {
      display: flex;
      padding: 10px 12px;
      gap: 8px;
      background: #fff;
      border-top: 1px solid #e9ecef;
      flex-shrink: 0;
    }
    #nivya-chat-input {
      flex: 1;
      border: 1.5px solid #dee2e6;
      border-radius: 24px;
      padding: 8px 14px;
      font-size: 13px;
      outline: none;
      transition: border 0.15s;
    }
    #nivya-chat-input:focus { border-color: #0d6efd; }
    #nivya-chat-send {
      background: linear-gradient(135deg, #0d6efd, #0a58ca);
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 38px; height: 38px;
      cursor: pointer;
      font-size: 16px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: transform 0.15s;
    }
    #nivya-chat-send:hover { transform: scale(1.08); }

    @media (max-width: 420px) {
      :root { --ncm-right: 16px; --ncm-bottom: 20px; }
      #nivya-chat-window {
        width: calc(100vw - 24px); right: 12px;
      }
    }
  `;
  document.head.appendChild(style);

  /* ── HTML ── */
  const brandMark = "/assets/img/apple-touch-icon.png";
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <button id="nivya-chat-btn" type="button" title="Chat with us" aria-label="Open chat" aria-expanded="false" aria-controls="nivya-chat-window">
      <img class="ncm-launcher-logo" src="${brandMark}" alt="">
      <span class="ncm-launcher-close" aria-hidden="true">✕</span>
      <span id="nivya-chat-badge" aria-hidden="true">1</span>
    </button>

    <div id="nivya-chat-window" role="dialog" aria-label="Nivya Hospital Assistant">
      <div id="nivya-chat-header">
        <img class="ncm-header-logo" src="${brandMark}" alt="">
        <div class="info">
          <strong>Nivya Hospital Assistant</strong>
          <span>🟢 Online – Here to help</span>
        </div>
        <button id="nivya-chat-close" type="button" title="Close" aria-label="Close chat">✕</button>
      </div>

      <div id="nivya-chat-messages" aria-live="polite"></div>

      <div id="nivya-chat-quick">
        <button type="button" class="ncm-quick-btn">📅 Book Appointment</button>
        <button type="button" class="ncm-quick-btn">💰 Fees</button>
        <button type="button" class="ncm-quick-btn">👨‍⚕️ Doctors</button>
        <button type="button" class="ncm-quick-btn">🏥 Specialities</button>
        <button type="button" class="ncm-quick-btn">📍 Location</button>
        <button type="button" class="ncm-quick-btn">📞 Contact</button>
      </div>

      <div id="nivya-chat-input-row">
        <input id="nivya-chat-input" type="text" placeholder="Type your question…" autocomplete="off" maxlength="200" aria-label="Type your question" />
        <button id="nivya-chat-send" type="button" aria-label="Send message">➤</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  /* ── References ── */
  const btn      = document.getElementById("nivya-chat-btn");
  const win      = document.getElementById("nivya-chat-window");
  const closeBtn = document.getElementById("nivya-chat-close");
  const msgs     = document.getElementById("nivya-chat-messages");
  const input    = document.getElementById("nivya-chat-input");
  const sendBtn  = document.getElementById("nivya-chat-send");
  const badge    = document.getElementById("nivya-chat-badge");
  const quickBar = document.getElementById("nivya-chat-quick");

  let isOpen = false;
  let seen = false;

  function toggleChat() {
    isOpen = !isOpen;
    win.classList.toggle("open", isOpen);
    btn.setAttribute("aria-expanded", String(isOpen));
    btn.setAttribute("aria-label", isOpen ? "Close chat" : "Open chat");
    if (isOpen) {
      seen = true;
      badge.style.display = "none";
      if (msgs.children.length === 0) addBotMsg(KB[0].answer, 400);
      // Don't auto-focus on touch screens: it pops the keyboard over the chat.
      if (!window.matchMedia("(pointer: coarse)").matches) {
        setTimeout(() => input.focus(), 300);
      }
    }
  }

  function scrollBottom() {
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addBotMsg(html, delay = 600) {
    // Show typing indicator
    const typing = document.createElement("div");
    typing.className = "ncm-bubble ncm-bot ncm-typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    msgs.appendChild(typing);
    scrollBottom();

    setTimeout(() => {
      typing.remove();
      const bubble = document.createElement("div");
      bubble.className = "ncm-bubble ncm-bot";
      bubble.innerHTML = html;
      msgs.appendChild(bubble);
      scrollBottom();
    }, delay);
  }

  function addUserMsg(text) {
    const bubble = document.createElement("div");
    bubble.className = "ncm-bubble ncm-user";
    bubble.textContent = text;
    msgs.appendChild(bubble);
    scrollBottom();
  }

  function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    addUserMsg(text);
    const reply = getReply(text);
    addBotMsg(reply);
  }

  /* ── Events ── */
  btn.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", toggleChat);

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });

  quickBar.addEventListener("click", (e) => {
    if (e.target.classList.contains("ncm-quick-btn")) {
      const text = e.target.textContent.replace(/[^\w\s]/gi, "").trim();
      input.value = text;
      handleSend();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) {
      toggleChat();
      btn.focus();
    }
  });

  // Show badge after 3s as a prompt (only if the visitor hasn't opened the chat yet)
  setTimeout(() => {
    if (!isOpen && !seen) {
      badge.style.display = "flex";
    }
  }, 3000);

})();
