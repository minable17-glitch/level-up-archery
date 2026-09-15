import { useEffect, useState } from 'react';
import { adminListReflectionQuestions, adminUpsertReflectionQuestion, adminDeleteReflectionQuestion } from '../lib/api';
import { uploadFile } from '../lib/upload';

const EMPTY = { id: null, questionText: '', activitySheetUrl: '', orderIndex: 0, visible: true };

export default function AdminReflectionEditor({ dayId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadFile(file, dayId);
      setForm((f) => ({ ...f, activitySheetUrl: url }));
    } catch (err) {
      setError(err.message || '이미지 업로드에 실패했어요.');
    } finally {
      setUploading(false);
    }
  }

  async function refresh() {
    setError('');
    try {
      setItems(await adminListReflectionQuestions(dayId));
    } catch (err) {
      setError(err.message || '문항 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId]);

  function edit(item) {
    setForm({
      id: item.id,
      questionText: item.question_text || '',
      activitySheetUrl: item.activity_sheet_url || '',
      orderIndex: item.order_index ?? 0,
      visible: item.visible,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.questionText.trim()) {
      setError('문항 내용을 입력해주세요.');
      return;
    }
    setPending(true);
    setError('');
    try {
      await adminUpsertReflectionQuestion(dayId, form);
      setForm(EMPTY);
      await refresh();
    } catch (err) {
      setError(err.message || '저장에 실패했어요.');
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('이 문항을 삭제할까요? (학생이 이미 작성한 답변도 함께 사라져요)')) return;
    try {
      await adminDeleteReflectionQuestion(dayId, id);
      await refresh();
    } catch (err) {
      setError(err.message || '삭제에 실패했어요.');
    }
  }

  return (
    <div>
      <div className="card">
        <h2>{form.id ? '문항 수정' : '새 문항 추가'}</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          학생이 성찰하기 화면에서 답하게 될 질문이에요. 예: "오늘 활을 쏠 때 숨이 가장 찼던 순간은 언제였나요?"
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>문항 내용 *</label>
            <textarea value={form.questionText} onChange={(e) => setForm({ ...form, questionText: e.target.value })} />
          </div>
          <div className="field">
            <label>참고 이미지/활동지 (선택, 파일 업로드 또는 URL)</label>
            <input type="text" value={form.activitySheetUrl} onChange={(e) => setForm({ ...form, activitySheetUrl: e.target.value })} placeholder="https://.../worksheet.jpg" />
            <label className="btn btn-outline" style={{ marginTop: 6, display: 'inline-block', cursor: 'pointer' }}>
              {uploading ? '업로드 중...' : '내 기기에서 이미지 올리기'}
              <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} style={{ display: 'none' }} />
            </label>
            {form.activitySheetUrl && (
              <img src={form.activitySheetUrl} alt="" style={{ display: 'block', marginTop: 8, width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
            )}
          </div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}>
              <label>정렬 순서</label>
              <input type="number" value={form.orderIndex} onChange={(e) => setForm({ ...form, orderIndex: Number(e.target.value) })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>노출 여부</label>
              <label className="checkbox-row" style={{ border: 'none' }}>
                <input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} />
                학생에게 보이기
              </label>
            </div>
          </div>
          {error && <div className="msg msg-error">{error}</div>}
          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn btn-primary" type="submit" disabled={pending || uploading}>
              {pending ? '저장 중...' : form.id ? '수정 저장' : '문항 추가'}
            </button>
            {form.id && (
              <button className="btn btn-outline" type="button" onClick={() => setForm(EMPTY)}>
                취소
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h2>등록된 문항 ({items.length})</h2>
        {loading && <p className="muted">불러오는 중...</p>}
        {!loading && items.length === 0 && <p className="muted">아직 등록된 문항이 없어요. 위에서 첫 문항을 만들어보세요.</p>}
        {items.map((item, i) => (
          <div className="list-row" key={item.id} style={{ alignItems: 'flex-start' }}>
            <span>
              {i + 1}. {item.question_text}
              {!item.visible && <span className="tag" style={{ marginLeft: 6 }}>숨김</span>}
            </span>
            <span className="row" style={{ flexShrink: 0 }}>
              <button className="btn btn-outline" type="button" onClick={() => edit(item)}>수정</button>
              <button className="btn btn-danger" type="button" onClick={() => handleDelete(item.id)}>삭제</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
