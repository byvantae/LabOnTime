import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore, collection, onSnapshot, query, orderBy, doc,
  runTransaction, serverTimestamp, deleteDoc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = id => document.getElementById(id);
const slots = ["07:00","07:50","09:00","09:50","10:40","12:20","13:10"];
let auth, db, user = null, rows = [], filter = "all", picked = "", unsub = null;
let profile = null, setupSubjects = [], editSubjects = [];
const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("COLE_")
  && firebaseConfig.projectId && !firebaseConfig.projectId.startsWith("SEU_");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const dateText = s => { if (!s) return ""; const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; };
const message = (id, text, err=false) => {
  const el = $(id); el.textContent = text; el.style.color = err ? "#ff9bb5" : "var(--cyan)";
};
const toast = text => {
  const el = $("toast"); el.textContent = text; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
};
const profileRef = () => doc(db, "profiles", user.uid);

$("today").textContent = new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date());
$("date").min = today(); $("date").value = today();
$("theme").onclick = () => {
  document.body.classList.toggle("light");
  $("theme").textContent = document.body.classList.contains("light") ? "☾" : "☼";
};
$("logout").onclick = () => auth && signOut(auth);
$("lab").onchange = renderSlots; $("date").onchange = renderSlots;
document.querySelectorAll("[data-filter]").forEach(button => button.onclick = () => {
  filter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach(x => x.classList.toggle("active", x === button));
  renderRows();
});

function addSubject(list, value) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean) return false;
  if (list.some(s => s.toLocaleLowerCase("pt-BR") === clean.toLocaleLowerCase("pt-BR"))) return false;
  list.push(clean); return true;
}
function renderChips(containerId, list, onRemove) {
  const el = $(containerId); el.replaceChildren();
  list.forEach((subject, index) => {
    const chip = document.createElement("span"); chip.className = "chip";
    const label = document.createElement("span"); label.textContent = subject;
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×";
    remove.setAttribute("aria-label", `Remover ${subject}`);
    remove.onclick = () => onRemove(index);
    chip.append(label, remove); el.append(chip);
  });
}
function renderSetupSubjects() {
  renderChips("subjectChips", setupSubjects, i => { setupSubjects.splice(i,1); renderSetupSubjects(); });
}
function renderEditSubjects() {
  renderChips("editSubjectChips", editSubjects, i => { editSubjects.splice(i,1); renderEditSubjects(); });
}
$("addSubject").onclick = () => {
  if (!addSubject(setupSubjects, $("newSubject").value)) return message("profileMsg","Digite uma matéria nova.",true);
  $("newSubject").value = ""; renderSetupSubjects(); message("profileMsg","");
};
$("editAddSubject").onclick = () => {
  if (!addSubject(editSubjects, $("editNewSubject").value)) return message("editProfileMsg","Digite uma matéria nova.",true);
  $("editNewSubject").value = ""; renderEditSubjects(); message("editProfileMsg","");
};
function fillSubjectSelect() {
  const select = $("subject"), old = select.value; select.replaceChildren();
  const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = "Selecione sua matéria"; select.append(placeholder);
  (profile?.subjects || []).forEach(s => { const option = document.createElement("option"); option.value = s; option.textContent = s; select.append(option); });
  if ((profile?.subjects || []).includes(old)) select.value = old;
}
function renderSlots() {
  const date = $("date").value, lab = $("lab").value, el = $("slots"); el.replaceChildren();
  slots.forEach(time => {
    const busy = rows.some(r => r.date === date && r.lab === lab && r.start_time === time);
    const button = document.createElement("button"); button.type = "button";
    button.className = "slot" + (picked === time ? " selected" : "");
    button.textContent = time; button.disabled = busy;
    button.onclick = () => { picked = time; $("time").value = time; renderSlots(); };
    el.append(button);
  });
  if (rows.some(r => r.date === date && r.lab === lab && r.start_time === picked)) { picked = ""; $("time").value = ""; }
}
function renderRows() {
  $("total").textContent = rows.length;
  const el = $("list");
  const data = rows.filter(r => filter === "all" || r.lab === filter)
    .sort((a,b) => (a.date+a.start_time).localeCompare(b.date+b.start_time));
  el.replaceChildren();
  if (!data.length) {
    el.innerHTML = '<div class="empty">◷<b>Nenhuma reserva por aqui</b><small>As reservas aparecerão nesta agenda.</small></div>'; return;
  }
  data.forEach(r => {
    const item = document.createElement("article"); item.className = "reservation";
    const stripe = document.createElement("div"); stripe.className = "stripe";
    const tm = document.createElement("div"); tm.className = "rtime"; tm.textContent = r.start_time;
    const dt = document.createElement("small"); dt.textContent = dateText(r.date); tm.append(dt);
    const info = document.createElement("div"); info.className = "rinfo";
    const name = document.createElement("b"); name.textContent = r.teacher || "Professor";
    const detail = document.createElement("span");
    const labName = r.lab === "Science Lab" ? "Laboratório de Ciências" : "Laboratório de Informática";
    detail.textContent = `${r.subject || "Matéria não informada"} • ${labName}`;
    info.append(name, detail); item.append(stripe, tm, info);
    if (user && r.createdBy === user.uid) {
      const cancel = document.createElement("button"); cancel.className = "cancel"; cancel.textContent = "Cancelar";
      cancel.onclick = async () => {
        if (!confirm("Cancelar esta reserva?")) return;
        try { await deleteDoc(doc(db,"reservations",r.id)); toast("Reserva cancelada."); }
        catch (error) { console.error(error); toast("Não foi possível cancelar. Confira as regras do Firestore."); }
      };
      item.append(cancel);
    }
    el.append(item);
  });
}
function listen() {
  if (unsub) unsub();
  unsub = onSnapshot(query(collection(db,"reservations"),orderBy("date")), snapshot => {
    rows = snapshot.docs.map(d => ({id:d.id,...d.data()})); renderRows(); renderSlots();
  }, error => { console.error(error); toast("Erro na agenda. Confira as regras do Firestore."); });
}
async function loadProfile() {
  const snap = await getDoc(profileRef());
  if (snap.exists()) {
    const data = snap.data();
    profile = { displayName: data.displayName || user.displayName || "", subjects: Array.isArray(data.subjects) ? data.subjects : [] };
    if (profile.displayName && profile.subjects.length) { showDashboard(); return; }
  } else {
    profile = { displayName: user.displayName || "", subjects: [] };
  }
  showProfileSetup();
}
function showProfileSetup() {
  $("login").classList.add("hidden"); $("dashboard").classList.add("hidden"); $("profileSetup").classList.remove("hidden");
  $("profileName").value = profile?.displayName || user?.displayName || "";
  setupSubjects = [...(profile?.subjects || [])]; renderSetupSubjects(); message("profileMsg","");
}
function showDashboard() {
  $("login").classList.add("hidden"); $("profileSetup").classList.add("hidden"); $("dashboard").classList.remove("hidden");
  $("logout").classList.remove("hidden");
  $("welcomeName").textContent = profile.displayName.split(" ")[0] || "professor(a)";
  $("teacherDisplay").value = profile.displayName;
  $("editName").value = profile.displayName;
  editSubjects = [...profile.subjects]; renderEditSubjects(); fillSubjectSelect();
  listen();
}
async function handleAuth(userFromAuth) {
  user = userFromAuth;
  if (unsub) { unsub(); unsub = null; }
  rows = []; profile = null; picked = ""; $("time").value = "";
  $("login").classList.toggle("hidden", !!user);
  $("dashboard").classList.add("hidden"); $("profileSetup").classList.add("hidden");
  $("logout").classList.toggle("hidden", !user);
  if (!user) { renderRows(); renderSlots(); return; }
  try { await loadProfile(); }
  catch (error) { console.error(error); toast("Não foi possível carregar seu perfil. Verifique as regras do Firestore."); }
}
if (configured) {
  try {
    const app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app);
    onAuthStateChanged(auth, handleAuth);
  } catch (error) { console.error(error); }
}
$("googleLogin").onclick = async () => {
  if (!configured) return message("loginMsg","Configure firebase-config.js antes de entrar.",true);
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({prompt:"select_account"});
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    message("loginMsg", error.code === "auth/unauthorized-domain"
      ? "Domínio não autorizado. Adicione byvantae.github.io em Authentication > Settings > Authorized domains."
      : "Não foi possível entrar com Google. Confira se o provedor Google está ativado no Firebase.", true);
  }
};
$("loginForm").onsubmit = async event => {
  event.preventDefault(); message("loginMsg","Entrando...");
  if (!configured) return message("loginMsg","Preencha firebase-config.js com os dados reais do Firebase.",true);
  try { await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value); message("loginMsg",""); }
  catch (error) { console.error(error); message("loginMsg","Não foi possível entrar. Confira e-mail, senha e configuração.",true); }
};
$("profileForm").onsubmit = async event => {
  event.preventDefault();
  const displayName = $("profileName").value.trim();
  if (!displayName) return message("profileMsg","Informe seu nome completo.",true);
  if (!setupSubjects.length) return message("profileMsg","Adicione pelo menos uma matéria.",true);
  message("profileMsg","Salvando perfil...");
  try {
    profile = {displayName, subjects:[...setupSubjects]};
    await setDoc(profileRef(), {...profile, email:user.email || "", updatedAt:serverTimestamp()});
    showDashboard(); toast("Perfil cadastrado com sucesso!");
  } catch (error) { console.error(error); message("profileMsg","Não foi possível salvar. Confira as regras do Firestore.",true); }
};
$("editProfileForm").onsubmit = async event => {
  event.preventDefault();
  const displayName = $("editName").value.trim();
  if (!displayName) return message("editProfileMsg","Informe seu nome completo.",true);
  if (!editSubjects.length) return message("editProfileMsg","Mantenha pelo menos uma matéria cadastrada.",true);
  message("editProfileMsg","Salvando alterações...");
  try {
    profile = {displayName, subjects:[...editSubjects]};
    await setDoc(profileRef(), {...profile, email:user.email || "", updatedAt:serverTimestamp()});
    $("teacherDisplay").value = displayName; $("welcomeName").textContent = displayName.split(" ")[0];
    fillSubjectSelect(); message("editProfileMsg","Perfil atualizado!"); toast("Perfil atualizado.");
  } catch (error) { console.error(error); message("editProfileMsg","Não foi possível atualizar. Confira as regras do Firestore.",true); }
};
$("reserveForm").onsubmit = async event => {
  event.preventDefault();
  if (!user || !db || !profile) return message("reserveMsg","Faça login e complete seu perfil.",true);
  const teacher = profile.displayName, subject = $("subject").value;
  const date = $("date").value, lab = $("lab").value, time = picked;
  if (!subject || !profile.subjects.includes(subject)) return message("reserveMsg","Selecione uma matéria cadastrada no seu perfil.",true);
  if (!time) return message("reserveMsg","Selecione um horário disponível.",true);
  if (date < today()) return message("reserveMsg","Escolha hoje ou uma data futura.",true);
  const id = `${date}_${lab.replaceAll(" ","-")}_${time.replace(":","")}`;
  const ref = doc(db,"reservations",id);
  message("reserveMsg","Confirmando reserva...");
  try {
    await runTransaction(db, async tx => {
      const old = await tx.get(ref);
      if (old.exists()) throw Error("SLOT_TAKEN");
      tx.set(ref,{date,lab,start_time:time,teacher,subject,createdBy:user.uid,createdAt:serverTimestamp()});
    });
    message("reserveMsg","Reserva confirmada!"); toast("Horário reservado com sucesso.");
    $("reserveForm").reset(); $("date").value = today(); picked = ""; $("teacherDisplay").value = profile.displayName; renderSlots();
  } catch (error) {
    console.error(error);
    message("reserveMsg",error.message === "SLOT_TAKEN" ? "Este horário acabou de ser reservado. Escolha outro." : "Falha ao reservar. Confira conexão e regras do Firestore.",true);
  }
};
renderSlots(); renderRows();
