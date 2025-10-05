import React, { useState, useEffect } from 'react';
import pinyin from 'pinyin';
import '../styles/FormStyles.css';

const SearchBar = ({ 
  value, 
  onChange, 
  placeholder = '搜索...', 
  onSearch, 
  storage, 
  maxSuggestions = 10 
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 处理输入变化并生成搜索建议
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // 生成搜索建议
    if (newValue.trim().length > 0 && storage && storage.search) {
      const results = storage.search(newValue);
      const allValues = new Set();
      
      results.forEach(item => {
        Object.values(item).forEach(val => {
          if (typeof val === 'string' && val.length > 0) {
            allValues.add(val);
          }
        });
      });
      
      const suggestionList = Array.from(allValues)
        .filter(val => 
          val.toLowerCase().includes(newValue.toLowerCase()) ||
          pinyin(val, { style: pinyin.STYLE_NORMAL, heteronym: false }).join('').toLowerCase().includes(newValue.toLowerCase())
        )
        .slice(0, maxSuggestions);
      
      setSuggestions(suggestionList);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // 选择建议项
  const handleSuggestionClick = (suggestion) => {
    onChange(suggestion);
    setShowSuggestions(false);
    if (onSearch) {
      onSearch(suggestion);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="search-bar-container">
      <div className="search-input-wrapper">
        <input
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={handleKeyDown}
        />
        <div className="search-icon">🔍</div>
      </div>
      
      {/* 搜索建议下拉菜单 */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="search-suggestions">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="suggestion-item"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;