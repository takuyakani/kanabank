import React, { useState } from 'react';
import type { Role } from '../types';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

interface LoginCardProps {
  role: Role;
  onSuccess: () => void;
}

export const LoginCard: React.FC<LoginCardProps> = ({ role, onSuccess }) => {
  const { login, isDemoMode } = useApp();
  const isParent = role === 'parent';

  const defaultEmail = isParent ? 'parent@kanabank.local' : 'child@kanabank.local';
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await login(email, password, role);
    setLoading(false);

    if (res.success) {
      onSuccess();
    } else {
      setError(res.error || 'ログインに失敗しました。');
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-white rounded-3xl shadow-xl border border-slate-100 text-center">
      <div className={`inline-flex p-4 rounded-2xl mb-4 ${isParent ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
        {isParent ? <ShieldCheck className="w-10 h-10" /> : <Sparkles className="w-10 h-10" />}
      </div>

      <h2 className="text-2xl font-bold mb-1 text-slate-800">
        {isParent ? '保護者（おや）ログイン' : '子ども用ログイン'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {isParent ? '管理画面を開くためのアカウントを入力してください' : 'お手伝いをはじめるよ！アカウントを入れてね'}
      </p>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl flex items-center gap-2 text-left">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isDemoMode && (
        <div className="mb-4 p-2.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-xl text-left">
          💡 <strong>デモ・ローカルモード</strong><br />
          パスワードは任意の4文字以上（例: <code>1234</code>）でログイン可能です。
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            {isParent ? 'メールアドレス / アカウントID' : 'なまえ・アカウント'}
          </label>
          <input
            type="text"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50 text-slate-800"
            placeholder={isParent ? 'parent@example.com' : 'child'}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            パスワード
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50 text-slate-800"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3.5 px-4 rounded-xl font-bold text-white shadow-md transition-transform active:scale-95 disabled:opacity-50 ${
            isParent
              ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
          }`}
        >
          {loading ? 'ログイン中...' : 'ログインする'}
        </button>
      </form>
    </div>
  );
};
