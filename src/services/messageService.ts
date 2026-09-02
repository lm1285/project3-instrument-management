import apiClient from './apiClient';

export interface InternalMessage {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'error' | 'success';
  status: 'read' | 'unread';
  createTime: string;
  relatedId?: string;
  source?: 'alert' | 'instrument' | 'backend';
}

type BackendMessage = {
  id: string;
  title: string;
  content: string;
  type?: InternalMessage['type'];
  status?: InternalMessage['status'];
  created_at: string;
  related_id?: string;
};

const STORAGE_KEY = 'instrument_app_internal_messages';
const UPDATE_EVENT_NAME = 'internal-messages-updated';
const BACKEND_MESSAGE_PREFIX = 'MSG-';

const ALERT_TITLES = {
  overdue: '\u8d85\u671f\u9884\u8b66',
  upcoming: '\u9884\u5230\u671f\u9884\u8b66',
  lowStock: '\u5e93\u5b58\u4e0d\u8db3\u9884\u8b66',
  fallback: '\u7cfb\u7edf\u9884\u8b66',
} as const;

function generateId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function isBackendMessage(id: string) {
  return id.startsWith(BACKEND_MESSAGE_PREFIX);
}

function resolveAlertTitle(alert: any) {
  const alertType = String(alert.alertType || alert.alert_type || '');

  if (alertType.includes('\u8d85\u671f')) {
    return ALERT_TITLES.overdue;
  }

  if (alertType.includes('\u9884\u5230\u671f')) {
    return ALERT_TITLES.upcoming;
  }

  if (alertType.includes('\u5e93\u5b58')) {
    return ALERT_TITLES.lowStock;
  }

  return alertType || ALERT_TITLES.fallback;
}

function toInternalBackendMessage(message: BackendMessage): InternalMessage {
  return {
    id: message.id,
    title: message.title,
    content: message.content,
    type: message.type || 'info',
    status: message.status || 'unread',
    createTime: message.created_at,
    relatedId: message.related_id,
    source: 'backend',
  };
}

class MessageService {
  private readMessages(): InternalMessage[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse messages from storage', error);
      return [];
    }
  }

  private writeMessages(messages: InternalMessage[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      window.dispatchEvent(new Event(UPDATE_EVENT_NAME));
    } catch (error) {
      console.error('Failed to save messages to storage', error);
    }
  }

  private updateMessages(updater: (messages: InternalMessage[]) => InternalMessage[]) {
    const nextMessages = updater(this.readMessages());
    this.writeMessages(nextMessages);
    return nextMessages;
  }

  getMessages() {
    return this.readMessages().sort(
      (left, right) => new Date(right.createTime).getTime() - new Date(left.createTime).getTime(),
    );
  }

  getUnreadCount() {
    return this.readMessages().filter((message) => message.status === 'unread').length;
  }

  addMessage(message: Omit<InternalMessage, 'id' | 'createTime' | 'status'>) {
    const nextMessage: InternalMessage = {
      ...message,
      id: generateId(),
      createTime: new Date().toISOString(),
      status: 'unread',
    };

    this.updateMessages((messages) => [nextMessage, ...messages]);
    return nextMessage;
  }

  markAsRead(id: string) {
    let changed = false;

    this.updateMessages((messages) =>
      messages.map((message) => {
        if (message.id !== id || message.status === 'read') {
          return message;
        }

        changed = true;
        return { ...message, status: 'read' };
      }),
    );

    if (changed && isBackendMessage(id)) {
      apiClient.put(`/messages/${id}/read`).catch((error: any) => {
        console.error('Failed to mark backend message as read', error);
      });
    }
  }

  markAllAsRead() {
    this.updateMessages((messages) => messages.map((message) => ({ ...message, status: 'read' })));
    apiClient.put('/messages/read-all').catch((error: any) => {
      console.error('Failed to mark all backend messages as read', error);
    });
  }

  deleteMessage(id: string) {
    this.updateMessages((messages) => messages.filter((message) => message.id !== id));

    if (isBackendMessage(id)) {
      apiClient.delete(`/messages/${id}`).catch((error: any) => {
        console.error('Failed to delete backend message', error);
      });
    }
  }

  async syncBackendMessages() {
    try {
      const response = await apiClient.get<BackendMessage[]>('/messages');
      if (!response.success || !Array.isArray(response.data)) {
        return;
      }

      this.updateMessages((messages) => {
        const messageMap = new Map(messages.map((message) => [message.id, message]));

        response.data!.forEach((backendMessage) => {
          const nextMessage = toInternalBackendMessage(backendMessage);
          const currentMessage = messageMap.get(nextMessage.id);

          if (!currentMessage) {
            messageMap.set(nextMessage.id, nextMessage);
            return;
          }

          if (currentMessage.status !== nextMessage.status) {
            messageMap.set(nextMessage.id, { ...currentMessage, status: nextMessage.status });
          }
        });

        return Array.from(messageMap.values()).sort(
          (left, right) => new Date(right.createTime).getTime() - new Date(left.createTime).getTime(),
        );
      });
    } catch (error) {
      console.error('Failed to sync backend messages', error);
    }
  }

  clearAll() {
    this.writeMessages([]);
  }

  syncAlerts(alerts: any[]) {
    if (!Array.isArray(alerts) || alerts.length === 0) {
      return;
    }

    this.updateMessages((messages) => {
      const existingAlertIds = new Set(
        messages
          .filter((message) => message.source === 'alert' && message.relatedId)
          .map((message) => message.relatedId),
      );

      const nextMessages = [...messages];

      alerts.forEach((alert) => {
        if (!alert.id || existingAlertIds.has(String(alert.id))) {
          return;
        }

        const title = resolveAlertTitle(alert);
        nextMessages.unshift({
          id: generateId(),
          title,
          content: `${title}: ${alert.name || '\u672a\u77e5\u4eea\u5668'} (${alert.model || '-'}) - ${alert.message || '\u8bf7\u53ca\u65f6\u5904\u7406'}`,
          type: 'warning',
          status: 'unread',
          createTime: new Date().toISOString(),
          relatedId: String(alert.id),
          source: 'alert',
        });

        existingAlertIds.add(String(alert.id));
      });

      return nextMessages;
    });
  }
}

export const messageService = new MessageService();
