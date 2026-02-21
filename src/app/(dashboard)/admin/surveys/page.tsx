"use client";

import { useEffect, useState } from "react";
import PageTitle from "@/components/ui/PageTitle";

interface SurveyResponse {
  id: string;
  userId: string;
  answers: string;
  createdAt: string;
  user: { id: string; name: string; rank: string | null };
}

interface Survey {
  id: string;
  title: string;
  description: string | null;
  questions: string;
  isActive: boolean;
  responses: SurveyResponse[];
  _count: { responses: number };
}

interface SurveyListItem {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  _count: { responses: number };
}

interface ParsedQuestion {
  q: string;
  type: string;
  options?: string[];
}

export default function AdminSurveyResultsPage() {
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/surveys").then((r) => r.json()).then(setSurveys);
  }, []);

  const openSurvey = async (id: string) => {
    setLoading(true);
    const res = await fetch(`/api/surveys/${id}`);
    const data = await res.json();
    setSelectedSurvey(data);
    setLoading(false);
  };

  const getStats = (questions: ParsedQuestion[], responses: SurveyResponse[]) => {
    return questions.map((q, qi) => {
      const answers = responses.map((r) => {
        const parsed = JSON.parse(r.answers);
        return parsed[qi] || "";
      }).filter(Boolean);

      if (q.type === "choice" && q.options) {
        const counts: Record<string, number> = {};
        q.options.forEach((opt) => { counts[opt] = 0; });
        answers.forEach((a) => { if (counts[a] !== undefined) counts[a]++; });
        return { question: q.q, type: "choice" as const, total: answers.length, counts };
      }
      return { question: q.q, type: "text" as const, total: answers.length, answers };
    });
  };

  return (
    <div>
      <PageTitle title="설문 결과 조회" description="설문 응답을 집계하고 조회합니다." />

      {!selectedSurvey ? (
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
          {surveys.length === 0 && (
            <p className="text-center py-8 text-gray-400">등록된 설문이 없습니다.</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <button
            onClick={() => setSelectedSurvey(null)}
            className="text-sm text-blue-600 hover:underline"
          >
            &larr; 목록으로
          </button>

          {loading ? (
            <div className="text-center py-8 text-gray-400">로딩 중...</div>
          ) : (
            <>
              <div className="bg-white rounded-xl border p-6">
                <h2 className="text-xl font-bold">{selectedSurvey.title}</h2>
                {selectedSurvey.description && (
                  <p className="text-gray-500 mt-1">{selectedSurvey.description}</p>
                )}
                <p className="text-sm text-gray-400 mt-2">총 {selectedSurvey.responses.length}명 응답</p>
              </div>

              {(() => {
                const questions: ParsedQuestion[] = JSON.parse(selectedSurvey.questions);
                const stats = getStats(questions, selectedSurvey.responses);

                return stats.map((stat, i) => (
                  <div key={i} className="bg-white rounded-xl border p-6">
                    <h3 className="font-semibold mb-3">{i + 1}. {stat.question}</h3>
                    <p className="text-xs text-gray-400 mb-3">{stat.total}명 응답</p>

                    {stat.type === "choice" && "counts" in stat ? (
                      <div className="space-y-2">
                        {Object.entries(stat.counts as Record<string, number>).map(([option, count]) => {
                          const pct = stat.total > 0 ? Math.round((count / stat.total) * 100) : 0;
                          return (
                            <div key={option}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span>{option}</span>
                                <span className="text-gray-500">{count}명 ({pct}%)</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2.5">
                                <div
                                  className="bg-blue-600 h-2.5 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : "answers" in stat ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {stat.answers.map((answer, j) => (
                          <div key={j} className="p-2 bg-gray-50 rounded text-sm">
                            {answer}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ));
              })()}

              {/* 개별 응답 목록 */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-6 py-3 bg-gray-50 border-b">
                  <h3 className="font-semibold text-sm">개별 응답 목록</h3>
                </div>
                <div className="divide-y max-h-96 overflow-y-auto">
                  {selectedSurvey.responses.map((r) => {
                    const answers = JSON.parse(r.answers);
                    const questions: ParsedQuestion[] = JSON.parse(selectedSurvey.questions);
                    return (
                      <div key={r.id} className="px-6 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">
                            {r.user.rank ? `${r.user.rank} ` : ""}{r.user.name}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          {questions.map((q, qi) => (
                            <p key={qi}>
                              <span className="text-gray-400">Q{qi + 1}.</span> {answers[qi] || "-"}
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {selectedSurvey.responses.length === 0 && (
                    <p className="px-6 py-6 text-center text-gray-400 text-sm">응답이 없습니다.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
