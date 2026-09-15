import { supabase } from './supabaseClient';

const BUCKET = 'content-uploads';
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export async function uploadFile(file, folder = '') {
  if (file.size > MAX_SIZE) {
    throw new Error(`파일이 너무 커요 (${file.name}). 50MB 이하로 올려주세요.`);
  }
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const path = `${folder ? `${folder}/` : ''}${crypto.randomUUID()}${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFiles(files, folder = '') {
  const urls = [];
  for (const file of files) {
    urls.push(await uploadFile(file, folder));
  }
  return urls;
}
