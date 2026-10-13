import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CalendarView } from '../components/CalendarView';
import { HistorySearchView } from '../components/HistorySearchView';
import {
  saveFirebaseConfig,
  clearFirebaseConfig,
  getSavedFirebaseConfig,
  type FirebaseCustomConfig
} from '../lib/firebase';
import type { ChoreMaster, RoutineTask, RoutineLog, ScheduleType, Transaction } from '../types';
import { formatScheduleDescription, isTaskScheduledForDate } from '../utils/scheduleUtils';
import {
  Check,
  X,
  Plus,
  Trash2,
  Edit2,
  MinusCircle,
  LogOut,
  ShoppingBag,
  Clock,
  Settings,
  Calendar,
  AlertTriangle,
  Info,
  Cloud,
  HardDrive,
  Gift,
  Trophy,
  CheckSquare,
  Search,
  Coins,
  AlertCircle,
  Download,
  Banknote,
  ShieldAlert,
  RefreshCw,
  Copy,
  CheckCheck,
  Upload,
  Undo2
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const ParentDashboard: React.FC = () => {
  const {
    currentUser,
    household,
    chores,
    requests,
    transactions,
    routines,
    routineLogs,
    fontSize,
    setFontSize,
    isDemoMode,
    updateGoal,
    approveRequest,
    rejectRequest,
    addPenalty,
    addSpend,
    addChoreMaster,
    updateChoreMaster,
    deleteChoreMaster,
    redeemGoal,
    addRoutine,
    updateRoutine,
    deleteRoutine,
    approveRoutineLog,
    clearAllTransactions,
    restoreTransactions,
    importBackupData,
    updateBalance,
    syncStatus,
    syncErrorMessage,
    logout,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'approvals' | 'routines' | 'penalty' | 'spend' | 'chores' | 'calendar' | 'search' | 'settings'>('approvals');
  const [historySubTab, setHistorySubTab] = useState<'calendar' | 'search'>('calendar');

  // 親からの残高直接編集モーダル
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState<number>(household.balance);
  const [balanceReason, setBalanceReason] = useState('');
  const [balanceError, setBalanceError] = useState('');
  const [balanceSuccess, setBalanceSuccess] = useState(false);

  // 親からの目標編集モーダル
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalTitleInput, setGoalTitleInput] = useState(household.goalTitle);
  const [goalAmountInput, setGoalAmountInput] = useState<number>(household.goalAmount);
  const [goalError, setGoalError] = useState('');
  const [goalSuccess, setGoalSuccess] = useState(false);

  // 減額（ペナルティ）フォーム
  const [penaltyReason, setPenaltyReason] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState<number>(50);
  const [penaltySuccess, setPenaltySuccess] = useState(false);
  const [penaltyError, setPenaltyError] = useState('');
  const [showPenaltyConfirm, setShowPenaltyConfirm] = useState(false);

  // お小遣い使用フォーム
  const [spendTitle, setSpendTitle] = useState('');
  const [spendAmount, setSpendAmount] = useState<number>(100);
  const [spendMethod, setSpendMethod] = useState<'cash' | 'virtual'>('cash');
  const [spendSuccess, setSpendSuccess] = useState(false);
  const [spendError, setSpendError] = useState('');

  // お手伝いマスター編集モーダル
  const [isEditingChore, setIsEditingChore] = useState(false);
  const [editingChoreData, setEditingChoreData] = useState<Partial<ChoreMaster>>({
    title: '',
    reward: 30,
    icon: 'sparkles',
    description: '',
  });

  // お手伝いマスター削除確認モーダル
  const [deletingChore, setDeletingChore] = useState<ChoreMaster | null>(null);
  const [isSavingChore, setIsSavingChore] = useState(false);
  const [isDeletingChore, setIsDeletingChore] = useState(false);

  // ルーティン編集モーダル
  const [isEditingRoutine, setIsEditingRoutine] = useState(false);
  const [routineError, setRoutineError] = useState('');
  const [editingRoutineData, setEditingRoutineData] = useState<Partial<RoutineTask>>({
    title: '',
    reward: 0,
    penaltyAmount: 30,
    graceDays: 1,
    scheduleType: 'daily',
    active: true,
  });
  const [routineDaysOfWeek, setRoutineDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [routineDayOfMonth, setRoutineDayOfMonth] = useState<number>(1);
  const [routineNthWeek, setRoutineNthWeek] = useState<number>(1);
  const [routineNthWeekday, setRoutineNthWeekday] = useState<number>(1);
  const [deletingRoutine, setDeletingRoutine] = useState<RoutineTask | null>(null);
  const [isSavingRoutine, setIsSavingRoutine] = useState(false);
  const [isDeletingRoutine, setIsDeletingRoutine] = useState(false);

  // 申請承認モーダル（ボーナス・コメント・自由入力報酬用）
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [customRewardInput, setCustomRewardInput] = useState<number>(50);
  const [bonusInput, setBonusInput] = useState(0);
  const [parentCommentInput, setParentCommentInput] = useState('');
  const [approveSuccessToast, setApproveSuccessToast] = useState<string | null>(null);
  const [approvingRoutineLogId, setApprovingRoutineLogId] = useState<string | null>(null);

  // 目標達成引き換え
  const [goalRedeemSuccess, setGoalRedeemSuccess] = useState(false);
  const [goalRedeemError, setGoalRedeemError] = useState('');

  // 履歴全削除モーダル
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [clearHistorySuccess, setClearHistorySuccess] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);

  // Undoトースト & バックアップ復元
  const [undoClearToast, setUndoClearToast] = useState<{ txs: Transaction[]; count: number } | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // Firestoreルールモーダル & ファミリー共有
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);
  const [copiedConfigCode, setCopiedConfigCode] = useState(false);
  const [pasteConfigCodeInput, setPasteConfigCodeInput] = useState('');

  // 全モーダルのESCキー閉じハンドリング
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsEditingBalance(false);
        setIsEditingGoal(false);
        setIsEditingChore(false);
        setDeletingChore(null);
        setIsEditingRoutine(false);
        setDeletingRoutine(null);
        setApprovingId(null);
        setShowPenaltyConfirm(false);
        setShowClearHistoryConfirm(false);
        setShowRulesModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // クラウド手動設定
  const currentSavedConfig = getSavedFirebaseConfig();
  const [fbApiKey, setFbApiKey] = useState(currentSavedConfig?.apiKey || '');
  const [fbProjectId, setFbProjectId] = useState(currentSavedConfig?.projectId || '');
  const [fbConfigMessage, setFbConfigMessage] = useState('');

  const isGoalReached = household.balance >= household.goalAmount && household.goalAmount > 0;
  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const pendingRoutineLogs = routineLogs.filter((l) => l.status === 'pending');

  // 本日の「いつもやること」未実施（未完了・未報告）の抽出
  const todayObj = new Date();
  const yStr = todayObj.getFullYear();
  const mStr = String(todayObj.getMonth() + 1).padStart(2, '0');
  const dStr = String(todayObj.getDate()).padStart(2, '0');
  const todayDateStr = `${yStr}-${mStr}-${dStr}`;

  const todayScheduledRoutines = routines.filter((r) => isTaskScheduledForDate(r, todayObj));
  // 未実施 = 今日の日付でログが存在しない、または open 状態（未報告・未完了）
  const uncompletedRoutines = todayScheduledRoutines.filter((routine) => {
    const log = routineLogs.find((l) => l.id === `${routine.id}_${todayDateStr}`);
    return !log || log.status === 'open';
  });

  const approvingReq = requests.find((r) => r.id === approvingId);

  // JSONバックアップダウンロード
  const handleDownloadBackup = () => {
    try {
      const backupData = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        household,
        transactions,
        chores,
        routines,
        requests,
        routineLogs,
      };
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      a.href = url;
      a.download = `kanabank_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupDownloaded(true);
      setTimeout(() => setBackupDownloaded(false), 5000);
    } catch (err) {
      console.error('バックアップ出力エラー:', err);
    }
  };

  const handleApprove = async () => {
    if (!approvingId || !approvingReq) return;
    const isCustom = approvingReq.choreId === 'custom';
    const rewardToGive = isCustom ? Number(customRewardInput) : (approvingReq.reward + Number(bonusInput));
    
    if (isCustom && (isNaN(Number(customRewardInput)) || Number(customRewardInput) < 1 || Number(customRewardInput) > 100000)) {
      alert('自由入力お手伝いの金額は 1円〜100,000円 の範囲で設定してください。');
      return;
    }

    await approveRequest(
      approvingId,
      Number(bonusInput),
      parentCommentInput,
      isCustom ? Number(customRewardInput) : undefined
    );
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
    });
    setApproveSuccessToast(`「${approvingReq.title}」を承認し、${rewardToGive}円を反映しました！`);
    setTimeout(() => setApproveSuccessToast(null), 3500);

    setApprovingId(null);
    setBonusInput(0);
    setCustomRewardInput(50);
    setParentCommentInput('');
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('やり直し・却下の理由（省略可）', '');
    if (reason !== null) {
      await rejectRequest(id, reason);
    }
  };

  const handleApproveRoutine = async (log: RoutineLog) => {
    setApprovingRoutineLogId(log.id);
    try {
      const res = await approveRoutineLog(log.id);
      if (res && !res.success) {
        alert(res.error || '承認に失敗しました');
        return;
      }
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
      setApproveSuccessToast(
        `「いつもやること: ${log.title}」を承認しました！${log.reward > 0 ? ` (+${log.reward}円)` : ''}`
      );
      setTimeout(() => setApproveSuccessToast(null), 3500);
    } catch (err) {
      console.error('いつもやること承認エラー:', err);
    } finally {
      setApprovingRoutineLogId(null);
    }
  };

  const handleSaveBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setBalanceError('');
    if (balanceInput < 0 || isNaN(balanceInput)) {
      setBalanceError('0円以上の金額を入力してください。');
      return;
    }
    const res = await updateBalance(balanceInput, balanceReason);
    if (!res.success) {
      setBalanceError(res.error || '残高の更新に失敗しました。');
      return;
    }
    setIsEditingBalance(false);
    setBalanceSuccess(true);
    setTimeout(() => setBalanceSuccess(false), 3500);
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
    setGoalSuccess(true);
    setTimeout(() => setGoalSuccess(false), 3000);
  };

  const handlePenaltySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPenaltyError('');

    if (!penaltyAmount || penaltyAmount < 1) {
      setPenaltyError('減額する金額は1円以上を入力してください。');
      return;
    }
    if (!penaltyReason.trim()) {
      setPenaltyError('理由を入力してください。');
      return;
    }

    setShowPenaltyConfirm(true);
  };

  const confirmExecutePenalty = async () => {
    setShowPenaltyConfirm(false);
    const res = await addPenalty(penaltyReason, penaltyAmount);
    if (!res.success) {
      setPenaltyError(res.error || '減額の登録に失敗しました。');
      return;
    }
    setPenaltyReason('');
    setPenaltySuccess(true);
    setTimeout(() => setPenaltySuccess(false), 3000);
  };

  const handleSpendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSpendError('');

    if (!spendAmount || spendAmount < 1) {
      setSpendError('出金する金額は1円以上を入力してください。');
      return;
    }
    if (spendAmount > household.balance) {
      setSpendError(`残高が不足しています（現在の残高: ${household.balance}円）。`);
      return;
    }

    const res = await addSpend(spendTitle, spendAmount, '', spendMethod);
    if (!res.success) {
      setSpendError(res.error || '出金の登録に失敗しました。');
      return;
    }
    setSpendTitle('');
    setSpendSuccess(true);
    setTimeout(() => setSpendSuccess(false), 3000);
  };

  const handleRedeemGoalByParent = async () => {
    setGoalRedeemError('');
    const res = await redeemGoal();
    if (!res.success) {
      setGoalRedeemError(res.error || '引き換えに失敗しました。');
      return;
    }
    setGoalRedeemSuccess(true);
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
    });
    setTimeout(() => setGoalRedeemSuccess(false), 4000);
  };

  const handleSaveChore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChoreData.title?.trim() || !editingChoreData.reward) return;
    if (isSavingChore) return;

    setIsSavingChore(true);
    try {
      if (editingChoreData.id) {
        await updateChoreMaster(editingChoreData as ChoreMaster);
      } else {
        await addChoreMaster({
          title: editingChoreData.title.trim(),
          reward: Number(editingChoreData.reward),
          icon: editingChoreData.icon || 'sparkles',
          description: editingChoreData.description?.trim(),
        });
      }
      setIsEditingChore(false);
      setEditingChoreData({
        title: '',
        reward: 30,
        icon: 'sparkles',
        description: '',
      });
    } catch (err) {
      console.error('お手伝い保存エラー:', err);
      // 万が一エラーが起きてもモーダルを閉じ、二重登録を防止
      setIsEditingChore(false);
    } finally {
      setIsSavingChore(false);
    }
  };

  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoutineError('');
    const trimmedTitle = editingRoutineData.title?.trim();
    if (!trimmedTitle) {
      setRoutineError('タスク名を入力してください。');
      return;
    }
    if (isSavingRoutine) return;

    setIsSavingRoutine(true);
    try {
      const schedType = (editingRoutineData.scheduleType || 'daily') as ScheduleType;
      let configObj: RoutineTask['scheduleConfig'] | undefined = undefined;

      if (schedType === 'weekly_days') {
        if (!routineDaysOfWeek || routineDaysOfWeek.length === 0) {
          setRoutineError('実施する曜日を少なくとも1つ選択してください。');
          setIsSavingRoutine(false);
          return;
        }
        configObj = { daysOfWeek: routineDaysOfWeek };
      } else if (schedType === 'monthly_date') {
        configObj = { dayOfMonth: routineDayOfMonth };
      } else if (schedType === 'monthly_nth_weekday') {
        configObj = { nthWeek: routineNthWeek, nthWeekday: routineNthWeekday };
      }

      if (editingRoutineData.id) {
        const updatePayload: RoutineTask = {
          ...(editingRoutineData as RoutineTask),
          title: trimmedTitle,
          reward: Math.max(0, Math.floor(Number(editingRoutineData.reward || 0))),
          penaltyAmount: Math.max(0, Math.floor(Number(editingRoutineData.penaltyAmount || 0))),
          graceDays: Math.max(0, Math.floor(Number(editingRoutineData.graceDays || 0))),
          scheduleType: schedType,
          active: editingRoutineData.active ?? true,
        };
        if (configObj) {
          updatePayload.scheduleConfig = configObj;
        } else {
          delete updatePayload.scheduleConfig;
        }
        await updateRoutine(updatePayload);
      } else {
        const newRoutinePayload: Omit<RoutineTask, 'id' | 'createdAt'> = {
          title: trimmedTitle,
          reward: Math.max(0, Math.floor(Number(editingRoutineData.reward || 0))),
          penaltyAmount: Math.max(0, Math.floor(Number(editingRoutineData.penaltyAmount || 0))),
          graceDays: Math.max(0, Math.floor(Number(editingRoutineData.graceDays || 0))),
          scheduleType: schedType,
          active: true,
        };
        if (configObj) {
          newRoutinePayload.scheduleConfig = configObj;
        }
        await addRoutine(newRoutinePayload);
      }
      setIsEditingRoutine(false);
      setRoutineSavedSuccess(true);
      setTimeout(() => setRoutineSavedSuccess(false), 3000);
    } catch (err) {
      console.error('ルーティン保存エラー:', err);
      setRoutineError('いつもやることの保存中にエラーが発生しました。再度お試しください。');
    } finally {
      setIsSavingRoutine(false);
    }
  };

  const confirmDeleteChore = async () => {
    if (!deletingChore || isDeletingChore) return;
    setIsDeletingChore(true);
    try {
      await deleteChoreMaster(deletingChore.id);
      setDeletingChore(null);
    } catch (err) {
      console.error('お手伝い削除エラー:', err);
      setDeletingChore(null);
    } finally {
      setIsDeletingChore(false);
    }
  };

  const confirmDeleteRoutine = async () => {
    if (!deletingRoutine || isDeletingRoutine) return;
    setIsDeletingRoutine(true);
    try {
      await deleteRoutine(deletingRoutine.id);
      setDeletingRoutine(null);
    } catch (err) {
      console.error('ルーティン削除エラー:', err);
      setDeletingRoutine(null);
    } finally {
      setIsDeletingRoutine(false);
    }
  };

  const [routineSavedSuccess, setRoutineSavedSuccess] = useState(false);
  const handleSaveFirebaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = fbApiKey.trim();
    const cleanProjectId = fbProjectId.trim();

    if (!cleanKey || !cleanProjectId) {
      setFbConfigMessage('API Key と Project ID は必須です。');
      return;
    }

    if (!cleanKey.startsWith('AIza') || cleanKey.length < 30) {
      setFbConfigMessage('API Key の形式が正しくありません（"AIza..." で始まる有効なキーを入力してください）。');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(cleanProjectId)) {
      setFbConfigMessage('Project ID には英小文字、数字、ハイフンのみ使用できます。');
      return;
    }

    const config: FirebaseCustomConfig = {
      apiKey: cleanKey,
      projectId: cleanProjectId,
      authDomain: `${cleanProjectId}.firebaseapp.com`,
    };
    saveFirebaseConfig(config);
    setFbConfigMessage('✓ Firebase設定を保存しました。設定を有効にするためページを再読み込みします...');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const handleClearFirebaseConfig = () => {
    clearFirebaseConfig();
    setFbConfigMessage('設定を削除しました。ローカルモードに戻すためページを再読み込みします...');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  // ファミリー招待リンクの生成・コピー
  const handleCopyInviteUrl = () => {
    const activeKey = fbApiKey || currentSavedConfig?.apiKey;
    const activeProject = fbProjectId || currentSavedConfig?.projectId;
    if (!activeKey || !activeProject) return;

    const payload = btoa(encodeURIComponent(JSON.stringify({ apiKey: activeKey, projectId: activeProject })));
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const url = `${origin}${pathname}#/?firebase_config=${payload}`;
    navigator.clipboard.writeText(url);
    setCopiedInviteUrl(true);
    setTimeout(() => setCopiedInviteUrl(false), 3000);
  };

  // 設定コード（Base64文字列）のコピー
  const handleCopyConfigCode = () => {
    const activeKey = fbApiKey || currentSavedConfig?.apiKey;
    const activeProject = fbProjectId || currentSavedConfig?.projectId;
    if (!activeKey || !activeProject) return;

    const payload = btoa(encodeURIComponent(JSON.stringify({ apiKey: activeKey, projectId: activeProject })));
    navigator.clipboard.writeText(payload);
    setCopiedConfigCode(true);
    setTimeout(() => setCopiedConfigCode(false), 3000);
  };

  // 設定コードからの反映
  const handleApplyConfigCode = (codeStr: string) => {
    try {
      const decoded = JSON.parse(decodeURIComponent(atob(codeStr.trim())));
      if (decoded.apiKey && decoded.projectId) {
        saveFirebaseConfig(decoded);
        setFbConfigMessage('✓ 設定コードを読み込みました。有効化のため再読み込みします...');
        setTimeout(() => window.location.reload(), 800);
      } else {
        setFbConfigMessage('設定コードに必要な項目が含まれていません。');
      }
    } catch {
      setFbConfigMessage('無効な設定コードです。');
    }
  };

  // バックアップJSONファイルからの復元（インポート）
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const res = await importBackupData(parsed);
        if (res.success) {
          setImportMessage('✓ バックアップデータを正常に復元しました！');
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 } });
        } else {
          setImportMessage(`復元失敗: ${res.error}`);
        }
      } catch {
        setImportMessage('無効なJSONファイルです。');
      }
      setTimeout(() => setImportMessage(null), 5000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 全履歴削除の実行
  const handleExecuteClearAll = async () => {
    if (isClearingHistory) return;
    setIsClearingHistory(true);
    try {
      const backupTxs = [...transactions];
      await clearAllTransactions();
      setShowClearHistoryConfirm(false);
      setClearHistorySuccess(true);
      setTimeout(() => setClearHistorySuccess(false), 4000);

      // 直後10秒間のUndo（元に戻す）トーストを表示
      setUndoClearToast({ txs: backupTxs, count: backupTxs.length });
    } catch (err) {
      console.error('全履歴削除エラー:', err);
    } finally {
      setIsClearingHistory(false);
    }
  };

  // 履歴削除の取り消し（Undo）
  const handleUndoClear = async () => {
    if (!undoClearToast) return;
    const restoreList = undoClearToast.txs;
    setUndoClearToast(null);
    await restoreTransactions(restoreList);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
  };

  const isPenaltyValid = Boolean(penaltyReason.trim() && penaltyAmount >= 1);
  const isSpendValid = Boolean(spendTitle.trim() && spendAmount >= 1 && spendAmount <= household.balance);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-28 flex flex-col">
      {/* トップバー */}
      <header className="px-4 py-3 bg-indigo-900 text-white flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center font-bold text-sm">
            親
          </div>
          <div>
            <h1 className="text-sm font-extrabold leading-tight">保護者ダッシュボード</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-indigo-200">残高: {household.balance} 円</span>
              <button
                type="button"
                onClick={() => {
                  if (syncStatus === 'error') setShowRulesModal(true);
                  else setActiveTab('settings');
                }}
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 transition ${
                  syncStatus === 'connected'
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                    : syncStatus === 'syncing'
                    ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                    : syncStatus === 'error'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-500/50 hover:bg-rose-900 cursor-pointer animate-pulse'
                    : 'bg-indigo-800 text-indigo-200'
                }`}
                title="同期ステータスを確認"
              >
                {syncStatus === 'connected' && (
                  <>
                    <Cloud className="w-2.5 h-2.5 text-emerald-400" /> クラウド同期中
                  </>
                )}
                {syncStatus === 'syncing' && (
                  <>
                    <RefreshCw className="w-2.5 h-2.5 text-amber-300 animate-spin" /> 同期確認中...
                  </>
                )}
                {syncStatus === 'error' && (
                  <>
                    <ShieldAlert className="w-2.5 h-2.5 text-rose-400" /> 同期エラー（設定確認）
                  </>
                )}
                {syncStatus === 'local' && (
                  <>
                    <HardDrive className="w-2.5 h-2.5 text-amber-300" /> ローカル保存
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 文字サイズ切替 & 設定 & ログアウト */}
        <div className="flex items-center gap-1">
          {/* 文字サイズ切替 */}
          <div className="flex bg-indigo-800/80 rounded-xl p-0.5 border border-indigo-700">
            <button
              onClick={() => setFontSize('small')}
              className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold transition ${
                fontSize === 'small' ? 'bg-white text-indigo-900 shadow-xs' : 'text-indigo-200'
              }`}
              title="文字サイズ: 小"
            >
              小
            </button>
            <button
              onClick={() => setFontSize('medium')}
              className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold transition ${
                fontSize === 'medium' ? 'bg-white text-indigo-900 shadow-xs' : 'text-indigo-200'
              }`}
              title="文字サイズ: 中"
            >
              中
            </button>
            <button
              onClick={() => setFontSize('large')}
              className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold transition ${
                fontSize === 'large' ? 'bg-white text-indigo-900 shadow-xs' : 'text-indigo-200'
              }`}
              title="文字サイズ: 大"
            >
              大
            </button>
          </div>

          <button
            onClick={() => setActiveTab('settings')}
            className={`p-1.5 rounded-xl transition ${
              activeTab === 'settings' ? 'bg-indigo-700 text-white' : 'text-indigo-300 hover:text-white'
            }`}
            title="クラウド設定"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={logout}
            className="p-1.5 rounded-xl text-indigo-300 hover:text-white hover:bg-indigo-800 transition"
            title="ログアウト"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="p-4 space-y-4 flex-1">
        {/* クラウド同期エラー警告バナー */}
        {syncStatus === 'error' && (
          <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-2xl text-xs text-rose-950 flex items-start justify-between gap-2 shadow-sm animate-fade-in">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-xs text-rose-900 leading-tight">
                  クラウド同期エラー（権限不足 または 設定エラー）
                </p>
                <p className="text-[11px] text-rose-700 mt-1 leading-snug">
                  {syncErrorMessage || 'Firestoreのセキュリティルールで読み書きがブロックされている可能性があります。'}
                </p>
                <p className="text-[10px] text-rose-500 mt-1 font-semibold">
                  ※ ルールを「すべてのユーザーに許可」に設定すると解決します。
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowRulesModal(true)}
              className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-xl transition shrink-0 shadow-xs"
            >
              解決手順
            </button>
          </div>
        )}

        {/* 履歴削除取り消し（Undo）トースト通知 */}
        {undoClearToast && (
          <div className="p-3 bg-slate-900 text-white text-xs rounded-2xl font-bold flex items-center justify-between gap-3 shadow-lg animate-fade-in border border-slate-700">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
              <span>全履歴（{undoClearToast.count}件）を削除しました</span>
            </div>
            <button
              onClick={handleUndoClear}
              className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-1 shrink-0 shadow-xs"
            >
              <Undo2 className="w-3.5 h-3.5" />
              元に戻す
            </button>
          </div>
        )}

        {/* バックアップ復元結果メッセージ */}
        {importMessage && (
          <div className={`p-3 text-xs rounded-2xl font-bold flex items-center gap-2 shadow-sm animate-fade-in border ${
            importMessage.startsWith('✓') ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <Check className="w-4 h-4 shrink-0" />
            <span>{importMessage}</span>
          </div>
        )}

        {/* クラウド未設定・ローカル保存モードの案内バナー */}
        {isDemoMode && activeTab !== 'settings' && (
          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs text-amber-900 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold text-[11px] leading-tight">現在は端末内のローカル保存で動作しています</p>
                <p className="text-[10px] text-amber-700 mt-0.5">複数端末でデータを共有するにはクラウド設定が必要です</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('settings')}
              className="px-2.5 py-1 bg-amber-200/70 hover:bg-amber-200 text-amber-900 font-bold text-[10px] rounded-lg transition shrink-0"
            >
              設定を見る
            </button>
          </div>
        )}

        {/* お手伝い承認完了トースト通知 */}
        {approveSuccessToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl font-bold flex items-center gap-2 shadow-sm animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{approveSuccessToast}</span>
          </div>
        )}

        {/* 親からの残高確認＆直接編集カード */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">現在の子どもの残高</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-indigo-950">{household.balance}</span>
                <span className="text-xs font-bold text-slate-500">円</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setBalanceInput(household.balance);
              setBalanceReason('');
              setBalanceError('');
              setIsEditingBalance(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs transition shrink-0 flex items-center gap-1 shadow-2xs"
          >
            <Edit2 className="w-3.5 h-3.5" />
            残高を変更
          </button>
        </div>

        {balanceSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-bold flex items-center gap-2 shadow-xs">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>子どもの残高を {household.balance} 円に更新しました！</span>
          </div>
        )}

        {/* 親からの目標表示＆編集カード */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">現在の子どもの目標</p>
              <h3 className="font-extrabold text-sm text-slate-800 leading-tight">
                {household.goalTitle}
              </h3>
              <p className="text-xs font-black text-amber-600 mt-0.5">
                目標金額: {household.goalAmount} 円
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setGoalTitleInput(household.goalTitle);
              setGoalAmountInput(household.goalAmount);
              setGoalError('');
              setIsEditingGoal(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-xs transition shrink-0"
          >
            目標を編集
          </button>
        </div>

        {goalSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>子どもの目標（{household.goalTitle} / {household.goalAmount}円）を更新しました！</span>
          </div>
        )}

        {/* 目標達成中カード（親画面でも目立つ位置に表示） */}
        {isGoalReached && activeTab !== 'settings' && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-3xl p-4 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs sm:text-sm leading-tight">子どもが目標を達成しました！</h4>
                <p className="text-[11px] opacity-90">
                  「{household.goalTitle}」（{household.goalAmount}円）
                </p>
              </div>
            </div>
            <button
              onClick={handleRedeemGoalByParent}
              className="px-3 py-2 rounded-xl bg-white text-emerald-700 font-black text-xs shadow-md hover:bg-emerald-50 transition shrink-0 ml-2"
            >
              買ってあげた！
            </button>
          </div>
        )}

        {goalRedeemSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-bold flex items-center gap-2">
            <Gift className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>目標達成のご褒美（{household.goalAmount}円）を出金処理し、次の目標へリセットしました！</span>
          </div>
        )}

        {goalRedeemError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{goalRedeemError}</span>
          </div>
        )}

        {/* --- タブ1: 承認まち一覧 --- */}
        {activeTab === 'approvals' && (
          <div className="space-y-4">
            {/* ルーティン（いつもやること）の未承認一覧 */}
            {pendingRoutineLogs.length > 0 && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-1.5 text-indigo-700">
                  <CheckSquare className="w-4 h-4" />
                  「いつもやること」の完了報告 ({pendingRoutineLogs.length}件)
                </h3>
                <div className="space-y-3">
                  {pendingRoutineLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800 text-xs">{log.title}</span>
                          <span className="text-[10px] text-slate-400 font-medium">({log.targetDate}分)</span>
                        </div>
                        <div className="text-[11px] mt-1 space-x-2">
                          {log.reward > 0 ? (
                            <span className="text-emerald-700 font-bold">ご褒美: +{log.reward}円</span>
                          ) : (
                            <span className="text-slate-500 font-semibold">ご褒美なし</span>
                          )}
                          {log.penaltyAmount > 0 && (
                            <span className="text-rose-600 font-bold">未達成ペナルティ: -{log.penaltyAmount}円</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleApproveRoutine(log)}
                        disabled={approvingRoutineLogId === log.id}
                        className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition shrink-0 ml-2 flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {approvingRoutineLogId === log.id ? '承認中...' : '承認'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* お手伝い申請の未承認一覧 */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm mb-3">子どもからのお手伝い申請</h3>

              {pendingRequests.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">現在、確認まちのお手伝いはありません</p>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-slate-800 text-sm">{req.title}</h4>
                            {req.choreId === 'custom' && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                                ✨ 自由入力
                              </span>
                            )}
                          </div>
                          {req.choreId === 'custom' ? (
                            <p className="text-amber-600 font-bold text-xs mt-0.5">
                              承認時に金額を決定します
                            </p>
                          ) : (
                            <p className="text-indigo-600 font-extrabold text-xs">+{req.reward} 円</p>
                          )}
                          {req.comment && (
                            <p className="text-xs text-slate-500 mt-1 bg-white px-2.5 py-1 rounded-lg border border-slate-100">
                              こども: 「{req.comment}」
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1 border-t border-indigo-100/60">
                        <button
                          onClick={() => handleReject(req.id)}
                          className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition flex items-center justify-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> やり直し
                        </button>
                        <button
                          onClick={() => {
                            setApprovingId(req.id);
                            setBonusInput(0);
                            setCustomRewardInput(req.requestedReward || 50);
                            setParentCommentInput('');
                          }}
                          className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-1 shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" /> 承認する
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* ルーティン（いつもやること）の未実施一覧 */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 text-amber-700">
                  <Clock className="w-4 h-4 text-amber-600" />
                  本日のいつもやること（未実施: {uncompletedRoutines.length}件）
                </h3>
                <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                  今日対象: {todayScheduledRoutines.length}件
                </span>
              </div>

              {uncompletedRoutines.length === 0 ? (
                <div className="py-4 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500 font-bold">🎉 本日のいつもやることはすべて報告済みまたは完了しています！</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">未実施のタスクはありません。</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {uncompletedRoutines.map((routine) => (
                    <div
                      key={routine.id}
                      className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100/80 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800 text-xs">{routine.title}</span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.2 rounded-md">
                            未実施
                          </span>
                        </div>
                        <div className="text-[11px] mt-1 text-slate-500 flex items-center gap-2 flex-wrap">
                          {routine.reward > 0 ? (
                            <span className="text-emerald-700 font-bold">ご褒美: +{routine.reward}円</span>
                          ) : (
                            <span className="text-slate-400">ご褒美なし</span>
                          )}
                          {routine.penaltyAmount > 0 && (
                            <span className="text-rose-600 font-bold">未達成ペナルティ: -{routine.penaltyAmount}円</span>
                          )}
                          <span className="text-slate-400">
                            {routine.graceDays > 0 ? `猶予: あと${routine.graceDays}日` : '当日中'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-xl shrink-0">
                        子ども報告待ち
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- タブ2: いつもやること（ルーティンマスター設定） --- */}
        {activeTab === 'routines' && (
          <div className="space-y-4">
            {routineSavedSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl font-bold flex items-center gap-2 shadow-xs">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>「いつもやること」を保存しました！</span>
              </div>
            )}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">いつもおこなうこと（スケジュール）</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    毎日や月〜金、月1回などの習慣を設定し、期限超過でペナルティを課します。
                  </p>
                </div>
                <button
                  onClick={() => {
                    setRoutineError('');
                    setEditingRoutineData({
                      title: '',
                      reward: 0,
                      penaltyAmount: 30,
                      graceDays: 1,
                      scheduleType: 'daily',
                      active: true,
                    });
                    setRoutineDaysOfWeek([1, 2, 3, 4, 5]);
                    setRoutineDayOfMonth(1);
                    setRoutineNthWeek(1);
                    setRoutineNthWeekday(1);
                    setIsEditingRoutine(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-4 h-4" /> 新規作成
                </button>
              </div>

              <div className="space-y-2.5">
                {routines.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">まだ「いつもやること」が登録されていません</p>
                    <p className="text-[11px] text-slate-400 mt-1">上の「新規作成」ボタンから追加してください。</p>
                  </div>
                ) : (
                  routines.map((routine) => (
                    <div
                      key={routine.id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-xs text-slate-800">{routine.title}</h4>
                          <span className="text-[10px] bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                            {formatScheduleDescription(routine)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] mt-1.5">
                          {routine.reward > 0 ? (
                            <span className="text-emerald-700 font-extrabold">+{routine.reward} 円</span>
                          ) : null}
                          <span className="text-rose-600 font-extrabold">未達成: -{routine.penaltyAmount} 円</span>
                          <span className="text-slate-400">猶予: {routine.graceDays}日</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          onClick={() => {
                            setRoutineError('');
                            setEditingRoutineData(routine);
                            if (routine.scheduleConfig?.daysOfWeek) setRoutineDaysOfWeek(routine.scheduleConfig.daysOfWeek);
                            if (routine.scheduleConfig?.dayOfMonth) setRoutineDayOfMonth(routine.scheduleConfig.dayOfMonth);
                            if (routine.scheduleConfig?.nthWeek) setRoutineNthWeek(routine.scheduleConfig.nthWeek);
                            if (routine.scheduleConfig?.nthWeekday !== undefined) setRoutineNthWeekday(routine.scheduleConfig.nthWeekday);
                            setIsEditingRoutine(true);
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition flex items-center gap-1 border border-indigo-200/60 shadow-2xs"
                          title="このいつもやることを編集"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>編集</span>
                        </button>
                        <button
                          onClick={() => setDeletingRoutine(routine)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition border border-transparent hover:border-rose-100"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              </div>
            </div>
          )}

        {/* --- タブ3: 叱られたペナルティ（減額） --- */}
        {activeTab === 'penalty' && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 text-rose-600">
                <MinusCircle className="w-5 h-5" />
                叱られた内容と減額の登録
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                約束を守らなかったり叱られた際に、理由と金額を入力して残高から差し引きます。
              </p>
            </div>

            {penaltyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{penaltyError}</span>
              </div>
            )}

            {penaltySuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-bold">
                ✓ 減額（ペナルティ）を登録しました。
              </div>
            )}

            <form onSubmit={handlePenaltySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">理由・内容</label>
                <input
                  type="text"
                  required
                  placeholder="例: ゲームの時間を30分オーバーした"
                  value={penaltyReason}
                  onChange={(e) => setPenaltyReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">減額する金額 (円)</label>
                <div className="flex gap-2">
                  {[20, 50, 100].map((amt) => (
                    <button
                      type="button"
                      key={amt}
                      onClick={() => setPenaltyAmount(amt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        penaltyAmount === amt
                          ? 'border-rose-500 bg-rose-50 text-rose-600'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      -{amt}円
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  required
                  min={1}
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-400 mt-2"
                />
                {penaltyAmount < 1 && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">1円以上の金額を入力してください。</p>
                )}
              </div>

              {household.balance - penaltyAmount < 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>注意: 減額後の残高は0円になります（現在の残高: {household.balance}円）。</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!isPenaltyValid}
                className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-rose-200 transition"
              >
                減額を反映する
              </button>
            </form>
          </div>
        )}

        {/* --- タブ4: お小遣い使用（出金） --- */}
        {activeTab === 'spend' && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 text-indigo-600">
                <ShoppingBag className="w-5 h-5" />
                お小遣いを使った記録（出金）
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                実際にお金を使って買い物した際、バーチャル残高から差し引きます。
              </p>
            </div>

            {spendError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{spendError}</span>
              </div>
            )}

            {spendSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-bold">
                ✓ お小遣いの使用を記録しました。
              </div>
            )}

            <form onSubmit={handleSpendSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">買ったもの・使い道</label>
                <input
                  type="text"
                  required
                  placeholder="例: 駄菓子屋さんでお菓子を買った"
                  value={spendTitle}
                  onChange={(e) => setSpendTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700">使用した金額 (円)</label>
                  <span className="text-[11px] text-slate-400">現在の残高: {household.balance}円</span>
                </div>
                <input
                  type="number"
                  required
                  min={1}
                  max={household.balance}
                  value={spendAmount}
                  onChange={(e) => setSpendAmount(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-400"
                />
                {spendAmount > household.balance && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">残高を超えています。</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">出金の方法・渡し方</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSpendMethod('cash')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      spendMethod === 'cash'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>現金を渡した</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpendMethod('virtual')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      spendMethod === 'virtual'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>バーチャル残高のみ</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  ※親が代わりにオンライン等で購入した場合は「バーチャル残高のみ」を選択できます。
                </p>
              </div>

              <button
                type="submit"
                disabled={!isSpendValid}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-indigo-200 transition"
              >
                出金を反映する
              </button>
            </form>
          </div>
        )}

        {/* --- タブ5: お手伝いマスター設定 --- */}
        {activeTab === 'chores' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-sm">お手伝いマスター登録</h3>
                <button
                  onClick={() => {
                    setEditingChoreData({ title: '', reward: 30, icon: 'sparkles', description: '' });
                    setIsEditingChore(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> 新規追加
                </button>
              </div>

              <div className="space-y-2">
                {chores.map((chore) => (
                  <div
                    key={chore.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-slate-800">{chore.title}</h4>
                      <p className="text-[11px] text-indigo-600 font-extrabold">+{chore.reward} 円</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingChoreData(chore);
                          setIsEditingChore(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
                        title="編集"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingChore(chore)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50"
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- タブ6: 履歴（カレンダー / 検索） --- */}
        {activeTab === 'calendar' && (
          <div className="space-y-4">
            {/* カレンダー表示 / 検索表示 切り替えボタン */}
            <div className="flex bg-slate-200/80 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setHistorySubTab('calendar')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                  historySubTab === 'calendar'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                カレンダー表示
              </button>
              <button
                type="button"
                onClick={() => setHistorySubTab('search')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                  historySubTab === 'search'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                履歴を検索する
              </button>
            </div>

            {clearHistorySuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl font-bold flex items-center gap-2 shadow-xs">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>履歴をすべて削除しました。</span>
              </div>
            )}

            {historySubTab === 'calendar' ? (
              <CalendarView transactions={transactions} />
            ) : (
              <HistorySearchView transactions={transactions} variant="parent" />
            )}

            {/* 履歴の管理・全削除カード */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  履歴データの一括管理（保護者用）
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  カレンダーおよび月間サマリーに記録されているすべての収支履歴（{transactions.length}件）を消去します。
                </p>
              </div>
              <button
                onClick={() => setShowClearHistoryConfirm(true)}
                disabled={transactions.length === 0}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:hover:bg-rose-50 border border-rose-200 transition shrink-0 flex items-center gap-1 shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>履歴をすべて削除</span>
              </button>
            </div>
          </div>
        )}

        {/* --- タブ7: クラウド同期ステータス --- */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 text-indigo-700">
                <Cloud className="w-5 h-5" />
                クラウド同期（ファミリー連動）ステータス
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                お父さん・お母さん・お子さんの複数端末間でリアルタイムにお小遣いデータを共有する設定状況です。
              </p>
            </div>

            <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
              syncStatus === 'connected'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : syncStatus === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : syncStatus === 'syncing'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm">
                  {syncStatus === 'connected' && (
                    <>
                      <Cloud className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>☁️ クラウド同期：正常に接続中</span>
                    </>
                  )}
                  {syncStatus === 'syncing' && (
                    <>
                      <RefreshCw className="w-5 h-5 text-amber-600 shrink-0 animate-spin" />
                      <span>クラウド同期を確認中...</span>
                    </>
                  )}
                  {syncStatus === 'error' && (
                    <>
                      <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                      <span>⚠️ クラウド同期エラー（設定・権限）</span>
                    </>
                  )}
                  {syncStatus === 'local' && (
                    <>
                      <HardDrive className="w-5 h-5 text-slate-600 shrink-0" />
                      <span>💻 ローカル保存モードで動作中</span>
                    </>
                  )}
                </div>
                {syncStatus === 'error' && (
                  <button
                    type="button"
                    onClick={() => setShowRulesModal(true)}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-lg transition"
                  >
                    ルール設定手順
                  </button>
                )}
              </div>
              <p className="leading-relaxed text-[11px]">
                {syncStatus === 'connected' &&
                  'Firebaseクラウドに正常接続されています。親と子のすべての端末間で残高・お手伝い・履歴がリアルタイムに共有されます。'}
                {syncStatus === 'syncing' &&
                  'クラウドサーバーと接続確認を行っています。数秒お待ちください。'}
                {syncStatus === 'error' &&
                  'Firebaseには設定されていますが、Firestoreのセキュリティルールによりアクセスがブロックされているか、設定が誤っています。下の「ルール設定手順」を確認してください。'}
                {syncStatus === 'local' &&
                  '環境変数または手動設定が未登録のため、このブラウザローカル内のみで動作しています。複数端末で共有するには下記で設定を行ってください。'}
              </p>
            </div>

            {/* ファミリー招待・端末共有セクション */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-indigo-600" />
                  ファミリー招待・端末共有
                </h4>
                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-100/80 px-2 py-0.5 rounded-full">
                  合流用
                </span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                子ども端末やパートナーのスマートフォンに同じFirebase接続設定をワンタップで共有できます。
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyInviteUrl}
                  className="p-2.5 bg-white border border-indigo-200 hover:border-indigo-400 rounded-xl font-bold text-[11px] text-indigo-800 flex items-center justify-center gap-1.5 shadow-2xs transition"
                >
                  {copiedInviteUrl ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-indigo-600" />}
                  <span>{copiedInviteUrl ? 'URLコピー完了！' : '招待リンクをコピー'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyConfigCode}
                  className="p-2.5 bg-white border border-indigo-200 hover:border-indigo-400 rounded-xl font-bold text-[11px] text-indigo-800 flex items-center justify-center gap-1.5 shadow-2xs transition"
                >
                  {copiedConfigCode ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-indigo-600" />}
                  <span>{copiedConfigCode ? 'コードコピー完了！' : '設定コードをコピー'}</span>
                </button>
              </div>

              {/* 設定コード貼り付け・適用 */}
              <div className="pt-2 border-t border-indigo-100/80">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  ほかの端末から受け取った「設定コード」を貼り付けて合流:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pasteConfigCodeInput}
                    onChange={(e) => setPasteConfigCodeInput(e.target.value)}
                    placeholder="設定コードを貼り付け..."
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-mono focus:outline-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyConfigCode(pasteConfigCodeInput)}
                    disabled={!pasteConfigCodeInput.trim()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-[11px] rounded-xl transition shrink-0"
                  >
                    反映
                  </button>
                </div>
              </div>
            </div>

            {/* バックアップと復元（インポート）セクション */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3 text-xs">
              <h4 className="font-extrabold text-slate-800 flex items-center gap-1.5">
                <Download className="w-4 h-4 text-slate-600" />
                データのバックアップと復元
              </h4>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                全データ（残高・お手伝い・ルーティン・履歴）をJSONファイルとして保存したり、以前のファイルから復元できます。
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="flex-1 py-2 px-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-2xs"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>JSONバックアップ保存</span>
                </button>

                <label className="flex-1 py-2 px-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer">
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span>ファイルから復元</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </label>
              </div>
              {backupDownloaded && (
                <p className="text-[11px] text-emerald-600 font-bold">✓ バックアップJSONを保存しました</p>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <h4 className="font-bold text-slate-700">ログイン中のアカウント</h4>
              <p className="text-slate-600 font-mono text-[11px] bg-white p-2 rounded-xl border border-slate-200">
                {currentUser?.email || '親アカウント'}（保護者権限）
              </p>
              <p className="text-[10px] text-slate-400">
                ※お手伝いの承認や減額を行うと、操作した親のアカウントが履歴に自動記録されます。
              </p>
            </div>

            {/* 詳細設定アコーディオン */}
            <details className="text-xs border-t border-slate-100 pt-3 text-slate-500">
              <summary className="font-semibold cursor-pointer hover:text-indigo-600 py-1">
                ⚙️ 手動Firebase設定（上級者・直接入力）
              </summary>
              <form onSubmit={handleSaveFirebaseConfig} className="space-y-3 pt-3">
                {fbConfigMessage && (
                  <div className="p-2 bg-amber-50 text-amber-800 text-[11px] rounded-lg">
                    {fbConfigMessage}
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">API Key</label>
                  <input
                    type="text"
                    required
                    value={fbApiKey}
                    onChange={(e) => setFbApiKey(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border text-[11px] font-mono"
                    placeholder="AIzaSy..."
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Project ID</label>
                  <input
                    type="text"
                    required
                    value={fbProjectId}
                    onChange={(e) => setFbProjectId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border text-[11px] font-mono"
                    placeholder="your-project"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition"
                  >
                    設定を保存して再読込
                  </button>
                  {currentSavedConfig && (
                    <button
                      type="button"
                      onClick={handleClearFirebaseConfig}
                      className="py-2 px-3 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-300 transition"
                    >
                      リセット
                    </button>
                  )}
                </div>
              </form>
            </details>
          </div>
        )}
      </main>

      {/* 固定ボトムナビゲーションバー（6カラムでバランス配置） */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-2 px-2 z-30 shadow-lg">
        <div className="max-w-md mx-auto grid grid-cols-6 gap-0.5 text-center">
          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition relative ${
              activeTab === 'approvals' ? 'text-indigo-600 font-black' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Clock className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight">承認</span>
            {(pendingRequests.length > 0 || pendingRoutineLogs.length > 0) && (
              <span className="absolute top-0 right-1 bg-rose-500 text-white text-[9px] px-1 py-0.2 rounded-full font-black animate-pulse">
                {pendingRequests.length + pendingRoutineLogs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('routines')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition ${
              activeTab === 'routines' ? 'text-indigo-600 font-black' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <CheckSquare className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight">いつも</span>
          </button>

          <button
            onClick={() => setActiveTab('penalty')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition ${
              activeTab === 'penalty' ? 'text-rose-600 font-black' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <MinusCircle className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight">減額</span>
          </button>

          <button
            onClick={() => setActiveTab('spend')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition ${
              activeTab === 'spend' ? 'text-indigo-600 font-black' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <ShoppingBag className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight">出金</span>
          </button>

          <button
            onClick={() => setActiveTab('chores')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition ${
              activeTab === 'chores' ? 'text-indigo-600 font-black' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Settings className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight">お手伝い</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition ${
              activeTab === 'calendar' ? 'text-indigo-600 font-black' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] leading-tight">履歴</span>
          </button>
        </div>
      </nav>

      {/* 残高直接編集モーダル（親用） */}
      {isEditingBalance && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditingBalance(false);
          }}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl space-y-4 relative max-h-[85vh] overflow-y-auto my-auto">
            <button
              type="button"
              onClick={() => setIsEditingBalance(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-indigo-900 pr-6">
              <Coins className="w-5 h-5 text-indigo-600 shrink-0" />
              <h3 className="font-bold text-base">残高の直接変更</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              現在の残高（{household.balance}円）を任意の金額に直接変更します。差額は履歴に記録されます。
            </p>

            {balanceError && (
              <div className="p-2.5 bg-rose-50 text-rose-600 text-xs rounded-xl flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{balanceError}</span>
              </div>
            )}

            <form onSubmit={handleSaveBalance} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  新しい残高（円） <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-xl text-base font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  現在の残高との差額: {balanceInput - household.balance >= 0 ? `+${balanceInput - household.balance}` : `${balanceInput - household.balance}`} 円
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  変更理由・メモ（任意）
                </label>
                <input
                  type="text"
                  value={balanceReason}
                  onChange={(e) => setBalanceReason(e.target.value)}
                  placeholder="例: 臨時のお小遣い、計算調整"
                  className="w-full px-3 py-2 border rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingBalance(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={balanceInput < 0 || isNaN(balanceInput)}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-200 transition"
                >
                  更新する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 目標編集モーダル（親用） */}
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

            <h3 className="font-bold text-base text-slate-800 pr-6">子どもの目標を設定する</h3>
            {goalError && (
              <div className="p-2.5 bg-rose-50 text-rose-600 text-xs rounded-xl flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{goalError}</span>
              </div>
            )}
            <form onSubmit={handleSaveGoal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">目標の品名・こと</label>
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
                <label className="block text-xs font-semibold text-slate-500 mb-1">目標金額（円）</label>
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
                  className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-200"
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ルーティン編集モーダル */}
      {isEditingRoutine && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditingRoutine(false);
          }}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 my-8 relative max-h-[85vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsEditingRoutine(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-bold text-base text-slate-800 pr-6">
              {editingRoutineData.id ? '「いつもやること」の編集' : '新しい「いつもやること」を作成'}
            </h3>

            {routineError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{routineError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRoutine} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">タスク名</label>
                <input
                  type="text"
                  required
                  value={editingRoutineData.title || ''}
                  onChange={(e) => setEditingRoutineData({ ...editingRoutineData, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                  placeholder="例: 明日の学校の時間割チェック"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">スケジュール頻度</label>
                <select
                  value={editingRoutineData.scheduleType || 'daily'}
                  onChange={(e) => setEditingRoutineData({ ...editingRoutineData, scheduleType: e.target.value as ScheduleType })}
                  className="w-full px-3 py-2 border rounded-xl"
                >
                  <option value="daily">まいにち（毎日）</option>
                  <option value="weekdays">月〜金（平日のみ）</option>
                  <option value="weekly_days">曜日を指定する</option>
                  <option value="monthly_date">毎月決まった日（例: 毎月1日）</option>
                  <option value="monthly_end">毎月月末（月1回）</option>
                  <option value="monthly_nth_weekday">毎月第〇〇曜日（例: 第2月曜日）</option>
                </select>
              </div>

              {/* 曜日指定オプション */}
              {editingRoutineData.scheduleType === 'weekly_days' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">実施する曜日</label>
                  <div className="flex gap-1">
                    {['日', '月', '火', '水', '木', '金', '土'].map((name, idx) => {
                      const isSelected = routineDaysOfWeek.includes(idx);
                      return (
                        <button
                          type="button"
                          key={name}
                          onClick={() => {
                            if (isSelected) {
                              setRoutineDaysOfWeek(routineDaysOfWeek.filter((d) => d !== idx));
                            } else {
                              setRoutineDaysOfWeek([...routineDaysOfWeek, idx]);
                            }
                          }}
                          className={`flex-1 py-1.5 rounded-lg font-bold border transition ${
                            isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600'
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 毎月特定日オプション */}
              {editingRoutineData.scheduleType === 'monthly_date' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">毎月の日付（1〜31日）</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={routineDayOfMonth}
                    onChange={(e) => setRoutineDayOfMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              )}

              {/* 第〇〇曜日オプション */}
              {editingRoutineData.scheduleType === 'monthly_nth_weekday' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">何週目</label>
                    <select
                      value={routineNthWeek}
                      onChange={(e) => setRoutineNthWeek(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-xl"
                    >
                      <option value={1}>第1</option>
                      <option value={2}>第2</option>
                      <option value={3}>第3</option>
                      <option value={4}>第4</option>
                      <option value={5}>第5</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">曜日</label>
                    <select
                      value={routineNthWeekday}
                      onChange={(e) => setRoutineNthWeekday(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-xl"
                    >
                      <option value={1}>月曜日</option>
                      <option value={2}>火曜日</option>
                      <option value={3}>水曜日</option>
                      <option value={4}>木曜日</option>
                      <option value={5}>金曜日</option>
                      <option value={6}>土曜日</option>
                      <option value={0}>日曜日</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ご褒美金額（円）
                    <span className="text-[10px] text-slate-400 block font-normal">※0円ならご褒美なし</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingRoutineData.reward ?? 0}
                    onChange={(e) => setEditingRoutineData({ ...editingRoutineData, reward: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    未達成ペナルティ（円）
                    <span className="text-[10px] text-rose-500 block font-normal">超過時に引かれる額</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingRoutineData.penaltyAmount ?? 30}
                    onChange={(e) => setEditingRoutineData({ ...editingRoutineData, penaltyAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  承認の猶予日数
                </label>
                <select
                  value={editingRoutineData.graceDays ?? 1}
                  onChange={(e) => setEditingRoutineData({ ...editingRoutineData, graceDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-xl"
                >
                  <option value={0}>0日（当日23:59まで・推奨しません）</option>
                  <option value={1}>1日（翌日23:59まで猶予・推奨）</option>
                  <option value={2}>2日（2日後の23:59まで猶予）</option>
                  <option value={3}>3日（3日後の23:59まで猶予）</option>
                  <option value={7}>7日（1週間後の23:59まで猶予）</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  ※ 猶予期間の最終日 23:59（翌日0:00）を過ぎると、自動的に未達成ペナルティとして残高から減額されます。
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSavingRoutine}
                  onClick={() => setIsEditingRoutine(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSavingRoutine}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-200 transition disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {isSavingRoutine ? '保存中...' : '保存する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ルーティン削除確認モーダル */}
      {deletingRoutine && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingRoutine(null);
          }}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl space-y-4 text-center relative max-h-[85vh] overflow-y-auto my-auto">
            <button
              type="button"
              onClick={() => setDeletingRoutine(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-800">スケジュールの削除</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              「<span className="font-bold text-slate-700">{deletingRoutine.title}</span>」を削除してもよろしいですか？
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingRoutine}
                onClick={() => setDeletingRoutine(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isDeletingRoutine}
                onClick={confirmDeleteRoutine}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-md shadow-rose-200 transition disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isDeletingRoutine ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル（お手伝い） */}
      {deletingChore && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingChore(null);
          }}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl space-y-4 text-center relative max-h-[85vh] overflow-y-auto my-auto">
            <button
              type="button"
              onClick={() => setDeletingChore(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-800">お手伝いの削除</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              「<span className="font-bold text-slate-700">{deletingChore.title}</span>」を削除してもよろしいですか？
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingChore}
                onClick={() => setDeletingChore(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isDeletingChore}
                onClick={confirmDeleteChore}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-md shadow-rose-200 transition disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isDeletingChore ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 承認用モーダル */}
      {approvingId && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setApprovingId(null);
          }}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl space-y-4 relative max-h-[85vh] overflow-y-auto my-auto">
            <button
              type="button"
              onClick={() => setApprovingId(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-bold text-base text-slate-800 pr-6">
              {approvingReq?.choreId === 'custom' ? '自由入力お手伝いの承認' : 'お手伝いの承認'}
            </h3>
            {approvingReq && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1">
                <p className="text-[10px] text-slate-400 font-bold mb-0.5">申請された内容</p>
                <p className="font-bold text-slate-800">{approvingReq.title}</p>
                {approvingReq.comment && (
                  <p className="text-slate-500">「{approvingReq.comment}」</p>
                )}
                {approvingReq.choreId === 'custom' && approvingReq.requestedReward !== undefined && (
                  <p className="text-[11px] font-bold text-amber-700 bg-amber-100/70 p-1.5 rounded-lg border border-amber-200/60 mt-1">
                    子どもからの希望金額: {approvingReq.requestedReward} 円
                  </p>
                )}
              </div>
            )}
            <div className="space-y-3">
              {approvingReq?.choreId === 'custom' ? (
                <div>
                  <label className="block text-xs font-bold text-indigo-700 mb-1">
                    あげるご褒美の金額（円） <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    required
                    value={customRewardInput}
                    onChange={(e) => setCustomRewardInput(Number(e.target.value))}
                    className="w-full px-3 py-2 border-2 border-indigo-200 rounded-xl text-sm font-bold focus:border-indigo-500 focus:outline-none"
                    placeholder="例: 50"
                  />
                  {(customRewardInput < 1 || customRewardInput > 100000 || isNaN(customRewardInput)) && (
                    <p className="text-[10px] text-rose-500 font-bold mt-1">1円〜100,000円の範囲で入力してください。</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    ※ 承認するとこの金額が子どもの残高にプラスされます。
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    ボーナス加算（任意、円）
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={bonusInput}
                    onChange={(e) => setBonusInput(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                    placeholder="0"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  ほめ言葉・メッセージ（任意）
                </label>
                <input
                  type="text"
                  value={parentCommentInput}
                  onChange={(e) => setParentCommentInput(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                  placeholder="きれいにできたね！"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApprovingId(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={approvingReq?.choreId === 'custom' && (customRewardInput < 1 || customRewardInput > 100000 || isNaN(customRewardInput))}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  承認完了
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* マスター編集モーダル（お手伝い） */}
      {isEditingChore && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditingChore(false);
          }}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl space-y-4 relative max-h-[85vh] overflow-y-auto my-auto">
            <button
              type="button"
              onClick={() => setIsEditingChore(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-bold text-base text-slate-800 pr-6">
              {editingChoreData.id ? 'お手伝いの編集' : '新しいお手伝いを追加'}
            </h3>
            <form onSubmit={handleSaveChore} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">お手伝いのなまえ</label>
                <input
                  type="text"
                  required
                  value={editingChoreData.title}
                  onChange={(e) => setEditingChoreData({ ...editingChoreData, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                  placeholder="例: 玄関のくつ並べ"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">もらえる金額（円）</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={editingChoreData.reward}
                  onChange={(e) => setEditingChoreData({ ...editingChoreData, reward: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">アイコンタイプ</label>
                <select
                  value={editingChoreData.icon}
                  onChange={(e) => setEditingChoreData({ ...editingChoreData, icon: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                >
                  <option value="sparkles">キラキラ（汎用）</option>
                  <option value="bath">お風呂</option>
                  <option value="dish">食器・お皿</option>
                  <option value="trash">ゴミ</option>
                  <option value="shirt">洗濯・服</option>
                  <option value="book">勉強・本</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSavingChore}
                  onClick={() => setIsEditingChore(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSavingChore}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {isSavingChore ? '保存中...' : '保存する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 叱られ減額の二重確認モーダル */}
      {showPenaltyConfirm && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPenaltyConfirm(false);
          }}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl space-y-4 text-center relative max-h-[85vh] overflow-y-auto my-auto">
            <button
              type="button"
              onClick={() => setShowPenaltyConfirm(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-800">減額を実行しますか？</h3>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-left space-y-1">
              <p className="text-slate-500">
                <span className="font-bold text-slate-700">理由:</span> {penaltyReason}
              </p>
              <p className="text-rose-600 font-extrabold">
                減額金額: -{penaltyAmount} 円
              </p>
              <p className="text-slate-400 text-[11px] pt-1 border-t border-slate-200">
                減額後の残高: {Math.max(0, household.balance - penaltyAmount)} 円
                {household.balance - penaltyAmount < 0 && ' (0円になります)'}
              </p>
            </div>
            <p className="text-[11px] text-slate-400">
              ※お子さんとのお約束に基づき減額します。この操作は履歴に残ります。
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowPenaltyConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition"
              >
                もどる
              </button>
              <button
                type="button"
                onClick={confirmExecutePenalty}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md shadow-rose-200"
              >
                減額する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 履歴全削除確認モーダル（バックアップダウンロード付き） */}
      {showClearHistoryConfirm && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowClearHistoryConfirm(false);
          }}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl space-y-4 text-center relative max-h-[85vh] overflow-y-auto my-auto">
            <button
              type="button"
              disabled={isClearingHistory}
              onClick={() => setShowClearHistoryConfirm(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-800">すべての履歴を削除</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              登録されているすべての収支・お手伝い・ルーティン履歴（計 <span className="font-bold text-slate-700">{transactions.length}件</span>）を削除してもよろしいですか？
            </p>

            {/* 削除前バックアップダウンロードボタン */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-left">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  バックアップの保存
                </span>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold border border-indigo-200 transition"
                >
                  JSONダウンロード
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                ※削除前にデータをパソコンやスマホに保存しておくことを推奨します。
              </p>
              {backupDownloaded && (
                <p className="text-[10px] text-emerald-600 font-bold mt-1">
                  ✓ バックアップファイルをダウンロードしました
                </p>
              )}
            </div>

            <p className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded-xl font-medium">
              ※ この操作は取り消せません。現在の残高は変更されません。
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isClearingHistory}
                onClick={() => setShowClearHistoryConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isClearingHistory}
                onClick={handleExecuteClearAll}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md shadow-rose-200"
              >
                {isClearingHistory ? '削除中...' : 'すべて削除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Firestoreセキュリティルール設定モーダル */}
      {showRulesModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRulesModal(false);
          }}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 relative max-h-[85vh] overflow-y-auto my-auto text-left">
            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-800">Firestoreルール設定手順</h3>
                <p className="text-[11px] text-slate-400">同期エラーを解決する方法</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                Firebaseコンソールのセキュリティルールが拒否されているため、端末間の同期が失敗しています。
              </p>
              <ol className="list-decimal list-inside space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-[11px]">
                <li><a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold">Firebase Console</a> を開く</li>
                <li>プロジェクトを選択 &rarr; <span className="font-bold">Firestore Database</span> &rarr; <span className="font-bold">ルール (Rules)</span> を開く</li>
                <li>以下のコードを貼り付けて <span className="font-bold text-indigo-700">「公開 (Publish)」</span> をクリック</li>
              </ol>

              {/* ルールコードのコピーボックス */}
              <div className="relative bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[10px] overflow-x-auto">
                <pre>{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}</pre>
                <button
                  type="button"
                  onClick={() => {
                    const ruleCode = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}`;
                    navigator.clipboard.writeText(ruleCode);
                    setCopiedRules(true);
                    setTimeout(() => setCopiedRules(false), 3000);
                  }}
                  className="absolute top-2 right-2 px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[10px] font-sans flex items-center gap-1 transition"
                >
                  {copiedRules ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRules ? 'コピー済' : 'コピー'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-md shadow-indigo-200"
              >
                理解しました（閉じる）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
