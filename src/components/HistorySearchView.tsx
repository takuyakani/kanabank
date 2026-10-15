import React, { useState, useMemo } from 'react';
import type { Transaction, ChoreRequest, RoutineTask, RoutineLog } from '../types';
import { useApp } from '../context/AppContext';
import { isTaskScheduledForDate } from '../utils/scheduleUtils';
import {
  Search,
  Calendar,
  X,
  Coins,
  HeartCrack,
  ShoppingBag,
  Flame,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Edit2,
  Trash2,
  AlertTriangle,
  Check
} from 'lucide-react';

interface HistorySearchViewProps {
  transactions: Transaction[];
  onSelectTransaction?: (transaction: Transaction) => void;
  variant?: 'child' | 'parent';
}

// 履歴と申請・いつもやることを統合した表示用アイテムの定義
export interface HistoryDisplayItem {
  id: string;
  sourceType: 'transaction' | 'request' | 'routine';
  title: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: 'chore' | 'penalty' | 'spend';
  status?: 'pending' | 'rejected' | 'approved' | 'open' | 'penalized';
  note?: string;
  createdBy?: string;
  createdAt: string; // ISO string
  originalTransaction?: Transaction;
  originalRequest?: ChoreRequest;
  originalRoutine?: RoutineTask;
  originalRoutineLog?: RoutineLog;
}

export const HistorySearchView: React.FC<HistorySearchViewProps> = ({
  transactions,
  onSelectTransaction,
  variant = 'parent',
}) => {
  const { updateTransaction, deleteTransaction, requests, updateChoreRequest, deleteChoreRequest, routines, routineLogs } = useApp();
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'chore' | 'penalty' | 'spend' | 'pending' | 'rejected' | 'open'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedItem, setSelectedItem] = useState<HistoryDisplayItem | null>(null);

  // 編集モード用の状態
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // 削除確認モーダル用の状態
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const isParent = variant === 'parent';

  // 本日の日付文字列
  const todayDateStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  // 全履歴アイテムの統合
  const allItems = useMemo<HistoryDisplayItem[]>(() => {
    // 通常の確定済みトランザクション
    const txItems: HistoryDisplayItem[] = transactions.map((tx) => ({
      id: tx.id,
      sourceType: 'transaction',
      title: tx.title,
      amount: tx.amount,
      date: tx.date,
      type: tx.type,
      status: 'approved',
      note: tx.note,
      createdBy: tx.createdBy,
      createdAt: tx.createdAt,
      originalTransaction: tx,
    }));

    // 親画面の場合、未承認（pending）またはやり直し（rejected）のお手伝い申請も表示に統合
    let reqItems: HistoryDisplayItem[] = [];
    if (isParent && requests) {
      reqItems = requests
        .filter((r) => r.status === 'pending' || r.status === 'rejected')
        .map((r) => {
          const reqDate = r.requestedAt ? r.requestedAt.slice(0, 10) : '';
          return {
            id: r.id,
            sourceType: 'request',
            title: r.title,
            amount: r.reward,
            date: reqDate,
            type: 'chore' as const,
            status: r.status,
            note: r.status === 'rejected' && r.parentComment ? `【やり直し理由】${r.parentComment}` : r.comment,
            createdBy: '子ども',
            createdAt: r.requestedAt || new Date().toISOString(),
            originalRequest: r,
          };
        });
    }

    // 今日の「いつもやること」を状況と共に履歴に統合
    let routineItems: HistoryDisplayItem[] = [];
    if (routines && routines.length > 0) {
      const todayObj = new Date();
      const scheduledRoutines = routines.filter((r) => isTaskScheduledForDate(r, todayObj));

      scheduledRoutines.forEach((routine) => {
        const log = routineLogs.find((l) => l.id === `${routine.id}_${todayDateStr}`);
        const status = log ? log.status : 'open';

        // 既に承認完了（completed）している場合、transactionsに「いつもやること達成: ...」として記録されているか確認
        // 記録されている場合はtransactions側で表示されるため、二重表示を防ぐ（ただしtransactionがない場合は追加）
        const alreadyInTransactions = transactions.some(
          (tx) => tx.date === todayDateStr && tx.title.includes(routine.title)
        );

        if (status === 'completed' && alreadyInTransactions) {
          return;
        }

        // 未実施（open）、報告済み承認待ち（pending）、またはペナルティ（penalized）
        const note =
          status === 'pending'
            ? '子どもから「おわったよ！」報告あり（承認待ち）'
            : status === 'open'
            ? '子ども未実施・報告待ち'
            : status === 'penalized'
            ? '期限超過ペナルティ'
            : '承認済み';

        routineItems.push({
          id: `routine-today-${routine.id}`,
          sourceType: 'routine',
          title: `いつもやること: ${routine.title}`,
          amount: routine.reward,
          date: todayDateStr,
          type: 'chore',
          status: status as any,
          note,
          createdBy: status === 'pending' ? '子ども' : status === 'completed' ? (log?.approvedBy || '保護者') : 'システム',
          createdAt: log?.reportedAt || log?.approvedAt || new Date().toISOString(),
          originalRoutine: routine,
          originalRoutineLog: log,
        });
      });
    }

    return [...txItems, ...reqItems, ...routineItems];
  }, [transactions, requests, routines, routineLogs, isParent, todayDateStr]);

  // フィルタリング処理
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // 検索ワード判定（タイトル、メモ、実行者）
      if (keyword.trim()) {
        const query = keyword.trim().toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(query);
        const matchNote = item.note ? item.note.toLowerCase().includes(query) : false;
        const matchCreatedBy = item.createdBy ? item.createdBy.toLowerCase().includes(query) : false;
        if (!matchTitle && !matchNote && !matchCreatedBy) return false;
      }

      // 種類フィルター
      if (typeFilter !== 'all') {
        if (typeFilter === 'pending') {
          if (item.status !== 'pending') return false;
        } else if (typeFilter === 'rejected') {
          if (item.status !== 'rejected') return false;
        } else if (typeFilter === 'open') {
          if (item.status !== 'open') return false;
        } else if (typeFilter === 'chore') {
          // お手伝い または いつもやること
          if (item.type !== 'chore') return false;
        } else if (item.type !== typeFilter) {
          return false;
        }
      }

      // 日付範囲判定 (YYYY-MM-DD)
      if (startDate && item.date < startDate) return false;
      if (endDate && item.date > endDate) return false;

      return true;
    }).sort((a, b) => {
      if (sortOrder === 'desc') {
        return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
      } else {
        return a.date.localeCompare(b.date) || a.createdAt.localeCompare(a.createdAt);
      }
    });
  }, [allItems, keyword, startDate, endDate, typeFilter, sortOrder]);

  // 確定済み取引タイプ別の合計集計（未承認・やり直しは残高未加算のため除外）
  const summary = useMemo(() => {
    let earned = 0;
    let penalized = 0;
    let spent = 0;

    filteredItems.forEach((item) => {
      if (item.sourceType !== 'transaction') return;
      if (item.type === 'chore') {
        earned += Math.max(0, item.amount);
      } else if (item.type === 'penalty') {
        penalized += Math.abs(item.amount);
      } else if (item.type === 'spend') {
        spent += Math.abs(item.amount);
      }
    });

    return { earned, penalized, spent };
  }, [filteredItems]);

  const handleItemClick = (item: HistoryDisplayItem) => {
    setSelectedItem(item);
    setIsEditing(false);
    setShowDeleteConfirm(false);
    setEditError('');
    setDeleteError('');
    if (onSelectTransaction && item.originalTransaction) {
      onSelectTransaction(item.originalTransaction);
    }
  };

  const startEdit = () => {
    if (!selectedItem) return;
    setEditTitle(selectedItem.title);
    setEditAmount(selectedItem.amount);
    setEditDate(selectedItem.date);
    // requestの場合はオリジナルのcommentを編集フォームにセット
    if (selectedItem.sourceType === 'request' && selectedItem.originalRequest) {
      setEditNote(selectedItem.originalRequest.comment || '');
    } else {
      setEditNote(selectedItem.note || '');
    }
    setEditError('');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || isSavingEdit) return;
    setEditError('');

    if (!editTitle.trim()) {
      setEditError('内容・タイトルを入力してください。');
      return;
    }
    if (!editDate) {
      setEditError('日付を入力してください。');
      return;
    }

    setIsSavingEdit(true);
    try {
      if (selectedItem.sourceType === 'request' && selectedItem.originalRequest) {
        // お手伝い申請（未承認またはやり直し）の修正
        const updatedReq: ChoreRequest = {
          ...selectedItem.originalRequest,
          title: editTitle.trim(),
          reward: Math.max(0, Math.floor(Number(editAmount))),
          comment: editNote.trim(),
          requestedAt: editDate ? `${editDate}T12:00:00.000Z` : selectedItem.originalRequest.requestedAt,
        };
        const res = await updateChoreRequest(updatedReq);
        if (!res.success) {
          setEditError(res.error || '申請の更新に失敗しました。');
          return;
        }
        setSelectedItem({
          ...selectedItem,
          title: updatedReq.title,
          amount: updatedReq.reward,
          date: editDate,
          note: updatedReq.status === 'rejected' && updatedReq.parentComment ? `【やり直し理由】${updatedReq.parentComment}` : updatedReq.comment,
          originalRequest: updatedReq,
        });
        setIsEditing(false);
      } else if (selectedItem.originalTransaction) {
        // 通常の確定済み履歴の修正
        const updatedTx: Transaction = {
          ...selectedItem.originalTransaction,
          title: editTitle.trim(),
          amount: Math.floor(Number(editAmount)),
          date: editDate,
          note: editNote.trim(),
        };
        const res = await updateTransaction(updatedTx);
        if (!res.success) {
          setEditError(res.error || '履歴の更新に失敗しました。');
          return;
        }
        setSelectedItem({
          ...selectedItem,
          title: updatedTx.title,
          amount: updatedTx.amount,
          date: updatedTx.date,
          note: updatedTx.note,
          originalTransaction: updatedTx,
        });
        setIsEditing(false);
      }
    } catch (err) {
      console.error('更新エラー:', err);
      setEditError('更新中にエラーが発生しました。');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem || isDeleting) return;
    setDeleteError('');
    setIsDeleting(true);
    try {
      if (selectedItem.sourceType === 'request') {
        const res = await deleteChoreRequest(selectedItem.id);
        if (!res.success) {
          setDeleteError(res.error || '申請の削除に失敗しました。');
          return;
        }
      } else {
        const res = await deleteTransaction(selectedItem.id);
        if (!res.success) {
          setDeleteError(res.error || '履歴の削除に失敗しました。');
          return;
        }
      }
      setShowDeleteConfirm(false);
      setSelectedItem(null);
    } catch (err) {
      console.error('削除エラー:', err);
      setDeleteError('削除中にエラーが発生しました。');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 検索・絞り込みカード */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className={`font-bold text-sm flex items-center gap-2 ${isParent ? 'text-indigo-900' : 'text-amber-800'}`}>
            <Search className={`w-4 h-4 ${isParent ? 'text-indigo-600' : 'text-amber-500'}`} />
            履歴をさがす（検索）
          </h3>
          {(keyword || startDate || endDate || typeFilter !== 'all') && (
            <button
              onClick={() => {
                setKeyword('');
                setStartDate('');
                setEndDate('');
                setTypeFilter('all');
              }}
              className="text-[11px] font-semibold text-rose-500 hover:underline flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> リセット
            </button>
          )}
        </div>

        {/* キーワード入力 */}
        <div className="relative">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="キーワード（お手伝い名、メモなど）"
            className={`w-full pl-9 pr-4 py-2.5 rounded-2xl border text-xs focus:outline-none transition ${
              isParent
                ? 'border-indigo-100 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                : 'border-amber-100 focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
            }`}
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          {keyword && (
            <button
              onClick={() => setKeyword('')}
              className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 期間指定 (開始日〜終了日) */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> 日付の範囲
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5">開始日</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5">終了日</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
            </div>
          </div>
        </div>

        {/* カテゴリフィルター（お手伝い・いつもやること / 減額 / 出金 / 申請中 / やり直し） */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> 種類で絞り込み
          </label>
          <div className="flex gap-1.5 flex-wrap text-xs">
            {[
              { id: 'all', label: 'すべて' },
              { id: 'chore', label: 'お手伝い・いつも' },
              { id: 'penalty', label: '叱られ減額' },
              { id: 'spend', label: '出金（つかった）' },
              ...(isParent ? [
                { id: 'pending', label: '確認中（未承認）' },
                { id: 'rejected', label: 'やり直し' },
                { id: 'open', label: '今日のいつも（未実施）' }
              ] : [])
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTypeFilter(f.id as any)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition border ${
                  typeFilter === f.id
                    ? isParent
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 検索結果サマリー & 並び替え */}
      <div className="flex items-center justify-between px-1">
        <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
          <span>検索結果:</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
            isParent ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-800'
          }`}>
            {filteredItems.length} 件
          </span>
        </div>

        <button
          onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs transition"
        >
          <ArrowUpDown className="w-3 h-3" />
          <span>{sortOrder === 'desc' ? '新しい順' : '古い順'}</span>
        </button>
      </div>

      {/* 絞り込み結果の金額サマリー */}
      {filteredItems.length > 0 && (
        <div className="grid grid-cols-3 gap-2 p-3 bg-white rounded-2xl border border-slate-100 text-center shadow-xs">
          <div>
            <span className="text-[10px] text-slate-400 font-bold block">ふえた</span>
            <span className="text-xs font-black text-amber-600">+{summary.earned}円</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block">しかり減額</span>
            <span className="text-xs font-black text-rose-600">-{summary.penalized}円</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block">つかった</span>
            <span className="text-xs font-black text-blue-600">-{summary.spent}円</span>
          </div>
        </div>
      )}

      {/* 検索結果リスト */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 space-y-2">
            <Search className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-500">条件に一致する履歴が見つかりませんでした</p>
            <p className="text-[11px] text-slate-400">検索ワードや日付の範囲を変えて試してください。</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isRoutine = item.title.startsWith('いつもやること');
            const isPending = item.status === 'pending';
            const isRejected = item.status === 'rejected';
            const isOpen = item.status === 'open';
            const isPenalized = item.status === 'penalized';

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item)}
                className={`w-full text-left p-3.5 bg-white hover:bg-slate-50 active:scale-[0.99] rounded-2xl border shadow-xs transition flex items-center justify-between gap-3 group ${
                  isPending
                    ? 'border-amber-300 bg-amber-50/20'
                    : isRejected
                    ? 'border-rose-200 bg-rose-50/20'
                    : isOpen
                    ? 'border-slate-200 bg-slate-50/50'
                    : isPenalized
                    ? 'border-rose-200 bg-rose-50/20'
                    : 'border-slate-100'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    item.type === 'chore'
                      ? isPending
                        ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-300'
                        : isRejected
                        ? 'bg-rose-100 text-rose-600'
                        : isOpen
                        ? 'bg-slate-100 text-slate-500'
                        : isPenalized
                        ? 'bg-rose-100 text-rose-600'
                        : isRoutine
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-emerald-100 text-emerald-600'
                      : item.type === 'penalty'
                      ? 'bg-rose-100 text-rose-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {item.type === 'chore' && (isRoutine ? <Flame className="w-5 h-5" /> : <Coins className="w-5 h-5" />)}
                    {item.type === 'penalty' && <HeartCrack className="w-5 h-5" />}
                    {item.type === 'spend' && <ShoppingBag className="w-5 h-5" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400">{item.date || '日付未定'}</span>
                      {isPending && (
                        <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded-md font-bold animate-pulse">
                          確認中（未承認）
                        </span>
                      )}
                      {isRejected && (
                        <span className="text-[9px] bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded-md font-bold">
                          やり直し
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
                      {item.createdBy && (
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-md font-medium">
                          {item.createdBy.includes('@') ? item.createdBy.split('@')[0] : item.createdBy}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-xs text-slate-800 truncate mt-0.5 group-hover:text-indigo-600 transition">
                      {item.title}
                    </p>
                    {item.note && (
                      <p className={`text-[11px] truncate mt-0.5 ${isRejected ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
                        {item.note}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`font-black text-xs ${
                    isPending
                      ? 'text-amber-500'
                      : isRejected
                      ? 'text-rose-400 line-through'
                      : isOpen
                      ? 'text-slate-400'
                      : isPenalized
                      ? 'text-rose-500 line-through'
                      : item.amount > 0
                      ? 'text-amber-600'
                      : item.amount < 0
                      ? 'text-rose-600'
                      : 'text-slate-500'
                  }`}>
                    {item.amount > 0 ? `+${item.amount}円` : `${item.amount}円`}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" />
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* 履歴詳細・修正モーダル */}
      {selectedItem && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingEdit && !isDeleting) {
              setSelectedItem(null);
              setIsEditing(false);
              setShowDeleteConfirm(false);
            }
          }}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 relative my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  selectedItem.type === 'chore'
                    ? selectedItem.status === 'rejected'
                      ? 'bg-rose-100 text-rose-600'
                      : 'bg-amber-100 text-amber-600'
                    : selectedItem.type === 'penalty'
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  {selectedItem.type === 'chore' && <Coins className="w-4 h-4" />}
                  {selectedItem.type === 'penalty' && <HeartCrack className="w-4 h-4" />}
                  {selectedItem.type === 'spend' && <ShoppingBag className="w-4 h-4" />}
                </div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-sm text-slate-800">
                    {isEditing
                      ? selectedItem.sourceType === 'request'
                        ? '申請の修正'
                        : '履歴の修正'
                      : '詳細・しょうさい'}
                  </h4>
                  {selectedItem.status === 'pending' && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                      {selectedItem.sourceType === 'routine' ? '確認中（承認待ち）' : '申請中（未承認）'}
                    </span>
                  )}
                  {selectedItem.status === 'rejected' && (
                    <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full border border-rose-200">
                      やり直し
                    </span>
                  )}
                  {selectedItem.status === 'open' && (
                    <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full border border-slate-300">
                      未実施
                    </span>
                  )}
                  {selectedItem.status === 'penalized' && (
                    <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full border border-rose-200">
                      期限超過
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedItem(null);
                  setIsEditing(false);
                  setShowDeleteConfirm(false);
                }}
                disabled={isSavingEdit || isDeleting}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* エラーメッセージ表示 */}
            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {isEditing ? (
              /* --- 修正モード（フォーム） --- */
              <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    内容・タイトル <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    placeholder="例: お風呂そうじ"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      金額（円） <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={editAmount}
                      onChange={(e) => setEditAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none font-bold"
                      placeholder="0"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {selectedItem.sourceType === 'request'
                        ? '※承認予定の金額'
                        : '※プラスは加算、マイナスは減額'}
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      実施日付 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    メッセージ・メモ（任意）
                  </label>
                  <textarea
                    rows={2}
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    placeholder="メモや理由を入力..."
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isSavingEdit}
                    className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-200 transition disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSavingEdit ? '保存中...' : '変更を保存'}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* --- 通常詳細表示モード --- */
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">内容</span>
                  <p className="font-extrabold text-sm text-slate-800">{selectedItem.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">金額</span>
                    <span className={`text-base font-black ${
                      selectedItem.status === 'pending'
                        ? 'text-amber-500'
                        : selectedItem.status === 'rejected'
                        ? 'text-rose-400 line-through'
                        : selectedItem.amount > 0
                        ? 'text-amber-600'
                        : selectedItem.amount < 0
                        ? 'text-rose-600'
                        : 'text-slate-600'
                    }`}>
                      {selectedItem.amount > 0 ? `+${selectedItem.amount}円` : `${selectedItem.amount}円`}
                    </span>
                    {selectedItem.sourceType === 'request' && (
                      <span className="text-[10px] text-slate-400 block">（未反映）</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">実施日付</span>
                    <span className="font-bold text-slate-700">{selectedItem.date || '未定'}</span>
                  </div>
                </div>

                {selectedItem.note && (
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">
                      {selectedItem.status === 'rejected' ? 'やり直し理由 / メモ' : 'メッセージ・メモ'}
                    </span>
                    <p className={`p-2.5 rounded-xl border leading-relaxed ${
                      selectedItem.status === 'rejected'
                        ? 'bg-rose-50 border-rose-100 text-rose-700 font-medium'
                        : 'bg-slate-50 border-slate-100 text-slate-700'
                    }`}>
                      {selectedItem.note}
                    </p>
                  </div>
                )}

                <div className="space-y-1 pt-1 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>{selectedItem.sourceType === 'request' ? '申請日時:' : '登録日時:'}</span>
                    <span>{new Date(selectedItem.createdAt).toLocaleString('ja-JP')}</span>
                  </div>
                  {selectedItem.createdBy && (
                    <div className="flex justify-between">
                      <span>{selectedItem.sourceType === 'request' ? '申請者:' : '登録・承認者:'}</span>
                      <span>{selectedItem.createdBy}</span>
                    </div>
                  )}
                </div>

                {/* 親画面限定: アクション案内 / 修正・削除ボタン */}
                {isParent && (
                  <div className="pt-2 border-t border-slate-100">
                    {selectedItem.sourceType === 'routine' ? (
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 text-center">
                        {selectedItem.status === 'pending'
                          ? '※この「いつもやること」はダッシュボード上部の承認枠から承認・差戻しを行えます。'
                          : selectedItem.status === 'open'
                          ? '※子どもが「おわったよ！」を送信するまで未実施として記録されます。'
                          : '※「いつも」タブからタスク自体の設定を変更・削除できます。'}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={startEdit}
                          className="flex-1 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center gap-1.5 transition border border-indigo-200/60"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>修正</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(true)}
                          className="flex-1 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs flex items-center justify-center gap-1.5 transition border border-rose-200/60"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>削除</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition mt-1"
                >
                  とじる
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {showDeleteConfirm && selectedItem && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setShowDeleteConfirm(false);
          }}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl space-y-4 text-center relative my-auto">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-base text-slate-800">
              {selectedItem.sourceType === 'request' ? 'この申請を削除しますか？' : 'この履歴を削除しますか？'}
            </h3>

            {deleteError && (
              <div className="p-2 bg-rose-50 text-rose-600 text-[11px] rounded-lg">
                {deleteError}
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-left text-xs space-y-1">
              <p className="font-bold text-slate-800 truncate">{selectedItem.title}</p>
              <p className="text-slate-500">{selectedItem.date || '日付未定'}</p>
              <p className={`font-black ${selectedItem.amount > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                {selectedItem.amount > 0 ? `+${selectedItem.amount}円` : `${selectedItem.amount}円`}
              </p>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              {selectedItem.sourceType === 'request'
                ? '申請を削除します（まだ承認されていないため残高には影響しません）。'
                : `削除すると、この履歴分の金額（${selectedItem.amount > 0 ? `+${selectedItem.amount}円` : `${selectedItem.amount}円`}）が残高に自動反映されます。元に戻すことはできません。`}
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-md shadow-rose-200 transition disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isDeleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
