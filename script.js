/* ============================================================
   Modeus demo — dynamic copy + iMessage interaction
   ============================================================ */

/* ---------- Read URL params ---------- */
const params = new URLSearchParams(window.location.search);
const firstName = (params.get("first_name") || "").trim();

/* ============================================================
   HERO HEADLINE (dynamic)
   ============================================================ */
const headlineEl = document.getElementById("headline");
const greetingLine = firstName ? `Hi ${escapeHtml(firstName)},<br />` : "";
headlineEl.innerHTML =
  `${greetingLine}Missed calls shouldn’t mean missed opportunities.`;

/* ============================================================
   iPHONE — INITIAL MESSAGES  (edit copy here)
   type: "in" = incoming grey, "out" = outgoing blue
   ============================================================ */
const initialMessages = [
  { type: "in", text: "Hi, are you replying to every enquiry fast enough?" },
  { type: "out", text: "No. Not always." },
  { type: "in", text: "That’s exactly why we built this." },
  { type: "in", text: "Calls, texts and WhatsApp messages get an instant reply. Then we ask a few tailored questions based around your processes and send you a summary with the next steps." },
  { type: "in", text: "Want to see how it works?" },
];

/* ============================================================
   iPHONE — ROADMAP MESSAGES (appended on Send) (edit copy here)
   ============================================================ */
const roadmapMessages = [
  "Perfect. Here’s the recovery flow:",
  "1. Enquiry comes in:\nThe system replies instantly, even when you can’t.",
  "2. Text goes out:\nThe customer gets a reply while the interest is still warm.",
  "3. Customer replies:\nWe ask questions tailored to how your business operates.",
  "4. Details are handed over:\nYou get a clean summary with the next step.",
  "Want me to show you this working on your own number?",
];

/* ---------- Render initial messages ---------- */
const chat = document.getElementById("chat");
initialMessages.forEach((m) => addBubble(m.text, m.type === "out" ? "outgoing" : "incoming"));

/* ============================================================
   SEND INTERACTION
   ============================================================ */
const sendBtn = document.getElementById("sendBtn");
const phoneInput = document.getElementById("phoneInput");
let sent = false;

sendBtn.addEventListener("click", handleSend);
phoneInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSend();
});

function handleSend() {
  if (sent) return;
  sent = true;

  const text = phoneInput.value.trim() || "Show me how";

  // 1. outgoing bubble
  addBubble(text, "outgoing");

  // disable send + fade input, remove the hint
  sendBtn.disabled = true;
  phoneInput.style.opacity = "0.5";
  const sendHint = document.getElementById("sendHint");
  if (sendHint) sendHint.style.display = "none";

  // 2. append second-set recovery flow; reveal chips ONLY after the final message
  roadmapMessages.forEach((msg, i) => {
    const isFinal = i === roadmapMessages.length - 1;
    setTimeout(() => {
      addBubble(msg, "incoming");
      if (isFinal) showChips();
    }, 600 + i * 750);
  });
}

/* ============================================================
   QUICK REPLY CHIPS (Yes / No)
   ============================================================ */
const quickReplies = document.getElementById("quickReplies");
let chipUsed = false;

// Force hidden on page load — nothing reveals chips until the recovery flow ends.
if (quickReplies) {
  quickReplies.style.display = "none";
  quickReplies.classList.remove("visible");
}

function showChips() {
  if (chipUsed) return; // never reappear once answered
  quickReplies.style.display = "flex";
  quickReplies.classList.add("visible");
  chat.scrollTop = chat.scrollHeight;
}

quickReplies.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chipUsed) return;
    chipUsed = true;

    const reply = chip.dataset.reply;
    quickReplies.style.display = "none"; // hide chips after a choice
    quickReplies.classList.remove("visible");
    addBubble(reply, "outgoing");

    if (reply === "Yes") {
      setTimeout(() => {
        addBubble("Perfect. Add your number below and I’ll text you the live demo.", "incoming");
        document.querySelector(".cta-card .phone-input").classList.add("highlight");
        document.getElementById("demo").scrollIntoView({ behavior: "smooth", block: "center" });
      }, 600);
    } else {
      setTimeout(() => {
        addBubble("No problem. You can still book a call if you want to see how this would be tailored to your business.", "incoming");
      }, 600);
    }
  });
});

/* ============================================================
   CTA FORM SUBMIT
   ============================================================ */
const ctaForm = document.getElementById("ctaForm");
const ctaSuccess = document.getElementById("ctaSuccess");

ctaForm.addEventListener("submit", (e) => {
  e.preventDefault();
  ctaSuccess.hidden = false;
});

/* ============================================================
   HELPERS
   ============================================================ */
function addBubble(text, cls, autoScroll = true) {
  const el = document.createElement("div");
  el.className = "bubble " + cls;
  el.textContent = text;
  chat.appendChild(el);
  if (autoScroll) chat.scrollTop = chat.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
