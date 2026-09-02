import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Modal, Tag } from 'antd';
import {
  CheckCircleOutlined,
  CheckOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import styles from './MessagesPage.module.css';
import { messageService, InternalMessage } from '../../../services/messageService';

interface MessagesModalProps {
  visible: boolean;
  onClose: () => void;
}

type FilterKey = 'all' | 'unread' | 'read';

const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部消息' },
  { key: 'unread', label: '未读消息' },
  { key: 'read', label: '已读消息' },
];

const MessagesModal: React.FC<MessagesModalProps> = ({ visible, onClose }) => {
  const { message: antMessage, modal } = App.useApp();
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const loadMessages = () => {
    setMessages(messageService.getMessages());
  };

  useEffect(() => {
    if (visible) {
      loadMessages();
      setActiveFilter('all');
    }
  }, [visible]);

  useEffect(() => {
    const handleUpdate = () => {
      if (visible) {
        loadMessages();
      }
    };

    window.addEventListener('internal-messages-updated', handleUpdate);
    return () => window.removeEventListener('internal-messages-updated', handleUpdate);
  }, [visible]);

  const unreadCount = useMemo(
    () => messages.filter((item) => item.status === 'unread').length,
    [messages],
  );

  const filteredMessages = useMemo(() => {
    if (activeFilter === 'unread') {
      return messages.filter((item) => item.status === 'unread');
    }

    if (activeFilter === 'read') {
      return messages.filter((item) => item.status === 'read');
    }

    return messages;
  }, [activeFilter, messages]);

  const handleMarkAllRead = () => {
    messageService.markAllAsRead();
    antMessage.success('已全部标记为已读');
    loadMessages();
  };

  const handleClearAll = () => {
    modal.confirm({
      title: '确认清空站内信',
      content: '清空后将移除当前全部站内信记录，是否继续？',
      okText: '确认清空',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        messageService.clearAll();
        antMessage.success('已清空全部消息');
        loadMessages();
      },
    });
  };

  const handleItemClick = (msg: InternalMessage) => {
    if (msg.status === 'unread') {
      messageService.markAsRead(msg.id);
      loadMessages();
    }
  };

  const handleDelete = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    messageService.deleteMessage(id);
    antMessage.success('消息已删除');
    loadMessages();
  };

  const getIcon = (type: InternalMessage['type']) => {
    switch (type) {
      case 'warning':
        return <WarningOutlined className={styles.iconWarning} />;
      case 'error':
        return <ExclamationCircleOutlined className={styles.iconError} />;
      case 'success':
        return <CheckCircleOutlined className={styles.iconSuccess} />;
      default:
        return <InfoCircleOutlined className={styles.iconInfo} />;
    }
  };

  const getTypeLabel = (type: InternalMessage['type']) => {
    switch (type) {
      case 'warning':
        return '提醒';
      case 'error':
        return '告警';
      case 'success':
        return '成功';
      default:
        return '通知';
    }
  };

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      title={null}
      centered
      width={720}
      className={styles.modal}
      styles={{ body: { padding: 0 } }}
    >
      <div className={styles.modalShell}>
        <div className={styles.modalHeader}>
          <div className={styles.headerMain}>
            <div>
              <div className={styles.headerEyebrow}>Internal Messages</div>
              <h2 className={styles.headerTitle}>站内信通知</h2>
              <p className={styles.headerSubtitle}>集中查看通知、提醒与系统消息，支持快速处理未读内容。</p>
            </div>
            <div className={styles.headerStats}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>未读</span>
                <strong className={styles.statValue}>{unreadCount}</strong>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>总计</span>
                <strong className={styles.statValue}>{messages.length}</strong>
              </div>
            </div>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.filterGroup}>
              {FILTER_OPTIONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`${styles.filterButton} ${activeFilter === item.key ? styles.filterButtonActive : ''}`}
                  onClick={() => setActiveFilter(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className={styles.actionGroup}>
              <Button
                icon={<CheckOutlined />}
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
              >
                全部已读
              </Button>
              <Button
                icon={<DeleteOutlined />}
                danger
                onClick={handleClearAll}
                disabled={messages.length === 0}
              >
                清空全部
              </Button>
            </div>
          </div>
        </div>

        <div className={styles.modalBody}>
          {filteredMessages.length === 0 ? (
            <div className={styles.emptyState}>
              <Empty
                description={messages.length === 0 ? '当前没有站内信' : '当前筛选条件下没有消息'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          ) : (
            <div className={styles.messageList}>
              {filteredMessages.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  className={`${styles.messageCard} ${msg.status === 'unread' ? styles.messageCardUnread : ''}`}
                  onClick={() => handleItemClick(msg)}
                >
                  <div className={styles.messageMain}>
                    <div className={styles.messageIconWrap}>
                      {getIcon(msg.type)}
                    </div>

                    <div className={styles.messageContent}>
                      <div className={styles.messageMeta}>
                        <div className={styles.messageTitleRow}>
                          <span className={styles.messageTitle}>{msg.title}</span>
                          <Tag bordered={false} color={msg.status === 'unread' ? 'processing' : 'default'}>
                            {msg.status === 'unread' ? '未读' : '已读'}
                          </Tag>
                          <Tag bordered={false}>{getTypeLabel(msg.type)}</Tag>
                        </div>
                        <span className={styles.messageTime}>{formatTime(msg.createTime)}</span>
                      </div>
                      <p className={styles.messageText}>{msg.content}</p>
                    </div>
                  </div>

                  <div className={styles.messageActions}>
                    {msg.status === 'unread' && <span className={styles.unreadDot} />}
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      size="small"
                      onClick={(event) => handleDelete(event, msg.id)}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default MessagesModal;
