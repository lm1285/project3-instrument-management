import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/MainPage.css'

function TestFormatting() {
  const navigate = useNavigate()
  const [inputText, setInputText] = useState('H_2O是水的化学式，10^-6表示百万分之一，这是*斜体文本*的示例')
  const [formattedText, setFormattedText] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600)

  // 文本格式处理函数 - 现在直接使用HTML标签，不再进行符号转换
  const formatText = (text) => {
    if (!text || typeof text !== 'string') return text || '-';
    
    // 直接返回原始文本，因为现在用户会直接输入HTML标签
    return text;
  };

  // 实时格式化输入文本
  useEffect(() => {
    const result = formatText(inputText);
    setFormattedText(result);
  }, [inputText]);

  // 示例格式选项 - 现在使用HTML标签格式
  const formatExamples = [
    { label: 'H<sub>2</sub>O (水的化学式)', text: 'H<sub>2</sub>O' },
    { label: '10<sup>-6</sup> (百万分之一)', text: '10<sup>-6</sup>' },
    { label: '<em>斜体文本</em>', text: '<em>斜体文本</em>' },
    { label: 'U<sub>rel</sub>=0.3 (带等号的下标格式)', text: 'U<sub>rel</sub>=0.3' },
    { label: '混合格式: E=mc<sup>2</sup> 是<em>相对论</em>的核心公式', text: 'E=mc<sup>2</sup> 是<em>相对论</em>的核心公式' }
  ];

  // 处理示例点击
  const handleExampleClick = (text) => {
    setInputText(text);
  };

  // 处理窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 600)
      if (window.innerWidth > 600) {
        setSidebarOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 切换侧边栏
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  // 返回主页面
  const goBack = () => {
    navigate('/main')
  }

  return (
    <div className="main-container">
      <header className="main-header">
        <div className="header-left">
          {isMobile && (
            <button className="menu-toggle" onClick={toggleSidebar}>
              ☰
            </button>
          )}
          <h1>文本格式测试</h1>
        </div>
        <div className="header-right">
          <button className="logout-button" onClick={goBack}>
            返回主页面
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="formatting-test-container">
          <div className="test-section">
            <h2>格式测试工具</h2>
            <p>请在下方输入框中输入文本，并使用以下格式标记:</p>
            <ul className="format-guide">
              <li>上标: 使用 ^ 符号，如 10^-6</li>
              <li>下标: 使用 _ 符号，如 H_2O 或 U_rel_=0.3</li>
              <li>斜体: 使用 * 符号包围文本，如 *斜体文本*</li>
            </ul>
          </div>

          <div className="input-section">
            <label htmlFor="formatInput">输入文本:</label>
            <textarea
              id="formatInput"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows="4"
              placeholder="输入带有格式标记的文本..."
            />
          </div>

          <div className="preview-section">
            <h3>预览结果:</h3>
            <div 
              className="formatted-preview"
              dangerouslySetInnerHTML={{ __html: formattedText }}
            />
            <div className="raw-html-section">
              <h4>生成的HTML:</h4>
              <pre>{formattedText}</pre>
            </div>
          </div>

          <div className="examples-section">
            <h3>示例格式:</h3>
            <div className="examples-grid">
              {formatExamples.map((example, index) => (
                <div key={index} className="example-item">
                  <button 
                    className="example-button"
                    onClick={() => handleExampleClick(example.text)}
                  >
                    {example.label}
                  </button>
                  <div 
                    className="example-preview"
                    dangerouslySetInnerHTML={{ __html: formatText(example.text) }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="tips-section">
            <h3>使用提示:</h3>
            <ul>
              <li>现在直接使用HTML标签进行格式化，例如: 斜体使用&lt;em&gt;文本&lt;/em&gt;, 上标使用&lt;sup&gt;文本&lt;/sup&gt;, 下标使用&lt;sub&gt;文本&lt;/sub&gt;</li>
              <li>示例: H&lt;sub&gt;2&lt;/sub&gt;SO&lt;sub&gt;4&lt;/sub&gt; 分子包含&lt;em&gt;氢&lt;/em&gt;、&lt;em&gt;硫&lt;/em&gt;和&lt;em&gt;氧&lt;/em&gt;元素</li>
              <li>确保HTML标签正确配对，所有文本字段都会保留并显示这些HTML标签</li>
            </ul>
          </div>
        </div>
      </main>

      <footer className="main-footer">
        <p>&copy; 2025 标准器/物质管理系统</p>
      </footer>
    </div>
  )
}

export default TestFormatting