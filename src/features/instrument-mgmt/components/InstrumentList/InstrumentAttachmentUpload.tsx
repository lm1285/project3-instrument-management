import React from 'react';
import { Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';

const { Dragger } = Upload;

interface InstrumentAttachmentUploadProps {
  uploadProps: UploadProps;
  attachment?: File | string | null;
}

const InstrumentAttachmentUpload: React.FC<InstrumentAttachmentUploadProps> = ({
  uploadProps,
  attachment,
}) => {
  const fileList: UploadFile[] = attachment
    ? [{
        uid: '1',
        name: typeof attachment === 'string' ? attachment : attachment.name,
        status: 'done',
      }]
    : [];

  return (
    <div className="instrument-upload-shell">
      <Dragger {...uploadProps} fileList={fileList} className="instrument-upload-dragger">
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到这里上传</p>
        <p className="ant-upload-hint">支持单个附件上传，建议放入证书、说明书或采购资料</p>
      </Dragger>
    </div>
  );
};

export default InstrumentAttachmentUpload;
