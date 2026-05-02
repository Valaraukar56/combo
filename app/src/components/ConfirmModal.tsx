import { Button, Modal, SectionHeading } from './ui';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  /** Defaults to "Annuler" */
  cancelLabel?: string;
  /** Defaults to "Confirmer" */
  confirmLabel?: string;
  /** When true, the confirm button uses the danger variant. Default: false. */
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Generic two-button confirmation dialog. Wraps the existing `Modal` so it
 * picks up the same animations and overlay treatment as the rest of the UI.
 * Use `destructive` for irreversible actions (leave room mid-game, etc.) so
 * the primary action gets the crimson treatment.
 */
export function ConfirmModal({
  open,
  title,
  message,
  cancelLabel = 'Annuler',
  confirmLabel = 'Confirmer',
  destructive = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onCancel} width={440}>
      <SectionHeading title={title} level="h2" />
      <p
        style={{
          marginTop: 16,
          fontSize: 14,
          color: 'var(--ink-2)',
          lineHeight: 1.55,
        }}
      >
        {message}
      </p>
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: 28,
          justifyContent: 'flex-end',
        }}
      >
        <Button variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
