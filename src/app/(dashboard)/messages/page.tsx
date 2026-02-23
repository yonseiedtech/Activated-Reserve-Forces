"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import PageTitle from "@/components/ui/PageTitle";

interface Message {
  id: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender?: { id: string; name: string; rank: string };
  receiver?: { id: string; name: string; rank: string };
}

interface User {
  id: string;
  name: string;
  rank: string;
  role: string;
}

export default function MessagesPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ receiverIds: [] as string[], title: "", content: "" });
  const [receiverSearch, setReceiverSearch] = useState("");

  useEffect(() => {
    fetchMessages();
  }, [tab]);

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then(setUsers);
  }, []);

  const fetchMessages = async () => {
    const res = await fetch(`/api/messages?type=${tab}`);
    setMessages(await res.json());
  };

  const handleRead = async (msg: Message) => {
    if (!msg.isRead && tab === "received") {
      await fetch(`/api/messages/${msg.id}`);
    }
    setSelectedMsg(msg);
  };

  const handleSend = async () => {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowCompose(false);
      setForm({ receiverIds: [], title: "", content: "" });
      fetchMessages();
    }
  };

  return (
    <div>
      <PageTitle
        title="쪽지"
        actions={
          <button onClick={() => setShowCompose(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + 쪽지 보내기
          </button>
        }
      />

      {/* 탭 */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab("received")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "received" ? "bg-white shadow" : "text-gray-500"}`}>
          받은 쪽지
        </button>
        <button onClick={() => setTab("sent")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "sent" ? "bg-white shadow" : "text-gray-500"}`}>
          보낸 쪽지
        </button>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl border divide-y">
        {messages.map((msg) => (
          <button
            key={msg.id}
            onClick={() => handleRead(msg)}
            className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${!msg.isRead && tab === "received" ? "bg-blue-50" : ""}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {!msg.isRead && tab === "received" && <span className="w-2 h-2 bg-blue-600 rounded-full shrink-0" />}
                  <p className="font-medium text-sm truncate">{msg.title}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {tab === "received"
                    ? `보낸이: ${msg.sender?.rank || ""} ${msg.sender?.name || ""}`
                    : `받는이: ${msg.receiver?.rank || ""} ${msg.receiver?.name || ""}`}
                </p>
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                {new Date(msg.createdAt).toLocaleDateString("ko-KR")}
              </span>
            </div>
          </button>
        ))}
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-3">쪽지가 없습니다.</p>
            <button
              onClick={() => setShowCompose(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              쪽지 보내기
            </button>
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {selectedMsg && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{selectedMsg.title}</h3>
              <button onClick={() => setSelectedMsg(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              {tab === "received"
                ? `보낸이: ${selectedMsg.sender?.rank || ""} ${selectedMsg.sender?.name || ""}`
                : `받는이: ${selectedMsg.receiver?.rank || ""} ${selectedMsg.receiver?.name || ""}`}
              {" "}| {new Date(selectedMsg.createdAt).toLocaleString("ko-KR")}
            </p>
            <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-sm min-h-[100px]">
              {selectedMsg.content}
            </div>
            {tab === "received" && selectedMsg.sender && (
              <button
                onClick={() => {
                  const replyTo = selectedMsg.sender!;
                  const reTitle = selectedMsg.title.startsWith("RE: ") ? selectedMsg.title : `RE: ${selectedMsg.title}`;
                  setSelectedMsg(null);
                  setForm({ receiverIds: [replyTo.id], title: reTitle, content: "" });
                  setShowCompose(true);
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                답장
              </button>
            )}
          </div>
        </div>
      )}

      {/* 작성 모달 */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">쪽지 보내기</h3>
            <div>
              <label className="block text-sm font-medium mb-1">
                받는 사람 {form.receiverIds.length > 0 && <span className="text-blue-600 font-normal">({form.receiverIds.length}명 선택됨)</span>}
              </label>
              <input
                type="text"
                value={receiverSearch}
                onChange={(e) => setReceiverSearch(e.target.value)}
                placeholder="이름으로 검색..."
                className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
              />
              <div className="border rounded-lg max-h-40 overflow-y-auto divide-y">
                {users
                  .filter((u) => u.id !== session?.user?.id)
                  .filter((u) => !receiverSearch || u.name.includes(receiverSearch) || (u.rank && u.rank.includes(receiverSearch)))
                  .map((u) => (
                    <label key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={form.receiverIds.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm({ ...form, receiverIds: [...form.receiverIds, u.id] });
                          } else {
                            setForm({ ...form, receiverIds: form.receiverIds.filter((id) => id !== u.id) });
                          }
                        }}
                        className="rounded"
                      />
                      <span>{u.rank ? `${u.rank} ` : ""}{u.name}</span>
                    </label>
                  ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">제목</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">내용</label>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} className="w-full px-3 py-2 border rounded-lg resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSend} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">보내기</button>
              <button onClick={() => setShowCompose(false)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
