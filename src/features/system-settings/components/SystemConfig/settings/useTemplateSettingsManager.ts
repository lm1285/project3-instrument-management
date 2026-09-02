import { App, Form, Modal, Upload } from 'antd';
import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { TemplateItem } from '../../../../../types/common';
import { useSystemSettings } from '../../../hooks/useSystemSettings';
import {
  createMissingDefaultTemplates,
  DEFAULT_TEMPLATE_TYPE,
  downloadTemplateFile,
  EXCEL_TEMPLATE_TYPE,
  isExcelFile,
  readFileAsBase64,
} from './templateSettingsUtils';

export function useTemplateSettingsManager() {
  const { message } = App.useApp();
  const [settings, setSettings] = useSystemSettings();
  const [modal, contextHolder] = Modal.useModal();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null);
  const [tempFile, setTempFile] = useState<{ name: string; data: string } | null>(null);
  const [form] = Form.useForm();
  const initializedRef = useRef(false);
  const templateType = Form.useWatch('type', form);

  const templates = settings.templates || [];

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    const missingTemplates = createMissingDefaultTemplates(templates);

    if (missingTemplates.length > 0) {
      setSettings((previousSettings) => ({
        ...previousSettings,
        templates: [...(previousSettings.templates || []), ...missingTemplates],
      }));
    }
  }, [setSettings, templates]);

  const handleAdd = () => {
    setEditingTemplate(null);
    setTempFile(null);
    form.resetFields();
    form.setFieldsValue({ type: DEFAULT_TEMPLATE_TYPE });
    setIsModalVisible(true);
  };

  const handleEdit = (record: TemplateItem) => {
    setEditingTemplate(record);
    setTempFile(record.fileName && record.fileData ? { name: record.fileName, data: record.fileData } : null);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleDelete = (id: string) => {
    setSettings({ ...settings, templates: templates.filter((template) => template.id !== id) });
    message.success('模板已删除');
  };

  const handleFileUpload = (file: File) => {
    if (!isExcelFile(file)) {
      message.error('只能上传 Excel 文件');
      return Upload.LIST_IGNORE as any;
    }

    modal.confirm({
      title: '确认上传',
      content: `确定要上传文件 "${file.name}" 吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const base64 = await readFileAsBase64(file);
          setTempFile({ name: file.name, data: base64 });
          message.success(`${file.name} 已准备好上传`);
        } catch (error) {
          message.error('文件读取失败');
        }
      },
    });

    return false;
  };

  const handleDownload = (record: TemplateItem) => {
    if (!record.fileData || !record.fileName) {
      message.error('该模板没有关联文件');
      return;
    }

    downloadTemplateFile(record.fileName, record.fileData);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

      if (values.type === EXCEL_TEMPLATE_TYPE && !tempFile) {
        message.error('请上传 Excel 模板文件');
        return;
      }

      const templateData = {
        ...values,
        fileName: values.type === EXCEL_TEMPLATE_TYPE ? tempFile?.name : undefined,
        fileData: values.type === EXCEL_TEMPLATE_TYPE ? tempFile?.data : undefined,
      };

      const nextTemplates = editingTemplate
        ? templates.map((template) =>
            template.id === editingTemplate.id
              ? { ...template, ...templateData, updatedAt: now }
              : template,
          )
        : [
            ...templates,
            {
              id: `${Date.now()}`,
              ...templateData,
              createdAt: now,
              updatedAt: now,
            } as TemplateItem,
          ];

      setSettings({ ...settings, templates: nextTemplates });
      setIsModalVisible(false);
      message.success(editingTemplate ? '模板更新成功' : '模板添加成功');
    } catch (error) {
      console.error('Template validation failed', error);
    }
  };

  return {
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
  };
}
