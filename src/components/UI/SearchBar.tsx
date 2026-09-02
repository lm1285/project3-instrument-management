import React, { useState } from 'react';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (value: string) => void;
  defaultValue?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 搜索框组件
 * 提供搜索输入功能，支持回车搜索和实时搜索
 */
const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = '搜索...',
  onSearch,
  defaultValue = '',
  className = '',
  style,
}) => {
  const [searchValue, setSearchValue] = useState(defaultValue);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch(searchValue);
    }
  };

  const handleSearchClick = () => {
    onSearch(searchValue);
  };

  return (
    <div className={`${styles.searchContainer} ${className}`} style={style}>
      <input
        type="text"
        className={styles.searchInput}
        placeholder={placeholder}
        value={searchValue}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
      />
      <button 
        className={styles.searchButton} 
        onClick={handleSearchClick}
        aria-label="搜索"
      >
        🔍
      </button>
    </div>
  );
};

export default SearchBar;