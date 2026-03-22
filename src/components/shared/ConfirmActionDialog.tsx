"use client";

import React from "react";
import { MdClose, MdWarningAmber } from "react-icons/md";
import styles from "./ConfirmActionDialog.module.css";

type ConfirmActionDialogProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isConfirmLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmActionDialog: React.FC<ConfirmActionDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = "Xoá",
  cancelLabel = "Huỷ",
  isConfirmLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  };

  return (
    <div
      className={styles["confirm-action-dialog"]}
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div className={styles["confirm-action-dialog__backdrop"]} />
      <div className={styles["confirm-action-dialog__panel"]}>
        <button
          type="button"
          className={styles["confirm-action-dialog__close-button"]}
          onClick={onCancel}
          aria-label="Đóng"
        >
          <MdClose />
        </button>
        <div className={styles["confirm-action-dialog__body"]}>
          <div className={styles["confirm-action-dialog__icon-wrapper"]}>
            <div className={styles["confirm-action-dialog__icon"]}>
              <MdWarningAmber />
            </div>
          </div>
          <h3 className={styles["confirm-action-dialog__title"]}>{title}</h3>
          {description && (
            <p className={styles["confirm-action-dialog__description"]}>
              {description}
            </p>
          )}
          <div className={styles["confirm-action-dialog__actions"]}>
            <button
              type="button"
              className={styles["confirm-action-dialog__primary-button"]}
              onClick={onConfirm}
              disabled={isConfirmLoading}
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              className={styles["confirm-action-dialog__secondary-button"]}
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
          </div>
        </div>
        <div className={styles["confirm-action-dialog__bottom-bar"]}>
          <div
            className={styles["confirm-action-dialog__bottom-bar-inner"]}
          />
        </div>
      </div>
    </div>
  );
};

export default ConfirmActionDialog;

