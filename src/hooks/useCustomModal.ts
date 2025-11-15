/**
 * useCustomModal Hook
 *
 * A React hook that provides easy-to-use methods for displaying custom modals.
 * This hook manages the modal state and provides convenience methods for
 * different modal types (success, error, warning, info, confirm).
 *
 * @module hooks/useCustomModal
 */

import { useState, useCallback } from "react";
import type { ModalConfig, ModalState, ModalMethods } from "../types/modal";

/**
 * useCustomModal Hook
 *
 * Manages modal state and provides convenience methods for showing different
 * types of modals.
 *
 * @returns Object containing modal state and methods
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const modal = useCustomModal();
 *
 *   const handleDelete = () => {
 *     modal.showConfirm(
 *       "Delete Profile",
 *       "Are you sure you want to delete this profile? This action cannot be undone.",
 *       () => {
 *         // Delete confirmed
 *         deleteProfile();
 *       }
 *     );
 *   };
 *
 *   const handleSuccess = () => {
 *     modal.showSuccess(
 *       "Success",
 *       "Profile saved successfully!"
 *     );
 *   };
 *
 *   return (
 *     <>
 *       <Button onPress={handleDelete} title="Delete" />
 *       <Button onPress={handleSuccess} title="Save" />
 *       <CustomModal
 *         visible={modal.visible}
 *         config={modal.config}
 *         onDismiss={modal.hideModal}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function useCustomModal(): ModalState & ModalMethods {
  const [state, setState] = useState<ModalState>({
    visible: false,
    config: null,
  });

  /**
   * Show a modal with custom configuration
   */
  const showModal = useCallback((config: ModalConfig) => {
    setState({
      visible: true,
      config,
    });
  }, []);

  /**
   * Hide the currently visible modal
   */
  const hideModal = useCallback(() => {
    setState({
      visible: false,
      config: null,
    });
  }, []);

  /**
   * Show a success modal with a single OK button
   */
  const showSuccess = useCallback(
    (title: string, message: string, onPress?: () => void) => {
      showModal({
        type: "success",
        title,
        message,
        buttons: [
          {
            text: "OK",
            onPress,
            style: "default",
          },
        ],
        dismissable: true,
      });
    },
    [showModal]
  );

  /**
   * Show an error modal with a single OK button
   */
  const showError = useCallback(
    (title: string, message: string, onPress?: () => void) => {
      showModal({
        type: "error",
        title,
        message,
        buttons: [
          {
            text: "OK",
            onPress,
            style: "default",
          },
        ],
        dismissable: true,
      });
    },
    [showModal]
  );

  /**
   * Show a warning modal with a single OK button
   */
  const showWarning = useCallback(
    (title: string, message: string, onPress?: () => void) => {
      showModal({
        type: "warning",
        title,
        message,
        buttons: [
          {
            text: "OK",
            onPress,
            style: "default",
          },
        ],
        dismissable: true,
      });
    },
    [showModal]
  );

  /**
   * Show an info modal with a single OK button
   */
  const showInfo = useCallback(
    (title: string, message: string, onPress?: () => void) => {
      showModal({
        type: "info",
        title,
        message,
        buttons: [
          {
            text: "OK",
            onPress,
            style: "default",
          },
        ],
        dismissable: true,
      });
    },
    [showModal]
  );

  /**
   * Show a confirmation modal with Cancel and Confirm buttons
   */
  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      onCancel?: () => void,
      confirmText: string = "Confirm",
      cancelText: string = "Cancel"
    ) => {
      showModal({
        type: "confirm",
        title,
        message,
        buttons: [
          {
            text: cancelText,
            onPress: onCancel,
            style: "cancel",
          },
          {
            text: confirmText,
            onPress: onConfirm,
            style: "default",
          },
        ],
        dismissable: false,
      });
    },
    [showModal]
  );

  return {
    ...state,
    showModal,
    hideModal,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm,
  };
}
