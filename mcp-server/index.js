import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요해요. README를 참고하세요.');
  process.exit(1);
}

// service role 키를 쓰므로 RLS를 모두 건너뛰고 테이블을 직접 조회한다.
// 이 서버는 교사 본인 컴퓨터에서만 실행하는 걸 전제로 한다(공개 서버 아님).
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function text(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorText(err) {
  return { content: [{ type: 'text', text: `오류: ${err.message || String(err)}` }], isError: true };
}

const server = new McpServer({ name: 'level-up-archery', version: '1.0.0' });

server.registerTool(
  'list_classes',
  {
    title: '학급 목록',
    description: '내가 만든 모든 학급(반) 목록을 가져온다. id, name(학급 이름), code(학급 코드)를 반환한다.',
    inputSchema: {},
  },
  async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, code, created_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return text(data);
    } catch (err) {
      return errorText(err);
    }
  }
);

server.registerTool(
  'list_students',
  {
    title: '학급 학생 목록',
    description: '특정 학급의 학생 명단(학번, 이름)을 가져온다.',
    inputSchema: { class_id: z.string().uuid().describe('학급 id (list_classes로 먼저 확인)') },
  },
  async ({ class_id }) => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, student_number, name, created_at')
        .eq('class_id', class_id)
        .order('student_number', { ascending: true });
      if (error) throw error;
      return text(data);
    } catch (err) {
      return errorText(err);
    }
  }
);

server.registerTool(
  'list_days',
  {
    title: '학급 일차 목록',
    description: '특정 학급에 등록된 일차(수업 차시) 목록을 가져온다.',
    inputSchema: { class_id: z.string().uuid().describe('학급 id') },
  },
  async ({ class_id }) => {
    try {
      const { data, error } = await supabase
        .from('days')
        .select('id, title, order_index, gem_url, created_at')
        .eq('class_id', class_id)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return text(data);
    } catch (err) {
      return errorText(err);
    }
  }
);

server.registerTool(
  'get_shooting_logs',
  {
    title: '슈팅(기록하기) 기록 조회',
    description:
      '학생들이 기록한 슈팅 결과(명중/빗나감 발수 등)를 가져온다. class_id/student_id/day_id 중 최소 하나는 넣어서 범위를 좁혀야 한다.',
    inputSchema: {
      class_id: z.string().uuid().optional().describe('학급 id로 필터'),
      student_id: z.string().uuid().optional().describe('학생 id로 필터'),
      day_id: z.string().uuid().optional().describe('일차 id로 필터'),
      limit: z.number().int().min(1).max(500).default(100).describe('최대 반환 개수(기본 100)'),
    },
  },
  async ({ class_id, student_id, day_id, limit }) => {
    if (!class_id && !student_id && !day_id) {
      return errorText(new Error('class_id, student_id, day_id 중 하나는 지정해주세요.'));
    }
    try {
      let query = supabase
        .from('shooting_logs')
        .select(
          'id, student_id, student_name, student_number, class_id, class_name, day_id, day_title, bow_number, hit_count, miss_count, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(limit);
      if (class_id) query = query.eq('class_id', class_id);
      if (student_id) query = query.eq('student_id', student_id);
      if (day_id) query = query.eq('day_id', day_id);
      const { data, error } = await query;
      if (error) throw error;
      return text(data);
    } catch (err) {
      return errorText(err);
    }
  }
);

server.registerTool(
  'get_reflection_answers',
  {
    title: '성찰 답변 조회',
    description:
      '학생들이 작성한 성찰 문항 답변을 질문 내용과 함께 가져온다. class_id/student_id/day_id 중 최소 하나는 넣어서 범위를 좁혀야 한다.',
    inputSchema: {
      class_id: z.string().uuid().optional().describe('학급 id로 필터'),
      student_id: z.string().uuid().optional().describe('학생 id로 필터'),
      day_id: z.string().uuid().optional().describe('일차 id로 필터'),
      limit: z.number().int().min(1).max(500).default(100).describe('최대 반환 개수(기본 100)'),
    },
  },
  async ({ class_id, student_id, day_id, limit }) => {
    if (!class_id && !student_id && !day_id) {
      return errorText(new Error('class_id, student_id, day_id 중 하나는 지정해주세요.'));
    }
    try {
      let query = supabase
        .from('reflection_answers')
        .select(
          'id, student_id, student_name, student_number, class_id, class_name, day_id, question_id, answer_text, created_at, reflection_questions(question_text)'
        )
        .order('created_at', { ascending: false })
        .limit(limit);
      if (class_id) query = query.eq('class_id', class_id);
      if (student_id) query = query.eq('student_id', student_id);
      if (day_id) query = query.eq('day_id', day_id);
      const { data, error } = await query;
      if (error) throw error;
      const flattened = (data || []).map((row) => ({
        ...row,
        question_text: row.reflection_questions?.question_text ?? null,
        reflection_questions: undefined,
      }));
      return text(flattened);
    } catch (err) {
      return errorText(err);
    }
  }
);

server.registerTool(
  'get_class_summary',
  {
    title: '학급 요약 통계',
    description:
      '특정 학급의 전체 기록을 집계해서 학생 수, 총 발수, 총 명중 수, 전체 명중률, 학생별 명중 랭킹(상위 20명)을 계산해 보여준다.',
    inputSchema: { class_id: z.string().uuid().describe('학급 id') },
  },
  async ({ class_id }) => {
    try {
      const [{ data: students, error: studentsError }, { data: logs, error: logsError }] = await Promise.all([
        supabase.from('students').select('id, student_number, name').eq('class_id', class_id),
        supabase.from('shooting_logs').select('student_id, student_name, student_number, hit_count, miss_count').eq('class_id', class_id),
      ]);
      if (studentsError) throw studentsError;
      if (logsError) throw logsError;

      const totalsByStudent = {};
      let totalHits = 0;
      let totalShots = 0;
      for (const log of logs || []) {
        totalHits += log.hit_count || 0;
        totalShots += (log.hit_count || 0) + (log.miss_count || 0);
        const key = log.student_id;
        if (!totalsByStudent[key]) {
          totalsByStudent[key] = {
            student_number: log.student_number,
            student_name: log.student_name,
            totalHits: 0,
            totalShots: 0,
          };
        }
        totalsByStudent[key].totalHits += log.hit_count || 0;
        totalsByStudent[key].totalShots += (log.hit_count || 0) + (log.miss_count || 0);
      }
      const ranking = Object.values(totalsByStudent)
        .sort((a, b) => b.totalHits - a.totalHits)
        .slice(0, 20);

      return text({
        studentCount: (students || []).length,
        shootingLogCount: (logs || []).length,
        totalHits,
        totalShots,
        overallHitRate: totalShots > 0 ? Number(((totalHits / totalShots) * 100).toFixed(1)) : null,
        ranking,
      });
    } catch (err) {
      return errorText(err);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
