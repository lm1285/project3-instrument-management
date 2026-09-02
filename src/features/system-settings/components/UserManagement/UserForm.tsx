import React, { useEffect, useState } from 'react';
import { App, Form, Input, Modal, Select } from 'antd';
import { DEPARTMENT_SELECT_OPTIONS } from '../../../../constants/departmentOptions';
import { createUser, updateUser } from '../../services/userService';

interface UserFormProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  editingUser?: {
    id: string;
    username: string;
    role: string;
    roles?: string[];
    department?: string;
  } | null;
}

const UserForm: React.FC<UserFormProps> = ({ visible, onCancel, onSuccess, editingUser }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    form.resetFields();
    form.setFieldsValue({
      username: editingUser?.username,
      department: editingUser?.department || undefined,
    });
  }, [editingUser, form, visible]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (editingUser) {
        await updateUser(editingUser.id, {
          username: values.username,
          department: values.department || '',
          ...(values.password ? { password: values.password } : {}),
        });
        message.success('用户信息已更新');
      } else {
        await createUser({
          username: values.username,
          password: values.password,
          role: 'engineer',
          department: values.department || '',
        });
        message.success('用户创建成功，默认角色为工程师');
      }

      onSuccess();
      onCancel();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }

      message.error(error?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={editingUser ? '编辑用户' : '新增用户'}
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText={editingUser ? '保存修改' : '创建用户'}
      cancelText="取消"
      confirmLoading={loading}
      destroyOnHidden
      forceRender
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="username"
          label="用户名"
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input placeholder="请输入用户名" />
        </Form.Item>

        <Form.Item
          name="department"
          label="所属科室"
          rules={[{ required: true, message: '请选择所属科室' }]}
          extra="影刀联用模块会根据这里的科室控制页面可见范围。"
        >
          <Select
            options={DEPARTMENT_SELECT_OPTIONS}
            placeholder="请选择所属科室"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label={editingUser ? '登录密码' : '初始密码'}
          rules={[{ required: !editingUser, message: '请输入密码' }]}
          extra={editingUser ? '如不修改密码可留空。' : '创建后可在权限配置中调整角色与权限。'}
        >
          <Input.Password placeholder={editingUser ? '留空则不修改' : '请输入密码'} />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="确认密码"
          dependencies={['password']}
          hasFeedback
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                const password = getFieldValue('password');
                if (!password && editingUser) {
                  return Promise.resolve();
                }
                if (!password) {
                  return Promise.reject(new Error('请再次输入密码'));
                }
                if (value !== password) {
                  return Promise.reject(new Error('两次输入的密码不一致'));
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <Input.Password placeholder="请再次输入密码" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default UserForm;
