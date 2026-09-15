import { supabase } from './supabaseClient';

// 로그인(학생/관리자) 직전에는 항상 이전 익명 세션을 정리하고 새로 발급받아서,
// 이전에 로그인했던 다른 사람의 세션과 섞이지 않도록 함.
async function ensureFreshAnonSession() {
  await supabase.auth.signOut();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

// ── 로그인 ──────────────────────────────────────────────

export async function teacherSignup({ username, password, email }) {
  await ensureFreshAnonSession();
  const { data, error } = await supabase.rpc('teacher_signup', {
    p_username: username,
    p_password: password,
    p_email: email,
  });
  if (error) throw error;
  return data[0];
}

export async function teacherLogin({ username, password }) {
  await ensureFreshAnonSession();
  const { data, error } = await supabase.rpc('teacher_login', { p_username: username, p_password: password });
  if (error) throw error;
  return data[0];
}

export async function teacherFindUsername({ email }) {
  const { data, error } = await supabase.rpc('teacher_find_username', { p_email: email });
  if (error) throw error;
  return data?.[0]?.username || null;
}

export async function teacherResetPassword({ username, email, newPassword }) {
  const { error } = await supabase.rpc('teacher_reset_password', {
    p_username: username,
    p_email: email,
    p_new_password: newPassword,
  });
  if (error) throw error;
}

export async function createClass({ name }) {
  const { data, error } = await supabase.rpc('create_class', { p_name: name });
  if (error) throw error;
  return data[0];
}

export async function getMyClasses() {
  const { data, error } = await supabase.rpc('get_my_classes');
  if (error) throw error;
  return data || [];
}

export async function adminUpdateClassCode(classId, newCode) {
  const { error } = await supabase.rpc('admin_update_class_code', { p_class_id: classId, p_new_code: newCode });
  if (error) throw error;
}

export async function studentLogin({ classCode, studentNumber, name, pin }) {
  await ensureFreshAnonSession();
  const { data, error } = await supabase.rpc('student_login', {
    p_class_code: classCode,
    p_student_number: studentNumber,
    p_name: name,
    p_pin: pin,
  });
  if (error) throw error;
  return data[0];
}

export async function logout() {
  await supabase.auth.signOut();
}

// ── 일차 ──────────────────────────────────────────────────

export async function listDays(classId) {
  const { data, error } = await supabase
    .from('days')
    .select('*')
    .eq('class_id', classId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function adminCreateDay(classId, title, orderIndex = 0) {
  const { data, error } = await supabase.rpc('admin_create_day', {
    p_class_id: classId,
    p_title: title,
    p_order_index: orderIndex,
  });
  if (error) throw error;
  return data;
}

export async function adminUpdateDay(classId, id, title, orderIndex) {
  const { error } = await supabase.rpc('admin_update_day', {
    p_class_id: classId,
    p_id: id,
    p_title: title,
    p_order_index: orderIndex,
  });
  if (error) throw error;
}

export async function adminDeleteDay(classId, id) {
  const { error } = await supabase.rpc('admin_delete_day', { p_class_id: classId, p_id: id });
  if (error) throw error;
}

// ── 읽어보기 / 배워보기 ────────────────────────────────

export async function listReadContents(dayId) {
  const { data, error } = await supabase
    .from('read_contents')
    .select('*')
    .eq('day_id', dayId)
    .eq('visible', true)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listLearnContents(dayId) {
  const { data, error } = await supabase
    .from('learn_contents')
    .select('*')
    .eq('day_id', dayId)
    .eq('visible', true)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ── 기록하기 ──────────────────────────────────────────────

export async function saveShootingLog(payload) {
  const { error } = await supabase.rpc('save_shooting_log', {
    p_day_id: payload.dayId,
    p_bow_number: payload.bowNumber,
    p_markers: payload.markers,
    p_hit_count: payload.hitCount,
    p_miss_count: payload.missCount || 0,
    p_group_center_x: null,
    p_group_center_y: null,
    p_aim_advice: null,
    p_sight_before: null,
    p_sight_after: null,
  });
  if (error) throw error;
}

export async function getMyShootingLog(dayId) {
  const { data, error } = await supabase.rpc('get_my_shooting_log', { p_day_id: dayId });
  if (error) throw error;
  return data?.[0] || null;
}

export async function getMyShootingHistory(limit = 10) {
  const { data, error } = await supabase.rpc('get_my_shooting_history', { p_limit: limit });
  if (error) throw error;
  return data || [];
}

// ── 성찰하기 ──────────────────────────────────────────────

export async function listReflectionQuestions(dayId) {
  const { data, error } = await supabase
    .from('reflection_questions')
    .select('*')
    .eq('day_id', dayId)
    .eq('visible', true)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveReflection(payload) {
  const { error } = await supabase.rpc('save_reflection', {
    p_day_id: payload.dayId,
    p_used_skills: payload.usedSkills,
    p_short_note: payload.shortNote,
  });
  if (error) throw error;
}

export async function getMyReflection(dayId) {
  const { data, error } = await supabase.rpc('get_my_reflection', { p_day_id: dayId });
  if (error) throw error;
  return data?.[0] || null;
}

export async function saveReflectionAnswer(questionId, answerText) {
  const { error } = await supabase.rpc('save_reflection_answer', {
    p_question_id: questionId,
    p_answer_text: answerText,
  });
  if (error) throw error;
}

export async function getMyReflectionAnswers(dayId) {
  const { data, error } = await supabase.rpc('get_my_reflection_answers', { p_day_id: dayId });
  if (error) throw error;
  return data || [];
}

// ── 관리자 (지금 로그인한 교사가 학급/일차 소유자인지는 서버에서 확인) ──

export async function adminListReadContents(dayId) {
  const { data, error } = await supabase.rpc('admin_list_read_contents', { p_day_id: dayId });
  if (error) throw error;
  return data || [];
}

export async function adminUpsertReadContent(dayId, content) {
  const { data, error } = await supabase.rpc('admin_upsert_read_content', {
    p_day_id: dayId,
    p_id: content.id || null,
    p_title: content.title,
    p_category: content.category,
    p_image_urls: content.imageUrls,
    p_order_index: content.orderIndex ?? 0,
    p_visible: content.visible ?? true,
  });
  if (error) throw error;
  return data;
}

export async function adminDeleteReadContent(dayId, id) {
  const { error } = await supabase.rpc('admin_delete_read_content', { p_day_id: dayId, p_id: id });
  if (error) throw error;
}

export async function adminListLearnContents(dayId) {
  const { data, error } = await supabase.rpc('admin_list_learn_contents', { p_day_id: dayId });
  if (error) throw error;
  return data || [];
}

export async function adminUpsertLearnContent(dayId, content) {
  const { data, error } = await supabase.rpc('admin_upsert_learn_content', {
    p_day_id: dayId,
    p_id: content.id || null,
    p_title: content.title,
    p_category: content.category,
    p_video_url: content.videoUrl,
    p_image_urls: content.imageUrls,
    p_description: content.description,
    p_order_index: content.orderIndex ?? 0,
    p_visible: content.visible ?? true,
  });
  if (error) throw error;
  return data;
}

export async function adminDeleteLearnContent(dayId, id) {
  const { error } = await supabase.rpc('admin_delete_learn_content', { p_day_id: dayId, p_id: id });
  if (error) throw error;
}

export async function adminListReflectionQuestions(dayId) {
  const { data, error } = await supabase.rpc('admin_list_reflection_questions', { p_day_id: dayId });
  if (error) throw error;
  return data || [];
}

export async function adminUpsertReflectionQuestion(dayId, question) {
  const { data, error } = await supabase.rpc('admin_upsert_reflection_question', {
    p_day_id: dayId,
    p_id: question.id || null,
    p_question_text: question.questionText,
    p_activity_sheet_url: question.activitySheetUrl,
    p_order_index: question.orderIndex ?? 0,
    p_visible: question.visible ?? true,
  });
  if (error) throw error;
  return data;
}

export async function adminDeleteReflectionQuestion(dayId, id) {
  const { error } = await supabase.rpc('admin_delete_reflection_question', { p_day_id: dayId, p_id: id });
  if (error) throw error;
}

export async function adminListReflectionQuestionsByClass(classId) {
  const { data, error } = await supabase.rpc('admin_list_reflection_questions_by_class', { p_class_id: classId });
  if (error) throw error;
  return data || [];
}

export async function adminListStudents(classId) {
  const { data, error } = await supabase.rpc('admin_list_students', { p_class_id: classId });
  if (error) throw error;
  return data || [];
}

export async function adminListShootingLogs(classId, limit = 300) {
  const { data, error } = await supabase.rpc('admin_list_shooting_logs', { p_class_id: classId, p_limit: limit });
  if (error) throw error;
  return data || [];
}

export async function adminListReflections(classId, limit = 300) {
  const { data, error } = await supabase.rpc('admin_list_reflections', { p_class_id: classId, p_limit: limit });
  if (error) throw error;
  return data || [];
}

export async function adminListReflectionAnswers(classId, limit = 500) {
  const { data, error } = await supabase.rpc('admin_list_reflection_answers', { p_class_id: classId, p_limit: limit });
  if (error) throw error;
  return data || [];
}
