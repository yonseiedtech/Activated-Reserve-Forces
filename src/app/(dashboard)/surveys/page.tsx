"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import PageTitle from "@/components/ui/PageTitle";

interface Survey {
  id: string;
  title: string;
  description: string | null;
  questions: string;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  _count: { responses: number };
}

export default function SurveysPage() {
  const { data: session } = useSession();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showSurvey, setShowSurvey] = useState<string | null>(null);
  const [surveyDetail, setSurveyDetail] = useState<{ questions: { q: string; type: string; options?: string[] }[]; myResponse?: { answers: string } } | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  // 생성 폼
  const [createForm, setCreateForm] = useState({ title: "", description: "", questions: [{ q: "", type: "text", options: [] as string[] }] });

  useEffect(() => {
    fetch("/api/surveys").then((r) => r.json()).then(setSurveys);
  }, []);

  const handleCreate = async () => {
    const res = await fetch("/api/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    if (res.ok) {
      setShowCreate(false);
      fetch("/api/surveys").then((r) => r.json()).then(setSurveys);
    }
  };

  const openSurvey = async (id: string) => {
    const res = await fetch(`/api/surveys/${id}`);
    const data = await res.json();
    const questions = JSON.parse(data.questions);
    const myResponse = data.myResponse ? JSON.parse(data.myResponse.answers) : {};
    setSurveyDetail({ questions, myResponse: data.myResponse });
    setAnswers(myResponse);
    setShowSurvey(id);
  };

  const handleSubmit = async () => {
    if (!showSurvey) return;
    const res = await fetch(`/api/surveys/${showSurvey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    if (res.ok) {
      setShowSurvey(null);
      fetch("/api/surveys").then((r) => r.json()).then(setSurveys);
    }
  };

  return (
    <div>
      <PageTitle
        title="설문조사"
        actions={
          isAdmin ? (
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              + 설문 생성
            </button>
          ) : undefined
        }
      />

      <div className="space-y-3">
        {surveys.map((s) => (
          <button
            key={s.id}
            onClick={() => openSurvey(s.id)}
            className="w-full text-left bg-white rounded-xl border p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                {s.description && <p className="text-sm text-gray-500 mt-1">{s.description}</p>}
              </div>
              <div className="text-right">
                <span className={`px-2 py-1 text-xs rounded-full ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {s.isActive ? "진행중" : "종료"}
                </span>
                <p className="text-xs text-gray-400 mt-1">{s._count.responses}명 응답</p>
              </div>
            </div>
          </button>
        ))}
        {surveys.length === 0 && <p className="text-center py-8 text-gray-400">등록된 설문이 없습니다.</p>}
      </div>

      {/* 설문 응답 모달 */}
      {showSurvey && surveyDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">설문 응답</h3>
            {surveyDetail.questions.map((q, i) => (
              <div key={i}>
                <label className="block text-sm font-medium mb-1">{i + 1}. {q.q}</label>
                {q.type === "text" ? (
                  <input
                    value={answers[i] || ""}
                    onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                ) : (
                  <div className="space-y-1">
                    {q.options?.map((opt, j) => (
                      <label key={j} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`q${i}`}
                          checked={answers[i] === opt}
                          onChange={() => setAnswers({ ...answers, [i]: opt })}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={handleSubmit} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">제출</button>
              <button onClick={() => setShowSurvey(null)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 생성 모달 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">설문 생성</h3>
            <div>
              <label className="block text-sm font-medium mb-1">제목</label>
              <input value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">설명</label>
              <input value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            {createForm.questions.map((q, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
                <input
                  value={q.q}
                  onChange={(e) => {
                    const qs = [...createForm.questions];
                    qs[i] = { ...qs[i], q: e.target.value };
                    setCreateForm({ ...createForm, questions: qs });
                  }}
                  placeholder={`질문 ${i + 1}`}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <select
                  value={q.type}
                  onChange={(e) => {
                    const qs = [...createForm.questions];
                    qs[i] = { ...qs[i], type: e.target.value };
                    setCreateForm({ ...createForm, questions: qs });
                  }}
                  className="px-3 py-1 border rounded text-sm"
                >
                  <option value="text">주관식</option>
                  <option value="choice">객관식</option>
                </select>
                {q.type === "choice" && (
                  <input
                    placeholder="선택지 (쉼표로 구분)"
                    value={q.options?.join(", ") || ""}
                    onChange={(e) => {
                      const qs = [...createForm.questions];
                      qs[i] = { ...qs[i], options: e.target.value.split(",").map((s) => s.trim()) };
                      setCreateForm({ ...createForm, questions: qs });
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                )}
              </div>
            ))}
            <button
              onClick={() => setCreateForm({ ...createForm, questions: [...createForm.questions, { q: "", type: "text", options: [] }] })}
              className="text-sm text-blue-600 hover:underline"
            >
              + 질문 추가
            </button>
            <div className="flex gap-3 pt-2">
              <button onClick={handleCreate} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">생성</button>
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
