/* ============================================================
   Nivya Hospital – Built-in Chatbot (Pure JS, No Dependencies)
   ============================================================ */

(function () {
  /* ── Knowledge Base ── */
  const KB = [
    // Greetings
    {
      patterns: ["hello", "hi", "vanakkam", "hey", "good morning", "good evening", "good afternoon", "start", "help"],
      answer: "👋 Hello! Welcome to <strong>Nivya Respiratory & Multispeciality Hospital</strong>.<br><br>How can I help you today? You can ask me about:<br>• 🏥 Our Doctors<br>• 🩺 Specialities<br>• 💰 Consultation Fees<br>• 📅 Appointments<br>• 📍 Location & Timings<br>• 📞 Contact"
    },

    // Doctors
    {
      patterns: ["doctor", "doctors", "physician", "specialist", "dr", "who are the doctors", "available doctors"],
      answer: "👨‍⚕️ Our Doctors:<br><br><strong>1. Dr. P. Manimozhian</strong><br>MD (Chest Medicine), DTCD, Dip. in Allergy (UK), FCCP (USA)<br>Consultant Pulmonologist, Bronchoscopist, Allergy & Sleep Physician<br><br><strong>2. Dr. M. Nivya</strong><br>MD (General Medicine), FCD (Diabetology), FCC (Clinical Cardiology)<br>Consultant Diabetologist & General Physician<br><br><strong>3. Dr. M.A. Mathan</strong><br>MBBS, MEM (Emergency & Critical Care Medicine)<br>Emergency Physician & Intensivist<br><br><strong>4. Dr. Naveen Paul Singh</strong><br>BDS<br>Dental Surgeon & Consultant Dentist"
    },

    // Manimozhian
    {
      patterns: ["manimozhian", "pulmonologist", "lung", "chest", "pulmonology", "bronchoscopy", "allergy", "sleep", "asthma", "copd"],
      answer: "🫁 <strong>Dr. P. Manimozhian</strong><br>Specialisation: Pulmonology, Bronchoscopy, Allergy & Sleep Medicine<br>Qualification: MD (Chest Medicine), DTCD, Dip. in Allergy (UK), FCCP (USA)<br>Experience: 21+ Years<br><br>Treats: Asthma, COPD, Lung Infections, Sleep Apnea, Allergies<br><br><a href='doctor-manimozhiyan-profile.html'>View Full Profile →</a>"
    },

    // Nivya
    {
      patterns: ["nivya", "diabetes", "diabetologist", "general physician", "sugar", "general medicine", "cardiology"],
      answer: "👩‍⚕️ <strong>Dr. M. Nivya</strong><br>Specialisation: Diabetology & General Medicine<br>Qualification: MD (General Medicine), FCD (Diabetology), FCC (Clinical Cardiology)<br>Experience: 15+ Years<br><br>Treats: Diabetes, General Health, Cardiology Consultations<br><br><a href='doctor-nivya-profile.html'>View Full Profile →</a>"
    },

    // Mathan
    {
      patterns: ["mathan", "emergency", "critical care", "icu", "intensivist", "trauma", "accident"],
      answer: "🚨 <strong>Dr. M.A. Mathan</strong><br>Specialisation: Emergency & Critical Care Medicine<br>Qualification: MBBS, MEM (Emergency & Critical Care Medicine)<br>Experience: 10+ Years<br><br>Handles: Emergency Cases, ICU Management, Trauma, Acute Medical Emergencies<br><br><a href='doctor-mathan-profile.html'>View Full Profile →</a>"
    },

    // Naveen Paul / Dentist
    {
      patterns: ["naveen", "paul", "dentist", "dentistry", "dental", "teeth", "tooth", "root canal", "braces", "cavity"],
      answer: "🦷 <strong>Dr. Naveen Paul Singh</strong><br>Specialisation: Dentistry & Dental Surgery<br>Qualification: BDS<br>Experience: 10+ Years<br><br>Treats: Root Canal, Tooth Extraction, Dental Implants, Cosmetic Dentistry, Gum Care<br><br><a href='doctor-naveen-paul-profile.html'>View Full Profile →</a>"
    },

    // Consultation Fees
    {
      patterns: ["fee", "fees", "cost", "charge", "price", "consultation fee", "how much", "rate", "new patient", "old patient"],
      answer: "💰 <strong>Consultation Fees:</strong><br><br>🔵 New Patient: <strong>₹800</strong><br>🟢 Old Patient: <strong>₹500</strong><br><br>These fees apply for all our consultants."
    },

    // Appointment / Booking
    {
      patterns: ["appointment", "book", "booking", "schedule", "visit", "when", "slot", "timing"],
      answer: "📅 <strong>Book an Appointment:</strong><br><br>You can book directly through our website:<br><a href='booking-1.html'>👉 Book Now</a><br><br>Or call us:<br>📞 <a href='tel:+914622332222'>+91 462 233 2222</a><br><br>⏰ OPD Timings:<br>Mon–Sat: 9:00 AM – 7:00 PM<br>Sunday: Emergency Only"
    },

    // Specialities
    {
      patterns: ["speciality", "specialities", "department", "departments", "services", "treatment", "what do you treat"],
      answer: "🏥 <strong>Our Specialities:</strong><br><br>🫁 Pulmonology<br>🚨 Emergency & Critical Care<br>💊 General Medicine<br>❤️ Cardiology<br>🦴 Orthopaedics<br>🦷 Dentistry<br>🔪 General Surgery<br>🧠 Neurology<br>🫃 Gastroenterology<br>🔬 Radiology<br>🎗️ Oncology<br>🧘 Psychiatry<br>🦷 Dentistry<br><br><a href='index.html#specialities'>View All Specialities →</a>"
    },

    // General Surgery
    {
      patterns: ["surgery", "general surgery", "wound", "thyroid", "breast", "lipoma", "piles", "fissure"],
      answer: "🔪 <strong>General Surgery:</strong><br><br>• Comprehensive Wound Care<br>• Thyroid Mass Surgery<br>• Breast Mass Surgery<br>• Lipoma Surgery<br>• Piles & Fissure<br>• Hernia Repair<br>• Appendix Surgery<br><br><a href='general-surgery.html'>Learn More →</a>"
    },

    // Neurology
    {
      patterns: ["neurology", "neuro", "brain", "nerve", "stroke", "epilepsy", "migraine", "parkinson"],
      answer: "🧠 <strong>Neurology:</strong><br><br>• Stroke<br>• Epilepsy<br>• Migraine<br>• Neuropathy<br>• Parkinson's Disease<br><br><a href='neurology.html'>Learn More →</a>"
    },

    // Gastroenterology
    {
      patterns: ["gastro", "gastroenterology", "stomach", "gut", "acid", "reflux", "gerd", "ulcer", "liver", "diarrhea", "constipation", "pancreas"],
      answer: "🫃 <strong>Gastroenterology:</strong><br><br>• GERD (Acid Reflux)<br>• Liver Diseases<br>• Gastritis<br>• Ulcers<br>• Diarrhea<br>• Constipation<br>• Pancreatic Disease<br><br><a href='gastro-enterology.html'>Learn More →</a>"
    },

    // Radiology
    {
      patterns: ["radiology", "xray", "x-ray", "scan", "ultrasound", "imaging", "doppler"],
      answer: "🔬 <strong>Radiology:</strong><br><br>• X-Ray<br>• Ultrasound<br>• Colour Doppler<br>• MRI & CT Scan Referrals<br><br><a href='radiology.html'>Learn More →</a>"
    },

    // Oncology
    {
      patterns: ["oncology", "cancer", "tumor", "tumour", "chemo", "chemotherapy"],
      answer: "🎗️ <strong>Oncology:</strong><br><br>• Cancer Screening<br>• Diagnosis and Staging<br>• Complete Cancer Treatment<br>• Supportive Care<br><br><a href='oncology.html'>Learn More →</a>"
    },

    // Psychiatry
    {
      patterns: ["psychiatry", "mental", "anxiety", "depression", "stress", "sleep disorder", "memory", "fishoparnea"],
      answer: "🧘 <strong>Psychiatry:</strong><br><br>• Anxiety<br>• Depression<br>• Stress Disorders<br>• Sleep Disorders<br>• Fishoparnea<br>• Memory Problems<br><br><a href='psychiatry.html'>Learn More →</a>"
    },

    // Location
    {
      patterns: ["location", "address", "where", "directions", "map", "tirunelveli", "how to reach", "vannarpettai"],
      answer: "📍 <strong>Our Location:</strong><br><br>Nivya Respiratory & Multispeciality Hospitals<br>Vannarpettai, Tirunelveli – 627 003<br>Tamil Nadu, India<br><br><a href='https://maps.google.com/?q=Nivya+Respiratory+and+Multispeciality+Hospitals' target='_blank'>📌 Open in Google Maps</a>"
    },

    // Contact
    {
      patterns: ["contact", "phone", "call", "number", "email", "reach", "whatsapp"],
      answer: "📞 <strong>Contact Us:</strong><br><br>Phone: <a href='tel:+914622332222'>+91 462 233 2222</a><br>Email: <a href='mailto:info@nivyahospitals.com'>info@nivyahospitals.com</a><br><br>Or visit us at:<br>📍 Vannarpettai, Tirunelveli<br><br><a href='contact-us.html'>Contact Page →</a>"
    },

    // Timings
    {
      patterns: ["timing", "timings", "hours", "open", "time", "opd", "working hours", "sunday", "weekend"],
      answer: "⏰ <strong>Hospital Timings:</strong><br><br>🗓️ Monday – Saturday: <strong>9:00 AM – 7:00 PM</strong><br>🚨 Sunday: <strong>Emergency Services Only</strong><br><br>For appointments: <a href='booking-1.html'>Book Here →</a>"
    },

    // About
    {
      patterns: ["about", "nivya hospital", "who are you", "hospital info", "history", "about us"],
      answer: "🏥 <strong>About Nivya Respiratory & Multispeciality Hospitals:</strong><br><br>A leading hospital in Tirunelveli dedicated to respiratory and multispeciality care. Known for several <em>firsts</em> in Tirunelveli including the 1st Pulmonology hospital, 1st Computerized PFT, 1st Sleep Study Centre and more.<br><br><a href='about-us.html'>Read Our Full Story →</a>"
    },

    // TB / PCR
    {
      patterns: ["tb", "tuberculosis", "genexpert", "pcr", "igra", "latent tb"],
      answer: "🧪 <strong>TB Services:</strong><br><br>• TB PCR (GeneXpert) – 1st in Tirunelveli private sector<br>• Latent TB Infection Blood Test (IGRA)<br>• Complete TB Diagnosis & Treatment<br><br><a href='pulmonology.html'>Pulmonology Services →</a>"
    },

    // PFT / Lung Test
    {
      patterns: ["pft", "pulmonary function", "feno", "ios", "6mwt", "spirometry", "lung test"],
      answer: "🫁 <strong>Pulmonary Function Tests (PFT):</strong><br><br>We are the 1st hospital in Tirunelveli to have:<br>• FeNO (Fractional Exhaled Nitric Oxide)<br>• IOS (Impulse Oscillometry System)<br>• 6MWT (6-Minute Walk Test)<br>• Computerized PFT<br><br><a href='pulmonology.html'>Learn More →</a>"
    },

    // Thank you / bye
    {
      patterns: ["thank", "thanks", "thank you", "bye", "goodbye", "ok thanks", "great", "ok"],
      answer: "😊 You're welcome! Feel free to ask anything else.<br><br>For appointments: <a href='booking-1.html'>📅 Book Now</a><br>For emergencies: <a href='tel:+914622332222'>📞 Call Us</a>"
    }
  ];

  /* ── Match user input to KB ── */
  function getReply(input) {
    const text = input.toLowerCase().trim();
    for (const entry of KB) {
      for (const pattern of entry.patterns) {
        if (text.includes(pattern)) {
          return entry.answer;
        }
      }
    }
    return "🤔 I'm not sure about that. Please try asking about:<br><br>• Doctors • Fees • Appointments<br>• Specialities • Location • Timings<br><br>Or call us directly: <a href='tel:+914622332222'>📞 +91 462 233 2222</a>";
  }

  /* ── Build UI ── */
  const style = document.createElement("style");
  style.textContent = `
    #nivya-chat-btn {
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 60px;
      height: 60px;
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
      bottom: 100px;
      right: 28px;
      width: 360px;
      max-height: 520px;
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
      pointer-events: none;
      transition: all 0.25s cubic-bezier(.4,0,.2,1);
    }
    #nivya-chat-window.open {
      transform: scale(1) translateY(0);
      opacity: 1;
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
    #nivya-chat-header .avatar {
      width: 38px; height: 38px;
      border-radius: 50%;
      background: rgba(255,255,255,0.25);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; flex-shrink: 0;
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
      #nivya-chat-window { width: calc(100vw - 24px); right: 12px; bottom: 88px; }
      #nivya-chat-btn { right: 16px; bottom: 20px; }
    }
  `;
  document.head.appendChild(style);

  /* ── HTML ── */
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <button id="nivya-chat-btn" title="Chat with us">
      💬
      <span id="nivya-chat-badge">1</span>
    </button>

    <div id="nivya-chat-window">
      <div id="nivya-chat-header">
        <div class="avatar">🏥</div>
        <div class="info">
          <strong>Nivya Hospital Assistant</strong>
          <span>🟢 Online – Here to help</span>
        </div>
        <button id="nivya-chat-close" title="Close">✕</button>
      </div>

      <div id="nivya-chat-messages"></div>

      <div id="nivya-chat-quick">
        <button class="ncm-quick-btn">📅 Book Appointment</button>
        <button class="ncm-quick-btn">💰 Fees</button>
        <button class="ncm-quick-btn">👨‍⚕️ Doctors</button>
        <button class="ncm-quick-btn">🏥 Specialities</button>
        <button class="ncm-quick-btn">📍 Location</button>
        <button class="ncm-quick-btn">📞 Contact</button>
      </div>

      <div id="nivya-chat-input-row">
        <input id="nivya-chat-input" type="text" placeholder="Type your question…" autocomplete="off" />
        <button id="nivya-chat-send">➤</button>
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

  function toggleChat() {
    isOpen = !isOpen;
    win.classList.toggle("open", isOpen);
    btn.textContent = isOpen ? "✕" : "💬";
    if (isOpen) {
      badge.style.display = "none";
      if (msgs.children.length === 0) addBotMsg(KB[0].answer, 400);
      setTimeout(() => input.focus(), 300);
    } else {
      btn.innerHTML = '💬<span id="nivya-chat-badge" style="display:none">1</span>';
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

  // Show badge after 3s as a prompt
  setTimeout(() => {
    if (!isOpen) {
      badge.style.display = "flex";
    }
  }, 3000);

})();
