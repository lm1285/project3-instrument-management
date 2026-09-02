import dbConfig from '../config/dbConfig';
import { listUsers } from './userService';

export interface SiteMessage {
  id: string;
  sender_id?: string;
  receiver_id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'error' | 'success';
  status: 'read' | 'unread';
  created_at: string;
  related_id?: string;
}

class SiteMessageService {
  private generateId(): string {
    return `MSG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send a message to a specific user
   */
  async sendMessage(
    receiverId: string,
    title: string,
    content: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info',
    senderId?: string,
    relatedId?: string
  ): Promise<SiteMessage> {
    const db = dbConfig.getConnection();
    const id = this.generateId();
    const now = new Date().toISOString();
    
    await db.run(
      `INSERT INTO site_messages (id, sender_id, receiver_id, title, content, type, status, created_at, related_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, senderId || null, receiverId, title, content, type, 'unread', now, relatedId || null]
    );

    return {
      id,
      sender_id: senderId,
      receiver_id: receiverId,
      title,
      content,
      type,
      status: 'unread',
      created_at: now,
      related_id: relatedId
    };
  }

  /**
   * Broadcast a message to all users with specific roles
   */
  async broadcastToRoles(
    roles: string[],
    title: string,
    content: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info',
    senderId?: string,
    relatedId?: string
  ): Promise<void> {
    try {
      // Get all users
      const allUsers = listUsers();
      
      // Filter users who have any of the target roles
      // Note: user.roles is an array, user.role is a string (primary role)
      // We should check both
      const targetUsers = allUsers.filter(u => {
        const userRoles = u.roles || [u.role];
        return roles.some(r => userRoles.includes(r));
      });

      // Send message to each target user
      for (const user of targetUsers) {
        await this.sendMessage(user.id, title, content, type, senderId, relatedId);
      }
    } catch (error) {
      console.error('Failed to broadcast message to roles:', error);
    }
  }

  /**
   * Get messages for a user
   */
  async getMessages(userId: string, status?: 'read' | 'unread'): Promise<SiteMessage[]> {
    const db = dbConfig.getConnection();
    let query = 'SELECT * FROM site_messages WHERE receiver_id = ?';
    const params: any[] = [userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    return await db.all(query, params);
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string, userId: string): Promise<boolean> {
    const db = dbConfig.getConnection();
    const result = await db.run(
      'UPDATE site_messages SET status = \'read\' WHERE id = ? AND receiver_id = ?',
      [messageId, userId]
    );
    return (result.changes || 0) > 0;
  }

  /**
   * Mark all messages as read for a user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    const db = dbConfig.getConnection();
    const result = await db.run(
      'UPDATE site_messages SET status = \'read\' WHERE receiver_id = ? AND status = \'unread\'',
      [userId]
    );
    return (result.changes || 0) > 0;
  }
  
  /**
   * Delete a message
   */
  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    const db = dbConfig.getConnection();
    const result = await db.run(
      'DELETE FROM site_messages WHERE id = ? AND receiver_id = ?',
      [messageId, userId]
    );
    return (result.changes || 0) > 0;
  }
}

export default new SiteMessageService();
