import React, { useState } from 'react';
import type { Transaction } from '../types';
import { useApp } from '../context/AppContext';
import { isTaskScheduledForDate } from '../utils/scheduleUtils';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Coins, HeartCrack, ShoppingBag, Sparkles, Flame, CheckCircle2 } from 'lucide-react';

interface CalendarViewProps {
  transactions: Transaction[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ transactions }) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // 月初と月終
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // 日付ごとの取引マップ
  const txByDate: Record<string, Transaction[]> = {};
  transactions.forEach((tx) => {
    if (!txByDate[tx.date]) txByDate[tx.date] = [];
    txByDate[tx.date].push(tx);
  });

  // 当月のサマリー集計
  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const currentMonthTxs = transactions.filter((tx) => tx.date.startsWith(currentMonthPrefix));

  let monthEarned = 0;
  let monthPenalty = 0;
  let monthSpent = 0;

  currentMonthTxs.forEach((tx) => {
    if (tx.type === 'chore') {
      monthEarned += tx.amount;
    } else if (tx.type === 'penalty') {
      monthPenalty += Math.abs(tx.amount);
    } else if (tx.type === 'spend') {
      monthSpent += Math.abs(tx.amount);
    }
  });

  // カレンダーの日セル配列を作成
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  const { routines, routineLogs } = useApp();

  // 今日の日付文字列（ローカルタイム基準）
  const todayStr = React.useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  // 選択日が今日の場合、本日のルーティンのうちまだtransactionになっていないもの（未実施 open、確認中 pending など）を抽出
  const todayRoutinesForSelectedDay = React.useMemo(() => {
    if (selectedDateStr !== todayStr || !routines || routines.length === 0) return [];
    const todayObj = new Date();
    const scheduled = routines.filter((r) => isTaskScheduledForDate(r, todayObj));

    return scheduled
      .map((routine) => {
        const log = routineLogs.find((l) => l.id === `${routine.id}_${todayStr}`);
        const status = log ? log.status : 'open';

        // 既に承認完了（completed）でtransactionsに存在するものはtransactions側で表示されるため除外
        const alreadyInTxs = transactions.some(
          (tx) => tx.date === todayStr && tx.title.includes(routine.title)
        );
        if (status === 'completed' && alreadyInTxs) return null;

        return {
          id: `routine-cal-${routine.id}`,
          title: `いつもやること: ${routine.title}`,
          reward: routine.reward,
          status, // 'open' | 'pending' | 'completed' | 'penalized'
          reportedAt: log?.reportedAt,
        };
      })
      .filter(Boolean) as Array<{
        id: string;
        title: string;
        reward: number;
        status: 'open' | 'pending' | 'completed' | 'penalized';
        reportedAt?: string;
      }>;
  }, [selectedDateStr, todayStr, routines, routineLogs, transactions]);

  const selectedTxs = txByDate[selectedDateStr] || [];
  const totalItemsCount = selectedTxs.length + todayRoutinesForSelectedDay.length;

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
      {/* 月選択ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm sm:text-base">
          <CalendarIcon className="w-5 h-5 text-amber-500" />
          {year}年 {month + 1}月
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
            title="前月"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
            title="翌月"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 当月のサマリーカード */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl mb-4 border border-slate-100 text-center">
        <div>
          <span className="text-[10px] text-slate-400 font-bold block">ふえた</span>
          <span className="text-xs sm:text-sm font-black text-amber-600">+{monthEarned}円</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-bold block">しかり減額</span>
          <span className="text-xs sm:text-sm font-black text-rose-600">-{monthPenalty}円</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-bold block">つかった</span>
          <span className="text-xs sm:text-sm font-black text-blue-600">-{monthSpent}円</span>
        </div>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 mb-2">
        <span className="text-rose-400">日</span>
        <span>月</span>
        <span>火</span>
        <span>水</span>
        <span>木</span>
        <span>金</span>
        <span className="text-blue-400">土</span>
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-11" />;
          }

          const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = dayStr === selectedDateStr;
          const dayTxs = txByDate[dayStr] || [];
          const hasChore = dayTxs.some((t) => t.type === 'chore');
          const hasPenalty = dayTxs.some((t) => t.type === 'penalty');
          const hasSpend = dayTxs.some((t) => t.type === 'spend');

          return (
            <button
              key={dayStr}
              onClick={() => setSelectedDateStr(dayStr)}
              className={`h-11 rounded-xl flex flex-col items-center justify-between p-1 transition-all relative ${
                isSelected
                  ? 'bg-amber-400 text-white font-bold shadow-md shadow-amber-200'
                  : 'hover:bg-amber-50 text-slate-700'
              }`}
            >
              <span className="text-xs">{day}</span>
              <div className="flex gap-0.5 mt-auto">
                {hasChore && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-amber-500'}`} />
                )}
                {hasPenalty && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-rose-200' : 'bg-rose-500'}`} />
                )}
                {hasSpend && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-200' : 'bg-blue-500'}`} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 選択した日の詳細タイムライン */}
      <div className="mt-5 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4 text-amber-500" />
            <span>{selectedDateStr} のできごと</span>
            <span className="text-[10px] text-slate-400 font-normal">({totalItemsCount}件)</span>
          </h4>

          {(selectedTxs.some((t) => t.type === 'chore') || todayRoutinesForSelectedDay.some((r) => r.status === 'completed')) && (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
              <Sparkles className="w-3 h-3 text-amber-600" />
              がんばったスタンプ！
            </span>
          )}
        </div>

        {totalItemsCount === 0 ? (
          <div className="py-4 text-center text-slate-400 text-xs">
            この日はきろくがありません
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {/* 本日のいつもやること状況（未確定分・承認済み分） */}
            {todayRoutinesForSelectedDay.map((r) => {
              const isApproved = r.status === 'completed';
              const isPending = r.status === 'pending';
              const isOpen = r.status === 'open';
              const isPenalized = r.status === 'penalized';

              return (
                <div
                  key={r.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                    isApproved
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : isPending
                      ? 'bg-amber-50/70 border-amber-200'
                      : isOpen
                      ? 'bg-slate-50/70 border-slate-200'
                      : 'bg-rose-50/70 border-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Flame className={`w-4 h-4 shrink-0 ${
                      isApproved
                        ? 'text-emerald-500'
                        : isPending
                        ? 'text-amber-500'
                        : isOpen
                        ? 'text-slate-400'
                        : 'text-rose-500'
                    }`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-slate-800 truncate">{r.title}</p>
                        {isApproved && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded-md font-bold flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            承認完了
                          </span>
                        )}
                        {isPending && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded-md font-bold animate-pulse">
                            確認中（未承認）
                          </span>
                        )}
                        {isOpen && (
                          <span className="text-[9px] bg-slate-200/80 text-slate-600 border border-slate-300 px-1.5 py-0.2 rounded-md font-bold">
                            未実施
                          </span>
                        )}
                        {isPenalized && (
                          <span className="text-[9px] bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded-md font-bold">
                            期限超過
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-[10px]">
                        {isApproved
                          ? '達成済み・承認完了'
                          : isPending
                          ? '子どもから「おわったよ！」報告あり'
                          : isOpen
                          ? '子どもの実施・報告待ち'
                          : '期限切れ'}
                      </p>
                    </div>
                  </div>
                  <span className={`font-black shrink-0 ${
                    isApproved
                      ? 'text-emerald-600'
                      : isPending
                      ? 'text-amber-500'
                      : 'text-slate-400'
                  }`}>
                    +{r.reward}円
                  </span>
                </div>
              );
            })}

            {/* 確定済みトランザクション */}
            {selectedTxs.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {tx.type === 'chore' && <Coins className="w-4 h-4 text-amber-500 shrink-0" />}
                  {tx.type === 'penalty' && <HeartCrack className="w-4 h-4 text-rose-500 shrink-0" />}
                  {tx.type === 'spend' && <ShoppingBag className="w-4 h-4 text-blue-500 shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-slate-800 truncate">{tx.title}</p>
                      {tx.createdBy && (
                        <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded-full font-medium">
                          {tx.createdBy.includes('@') ? tx.createdBy.split('@')[0] : tx.createdBy}
                        </span>
                      )}
                    </div>
                    {tx.note && <p className="text-slate-400 text-[10px] truncate">{tx.note}</p>}
                  </div>
                </div>
                <span
                  className={`font-black shrink-0 ${
                    tx.amount > 0 ? 'text-amber-600' : 'text-rose-600'
                  }`}
                >
                  {tx.amount > 0 ? `+${tx.amount}円` : `${tx.amount}円`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
