import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "mo64-memo-supabase-config";
const DEFAULT_CONFIG = {
  url: "https://cchevqlgwhlyxdnubsev.supabase.co",
  key: "sb_publishable_FRHntwiqVsrdfSjF5byHkA_wYJTdww7"
};
let supabase = null;
let currentUser = null;
let notes = [];
let activeNoteId = null;
let saveTimer = null;
let isSignup = false;

const setStatus = (text, online = false) => {
  $("syncState").textContent = text;
  $("syncState").classList.toggle("online", online);
};
const config = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || DEFAULT_CONFIG; }
  catch { return DEFAULT_CONFIG; }
};
const show = (id, visible) => $(id).classList.toggle("hidden", !visible);
const escapeText = (value) => String(value || "");
const formatDate = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }).format(new Date(value));
};
const activeNote = () => notes.find((note) => note.id === activeNoteId) || null;

function renderList() {
  const query = $("searchInput").value.trim().toLowerCase();
  const filtered = notes.filter((note) => (note.title + "\n" + note.content).toLowerCase().includes(query));
  $("noteList").replaceChildren();
  $("emptyList").classList.toggle("hidden", filtered.length > 0);
  filtered.forEach((note) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "note-item" + (note.id === activeNoteId ? " active" : "");
    const title = document.createElement("strong");
    title.textContent = note.title.trim() || "無題のメモ";
    const detail = document.createElement("span");
    detail.textContent = (note.content || "").replace(/\s+/g, " ").trim() || formatDate(note.updated_at);
    button.append(title, detail);
    button.addEventListener("click", () => selectNote(note.id));
    $("noteList").append(button);
  });
}

function selectNote(id) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    saveActiveNote();
  }
  activeNoteId = id;
  const note = activeNote();
  show("welcomeView", !note);
  show("editorView", !!note);
  if (note) {
    $("titleInput").value = note.title || "";
    $("contentInput").value = note.content || "";
    $("charCount").textContent = (note.content || "").length + "文字";
    $("updatedLabel").textContent = "保存済み · " + formatDate(note.updated_at);
  }
  renderList();
}

async function loadNotes() {
  setStatus("読み込み中");
  const { data, error } = await supabase.from("notes").select("id,title,content,created_at,updated_at").order("updated_at", { ascending:false });
  if (error) {
    setStatus("読み込み失敗");
    alert("メモを読み込めませんでした。\n" + error.message);
    return;
  }
  notes = data || [];
  if (!notes.some((note) => note.id === activeNoteId)) activeNoteId = notes[0]?.id || null;
  renderList();
  selectNote(activeNoteId);
  setStatus("同期中", true);
}

async function createNote() {
  const { data, error } = await supabase.from("notes").insert({ user_id: currentUser.id, title:"", content:"" }).select("id,title,content,created_at,updated_at").single();
  if (error) { alert("メモを作成できませんでした。\n" + error.message); return; }
  notes.unshift(data);
  selectNote(data.id);
  $("titleInput").focus();
  setStatus("保存済み", true);
}

function queueSave() {
  const note = activeNote();
  if (!note) return;
  note.title = $("titleInput").value;
  note.content = $("contentInput").value;
  $("charCount").textContent = note.content.length + "文字";
  $("updatedLabel").textContent = "保存中…";
  renderList();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveActiveNote();
  }, 650);
}

async function saveActiveNote() {
  const note = activeNote();
  if (!note || !currentUser) return;
  const payload = { title: $("titleInput").value, content: $("contentInput").value, updated_at:new Date().toISOString() };
  const { data, error } = await supabase.from("notes").update(payload).eq("id", note.id).eq("user_id", currentUser.id).select("id,title,content,created_at,updated_at").single();
  if (error) {
    $("updatedLabel").textContent = "保存に失敗";
    setStatus("保存エラー");
    console.error(error);
    return;
  }
  Object.assign(note, data);
  $("updatedLabel").textContent = "保存済み · " + formatDate(data.updated_at);
  setStatus("同期中", true);
  notes.sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));
  renderList();
}

async function deleteActiveNote() {
  const note = activeNote();
  if (!note || !confirm("このメモを削除しますか？")) return;
  const { error } = await supabase.from("notes").delete().eq("id", note.id).eq("user_id", currentUser.id);
  if (error) { alert("削除できませんでした。\n" + error.message); return; }
  notes = notes.filter((item) => item.id !== note.id);
  activeNoteId = notes[0]?.id || null;
  selectNote(activeNoteId);
}

function showAuth() {
  show("authPanel", true);
  show("memoApp", false);
  show("signOutButton", false);
  setStatus("ログインしてください");
}

function showWorkspace() {
  show("authPanel", false);
  show("memoApp", true);
  show("signOutButton", true);
}

async function connect(savedConfig) {
  if (!savedConfig?.url || !savedConfig?.key) {
    openSettings();
    return;
  }
  try {
    supabase = createClient(savedConfig.url, savedConfig.key);
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) {
      currentUser = data.session.user;
      showWorkspace();
      await loadNotes();
    } else showAuth();
    supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
        currentUser = session?.user || null;
        if (currentUser) { showWorkspace(); await loadNotes(); }
        else { notes = []; activeNoteId = null; showAuth(); }
      }, 0);
    });
  } catch (error) {
    console.error(error);
    setStatus("接続エラー");
    $("settingsMessage").textContent = "接続できませんでした。URLとキーを確認してください。";
    openSettings();
  }
}

function openSettings() {
  const saved = config();
  $("projectUrlInput").value = saved?.url || "";
  $("publishableKeyInput").value = saved?.key || "";
  $("settingsMessage").textContent = "";
  $("settingsDialog").showModal();
}

$("settingsButton").addEventListener("click", openSettings);
$("closeSettingsButton").addEventListener("click", () => $("settingsDialog").close());
$("settingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = $("projectUrlInput").value.trim().replace(/\/+$/, "");
  const key = $("publishableKeyInput").value.trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    $("settingsMessage").textContent = "Project URLの形式を確認してください。";
    return;
  }
  if (!key.startsWith("sb_publishable_") && !key.startsWith("eyJ")) {
    $("settingsMessage").textContent = "Publishable key（または旧anon key）を入力してください。";
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, key }));
  $("settingsDialog").close();
  await connect({ url, key });
});

$("authModeButton").addEventListener("click", () => {
  isSignup = !isSignup;
  $("authSubmit").textContent = isSignup ? "アカウントを作成" : "ログイン";
  $("authModeButton").textContent = isSignup ? "ログインに戻る" : "アカウントを新規作成";
  $("passwordInput").autocomplete = isSignup ? "new-password" : "current-password";
  $("authMessage").textContent = "";
});
$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return;
  $("authSubmit").disabled = true;
  $("authMessage").textContent = "処理中…";
  const email = $("emailInput").value.trim();
  const password = $("passwordInput").value;
  const result = isSignup
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });
  $("authSubmit").disabled = false;
  if (result.error) { $("authMessage").textContent = result.error.message; return; }
  if (isSignup && !result.data.session) {
    $("authMessage").textContent = "確認メールを送信しました。メール内のリンクから登録を完了してください。";
  } else {
    $("authMessage").textContent = "ログインしました。";
    currentUser = result.data.user;
    showWorkspace();
    await loadNotes();
  }
});

$("signOutButton").addEventListener("click", async () => {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; await saveActiveNote(); }
  await supabase.auth.signOut();
});
$("newNoteButton").addEventListener("click", createNote);
$("welcomeNewButton").addEventListener("click", createNote);
$("titleInput").addEventListener("input", queueSave);
$("contentInput").addEventListener("input", queueSave);
$("searchInput").addEventListener("input", renderList);
$("deleteNoteButton").addEventListener("click", deleteActiveNote);

connect(config());
