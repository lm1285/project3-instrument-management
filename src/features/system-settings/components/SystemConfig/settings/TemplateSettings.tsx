import React from 'react';
import { Alert, App, Button, Collapse, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, Upload } from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileExcelOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { PermissionGuard } from '../../../../auth/components/PermissionGuard';
import { INSTRUMENT_FIELDS } from '../../../../instrument-mgmt/constants';
import { TemplateItem } from '../../../../../types/common';
import {
  EXCEL_TEMPLATE_TYPE,
  TEMPLATE_FUNCTION_OPTIONS,
  TEMPLATE_TYPE_OPTIONS,
} from './templateSettingsUtils';
import { useTemplateSettingsManager } from './useTemplateSettingsManager';

const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;

const TemplateSettings: React.FC = () => {
  const { message } = App.useApp();
  const {
    contextHolder,
    editingTemplate,
    form,
    handleAdd,
    handleDelete,
    handleDownload,
    handleEdit,
    handleFileUpload,
    handleOk,
    isModalVisible,
    setIsModalVisible,
    tempFile,
    templateType,
    templates,
  } = useTemplateSettingsManager();

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '对应功能',
      dataIndex: 'relatedFunction',
      key: 'relatedFunction',
      width: 180,
      render: (text: string) => (text ? <Tag color="orange">{text}</Tag> : '-'),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (text: string) => <Tag color={text === EXCEL_TEMPLATE_TYPE ? 'green' : 'blue'}>{text}</Tag>,
    },
    {
      title: '内容/文件',
      key: 'content',
      ellipsis: true,
      render: (_value: unknown, record: TemplateItem) => {
        if (record.type === EXCEL_TEMPLATE_TYPE) {
          return (
            <Space>
              <FileExcelOutlined style={{ color: 'green' }} />
              {record.fileName}
              <PermissionGuard permission="system:template:download">
                <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record)}>
                  下载
                </Button>
              </PermissionGuard>
            </Space>
          );
        }

        return record.content;
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_value: unknown, record: TemplateItem) => (
        <Space size="middle">
          <PermissionGuard permission="system:template:edit">
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="system:template:delete">
            <Popconfirm title="确定要删除这个模板吗？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
              <Button type="text" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 24px' }}>
      {contextHolder}

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          模板管理
        </Title>
        <PermissionGuard permission="system:template:add">
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建模板
          </Button>
        </PermissionGuard>
      </div>

      <Table columns={columns} dataSource={templates} rowKey="id" pagination={{ pageSize: 10 }} />

      <Modal
        title={editingTemplate ? '编辑模板' : '新建模板'}
        open={isModalVisible}
        onOk={handleOk}
        okText="保存"
        cancelText="取消"
        onCancel={() => setIsModalVisible(false)}
        width={700}
        forceRender
      >
        <Form form={form} layout="vertical" initialValues={{ type: '通知' }}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="例如：超期预警通知 / 检定证书模板" />
          </Form.Item>

          <Form.Item name="relatedFunction" label="对应功能">
            <Select placeholder="请选择对应功能（可选）" allowClear>
              {TEMPLATE_FUNCTION_OPTIONS.map((option) => (
                <Option key={option} value={option}>
                  {option}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="type" label="模板类型" rules={[{ required: true, message: '请选择模板类型' }]}>
            <Select>
              {TEMPLATE_TYPE_OPTIONS.map((option) => (
                <Option key={option} value={option}>
                  {option}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {templateType === EXCEL_TEMPLATE_TYPE ? (
            <>
              <Form.Item label="Excel 模板文件" required>
                <Upload beforeUpload={handleFileUpload} showUploadList={false} accept=".xlsx,.xls">
                  <Button icon={<UploadOutlined />}>{tempFile ? '重新上传文件' : '上传 Excel 文件'}</Button>
                </Upload>
                {tempFile && (
                  <div style={{ marginTop: 8 }}>
                    <Tag icon={<FileExcelOutlined />} color="green">
                      {tempFile.name}
                    </Tag>
                  </div>
                )}
              </Form.Item>

              <Form.Item name="content" label="备注说明">
                <TextArea rows={2} placeholder="关于此模板的说明..." />
              </Form.Item>

              <Alert
                message="如何制作 Excel 模板？"
                description="请在 Excel 单元格中使用 {{字段名}} 作为占位符，系统生成文件时会自动替换成实际数据。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Collapse
                size="small"
                items={[
                  {
                    key: '1',
                    label: '可用字段对照表（点击复制）',
                    children: (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {INSTRUMENT_FIELDS.map((field: any) => (
                          <Tag
                            key={field.key}
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              const placeholder = `{{${field.key}}}`;
                              navigator.clipboard.writeText(placeholder);
                              message.success('已复制到剪贴板');
                            }}
                          >
                            <b>{`{{${field.key}}}`}</b> : {field.label}
                          </Tag>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            </>
          ) : (
            <Form.Item name="content" label="模板内容" rules={[{ required: true, message: '请输入模板内容' }]}>
              <TextArea rows={6} placeholder="在此输入模板内容..." showCount maxLength={1000} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default TemplateSettings;
