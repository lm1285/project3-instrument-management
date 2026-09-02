import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { QrReader } from 'react-qr-reader';
import jsQR from 'jsqr';
import { message } from 'antd';
import { CloseOutlined, PictureOutlined, CameraOutlined } from '@ant-design/icons';
import './WeChatLikeScanner.css';

interface WeChatLikeScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const WeChatLikeScanner: React.FC<WeChatLikeScannerProps> = ({ onScan, onClose }) => {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 确保组件挂载时让所有输入框失焦，防止软键盘弹出
  React.useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  const handleScan = (result: any, error: any) => {
    if (result) {
      // result is usually an object from @zxing/library
      const text = result?.getText?.() || result?.text || result?.data;
      if (text) {
        if (navigator.vibrate) {
          navigator.vibrate(200);
        }
        onScan(text);
      }
    }
    // error is logged frequently when no QR code is found, so we usually ignore it
    // unless it's a permission error or something serious
    if (error) {
       // Only capture serious errors if needed, but for now we ignore scanning noise
       // console.info(error);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 清除input的值，允许重复选择同一文件
    event.target.value = '';

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 计算缩放比例，限制最大边长为 1000px，避免大图导致卡死
        const maxDimension = 1000;
        let width = img.width;
        let height = img.height;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.floor((height / width) * maxDimension);
            width = maxDimension;
          } else {
            width = Math.floor((width / height) * maxDimension);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          try {
            const imageData = ctx.getImageData(0, 0, width, height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
              onScan(code.data);
            } else {
              message.error('无法识别图片中的二维码');
            }
          } catch (error) {
            console.error('QR code processing error:', error);
            message.error('处理图片时出错');
          }
        }
      };
      img.onerror = () => {
        message.error('加载图片失败');
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      message.error('读取文件失败');
    };
    reader.readAsDataURL(file);
  };

  return ReactDOM.createPortal(
    <div className="scanner-overlay">
      <div className="close-btn" onClick={onClose}>
        <CloseOutlined />
      </div>
      
      <div className="scanner-tip">将二维码放入框内，即可自动扫描</div>

      <div className="scanner-container">
        {/* QrReader Container */}
        <div className="scanner-camera-wrapper">
             <QrReader
                key={facingMode}
                constraints={{ facingMode: facingMode }}
                onResult={handleScan}
                className="scanner-video"
                videoStyle={{ objectFit: 'cover', width: '100%', height: '100%' }}
                containerStyle={{ width: '100%', height: '100%', paddingTop: 0 }}
                ViewFinder={() => null} 
             />
        </div>

        {/* Mask Overlay */}
        <div className="scanner-mask-overlay">
          <div className="mask-top"></div>
          <div className="mask-middle">
            <div className="mask-left"></div>
            <div className="scan-area">
              <div className="corner corner-tl"></div>
              <div className="corner corner-tr"></div>
              <div className="corner corner-bl"></div>
              <div className="corner corner-br"></div>
              <div className="scan-line"></div>
            </div>
            <div className="mask-right"></div>
          </div>
          <div className="mask-bottom"></div>
        </div>
      </div>

      <div className="scanner-controls">
        <button className="control-btn" onClick={() => fileInputRef.current?.click()}>
          <div className="control-icon"><PictureOutlined /></div>
          <span className="control-text">相册</span>
        </button>
        <button className="control-btn" onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}>
          <div className="control-icon"><CameraOutlined /></div>
          <span className="control-text">翻转</span>
        </button>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="image/*" 
        onChange={handleImageUpload} 
      />
    </div>,
    document.body
  );
};

export default WeChatLikeScanner;
