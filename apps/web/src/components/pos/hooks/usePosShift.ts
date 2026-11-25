import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { createIdempotencyKey } from '../../../lib/api';
import { posShiftService } from '../../../services/posShiftService';
import type {
  PosActiveShiftOverview,
  PosShiftRecord,
  ToastMessage,
} from '../../../types';
import { formatMoney, getChileTodayIso } from '../../../utils/formatters';
import { printShiftReceipt } from '../posPrint';

const EMPTY_SHIFT_OVERVIEW: PosActiveShiftOverview = {
  hasOpenShift: false,
  activeShiftId: null,
  shiftNumber: null,
  openedAt: null,
  openedByName: null,
  openingCash: 0,
  totalSales: 0,
  transactionsCount: 0,
  cashSalesTotal: 0,
  cardPosTotal: 0,
  debitTotal: 0,
  creditTotal: 0,
  transferTotal: 0,
  expectedCash: 0,
  lastClosedShift: null,
};

interface UsePosShiftOptions {
  isAdmin: boolean;
  isOnline?: boolean;
  addToastRef: MutableRefObject<(toast: Omit<ToastMessage, 'id'>) => void>;
}

/**
 * Encapsula la carga de turno activo, fondo inicial, historial de arqueos
 * y cierre idempotente de caja en POS.
 */
export function usePosShift({
  isAdmin,
  isOnline = true,
  addToastRef,
}: UsePosShiftOptions) {
  const [shiftOverview, setShiftOverview] =
    useState<PosActiveShiftOverview>(EMPTY_SHIFT_OVERVIEW);
  const todayKey = shiftOverview.businessDate ?? getChileTodayIso();
  const [shiftsHistory, setShiftsHistory] = useState<PosShiftRecord[]>([]);
  const [isLoadingShift, setIsLoadingShift] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('0');
  const [isSavingOpeningCash, setIsSavingOpeningCash] = useState(false);

  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('0');
  const [closeNotes, setCloseNotes] = useState('');
  const [printOnClose, setPrintOnClose] = useState(true);
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [lastReceiptShift, setLastReceiptShift] =
    useState<PosShiftRecord | null>(null);

  const closeShiftIdempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    closeShiftIdempotencyKeyRef.current = null;
  }, [countedCashInput, closeNotes]);

  const loadShiftSummary = useCallback(
    async (silent = false) => {
      if (!silent) {
        setIsLoadingShift(true);
      }
      try {
        const [overview, history] = await Promise.all([
          posShiftService.getActiveOverview(),
          posShiftService.getShifts(),
        ]);
        setShiftOverview(overview);
        setOpeningCashInput(String(overview.openingCash));
        setShiftsHistory(history);
      } catch (err: unknown) {
        if (!silent) {
          addToastRef.current({
            type: 'error',
            title: 'Error al consultar turno de caja',
            message:
              err instanceof Error
                ? err.message
                : 'No se pudo obtener el estado actual de la caja.',
          });
        }
      } finally {
        if (!silent) {
          setIsLoadingShift(false);
        }
      }
    },
    [addToastRef],
  );

  const parsedOpeningCash = Math.max(0, Number(openingCashInput) || 0);
  const savedOpeningCash = Math.max(0, Number(shiftOverview.openingCash || 0));
  const expectedCashPreview = savedOpeningCash + shiftOverview.cashSalesTotal;
  const hasClosingActivity =
    shiftOverview.hasOpenShift ||
    shiftOverview.transactionsCount > 0 ||
    savedOpeningCash > 0;
  const parsedCountedCash = Math.max(0, Number(countedCashInput) || 0);
  const modalCashDiff = parsedCountedCash - expectedCashPreview;
  const isOpeningCashDirty = parsedOpeningCash !== savedOpeningCash;

  const handleSaveOpeningCash = useCallback(async () => {
    if (isSavingOpeningCash) return;
    if (!isOnline) {
      addToastRef.current({
        type: 'error',
        title: 'Sin conexión con el servidor',
        message: 'Restablece la conexión antes de guardar el fondo inicial.',
      });
      return;
    }
    setIsSavingOpeningCash(true);
    try {
      const updated = await posShiftService.updateOpeningCash({
        openingCash: parsedOpeningCash,
      });
      setShiftOverview(updated);
      setOpeningCashInput(String(updated.openingCash));
      addToastRef.current({
        type: 'success',
        title: 'Fondo inicial guardado',
        message: `Fondo en gaveta registrado en ${formatMoney(updated.openingCash)}.`,
      });
    } catch (error) {
      addToastRef.current({
        type: 'error',
        title: 'No se pudo guardar el fondo inicial',
        message:
          error instanceof Error
            ? error.message
            : 'Inténtalo nuevamente en unos segundos.',
      });
    } finally {
      setIsSavingOpeningCash(false);
    }
  }, [isSavingOpeningCash, isOnline, parsedOpeningCash, addToastRef]);

  const openCloseShiftModal = useCallback(() => {
    closeShiftIdempotencyKeyRef.current = null;
    setCountedCashInput(String(expectedCashPreview));
    setCloseNotes('');
    setPrintOnClose(true);
    setIsCloseModalOpen(true);
  }, [expectedCashPreview]);

  const handlePrintShift = useCallback(
    (target: PosShiftRecord) => {
      const ok = printShiftReceipt(target);
      if (!ok) {
        addToastRef.current({
          type: 'warning',
          title: 'Ventana bloqueada',
          message: 'Permite las ventanas emergentes del navegador para imprimir.',
        });
      }
    },
    [addToastRef],
  );

  const handleConfirmCloseShift = useCallback(async () => {
    if (isClosingShift) return;
    if (!isOnline) {
      addToastRef.current({
        type: 'error',
        title: 'Sin conexión con el servidor',
        message: 'Restablece la conexión antes de cerrar el turno de caja.',
      });
      return;
    }
    setIsClosingShift(true);
    try {
      const idempotencyKey =
        closeShiftIdempotencyKeyRef.current ?? createIdempotencyKey();
      closeShiftIdempotencyKeyRef.current = idempotencyKey;

      const closedShift = await posShiftService.closeShift(
        {
          countedCash: parsedCountedCash,
          notes: closeNotes.trim() || undefined,
        },
        idempotencyKey,
      );
      closeShiftIdempotencyKeyRef.current = null;

      setIsCloseModalOpen(false);
      setLastReceiptShift(closedShift);
      await loadShiftSummary();

      let printed = true;
      if (printOnClose) {
        printed = printShiftReceipt(closedShift);
      }

      if (isAdmin && closedShift.accountingWarning) {
        addToastRef.current({
          type: 'warning',
          title: `Turno #${closedShift.shiftNumber} cerrado (caja reiniciada)`,
          message: closedShift.accountingWarning,
        });
      } else if (printOnClose && !printed) {
        addToastRef.current({
          type: 'info',
          title: `¡Turno #${closedShift.shiftNumber} cerrado y caja en $0!`,
          message:
            'El navegador bloqueó la ventana de impresión. Usa "Reimprimir Comprobante" en el historial de arqueos.',
        });
      } else {
        const diff = Number(closedShift.cashDifference ?? 0);
        const diffDesc =
          Math.abs(diff) < 0.01
            ? 'Cuadratura exacta ($0).'
            : diff > 0
              ? `Sobrante de +${formatMoney(diff)}${
                  closedShift.closingEntryNumber
                    ? ` (Asiento #${closedShift.closingEntryNumber})`
                    : ''
                }.`
              : `Faltante de ${formatMoney(-Math.abs(diff))}${
                  closedShift.closingEntryNumber
                    ? ` (Asiento #${closedShift.closingEntryNumber})`
                    : ''
                }.`;

        addToastRef.current({
          type: 'success',
          title: `¡Turno #${closedShift.shiftNumber} cerrado y caja reiniciada!`,
          message: `${diffDesc} Indicadores de efectivo y POS reiniciados en $0.`,
        });
      }
    } catch (error) {
      addToastRef.current({
        type: 'error',
        title: 'No se pudo cerrar el turno',
        message:
          error instanceof Error
            ? error.message
            : 'Ocurrió un error al generar el arqueo de caja.',
      });
    } finally {
      setIsClosingShift(false);
    }
  }, [
    isClosingShift,
    isOnline,
    parsedCountedCash,
    closeNotes,
    loadShiftSummary,
    printOnClose,
    isAdmin,
    addToastRef,
  ]);

  return {
    shiftOverview,
    todayKey,
    shiftsHistory,
    isLoadingShift,
    openingCashInput,
    setOpeningCashInput,
    isSavingOpeningCash,
    isCloseModalOpen,
    setIsCloseModalOpen,
    countedCashInput,
    setCountedCashInput,
    closeNotes,
    setCloseNotes,
    printOnClose,
    setPrintOnClose,
    isClosingShift,
    lastReceiptShift,
    savedOpeningCash,
    expectedCashPreview,
    hasClosingActivity,
    modalCashDiff,
    isOpeningCashDirty,
    loadShiftSummary,
    handleSaveOpeningCash,
    openCloseShiftModal,
    handlePrintShift,
    handleConfirmCloseShift,
  };
}
