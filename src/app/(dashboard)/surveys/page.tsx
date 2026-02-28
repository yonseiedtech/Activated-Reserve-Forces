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
  const [surveyDetail, setSurveyDetail] = useState<{ questions: { q: string; type: string; options?: string[]; required?: boolean }[]; myResponse?: { answers: string } } | null>(null);
  const [requiredError, setRequiredError] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  // 생성 폼
  const [createForm, setCreateForm] = useState({ title: "", description: "", questions: [{ q: "", type: "text", options: [] as string[], required: true }] });

  useEffect(() => {
    fetch("/api/surveys").then((r) => r.json()).then(setSurveys);
  }, []);

  const handleCreate = async () => {
    if (!createForm.title.trim()) return alert("제목을 입력해주세요.");
    if (createForm.questions.some((q) => !q.q.trim())) return alert("모든 질문을 입력해주세요.");
    const cleanedForm = {
      ...createForm,
      questions: createForm.questions.map((q) => ({
        ...q,
        options: q.type === "choice" ? (q.options || []).filter((o) => o.trim()) : q.options,
      })),
    };
    const res = await fetch("/api/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleanedForm),
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
    setRequiredError([]);
    setShowSurvey(id);
  };

  const handleSubmit = async () => {
    if (!showSurvey || !surveyDetail) return;
    // 필수 문항 검증
    const missing: number[] = [];
    surveyDetail.questions.forEach((q, i) => {
      if (q.required !== false && (!answers[i] || !String(answers[i]).trim())) {
        missing.push(i);
      }
    });
    if (missing.length > 0) {
      setRequiredError(missing);
      alert(`필수 문항 ${missing.map((i) => i + 1).join(", ")}번을 입력해주세요.`);
      return;
    }
    setRequiredError([]);
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
              <div key={i} className={`p-3 rounded-lg ${requiredError.includes(i) ? "bg-red-50 border border-red-200" : ""}`}>
                <label className="block text-sm font-medium mb-1">
                  {i + 1}. {q.q}
                  {q.required !== false && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {q.type === "text" ? (
                  <input
                    value={answers[i] || ""}
                    onChange={(e) => { setAnswers({ ...answers, [i]: e.target.value }); setRequiredError(requiredError.filter((x) => x !== i)); }}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                ) : (
                  <div className="space-y-1">
                    {q.options?.map((opt, j) => (
                      <label key={j} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name={`q${i}`}
                          checked={answers[i] === opt}
                          onChange={() => { setAnswers({ ...answers, [i]: opt }); setRequiredError(requiredError.filter((x) => x !== i)); }}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}
                {requiredError.includes(i) && <p className="text-xs text-red-500 mt-1">필수 문항입니다.</p>}
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
            <div className="space-y-3">
              <label className="block text-sm font-medium">질문 목록</label>
              {createForm.questions.map((q, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">질문 {i + 1}{(q.required !== false) && <span className="text-red-500 ml-0.5">*</span>}</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.required !== false}
                          onChange={(e) => {
                            const qs = [...createForm.questions];
                            qs[i] = { ...qs[i], required: e.target.checked };
                            setCreateForm({ ...createForm, questions: qs });
                          }}
                          className="w-3.5 h-3.5 text-blue-600 rounded"
                        />
                        <span className="text-xs text-gray-500">필수</span>
                      </label>
                      {createForm.questions.length > 1 && (
                        <button
                          onClick={() => {
                            const qs = createForm.questions.filter((_, idx) => idx !== i);
                            setCreateForm({ ...createForm, questions: qs });
                          }}
                          className="text-xs text-red-500 hover:underline"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    value={q.q}
                    onChange={(e) => {
                      const qs = [...createForm.questions];
                      qs[i] = { ...qs[i], q: e.target.value };
                      setCreateForm({ ...createForm, questions: qs });
                    }}
                    placeholder="질문 내용을 입력하세요"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <select
                    value={q.type}
                    onChange={(e) => {
                      const qs = [...createForm.questions];
                      qs[i] = { ...qs[i], type: e.target.value };
                      setCreateForm({ ...createForm, questions: qs });
                    }}
                    className="px-3 py-1.5 border rounded-lg text-sm"
                  >
                    <option value="text">주관식</option>
                    <option value="choice">객관식</option>
                  </select>
                  {q.type === "choice" && (
                    <div className="space-y-2">
                      {(q.options?.length ? q.options : [""]).map((opt, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-4 text-center">{j + 1}</span>
                          <input
                            value={opt}
                            onChange={(e) => {
                              const qs = [...createForm.questions];
                              const opts = [...(qs[i].options || [""])];
                              opts[j] = e.target.value;
                              qs[i] = { ...qs[i], options: opts };
                              setCreateForm({ ...createForm, questions: qs });
                            }}
                            placeholder={`선지 ${j + 1}`}
                            className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                          />
                          {(q.options?.length || 1) > 1 && (
                            <button
                              onClick={() => {
                                const qs = [...createForm.questions];
                                const opts = (qs[i].options || []).filter((_, idx) => idx !== j);
                                qs[i] = { ...qs[i], options: opts };
                                setCreateForm({ ...createForm, questions: qs });
                              }}
                              className="text-gray-400 hover:text-red-500 text-sm px-1"
                              title="선지 삭제"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const qs = [...createForm.questions];
                          qs[i] = { ...qs[i], options: [...(qs[i].options || []), ""] };
                          setCreateForm({ ...createForm, questions: qs });
                        }}
                        className="text-xs text-blue-600 hover:underline ml-6"
                      >
                        + 선지 추가
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => setCreateForm({ ...createForm, questions: [...createForm.questions, { q: "", type: "text", options: [], required: true }] })}
                className="text-sm text-blue-600 hover:underline"
              >
                + 질문 추가
              </button>
            </div>
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
