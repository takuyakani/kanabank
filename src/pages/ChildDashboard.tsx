import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CalendarView } from '../components/CalendarView';
import { HistorySearchView } from '../components/HistorySearchView';
import { isTaskScheduledForDate } from '../utils/scheduleUtils';
import type { FontSizePreference } from '../types';
import {
  Coins,
  Trophy,
  Send,
  LogOut,
  Sparkles,
  Bath,
  UtensilsCrossed,
  Trash2,
  Shirt,
  BookOpen,
  CheckCircle2,
  Clock,
  XCircle,
  Gift,
  AlertCircle,
  Calendar,
  Check,
  Flame,
  AlertTriangle,
  Type,
  Edit3,
  Search,
  X,
  Cloud,
  HardDrive,
  RefreshCw,
  ShieldAlert,
  Settings
} from 'lucide-react';
import { saveFirebaseConfig } from '../lib/firebase';
import confetti from 'canvas-confetti';

const ICON_MAP: Record<string, React.ReactNode> = {
  bath: <Bath className="w-6 h-6" />,
  dish: <UtensilsCrossed className="w-6 h-6" />,
  trash: <Trash2 className="w-6 h-6" />,
  shirt: <Shirt className="w-6 h-6" />,
  sparkles: <Sparkles className="w-6 h-6" />,
  book: <BookOpen className="w-6 h-6" />,
};

export const ChildDashboard: React.FC = () => {
  const {
    household,
    chores,
    requests,
    transactions,
    routines,
    routineLogs,
    fontSize,
    setFontSize,
    textMode,
    setTextMode,
    submitChoreRequest,
    submitCustomChoreRequest,
    reportRoutineDone,
    checkAndApplyOverduePenalties,
    syncStatus,
    logout,
    updateGoal,
    redeemGoal
  } = useApp();

  const [selectedChoreId, setSelectedChoreId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [customChoreTitle, setCustomChoreTitle] = useState('');
  const [customChoreComment, setCustomChoreComment] = useState('');
  const [customRewardWanted, setCustomRewardWanted] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportingRoutineId, setReportingRoutineId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'apply' | 'calendar'>('home');
  const [historySubTab, setHistorySubTab] = useState<'calendar' | 'search'>('calendar');

  // おうちのひと用クラウド合流モーダル
  const [showParentSyncModal, setShowParentSyncModal] = useState(false);
  const [parentMathAnswer, setParentMathAnswer] = useState('');
  const [parentPassUnlocked, setParentPassUnlocked] = useState(false);
  const [parentSyncCode, setParentSyncCode] = useState('');
  const [parentSyncError, setParentSyncError] = useState('');

  // アプリ起動・画面表示時に期限切れペナルティを自動判定
  useEffect(() => {
    checkAndApplyOverduePenalties();
  }, [checkAndApplyOverduePenalties]);

  // 目標編集モーダル
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalTitleInput, setGoalTitleInput] = useState(household.goalTitle);
  const [goalAmountInput, setGoalAmountInput] = useState(household.goalAmount);
  const [goalError, setGoalError] = useState('');

  // 目標達成引き換えモーダル
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemError, setRedeemError] = useState('');

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsEditingGoal(false);
        setShowRedeemModal(false);
        setShowParentSyncModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 達成率計算
  const isGoalReached = household.balance >= household.goalAmount && household.goalAmount > 0;
  const progressPercent = Math.min(100, Math.floor((household.balance / (household.goalAmount || 1)) * 100));

  // 今日のルーティン抽出
  const todayObj = new Date();
  const y = todayObj.getFullYear();
  const m = String(todayObj.getMonth() + 1).padStart(2, '0');
  const d = String(todayObj.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  const todayRoutines = routines.filter((r) => isTaskScheduledForDate(r, todayObj));
  const allRoutinesCompleted =
    todayRoutines.length > 0 &&
    todayRoutines.every((routine) => {
      const log = routineLogs.find((l) => l.id === `${routine.id}_${todayStr}`);
      return log?.status === 'completed';
    });

  const handleRoutineDone = async (routineId: string) => {
    setReportingRoutineId(routineId);
    await reportRoutineDone(routineId, todayStr);
    setReportingRoutineId(null);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
    });
  };

  const handleApply = async () => {
    if (!selectedChoreId) return;
    setSubmitting(true);
    try {
      await submitChoreRequest(selectedChoreId, comment);
    } catch (err) {
      console.error('お手伝い申請エラー:', err);
    } finally {
      setSubmitting(false);
      setSelectedChoreId(null);
      setComment('');
    }

    // 申請時のお祝い紙吹雪
    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.7 },
    });
    setActiveTab('home');
  };

  const handleCustomApply = async () => {
    if (!customChoreTitle.trim()) return;
    setSubmitting(true);
    const parsedReward = customRewardWanted ? Number(customRewardWanted) : undefined;
    try {
      await submitCustomChoreRequest(customChoreTitle.trim(), customChoreComment.trim(), parsedReward);
    } catch (err) {
      console.error('自由入力申請エラー:', err);
    } finally {
      setSubmitting(false);
      setCustomChoreTitle('');
      setCustomChoreComment('');
      setCustomRewardWanted('');
      setIsCustomMode(false);
    }

    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.7 },
    });
    setActiveTab('home');
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoalError('');
    const res = await updateGoal(goalTitleInput, Number(goalAmountInput));
    if (!res.success) {
      setGoalError(res.error || '目標の更新に失敗しました。');
      return;
    }
    setIsEditingGoal(false);
    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.6 },
    });
  };

  const handleRedeemGoal = async () => {
    setRedeemError('');
    const res = await redeemGoal();
    if (!res.success) {
      setRedeemError(res.error || '引き換えに失敗しました。');
      return;
    }
    setShowRedeemModal(false);
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.5 },
    });
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  return (
    <div className="max-w-md mx-auto min-h-screen bg-amber-50/50 pb-28 flex flex-col">
      {/* トップバー */}
      <header className="px-4 py-3 bg-white/90 backdrop-blur border-b border-amber-100 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-white font-black text-sm shrink-0">
            お
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-800 leading-tight">
              {textMode === 'hiragana' ? 'こどもよう おさいふ' : 'こども用おさいふ'}
            </h1>
            <p className="text-[10px] text-amber-600 font-medium">
              {textMode === 'hiragana' ? 'がんばっておてつだいしよう！' : 'がんばってお手伝いしよう！'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* ひらがな / かんじ 切替スイッチ */}
          <div className="flex bg-amber-100/80 rounded-xl p-0.5 border border-amber-200">
            <button
              onClick={() => setTextMode('hiragana')}
              className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold transition ${
                textMode === 'hiragana' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-800 hover:text-amber-950'
              }`}
              title="ひらがなモード"
            >
              ひらがな
            </button>
            <button
              onClick={() => setTextMode('normal')}
              className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold transition ${
                textMode === 'normal' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-800 hover:text-amber-950'
              }`}
              title="かんじ・通常モード"
            >
              かんじ
            </button>
          </div>

          {/* 文字サイズ変更 */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
            <span className="text-[10px] text-slate-400 pl-1 pr-0.5 flex items-center" title="文字サイズ">
              <Type className="w-3 h-3" />
            </span>
            {(['small', 'medium', 'large'] as FontSizePreference[]).map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded-lg transition ${
                  fontSize === size
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
              </button>
            ))}
          </div>

          {/* クラウド同期ステータス ＆ おうちのひと用設定ボタン */}
          <button
            type="button"
            onClick={() => {
              setParentPassUnlocked(false);
              setParentMathAnswer('');
              setParentSyncError('');
              setShowParentSyncModal(true);
            }}
            className={`p-1.5 rounded-xl border transition flex items-center justify-center ${
              syncStatus === 'connected'
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                : syncStatus === 'error'
                ? 'bg-rose-50 text-rose-600 border-rose-300 hover:bg-rose-100 animate-pulse'
                : syncStatus === 'syncing'
                ? 'bg-amber-50 text-amber-600 border-amber-200'
                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
            }`}
            title="おうちのひと用（クラウドせってい）"
          >
            {syncStatus === 'connected' && <Cloud className="w-3.5 h-3.5" />}
            {syncStatus === 'syncing' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {syncStatus === 'error' && <ShieldAlert className="w-3.5 h-3.5" />}
            {syncStatus === 'local' && <Settings className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={logout}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            title="ログアウト"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="p-4 space-y-4 flex-1">
        {/* --- タブ1: ホーム (おさいふ画面) --- */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* 残高カード */}
            <div className="bg-gradient-to-br from-amber-400 to-amber-500 rounded-3xl p-6 text-white shadow-xl shadow-amber-200/60 text-center relative overflow-hidden">
              <div className="absolute top-2 right-2 opacity-10">
                <Coins className="w-32 h-32" />
              </div>
              <p className="text-xs font-bold tracking-wider opacity-90 mb-1">
                {textMode === 'hiragana' ? 'いまの おかね' : 'いまのバーチャル残高'}
              </p>
              <div className="flex items-center justify-center gap-2 my-2">
                <Coins className="w-9 h-9 text-amber-100" />
                <span className="text-5xl font-black tracking-tight">{household.balance}</span>
                <span className="text-xl font-bold self-end mb-1">
                  {textMode === 'hiragana' ? 'えん' : '円'}
                </span>
              </div>
              <p className="text-[11px] bg-white/20 backdrop-blur rounded-full px-3 py-1 inline-block mt-1 font-bold">
                {isGoalReached
                  ? (textMode === 'hiragana' ? '🎉 もくひょうを たっせいしたよ！すごい！' : '🎉 目標を達成したよ！すごい！')
                  : (textMode === 'hiragana' ? `もくひょうまで あと ${Math.max(0, household.goalAmount - household.balance)} えん` : `目標まであと ${Math.max(0, household.goalAmount - household.balance)} 円`)}
              </p>
            </div>

            {/* 目標達成お祝いバナー */}
            {isGoalReached && (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-3xl p-4 shadow-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Gift className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm leading-tight">
                      {textMode === 'hiragana' ? 'もくひょうを たっせいしたよ！' : '目標をたっせいしたよ！'}
                    </h4>
                    <p className="text-[11px] opacity-90">
                      「{household.goalTitle}」{textMode === 'hiragana' ? 'を かってもらおう！' : 'を買ってもらおう！'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRedeemModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-white text-emerald-700 font-black text-xs shadow-md hover:bg-emerald-50 transition shrink-0"
                >
                  {textMode === 'hiragana' ? 'ひきかえる' : '引き換える'}
                </button>
              </div>
            )}

            {/* 今日の「いつもやること（ルーティン）」カード */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-amber-100/80">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" />
                  <h3 className="font-extrabold text-slate-800 text-sm">
                    {textMode === 'hiragana' ? 'きょうの いつもやること' : '今日のいつもやること'}
                  </h3>
                </div>
                <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100">
                  {todayRoutines.length}{textMode === 'hiragana' ? 'こ' : '件'}
                </span>
              </div>

              {/* 全問達成お祝いコンプリートバナー */}
              {allRoutinesCompleted && (
                <div className="mb-3 p-3.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-2xl text-white shadow-sm flex items-center gap-2.5 animate-bounce-subtle">
                  <span className="text-xl">🌟</span>
                  <div>
                    <h4 className="font-black text-xs">
                      {textMode === 'hiragana' ? 'きょうのいつもやること ぜんぶできた！' : 'きょうのいつもやること コンプリート！'}
                    </h4>
                    <p className="text-[10px] opacity-95">
                      {textMode === 'hiragana' ? 'ぜんぶクリアできたね！たいへんよくできました！' : 'ぜんぶクリアできたね！たいへんよくできました！'}
                    </p>
                  </div>
                </div>
              )}

              {todayRoutines.length === 0 ? (
                <div className="text-center py-4 bg-slate-50/70 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-400 font-medium">
                    {textMode === 'hiragana' ? 'きょうのいつもやることは ないよ！' : 'きょうのいつもやることはないよ！'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {textMode === 'hiragana' ? 'よくがんばったね！' : 'よくがんばったね！'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {todayRoutines.map((routine) => {
                    const logId = `${routine.id}_${todayStr}`;
                    const log = routineLogs.find((l) => l.id === logId);
                    const isDone = Boolean(log);
                    const isApproved = log?.status === 'completed';
                    const isPending = log?.status === 'pending';
                    const isPenalty = log?.status === 'penalized';

                    return (
                      <div
                        key={routine.id}
                        className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                          isApproved
                            ? 'bg-emerald-50/70 border-emerald-100'
                            : isPending
                            ? 'bg-amber-50/70 border-amber-200'
                            : isPenalty
                            ? 'bg-rose-50/70 border-rose-200'
                            : 'bg-slate-50/90 border-slate-100 hover:border-amber-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-800 text-xs">{routine.title}</span>
                            {/* ご褒美金額: 0円の時は表示しない（仕様準拠） */}
                            {routine.reward > 0 && (
                              <span className="text-[10px] font-extrabold text-amber-600 bg-amber-100/60 px-1.5 py-0.2 rounded-md">
                                +{routine.reward}{textMode === 'hiragana' ? 'えん' : '円'}
                              </span>
                            )}
                            {/* ペナルティ金額表示 */}
                            {routine.penaltyAmount > 0 && (
                              <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5 inline" />
                                {textMode === 'hiragana' ? `できなかったら-${routine.penaltyAmount}えん` : `未達成-${routine.penaltyAmount}円`}
                              </span>
                            )}
                          </div>
                          {routine.graceDays > 0 && !isDone && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {textMode === 'hiragana'
                                ? `あと${routine.graceDays}にち までに やろう（よる 11:59まで）`
                                : `猶予: あと${routine.graceDays}日（最終日23:59まで）`}
                            </p>
                          )}
                          {routine.graceDays === 0 && !isDone && (
                            <p className="text-[10px] text-rose-400 mt-0.5">
                              {textMode === 'hiragana' ? 'きげん: きょうの よる 11:59まで' : '期限: きょう23:59まで'}
                            </p>
                          )}
                        </div>

                        {/* アクションボタン / ステータス */}
                        <div className="shrink-0">
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {textMode === 'hiragana' ? 'かんりょう！' : '完了！'}
                            </span>
                          )}

                          {isPending && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-200/70 px-2.5 py-1.5 rounded-xl">
                              <Clock className="w-3.5 h-3.5 animate-pulse" /> {textMode === 'hiragana' ? 'かくにんちゅう' : 'かくにん中'}
                            </span>
                          )}

                          {isPenalty && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-100 px-2.5 py-1.5 rounded-xl">
                              <XCircle className="w-3.5 h-3.5" /> {textMode === 'hiragana' ? 'じかんぎれ' : '期限切れ'}
                            </span>
                          )}

                          {!isDone && (
                            <button
                              onClick={() => handleRoutineDone(routine.id)}
                              disabled={reportingRoutineId === routine.id}
                              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-white font-extrabold text-xs shadow-md shadow-amber-200 transition flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {reportingRoutineId === routine.id ? (textMode === 'hiragana' ? 'そうしんちゅう...' : '送信中...') : 'おわったよ！'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 目標プログレスカード */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-slate-800 text-sm">{household.goalTitle}</h3>
                </div>
                <button
                  onClick={() => {
                    setGoalTitleInput(household.goalTitle);
                    setGoalAmountInput(household.goalAmount);
                    setGoalError('');
                    setIsEditingGoal(true);
                  }}
                  className="text-[11px] font-semibold text-amber-600 hover:underline"
                >
                  へんこう
                </button>
              </div>

              {/* ゲージ */}
              <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden p-0.5 mb-2">
                <div
                  className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-slate-500 font-semibold">
                <span>{progressPercent}% 達成</span>
                <span>もくひょう: {household.goalAmount}円</span>
              </div>
            </div>

            {/* 親の承認まちバナー */}
            {pendingRequests.length > 0 && (
              <div className="bg-amber-100/70 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-amber-600 shrink-0 animate-pulse" />
                  <div className="text-xs">
                    <p className="font-bold text-amber-900">
                      {textMode === 'hiragana'
                        ? `おうちのひとの かくにんまち: ${pendingRequests.length}こ`
                        : `お父さん・お母さんの確認まち: ${pendingRequests.length}件`}
                    </p>
                    <p className="text-amber-700">
                      {textMode === 'hiragana'
                        ? 'しょうにん されたら おかねが ふえるよ！'
                        : '承認されたら残高にプラスされるよ！'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('apply')}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs shrink-0 flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  {textMode === 'hiragana' ? 'べつの おてつだいを する' : '別のお手伝いを申請'}
                </button>
              </div>
            )}

            {/* 最近の申請ステータス */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 text-xs mb-3 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                {textMode === 'hiragana' ? 'さいきんの おてつだい' : '最近の申請履歴'}
              </h3>
              {requests.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  {textMode === 'hiragana' ? 'まだ おてつだいの しんせいは ないよ' : 'まだ申請がありません'}
                </p>
              ) : (
                <div className="space-y-2">
                  {requests.slice(0, 4).map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-700">{req.title}</span>
                          <span className="text-[10px] text-amber-600 font-semibold">
                            +{req.reward}{textMode === 'hiragana' ? 'えん' : '円'}
                          </span>
                        </div>
                        {req.comment && <p className="text-[11px] text-slate-400 mt-0.5">「{req.comment}」</p>}
                        {req.parentComment && (
                          <p className="text-[11px] text-indigo-600 mt-0.5 font-medium">
                            {textMode === 'hiragana' ? 'おうちのひと' : 'おや'}: 「{req.parentComment}」
                          </p>
                        )}
                      </div>

                      <div>
                        {req.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" /> {textMode === 'hiragana' ? 'かくにんちゅう' : '確認中'}
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> {textMode === 'hiragana' ? 'しょうにん！' : '承認！'}
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-bold bg-rose-100 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" /> {textMode === 'hiragana' ? 'やりなおし' : 'やり直し'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- タブ2: お手伝い申請 --- */}
        {activeTab === 'apply' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
              {/* 一覧から選ぶ / じぶんで入力する タブ切替 */}
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomMode(false);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                    !isCustomMode
                      ? 'bg-white text-amber-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  一覧からえらぶ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomMode(true);
                    setSelectedChoreId(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 ${
                    isCustomMode
                      ? 'bg-white text-amber-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  自分で入力する
                </button>
              </div>

              {!isCustomMode ? (
                <>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm mb-1">今日やったお手伝いを選んでね！</h3>
                    <p className="text-xs text-slate-500">選んだら「申請する」ボタンを押してね。</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-2">
                    {chores.map((chore) => {
                      const isSelected = selectedChoreId === chore.id;
                      return (
                        <button
                          key={chore.id}
                          onClick={() => setSelectedChoreId(chore.id)}
                          className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                            isSelected
                              ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400 shadow-md'
                              : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className="p-2 rounded-xl bg-white w-fit shadow-xs text-amber-500 mb-2">
                            {ICON_MAP[chore.icon] || <Sparkles className="w-6 h-6" />}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-800 leading-tight mb-1">{chore.title}</p>
                            <p className="text-sm font-black text-amber-600">+{chore.reward}円</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedChoreId && (
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <label className="block text-xs font-bold text-slate-600">ひとことメッセージ（なくてもOK）</label>
                      <input
                        type="text"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="例: ピカピカにできたよ！"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <button
                        onClick={handleApply}
                        disabled={submitting}
                        className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-sm shadow-lg shadow-amber-200 transition flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        {submitting ? '申請中...' : 'お父さん・お母さんに申請する！'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* 自由入力フォーム（マスターにないお手伝い） */
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-100 text-xs text-amber-800">
                    <p className="font-bold">✨ 一覧にない特別なお手伝いをしたよ！</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      何をしたかを書いて申請してね。もらえる金額はお父さん・お母さんが確認して決めてくれるよ！
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      やったお手伝い・がんばったこと <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customChoreTitle}
                      onChange={(e) => setCustomChoreTitle(e.target.value)}
                      placeholder="例: 自転車をきれいに洗った、弟の宿題を教えてあげた"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ひとことメッセージ（アピールしよう！）
                    </label>
                    <textarea
                      rows={2}
                      value={customChoreComment}
                      onChange={(e) => setCustomChoreComment(e.target.value)}
                      placeholder="例: サドルもチェーンもピカピカにしたよ！"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {textMode === 'hiragana' ? 'もらいたい おこづかい（きぼう・なくてもOK）' : 'もらいたいお小遣い（希望金額・任意）'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        value={customRewardWanted}
                        onChange={(e) => setCustomRewardWanted(e.target.value)}
                        placeholder="例: 100"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 pr-10"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">
                        {textMode === 'hiragana' ? 'えん' : '円'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {textMode === 'hiragana'
                        ? '※さいしゅうてきな きんがくは おとうさん・おかあさんが きめるよ'
                        : '※最終的な金額はお父さん・お母さんが確認して決定します'}
                    </p>
                  </div>

                  <button
                    onClick={handleCustomApply}
                    disabled={submitting || !customChoreTitle.trim()}
                    className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 active:scale-95 text-white font-black text-sm shadow-lg shadow-amber-200 transition flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? '申請中...' : 'このお手伝いを申請する！'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- タブ3: カレンダー・履歴 --- */}
        {activeTab === 'calendar' && (
          <div className="space-y-4">
            {/* カレンダー表示 / 履歴検索 切り替えボタン */}
            <div className="flex bg-amber-100/70 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setHistorySubTab('calendar')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                  historySubTab === 'calendar'
                    ? 'bg-white text-amber-800 shadow-xs'
                    : 'text-amber-900/70 hover:text-amber-950'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                カレンダー
              </button>
              <button
                type="button"
                onClick={() => setHistorySubTab('search')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                  historySubTab === 'search'
                    ? 'bg-white text-amber-800 shadow-xs'
                    : 'text-amber-900/70 hover:text-amber-950'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                さがす（検索）
              </button>
            </div>

            {historySubTab === 'calendar' ? (
              <CalendarView transactions={transactions} />
            ) : (
              <HistorySearchView transactions={transactions} variant="child" />
            )}
          </div>
        )}
      </main>

      {/* 目標引き換え確認モーダル */}
      {showRedeemModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRedeemModal(false);
          }}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl space-y-4 text-center relative max-h-[85vh] overflow-y-auto my-auto">
            <button
              type="button"
              onClick={() => setShowRedeemModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <Gift className="w-8 h-8" />
            </div>
            <h3 className="font-extrabold text-lg text-slate-800">
              {textMode === 'hiragana' ? 'もくひょうの しなを ゲット！' : '目標の品をゲット！'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              「<span className="font-bold text-slate-700">{household.goalTitle}</span>」を買うために、残高から <span className="font-bold text-slate-800">{household.goalAmount}円</span> を使いますか？
            </p>
            {redeemError && (
              <p className="text-xs text-rose-600 font-bold">{redeemError}</p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRedeemModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition"
              >
                {textMode === 'hiragana' ? 'あとにする' : 'あとにする'}
              </button>
              <button
                type="button"
                onClick={handleRedeemGoal}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-200 hover:bg-emerald-700 transition"
              >
                {textMode === 'hiragana' ? 'ひきかえる！' : '引き換える！'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 目標編集モーダル */}
      {isEditingGoal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditingGoal(false);
          }}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl space-y-4 relative max-h-[85vh] overflow-y-auto my-auto">
            <button
              type="button"
              onClick={() => setIsEditingGoal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-bold text-base text-slate-800 pr-6">
              {textMode === 'hiragana' ? 'もくひょうを あたらしくする' : '目標を新しくする'}
            </h3>
            {goalError && (
              <div className="p-2.5 bg-rose-50 text-rose-600 text-xs rounded-xl flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{goalError}</span>
              </div>
            )}
            <form onSubmit={handleSaveGoal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {textMode === 'hiragana' ? 'ほしいもの・もくひょう' : 'ほしいもの・目標'}
                </label>
                <input
                  type="text"
                  required
                  value={goalTitleInput}
                  onChange={(e) => setGoalTitleInput(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                  placeholder="例: ニンテンドースイッチソフト"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  {textMode === 'hiragana' ? 'もくひょう きんがく（えん）' : '目標金額（円）'}
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={goalAmountInput}
                  onChange={(e) => setGoalAmountInput(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingGoal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition"
                >
                  {textMode === 'hiragana' ? 'やめる' : 'キャンセル'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-200 transition"
                >
                  {textMode === 'hiragana' ? 'ほぞん' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 固定ボトムナビゲーションバー（子ども用・大きめボタンで操作しやすい） */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-amber-200 py-2 px-3 z-30 shadow-lg">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-2 text-center">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition ${
              activeTab === 'home'
                ? 'text-amber-600 bg-amber-50 font-black shadow-xs'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Coins className="w-6 h-6 mb-0.5" />
            <span className="text-xs font-bold leading-tight">おさいふ</span>
          </button>

          <button
            onClick={() => setActiveTab('apply')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition relative ${
              activeTab === 'apply'
                ? 'text-amber-600 bg-amber-50 font-black shadow-xs'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Send className="w-6 h-6 mb-0.5" />
            <span className="text-xs font-bold leading-tight">お手伝い申請</span>
            {pendingRequests.length > 0 && (
              <span className="absolute top-1 right-5 bg-amber-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition ${
              activeTab === 'calendar'
                ? 'text-amber-600 bg-amber-50 font-black shadow-xs'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar className="w-6 h-6 mb-0.5" />
            <span className="text-xs font-bold leading-tight">カレンダー</span>
          </button>
        </div>
      </nav>

      {/* おうちのひと用クラウド合流モーダル */}
      {showParentSyncModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowParentSyncModal(false);
          }}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl space-y-4 relative max-h-[85vh] overflow-y-auto my-auto text-left">
            <button
              type="button"
              onClick={() => setShowParentSyncModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-800">おうちのひと用設定</h3>
                <p className="text-[11px] text-slate-400">クラウド同期・ファミリー合流</p>
              </div>
            </div>

            {/* 同期ステータス案内 */}
            <div className={`p-3 rounded-2xl border text-xs space-y-1 ${
              syncStatus === 'connected'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : syncStatus === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <p className="font-bold flex items-center gap-1.5">
                {syncStatus === 'connected' && <Cloud className="w-4 h-4 text-emerald-600" />}
                {syncStatus === 'error' && <ShieldAlert className="w-4 h-4 text-rose-600" />}
                {syncStatus === 'local' && <HardDrive className="w-4 h-4 text-slate-600" />}
                ステータス: {
                  syncStatus === 'connected' ? 'クラウド同期中' :
                  syncStatus === 'error' ? '同期エラー（設定確認）' :
                  syncStatus === 'syncing' ? '確認中...' : 'ローカル保存'
                }
              </p>
              <p className="text-[10px] leading-tight">
                {syncStatus === 'connected'
                  ? '親の端末とリアルタイムに繋がっています。'
                  : '複数端末で残高を合わせるには親画面から発行した設定コードを入力してください。'}
              </p>
            </div>

            {!parentPassUnlocked ? (
              /* 保護者ロック（九九計算） */
              <div className="space-y-3 pt-1">
                <p className="text-xs text-slate-600 leading-snug">
                  誤操作を防ぐため、大人の確認クイズに答えてください：<br />
                  <span className="font-extrabold text-indigo-600 text-sm">7 × 8 = ？</span>
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={parentMathAnswer}
                    onChange={(e) => setParentMathAnswer(e.target.value)}
                    placeholder="答えを入力"
                    className="flex-1 px-3 py-2 border rounded-xl text-xs font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (parentMathAnswer.trim() === '56') {
                        setParentPassUnlocked(true);
                        setParentSyncError('');
                      } else {
                        setParentSyncError('答えがちがいます');
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
                  >
                    解除
                  </button>
                </div>
                {parentSyncError && (
                  <p className="text-[11px] text-rose-500 font-bold">{parentSyncError}</p>
                )}
              </div>
            ) : (
              /* 設定コード入力フォーム */
              <div className="space-y-3 pt-1">
                <p className="text-xs text-slate-600 leading-snug">
                  親の管理画面の「設定」&rarr;「ファミリー招待」からコピーした「設定コード」を貼り付けてください：
                </p>
                <input
                  type="text"
                  value={parentSyncCode}
                  onChange={(e) => setParentSyncCode(e.target.value)}
                  placeholder="設定コードを貼り付け..."
                  className="w-full px-3 py-2 border rounded-xl text-xs font-mono"
                />
                {parentSyncError && (
                  <p className="text-[11px] text-rose-500 font-bold">{parentSyncError}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const decoded = JSON.parse(decodeURIComponent(atob(parentSyncCode.trim())));
                      if (decoded.apiKey && decoded.projectId) {
                        saveFirebaseConfig(decoded);
                        alert('設定を保存しました。再読み込みしてクラウドに合流します！');
                        window.location.reload();
                      } else {
                        setParentSyncError('設定コードに必要な項目がありません');
                      }
                    } catch {
                      setParentSyncError('無効な設定コードです');
                    }
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  設定を適用して再読込
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
