// SearchBar组件，提供搜索功能
import React, { useState } from 'react';
import '../../styles/FormStyles.css';

const SearchBar = ({ onSearch, placeholder = '搜索...' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('all'); // 'all', 'name', 'model', 'serialNumber', 'location'

  // 处理搜索输入变化
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // 处理搜索类型变化
  const handleSearchTypeChange = (e) => {
    setSearchType(e.target.value);
  };

  // 执行搜索
  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({
        term: searchTerm.trim(),
        type: searchType
      });
    }
  };

  // 清除搜索
  const handleClear = () => {
    setSearchTerm('');
    if (onSearch) {
      onSearch({
        term: '',
        type: searchType
      });
    }
  };

  return (
    <form className="search-bar" onSubmit={handleSearch}>
      <div className="search-input-container">
        <input
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleSearchChange}
          aria-label="搜索输入框"
        />
        {searchTerm && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={handleClear}
            aria-label="清除搜索"
          >
            ×
          </button>
        )}
        <button
          type="submit"
          className="search-submit-btn"
          aria-label="搜索"
        >
          🔍
        </button>
      </div>
      
      <div className="search-options">
        <select
          className="search-type-select"
          value={searchType}
          onChange={handleSearchTypeChange}
          aria-label="搜索类型选择"
        >
          <option value="all">全部字段</option>
          <option value="name">仪器名称</option>
          <option value="model">型号</option>
          <option value="serialNumber">序列号</option>
          <option value="manufacturer">生产厂商</option>
          <option value="location">存放位置</option>
          <option value="responsiblePerson">负责人</option>
        </select>
      </div>
    </form>
  );
};

export default SearchBar;