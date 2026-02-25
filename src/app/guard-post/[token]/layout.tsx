export default function GuardPostLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-900 text-white px-4 py-3">
        <h1 className="text-lg font-bold">위병소 출퇴근 기록</h1>
        <p className="text-blue-200 text-xs">상비예비군 소집훈련 관리</p>
      </header>
      <main className="p-4 max-w-2xl mx-auto">
        {children}
      </main>
    </div>
  );
}
