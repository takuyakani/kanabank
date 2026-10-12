import React from 'react';
import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { LoginCard } from './components/LoginCard';
import { ChildDashboard } from './pages/ChildDashboard';
import { ParentDashboard } from './pages/ParentDashboard';
import { ShieldCheck, Sparkles, AlertTriangle } from 'lucide-react';

// 子ども用ポータル (/child)
const ChildPortal: React.FC = () => {
  const { currentUser, logout } = useApp();

  // 保護者アカウントで子ポータルにアクセスしてきた場合
  if (currentUser && currentUser.role === 'parent') {
    return (
      <div className="min-h-screen bg-amber-50/70 flex flex-col justify-center items-center p-4 text-center">
        <div className="w-full max-w-sm p-6 bg-white rounded-3xl shadow-lg border border-amber-200">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">保護者アカウントでログイン中</h2>
          <p className="text-xs text-slate-500 mb-6">
            現在は保護者アカウントとして認識されています。子ども用画面を使うには一度ログアウトするか、保護者用画面へ移動してください。
          </p>
          <div className="space-y-2">
            <Link
              to="/parent"
              className="block w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs"
            >
              保護者画面へ移動
            </Link>
            <button
              onClick={logout}
              className="w-full py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200"
            >
              ログアウトして子どもで入る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 子どもアカウントとして認証済みならダッシュボード表示
  if (currentUser && currentUser.role === 'child') {
    return <ChildDashboard />;
  }

  // 未ログイン時は子ども用ログインカード
  return (
    <div className="min-h-screen bg-amber-50/70 flex flex-col justify-center items-center p-4">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-black text-amber-500 tracking-tight">カナバンク (子ども用)</h1>
        <p className="text-xs text-amber-700 font-semibold mt-1">ログインしてお手伝いをはじめよう！</p>
      </div>
      <LoginCard role="child" onSuccess={() => {}} />
    </div>
  );
};

// 親用ポータル (/parent) - 厳格な認可ガード
const ParentPortal: React.FC = () => {
  const { currentUser, logout } = useApp();

  // 子どもアカウントで親ポータルに不正アクセスしてきた場合
  if (currentUser && currentUser.role === 'child') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 text-center">
        <div className="w-full max-w-sm p-6 bg-white rounded-3xl shadow-xl border border-rose-200">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">保護者専用エリアです</h2>
          <p className="text-xs text-slate-500 mb-6">
            子どもアカウントでは保護者画面にアクセスできません。保護者の方のパスワードでログインし直してください。
          </p>
          <div className="space-y-2">
            <button
              onClick={logout}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-200 hover:bg-indigo-700"
            >
              保護者としてログインする
            </button>
            <Link
              to="/child"
              className="block w-full py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200"
            >
              子ども画面に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 保護者アカウントとして認証済みならダッシュボード表示
  if (currentUser && currentUser.role === 'parent') {
    return <ParentDashboard />;
  }

  // 未ログイン時は保護者用ログインカード
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-black text-indigo-900 tracking-tight">カナバンク (保護者用)</h1>
        <p className="text-xs text-indigo-600 font-semibold mt-1">お子様のお手伝い管理・承認ポータル</p>
      </div>
      <LoginCard role="parent" onSuccess={() => {}} />
    </div>
  );
};

// ホーム画面（URL案内ページ）
const HomeLanding: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-3xl bg-amber-400 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-amber-200 mb-4">
        カ
      </div>
      <h1 className="text-2xl font-black text-slate-800 mb-2">カナバンクへようこそ</h1>
      <p className="text-xs text-slate-500 mb-8 leading-relaxed">
        子ども用とお父さん・お母さん用でURLが分かれています。<br />
        それぞれの端末でブックマーク・ホーム画面に追加してご利用ください。
      </p>

      <div className="w-full space-y-3">
        <Link
          to="/child"
          className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-white font-black text-sm shadow-md shadow-amber-200 flex items-center justify-center gap-2 hover:opacity-95 transition"
        >
          <Sparkles className="w-5 h-5" />
          子ども用ページへ進む (/child)
        </Link>

        <Link
          to="/parent"
          className="w-full p-4 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 hover:bg-indigo-700 transition"
        >
          <ShieldCheck className="w-5 h-5" />
          保護者用ページへ進む (/parent)
        </Link>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <HashRouter>
      <AppProvider>
        <Routes>
          <Route path="/" element={<HomeLanding />} />
          <Route path="/child" element={<ChildPortal />} />
          <Route path="/parent" element={<ParentPortal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
    </HashRouter>
  );
};

export default App;
